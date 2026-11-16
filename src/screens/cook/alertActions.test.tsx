// Done and +15 min tapped on a step notification while the app was closed or in the background (mockup 14;
// the notification itself is native). The taps wait in the phone's queue; at start and on coming back to the
// front the app reads the queue (`useAlarmWiring`), applies them to the cook, replaces the alarm set once and
// Live cook says what changed until OK.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAlarmWiring } from '@/lib/alarmWiring';
import { dueAt, pending, type ActiveCook } from '@/lib/cook';
import { fakeAlarms, fakeResume, type FakeAlarms } from '@/platform/fakes';
import type { NotificationAction } from '@/platform/types';
import { AT_1023, MIN, cookAt } from '@/test/cook';
import { storeWrapper, testRepos } from '@/test/store';
import { CookScreen } from './CookScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const WRAP = 'phase:b:wrap'; // "Check the brisket", due 11:35 AM
const AT_1135 = AT_1023 + 72 * MIN;
const tap = (type: NotificationAction['type'], at: number, keys = [WRAP]): NotificationAction => ({
  type,
  alarmId: 'a1',
  keys,
  at,
});

/** The app as the root layout wires it: the alarm wiring and Live cook over one store. */
function App({ alarms, onResume, now }: { alarms: FakeAlarms; onResume: CookResume; now: () => number }) {
  useAlarmWiring(alarms, onResume, () => {});
  return <CookScreen permissions={alarms} onResume={onResume} onGoPlan={() => {}} now={now} />;
}
type CookResume = ReturnType<typeof fakeResume>['onResume'];

/** Start the app at `at` with `queued` taps already waiting on the phone. */
async function start(cook: ActiveCook, at: number, queued: NotificationAction[] = []) {
  const r = testRepos();
  r.repos.activeCook.save(cook, AT_1023);
  const alarms = fakeAlarms();
  alarms.queued = queued;
  const resume = fakeResume();
  const clock = { now: at };
  await render(<App alarms={alarms} onResume={resume.onResume} now={() => clock.now} />, {
    wrapper: storeWrapper(r.repos, () => clock.now, alarms),
  });
  await waitFor(() => expect(alarms.sets.length).toBeGreaterThan(0));
  await act(async () => {});
  return { repos: r.repos, alarms, resume, clock };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('taps made while the app was closed, applied at start', () => {
  test('Done: the step is done at the time of the tap, Next up moves on and the notice says so', async () => {
    const { repos, alarms } = await start(cookAt(AT_1023), AT_1135 + 20 * MIN, [tap('done', AT_1135 + MIN)]);
    expect(repos.activeCook.load()!.done[WRAP]).toBe(AT_1135 + MIN);
    expect(screen.getByText('Check the brisket: done at 11:36 AM from the alert.')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: /^Wings on the smoker on a wire rack in / })).toBeOnTheScreen();
    expect(screen.queryByText(/^Overdue since/)).toBeNull();
    // One whole set for the changed cook, and the done step's repeats are stopped.
    expect(alarms.sets).toHaveLength(1);
    expect(alarms.calls.filter(c => c.startsWith('acknowledge')).at(-1)).toContain(WRAP);
    expect(alarms.sets[0]!.flatMap(a => a.keys)).not.toContain(WRAP);
  });

  test('+15 min: the step is due 15 min later, still Next up, and the notice says so', async () => {
    const cook = cookAt(AT_1023);
    const { repos, alarms } = await start(cook, AT_1135 + 5 * MIN, [tap('snooze15', AT_1135 + MIN)]);
    const saved = repos.activeCook.load()!;
    const next = pending(saved)[0]!;
    expect(next.key).toBe(WRAP);
    expect(dueAt(saved, next)).toBeGreaterThanOrEqual(AT_1135 + 15 * MIN);
    expect(saved.done[WRAP]).toBeUndefined();
    expect(screen.getByText(/^Check the brisket: moved 15 min from the alert\./)).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: /^Check the brisket in \d+ min$/ })).toBeOnTheScreen();
    expect(alarms.sets).toHaveLength(1);
    expect(alarms.sets[0]!.some(a => a.keys.includes(WRAP) && a.at === dueAt(saved, next))).toBe(true);
  });

  test('OK clears the notice and it does not come back at the next start', async () => {
    const { repos } = await start(cookAt(AT_1023), AT_1135 + 20 * MIN, [tap('done', AT_1135 + MIN)]);
    await fireEvent.press(button('OK'));
    await act(async () => {});
    expect(screen.queryByText(/from the alert/)).toBeNull();
    expect(repos.activeCook.load()!.notice).toBeNull();
    expect(repos.activeCook.load()!.done[WRAP]).toBe(AT_1135 + MIN);
  });

  test('+15 that moves serve: the one new alarm set has the wings and the breasts at their new times (T-076)', async () => {
    // The brisket's pull check at 3:40 PM put off four times; taps 3 and 4 move serve 15 min each.
    const PULL = 'pull:b:';
    const AT_340 = AT_1023 + 317 * MIN;
    const cook = { ...cookAt(AT_1023), done: { ...cookAt(AT_1023).done, [WRAP]: AT_1135 } };
    const taps = [0, 1, 2, 3].map(i => tap('snooze15', AT_340 + i * 15 * MIN, [PULL]));
    const { repos, alarms } = await start(cook, AT_340 + 46 * MIN, taps);
    expect(repos.activeCook.load()!.plan.serveAt).toBe(AT_340 + 110 * MIN); // 5:30 PM
    expect(screen.getByText(/Serve moved to 5:30 PM\. The other foods moved with it\.$/)).toBeOnTheScreen();
    expect(alarms.sets).toHaveLength(1);
    const ringsAt = (key: string) => alarms.sets[0]!.find(a => a.keys.includes(key))?.at;
    expect(ringsAt('phase:w:crisp')).toBe(AT_340 + 70 * MIN); // 4:50 PM, was 4:20
    expect(ringsAt('griddleOn::')).toBe(AT_340 + 75 * MIN); // 4:55 PM, was 4:25
    expect(ringsAt('phase:c:cook')).toBe(AT_340 + 90 * MIN); // 5:10 PM, was 4:40
    expect(ringsAt('pull:c:')).toBe(AT_340 + 102 * MIN); // 5:22 PM, was 4:52
    expect(ringsAt('pull:w:')).toBe(AT_340 + 105 * MIN); // 5:25 PM, was 4:55
    expect(ringsAt('serve::')).toBe(AT_340 + 110 * MIN);
  });

  test('Open changes nothing and shows no notice', async () => {
    const { repos, alarms } = await start(cookAt(AT_1023), AT_1135 + 5 * MIN, [tap('open', AT_1135 + MIN)]);
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(screen.queryByText(/from the alert/)).toBeNull();
    expect(screen.getByText('Overdue since 11:35 AM')).toBeOnTheScreen();
    expect(alarms.sets).toHaveLength(1); // the set every start puts back
  });
});

