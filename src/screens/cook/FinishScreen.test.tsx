// Cook finished (mockup 15) and the way to it (T-023), on the cook of mockup 12 over a real database with the
// fake phone alarms: End cook in Cook options, Done on the Serve step, Save to history, Discard, the notes
// and the support link that shows once.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { doneStep, dueAt, pending, type ActiveCook } from '@/lib/cook';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { AT_1023, MIN, cookAt, cookGear, cookMenu } from '@/test/cook';
import { storeWrapper, testRepos } from '@/test/store';
import { CookFlow } from './CookFlow';
import { SUPPORT_URL } from './FinishScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const SERVE = Date.UTC(2026, 10, 14, 22, 0); // 5:00 PM
const DRAFT = { mode: 'readyBy' as const, at: SERVE, pitTempF: 225, items: cookMenu };
/** A cook saved before this one: Save and Discard must leave it alone (T-064). */
const SAVED = { id: 'r1', date: SERVE - 7 * 24 * 60 * MIN, notes: 'Windy', pitTempF: 250, lateMin: 18, items: [] };

/** Every step still to do marked done at the time it was due; with `leaveServe`, all but Serve. */
function doneOnTime(c: ActiveCook, leaveServe = false): ActiveCook {
  let cur = c;
  for (;;) {
    const k = pending(cur)[0];
    if (!k || (leaveServe && k.event.kind === 'serve')) return cur;
    cur = doneStep(cur, k.key, dueAt(cur, k), true).cook;
  }
}

