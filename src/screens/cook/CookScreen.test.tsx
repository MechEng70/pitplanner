import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { ActiveCook } from '@/lib/cook';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { AT_1023, MIN, cookAt, cookGear, cookMenu } from '@/test/cook';
import { storeWrapper, testRepos } from '@/test/store';
import { ALERTS_OFF, CookScreen } from './CookScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** The Cook tab over a real database, with the fake phone alarms and a clock the test moves. */
async function show(cook: ActiveCook | null, at = AT_1023) {
  const r = testRepos();
  r.repos.cookers.save(cookGear, at);
  r.repos.settings.setDraft({ mode: 'readyBy', at: Date.UTC(2026, 10, 14, 22, 0), pitTempF: 225, items: cookMenu }, at);
  if (cook) r.repos.activeCook.save(cook, at);
  const alarms = fakeAlarms();
  const resume = fakeResume();
  const clock = { now: at };
  const onGoPlan = jest.fn();
  await render(
    <CookScreen permissions={alarms} onResume={resume.onResume} onGoPlan={onGoPlan} now={() => clock.now} />,
    { wrapper: storeWrapper(r.repos, () => clock.now, alarms) },
  );
  return { repos: r.repos, alarms, resume, clock, onGoPlan };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const replaced = (calls: string[]) => calls.filter(c => c.startsWith('replaceAll')).length;

describe('no cook running (T-064)', () => {
  // 0.2.0 started a cook when the Cook tab was opened with food on the plan, so a discarded cook came back
  // on the next look (Jason's phone, 2026-11-15).
  test('says so and sends the user to Plan; food on the plan never starts a cook', async () => {
    const { repos, alarms, onGoPlan } = await show(null);
    expect(screen.getByRole('heading', { name: 'Cook' })).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'No cook running' })).toBeOnTheScreen();
    expect(
      screen.getByText('Start a cook from the Plan tab. Each step shows up here as it comes due.'),
    ).toBeOnTheScreen();
    await fireEvent.press(button('Go to Plan'));
    expect(onGoPlan).toHaveBeenCalledTimes(1);
    expect(repos.activeCook.load()).toBeNull();
    expect(alarms.calls).toEqual([]);
  });
});