describe('taps made with the app in the background, applied on resume', () => {
  test('Done from the shade: Live cook is overdue until the app is back in front, then moves on with the notice', async () => {
    const { repos, alarms, resume, clock } = await start(cookAt(AT_1023), AT_1023);
    expect(alarms.sets).toHaveLength(1);
    expect(screen.getByText('Check at 11:35 AM')).toBeOnTheScreen();

    clock.now = AT_1135 + 12 * MIN;
    alarms.queued = [tap('done', AT_1135 + 2 * MIN)];
    await act(async () => resume.resume());
    await waitFor(() => expect(alarms.sets).toHaveLength(2));
    expect(alarms.queued).toEqual([]);
    expect(repos.activeCook.load()!.done[WRAP]).toBe(AT_1135 + 2 * MIN);
    expect(screen.getByText('Check the brisket: done at 11:37 AM from the alert.')).toBeOnTheScreen();
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.getByRole('heading', { name: /^Wings on the smoker on a wire rack in / })).toBeOnTheScreen();
  });

  test('+15 then Done on the same step, read together: applied in the order they were tapped', async () => {
    const { repos, alarms, resume, clock } = await start(cookAt(AT_1023), AT_1023);
    clock.now = AT_1135 + 30 * MIN;
    // Queued out of order on purpose.
    alarms.queued = [tap('done', AT_1135 + 16 * MIN), tap('snooze15', AT_1135 + MIN)];
    await act(async () => resume.resume());
    await waitFor(() => expect(alarms.sets).toHaveLength(2));
    const saved = repos.activeCook.load()!;
    expect(saved.done[WRAP]).toBe(AT_1135 + 16 * MIN);
    expect(saved.reminders[WRAP]).toBeUndefined();
    expect(saved.notice).toMatch(
      /^Check the brisket: moved 15 min from the alert\..*Check the brisket: done at 11:51 AM from the alert\./,
    );
    expect(screen.getByText(/done at 11:51 AM from the alert\./)).toBeOnTheScreen();
  });

  test('coming back with nothing tapped changes nothing: no notice, no new alarm set', async () => {
    const { repos, alarms, resume, clock } = await start(cookAt(AT_1023), AT_1023);
    clock.now = AT_1135 + 12 * MIN;
    await act(async () => resume.resume());
    await act(async () => {});
    expect(alarms.sets).toHaveLength(1);
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(screen.queryByText(/from the alert/)).toBeNull();
    // Overdue and counting (SPEC section 6).
    expect(screen.getByText('Overdue since 11:35 AM')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Check the brisket, 12 min overdue' })).toBeOnTheScreen();
    clock.now += 10 * MIN;
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByRole('heading', { name: 'Check the brisket, 22 min overdue' })).toBeOnTheScreen();
  });
});