async function show(cook: ActiveCook, at: number, flags = {}) {
  const r = testRepos();
  r.repos.cookers.save(cookGear, at);
  r.repos.settings.setDraft(DRAFT, at);
  r.repos.settings.setFlags(flags, at);
  r.repos.history.save(SAVED, at);
  r.repos.activeCook.save(cook, at);
  const alarms = fakeAlarms();
  const onGoPlan = jest.fn();
  await render(<CookFlow permissions={alarms} onResume={fakeResume().onResume} onGoPlan={onGoPlan} now={() => at} />, {
    wrapper: storeWrapper(r.repos, () => at, alarms),
  });
  await act(async () => {});
  return { repos: r.repos, alarms, onGoPlan, history: r.repos.history.list() };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const settle = async () => {
  await act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
  await act(async () => {});
};
const endCook = async () => {
  await fireEvent.press(button('Cook options'));
  const sheet = screen.queryAllByLabelText('Cook options').find(e => e.props.role === 'dialog')!;
  await fireEvent.press(within(sheet).getByRole('button', { name: /^End cook/ }));
  await settle();
};
const cancels = (calls: string[]) => calls.filter(c => c === 'cancelAll').length;

describe('the way to Cook finished', () => {
  test('End cook in Cook options opens it; the cook, its alarms and the history stay until Save or Discard', async () => {
    const { repos, alarms, onGoPlan, history } = await show(cookAt(AT_1023), AT_1023);
    const calls = alarms.calls.length;
    await endCook();
    expect(screen.getByRole('heading', { name: 'Cook finished' })).toBeOnTheScreen();
    expect(screen.getByText('Saturday, Nov 14')).toBeOnTheScreen();
    expect(screen.getByText('Ended at 10:23 AM, before serve.')).toBeOnTheScreen();
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(alarms.calls.length).toBe(calls);
    expect(repos.history.list()).toEqual(history);
    expect(onGoPlan).not.toHaveBeenCalled();
  });

  test('Done on the Serve step marks it done and opens it', async () => {
    const { repos, alarms } = await show(doneOnTime(cookAt(AT_1023), true), SERVE);
    expect(screen.getByRole('heading', { name: /^Serve/ })).toBeOnTheScreen();
    await fireEvent.press(button('Done'));
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Cook finished' })).toBeOnTheScreen();
    expect(screen.getByText('Served at 5:00 PM, on time.')).toBeOnTheScreen();
    expect(Object.entries(repos.activeCook.load()!.done).find(([k]) => k.startsWith('serve:'))?.[1]).toBe(SERVE);
    // The cook is still running until Save or Discard.
    expect(cancels(alarms.calls)).toBe(0);
  });
});

describe('Cook finished (mockup 15)', () => {
  test('planned vs actual per food, the rate update, the notes box and the three actions', async () => {
    await show(doneOnTime(cookAt(AT_1023)), SERVE);
    await endCook();
    expect(screen.getByText('Served at 5:00 PM, on time.')).toBeOnTheScreen();
    for (const [name, line] of [
      ['Brisket', 'Planned 9 hr, actual 9 hr'],
      ['Chicken wings', 'Planned 1 hr 40 min, actual 1 hr 40 min'],
      ['Chicken breasts', 'Planned 12 min, actual 12 min'],
    ]) {
      expect(screen.getByText(name!)).toBeOnTheScreen();
      expect(screen.getByText(line!)).toBeOnTheScreen();
    }
    expect(screen.getAllByText('On plan')).toHaveLength(3);
    expect(screen.getByText('Your brisket rate updates')).toBeOnTheScreen();
    // The fixture has a saved brisket rate: it holds until three cooks are logged.
    expect(
      screen.getByText(
        'Plans keep your 0.75 hr/lb. 1 of 3 logged cooks before it adjusts. Lock it in Gear, Cook rates.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Notes for next time')).toBeOnTheScreen();
    expect(screen.getByLabelText('Notes for next time').props.placeholder).toBe('Wind, wood, what you would change');
    expect(button('Save to history')).toBeEnabled();
    expect(button('Discard this cook')).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Buy me a bag of pellets' })).toBeOnTheScreen();
  });

  test('with no saved rate the card says where the rate moves, and from how many cooks', async () => {
    const c = doneOnTime(cookAt(AT_1023));
    await show({ ...c, input: { ...c.input, rateOverrides: {} } }, SERVE);
    await endCook();
    expect(screen.getByText('Your brisket rate updates')).toBeOnTheScreen();
    expect(screen.getByText(/^\d\.\d\d to \d\.\d\d hr\/lb at 225F, from 1 cook\.$/)).toBeOnTheScreen();
  });

  test('a cook ended before a food came off says so and gives that food no result', async () => {
    await show(cookAt(AT_1023), AT_1023);
    await endCook();
    expect(screen.getByText('Planned 9 hr. Ended before it came off.')).toBeOnTheScreen();
    expect(screen.getAllByText('Not logged')).toHaveLength(3);
    expect(screen.queryByText(/rate updates/)).toBeNull();
  });

  test('Save to history writes one record with the notes, ends the cook, clears the alarms once and goes to Plan', async () => {
    const { repos, alarms, onGoPlan, history } = await show(doneOnTime(cookAt(AT_1023)), SERVE);
    await endCook();
    await fireEvent.changeText(screen.getByLabelText('Notes for next time'), '  Windy. More post oak.  ');
    await fireEvent.press(button('Save to history'));
    await act(async () => {});
    const list = repos.history.list();
    expect(list).toHaveLength(2);
    const rec = list.find(r => r.id !== SAVED.id)!;
    expect(rec).toMatchObject({ date: SERVE, notes: 'Windy. More post oak.', pitTempF: 225, lateMin: 0 });
    expect(rec.items.map(i => [i.name, i.plannedMin, i.actualMin, i.log.discarded ?? false])).toEqual([
      ['Brisket', 540, 540, false],
      ['Chicken wings', 100, 100, false],
      ['Chicken breasts', 12, 12, false],
    ]);
    // Regression (T-064): a saved cook is only removed or changed by Remove on Cook history.
    expect(list.filter(r => r.id === SAVED.id)).toEqual(history);
    expect(repos.activeCook.load()).toBeNull();
    expect(cancels(alarms.calls)).toBe(1);
    expect(alarms.stored.alarms).toEqual([]);
    expect(onGoPlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'No cook running' })).toBeOnTheScreen();
    expect(repos.settings.draft()).toEqual(DRAFT);
  });

  test('Discard writes nothing, ends the cook, clears the alarms once and goes to Plan', async () => {
    const { repos, alarms, onGoPlan, history } = await show(doneOnTime(cookAt(AT_1023)), SERVE);
    await endCook();
    await fireEvent.changeText(screen.getByLabelText('Notes for next time'), 'Not kept');
    await fireEvent.press(button('Discard this cook'));
    await act(async () => {});
    // Regression (T-064): the history is exactly what it was.
    expect(repos.history.list()).toEqual(history);
    expect(repos.activeCook.load()).toBeNull();
    expect(cancels(alarms.calls)).toBe(1);
    expect(onGoPlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'No cook running' })).toBeOnTheScreen();
    expect(repos.settings.draft()).toEqual(DRAFT);
  });

  test('a cook ended early is saved with its foods marked not logged, so no rate learns from it', async () => {
    const { repos } = await show(cookAt(AT_1023), AT_1023);
    await endCook();
    await fireEvent.press(button('Save to history'));
    await act(async () => {});
    const rec = repos.history.list().find(r => r.id !== SAVED.id)!;
    expect(rec.lateMin).toBeNull();
    expect(rec.items.map(i => i.log.discarded)).toEqual([true, true, true]);
    expect(repos.history.logs()).toEqual([]);
  });
});

describe('the support link', () => {
  test('opens the support page in the browser', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await show(cookAt(AT_1023), AT_1023);
    await endCook();
    await fireEvent.press(screen.getByRole('link', { name: 'Buy me a bag of pellets' }));
    expect(open).toHaveBeenCalledWith(SUPPORT_URL);
    expect(SUPPORT_URL).toBe('https://buymeacoffee.com/PitPlanner');
    open.mockRestore();
  });

  test.each(['Save to history', 'Discard this cook'])('is marked as shown after %s', async name => {
    const { repos } = await show(cookAt(AT_1023), AT_1023);
    await endCook();
    await fireEvent.press(button(name));
    await act(async () => {});
    expect(repos.settings.flags()).toEqual({ supportShown: true });
  });

  test('is not shown again once it has been shown, and the other flags are kept', async () => {
    const { repos } = await show(cookAt(AT_1023), AT_1023, { supportShown: true, rateHintShown: true });
    await endCook();
    expect(screen.queryByRole('link')).toBeNull();
    expect(button('Discard this cook')).toBeOnTheScreen();
    await fireEvent.press(button('Discard this cook'));
    await act(async () => {});
    expect(repos.settings.flags()).toEqual({ supportShown: true, rateHintShown: true });
  });
});