describe('live cook (mockup 12)', () => {
  test('header, status, Next up worded as a check, the countdown and the next three steps', async () => {
    await show(cookAt(AT_1023));
    expect(screen.getByRole('heading', { name: 'Cooking' })).toBeOnTheScreen();
    expect(screen.getByText('Smoker 225F, serve 5:00 PM')).toBeOnTheScreen();
    expect(screen.getByText('On plan')).toBeOnTheScreen();
    expect(screen.getByText('Check at 11:35 AM')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Check the brisket' })).toBeOnTheScreen();
    expect(screen.getByText('Wrap once the bark is set, about 165-170F. Not ready? Tap Adjust.')).toBeOnTheScreen();
    expect(screen.getByLabelText('in 1 hr 12 min')).toBeOnTheScreen();
    expect(button('Done')).toBeEnabled();
    expect(button('Adjust')).toBeOnTheScreen();
    expect(button('Cook options')).toBeOnTheScreen();

    expect(screen.getByText('Today, 6 AM to serve')).toBeOnTheScreen();
    expect(screen.getByText('Now 10:23 AM')).toBeOnTheScreen();
    expect(screen.getByText('3:15 to 3:40 PM: brisket and wings share the smoker at 225F.')).toBeOnTheScreen();

    expect(screen.getByRole('heading', { name: 'After that' })).toBeOnTheScreen();
    expect(button('Full timeline')).toBeOnTheScreen();
    for (const [time, step] of [
      ['3:15 PM', 'Wings on the smoker on a wire rack'],
      ['3:25 PM', 'Oven to 170F for holding'],
      ['3:40 PM', 'Check tenderness: pull at 200-205F when the probe slides in like butter'],
    ]) {
      expect(screen.getByText(time!)).toBeOnTheScreen();
      expect(screen.getByText(step!)).toBeOnTheScreen();
    }
    // Only three: the fourth step waits its turn.
    expect(screen.queryByText(/Turn the smoker up to 400F/)).toBeNull();
  });

  test('a step that is not a check reads "At", with no Adjust hint', async () => {
    // 6:00 AM: nothing done yet, the smoker is fired at 6:20.
    await show(cookAt(AT_1023 - 263 * MIN), AT_1023 - 263 * MIN);
    expect(screen.getByText('At 6:20 AM')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Fire the smoker to 225F' })).toBeOnTheScreen();
    expect(screen.getByLabelText('in 20 min')).toBeOnTheScreen();
    expect(screen.queryByText(/Not ready\? Tap Adjust\./)).toBeNull();
  });

  test('the countdown follows the clock without a tap, and a step past its time reads overdue and Behind', async () => {
    const { clock, resume } = await show(cookAt(AT_1023));
    clock.now += 2 * MIN;
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByLabelText('in 1 hr 10 min')).toBeOnTheScreen();
    // Back from another app two hours later: read at once, not at the next tick.
    clock.now = AT_1023 + 82 * MIN;
    await act(() => resume.resume());
    expect(screen.getByText('Overdue since 11:35 AM')).toBeOnTheScreen();
    expect(screen.getByLabelText('10 min overdue')).toBeOnTheScreen();
    expect(screen.getByText('Behind')).toBeOnTheScreen();
    expect(screen.getByText('Now 11:45 AM')).toBeOnTheScreen();
  });

  test('temps read in Celsius when that is the unit', async () => {
    const r = testRepos();
    r.repos.cookers.save(cookGear, AT_1023);
    r.repos.settings.setUnits({ temp: 'C', weight: 'lb' }, AT_1023);
    r.repos.activeCook.save(cookAt(AT_1023), AT_1023);
    const alarms = fakeAlarms();
    await render(
      <CookScreen permissions={alarms} onResume={fakeResume().onResume} onGoPlan={jest.fn()} now={() => AT_1023} />,
      { wrapper: storeWrapper(r.repos, () => AT_1023, alarms) },
    );
    expect(screen.getByText(/^Smoker \d+C, serve 5:00 PM$/)).toBeOnTheScreen();
    expect(screen.queryByText(/165-170F/)).toBeNull();
  });
});

describe('Done', () => {
  test('marks the step done at the time of the tap, saves the cook and replaces the alarms once', async () => {
    const { repos, alarms, clock } = await show(cookAt(AT_1023));
    clock.now = AT_1023 + 70 * MIN; // 11:33 AM, two minutes early: no question to ask
    await act(() => jest.advanceTimersByTime(30_000));
    const before = replaced(alarms.calls);
    await fireEvent.press(button('Done'));
    await act(async () => {});
    const saved = repos.activeCook.load()!;
    expect(saved.done['phase:b:wrap']).toBe(clock.now);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(alarms.calls).toContain(`acknowledge ${Object.keys(saved.done).join(',')}`);
    expect(screen.getByRole('heading', { name: 'Wings on the smoker on a wire rack' })).toBeOnTheScreen();
    expect(screen.getByText('At 3:15 PM')).toBeOnTheScreen();
  });

  // Until the keep or move sheet (T-022): as a Done from an alert, serve stays when the holds cover the change.
  test('an hour early keeps serve time when the holds cover it', async () => {
    const { repos, clock } = await show(cookAt(AT_1023));
    await fireEvent.press(button('Done'));
    await act(async () => {});
    const saved = repos.activeCook.load()!;
    expect(saved.done['phase:b:wrap']).toBe(clock.now);
    expect(saved.plan.serveAt).toBe(cookAt(AT_1023).plan.serveAt);
    expect(screen.getByText('Smoker 225F, serve 5:00 PM')).toBeOnTheScreen();
  });

  test('after the last step there is no Next up card, and the cook is still there', async () => {
    const at = Date.UTC(2026, 10, 14, 22, 5);
    const { repos } = await show(cookAt(at), at);
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'After that' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Cooking' })).toBeOnTheScreen();
    expect(repos.activeCook.load()).not.toBeNull();
  });
});

describe('alert permissions (SPEC section 6)', () => {
  test('no banner while everything is allowed', async () => {
    await show(cookAt(AT_1023));
    expect(screen.queryByText(ALERTS_OFF)).toBeNull();
  });

  test('a permission taken away mid-cook shows the red banner when the app comes back; Fix lists what is off', async () => {
    const { alarms, resume } = await show(cookAt(AT_1023));
    alarms.granted = { ...alarms.granted, exactAlarms: false };
    await act(() => resume.resume());
    expect(screen.getByText(ALERTS_OFF)).toBeOnTheScreen();

    await fireEvent.press(button('Fix'));
    const sheet = within(screen.getByLabelText('Alerts'));
    expect(sheet.getByText('Alarms and reminders')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Allow alarms and reminders' }));
    expect(alarms.calls).toContain('openSettings exactAlarm');

    // Turned back on in Settings: the row and the banner follow when the app is in front again.
    alarms.granted = { ...alarms.granted, exactAlarms: true };
    await act(() => resume.resume());
    expect(sheet.queryByRole('button', { name: 'Allow alarms and reminders' })).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: 'Close' }));
    await act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
    expect(screen.queryByText(ALERTS_OFF)).toBeNull();
  });

  test('notifications are asked for first, then Settings when Android no longer asks', async () => {
    const { alarms, resume } = await show(cookAt(AT_1023));
    alarms.granted = { ...alarms.granted, notifications: false };
    await act(() => resume.resume());
    await fireEvent.press(button('Fix'));
    await fireEvent.press(button('Allow notifications'));
    await act(async () => {});
    expect(alarms.calls.filter(c => /^(requestNotifications|openSettings)/.test(c))).toEqual([
      'requestNotifications',
      'openSettings notifications',
    ]);
  });
});

describe('what an alert changed', () => {
  test('the notice shows until OK, in the display units', async () => {
    const { repos } = await show({
      ...cookAt(AT_1023),
      notice: 'Fire the smoker to 225F: done at 6:21 AM from the alert.',
    });
    expect(screen.getByText('Fire the smoker to 225F: done at 6:21 AM from the alert.')).toBeOnTheScreen();
    await fireEvent.press(button('OK'));
    expect(screen.queryByText(/from the alert/)).toBeNull();
    expect(repos.activeCook.load()!.notice).toBeNull();
  });
});
