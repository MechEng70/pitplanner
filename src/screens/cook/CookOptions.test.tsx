// Cook options (mockup 13), the Start over question and the keep or move sheet (T-022), on the cook of
// mockup 12 over a real database with the fake phone alarms. Every action saves the cook once and replaces
// the phone's alarm set once.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { ActiveCook } from '@/lib/cook';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { AT_1023, MIN, cookAt, cookGear, cookMenu } from '@/test/cook';
import { storeWrapper, testRepos } from '@/test/store';
import { CookScreen } from './CookScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const SERVE = Date.UTC(2026, 10, 14, 22, 0); // 5:00 PM
const DRAFT = { mode: 'readyBy' as const, at: SERVE, pitTempF: 225, items: cookMenu };
/** A cook saved before this one: ending or starting over must leave it alone (T-064). */
const SAVED = { id: 'r1', date: SERVE - 7 * 24 * 60 * MIN, notes: 'Windy', pitTempF: 250, lateMin: 18, items: [] };

async function show(cook: ActiveCook = cookAt(AT_1023), at = AT_1023, withEnd = true) {
  const r = testRepos();
  r.repos.cookers.save(cookGear, at);
  r.repos.settings.setDraft(DRAFT, at);
  r.repos.history.save(SAVED, at);
  r.repos.activeCook.save(cook, at);
  const alarms = fakeAlarms();
  const clock = { now: at };
  const onGoPlan = jest.fn();
  const onEnd = jest.fn();
  await render(
    <CookScreen
      permissions={alarms}
      onResume={fakeResume().onResume}
      onGoPlan={onGoPlan}
      onEnd={withEnd ? onEnd : undefined}
      now={() => clock.now}
    />,
    { wrapper: storeWrapper(r.repos, () => clock.now, alarms) },
  );
  await act(async () => {});
  return { repos: r.repos, alarms, clock, onGoPlan, onEnd, history: r.repos.history.list() };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const replaced = (calls: string[]) => calls.filter(c => c.startsWith('replaceAll')).length;
/** The sheet slides down, then the action runs and the alarms are set. */
const settle = async () => {
  await act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
  await act(async () => {});
};
/** The Cook options sheet (the button that opens it has the same label). */
const optionsSheet = () => screen.queryAllByLabelText('Cook options').find(e => e.props.role === 'dialog');
const openOptions = async () => {
  await fireEvent.press(button('Cook options'));
  return within(optionsSheet()!);
};
/** Tap a row of Cook options and wait for the sheet to close. */
const act1 = async (name: string | RegExp) => {
  const sheet = await openOptions();
  await fireEvent.press(sheet.getByRole('button', { name }));
  await settle();
};

describe('Cook options (mockup 13)', () => {
  test('the Cook options button opens the sheet with every action; nothing changes until one is tapped', async () => {
    const { repos, alarms } = await show();
    const calls = alarms.calls.length;
    const sheet = await openOptions();
    expect(sheet.getByText('Running behind or ahead')).toBeOnTheScreen();
    expect(sheet.getByText('Shifts every step after now')).toBeOnTheScreen();
    expect(sheet.getByText('0')).toBeOnTheScreen();
    // No shift picked yet: no serve choice and nothing to apply.
    expect(sheet.queryByRole('radio')).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Apply' })).toBeNull();
    for (const [title, sub] of [
      ['Not yet, check again in 30 min', 'Check the brisket. Serve stays at 5:00 PM.'],
      ['Quiet alerts for 30 min', 'The plan keeps running. Missed steps wait for you.'],
      ['Pit went out', 'Stops the clock until you tap "Back up to temp"'],
      ['Start over', 'Back to Plan with the same menu'],
      ['End cook', 'Save to history or discard. Turns off all alerts.'],
    ]) {
      expect(sheet.getByText(title!)).toBeOnTheScreen();
      expect(sheet.getByText(sub!)).toBeOnTheScreen();
    }
    await fireEvent.press(sheet.getByRole('button', { name: 'Close' }));
    await settle();
    expect(optionsSheet()).toBeUndefined();
    expect(alarms.calls.length).toBe(calls);
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
  });

  test('Adjust opens it too', async () => {
    await show();
    await fireEvent.press(button('Adjust'));
    expect(optionsSheet()).toBeOnTheScreen();
  });
});

describe('Running behind or ahead', () => {
  test('+30 keeping serve: the hold impact is spelled out, and Apply re-plans and replaces the alarms once', async () => {
    const { repos, alarms } = await show();
    const before = replaced(alarms.calls);
    const sheet = await openOptions();
    await fireEvent.press(sheet.getByRole('button', { name: 'More shift' }));
    await fireEvent.press(sheet.getByRole('button', { name: 'More shift' }));
    expect(sheet.getByText('+30')).toBeOnTheScreen();
    expect(radio(/^Keep serve at 5:00 PM use up hold time$/)).toBeChecked();
    expect(radio(/^Move serve to 5:30 PM tell the family$/)).not.toBeChecked();
    expect(sheet.getByText('Brisket hold drops from 1 hr to 30 min. Still OK.')).toBeOnTheScreen();
    // Nothing is saved while choosing.
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));

    await fireEvent.press(sheet.getByRole('button', { name: 'Apply' }));
    await settle();
    expect(optionsSheet()).toBeUndefined();
    const saved = repos.activeCook.load()!;
    expect(saved.plan.serveAt).toBe(SERVE);
    const brisket = saved.plan.items.find(i => i.input.id === 'b')!;
    expect(brisket.finish).toBe(cookAt(AT_1023).plan.items.find(i => i.input.id === 'b')!.finish + 30 * MIN);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(screen.getByText('Check at 12:05 PM')).toBeOnTheScreen();
    expect(screen.getByText('Behind')).toBeOnTheScreen();
  });

  test('+30 moving serve: serve time moves, holds stay', async () => {
    const { repos, alarms } = await show();
    const before = replaced(alarms.calls);
    const sheet = await openOptions();
    await fireEvent.press(sheet.getByRole('button', { name: 'More shift' }));
    await fireEvent.press(sheet.getByRole('button', { name: 'More shift' }));
    await fireEvent.press(radio(/^Move serve to 5:30 PM/));
    expect(radio(/^Move serve to 5:30 PM/)).toBeChecked();
    expect(sheet.getByText('Serve moves to 5:30 PM. Holds stay as planned.')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Apply' }));
    await settle();
    expect(repos.activeCook.load()!.plan.serveAt).toBe(SERVE + 30 * MIN);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(screen.getByText('Smoker 225F, serve 5:30 PM')).toBeOnTheScreen();
  });

  test('-15, running ahead: keeping serve holds longer', async () => {
    const { repos } = await show();
    const sheet = await openOptions();
    await fireEvent.press(sheet.getByRole('button', { name: 'Less shift' }));
    expect(sheet.getByText('-15')).toBeOnTheScreen();
    expect(radio(/^Keep serve at 5:00 PM hold longer$/)).toBeChecked();
    expect(radio(/^Move serve to 4:45 PM tell the family$/)).toBeOnTheScreen();
    expect(sheet.getByText('Brisket hold grows from 1 hr to 1 hr 15 min. Still OK.')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Apply' }));
    await settle();
    expect(repos.activeCook.load()!.plan.serveAt).toBe(SERVE);
    expect(screen.getByText('Check at 11:20 AM')).toBeOnTheScreen();
  });

  test('back at 0 there is nothing to apply; the shift stops at 3 hr either way', async () => {
    await show();
    const sheet = await openOptions();
    await fireEvent.press(sheet.getByRole('button', { name: 'More shift' }));
    await fireEvent.press(sheet.getByRole('button', { name: 'Less shift' }));
    expect(sheet.queryByRole('button', { name: 'Apply' })).toBeNull();
    for (let i = 0; i < 12; i++) await fireEvent.press(sheet.getByRole('button', { name: 'More shift' }));
    expect(sheet.getByText('+180')).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: 'More shift' })).toBeDisabled();
  });
});

describe('Quiet alerts for 30 min', () => {
  test('tells the phone to hold alerts until then, and replaces the alarms once', async () => {
    const { repos, alarms } = await show();
    const before = replaced(alarms.calls);
    await act1(/^Quiet alerts for 30 min/);
    const until = AT_1023 + 30 * MIN;
    expect(repos.activeCook.load()!.quietUntil).toBe(until);
    expect(alarms.calls).toContain(`setQuiet ${until}`);
    expect(replaced(alarms.calls) - before).toBe(1);
    // The plan keeps running.
    expect(repos.activeCook.load()!.plan).toEqual(cookAt(AT_1023).plan);
  });

  test('while quiet the row reads Alerts back on, which ends it', async () => {
    const { repos, alarms } = await show({ ...cookAt(AT_1023), quietUntil: AT_1023 + 30 * MIN });
    const before = replaced(alarms.calls);
    const sheet = await openOptions();
    expect(sheet.queryByText(/^Quiet alerts for/)).toBeNull();
    expect(sheet.getByText('Quiet until 10:53 AM')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: /^Alerts back on/ }));
    await settle();
    expect(repos.activeCook.load()!.quietUntil).toBeNull();
    expect(alarms.calls.at(-2)).toBe('setQuiet off');
    expect(replaced(alarms.calls) - before).toBe(1);
  });
});

describe('Pit went out, Back up to temp', () => {
  test('Pit went out stops the clock: a banner on Live cook, and only the pit reminder is set', async () => {
    const { repos, alarms } = await show();
    const before = replaced(alarms.calls);
    await act1(/^Pit went out/);
    expect(repos.activeCook.load()!.pitDownAt).toBe(AT_1023);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(alarms.sets.at(-1)!.map(a => a.id)).toEqual(['pitcheck']);
    expect(screen.getByText('Pit out since 10:23 AM. Steps are on hold.')).toBeOnTheScreen();
    expect(button('Back up to temp')).toBeOnTheScreen();
    // Already out: the row is not offered again.
    const sheet = await openOptions();
    expect(sheet.queryByText('Pit went out')).toBeNull();
  });

  test('Back up to temp asks keep or move; Move serve re-times the steps and replaces the alarms once', async () => {
    const { repos, alarms, clock } = await show({ ...cookAt(AT_1023), pitDownAt: AT_1023 });
    clock.now = AT_1023 + 20 * MIN;
    const before = replaced(alarms.calls);
    await fireEvent.press(button('Back up to temp'));
    const sheet = within(screen.getByLabelText('Pit back up to temp'));
    expect(
      sheet.getByText('The pit was out from 10:23 AM. Keep serve time and shorten holds, or move serve?'),
    ).toBeOnTheScreen();
    // 20 min out plus 15 to recover: the wings would come off after serve, so Move serve is selected.
    expect(radio(/^Move serve Serve 5:35 PM, later by 35 min\.$/)).toBeChecked();
    expect(radio(/^Keep serve 5:00 PM Brisket holds 25 min instead of 1 hr\.$/)).not.toBeChecked();
    // Nothing changes until Apply.
    expect(repos.activeCook.load()!.pitDownAt).toBe(AT_1023);
    expect(replaced(alarms.calls)).toBe(before);

    await fireEvent.press(sheet.getByRole('button', { name: 'Apply' }));
    await settle();
    const saved = repos.activeCook.load()!;
    expect(saved.pitDownAt).toBeNull();
    expect(saved.plan.serveAt).toBe(SERVE + 35 * MIN);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(alarms.sets.at(-1)!.length).toBeGreaterThan(5);
    expect(screen.queryByText(/^Pit out since/)).toBeNull();
    expect(screen.getByText('Smoker 225F, serve 5:35 PM')).toBeOnTheScreen();
  });

  test('closing the question leaves the pit out', async () => {
    const { repos, clock } = await show({ ...cookAt(AT_1023), pitDownAt: AT_1023 });
    clock.now = AT_1023 + 20 * MIN;
    await fireEvent.press(button('Back up to temp'));
    await fireEvent.press(within(screen.getByLabelText('Pit back up to temp')).getByRole('button', { name: 'Close' }));
    await settle();
    expect(repos.activeCook.load()!.pitDownAt).toBe(AT_1023);
    expect(button('Back up to temp')).toBeOnTheScreen();
  });
});

describe('Not yet at a check step', () => {
  test('moves that food 30 min; serve stays while the hold covers it; alarms replaced once', async () => {
    const { repos, alarms } = await show();
    const before = replaced(alarms.calls);
    await act1(/^Not yet, check again in 30 min/);
    const saved = repos.activeCook.load()!;
    expect(saved.plan.serveAt).toBe(SERVE);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(screen.getByText('Check at 12:05 PM')).toBeOnTheScreen();
    // Only the brisket moved: the wings go on when they did.
    expect(screen.getByText('3:15 PM')).toBeOnTheScreen();
    expect(screen.getByText('Wings on the smoker on a wire rack')).toBeOnTheScreen();
  });

  // Live test of 2026-11-11: Not yet kept serve time even when that left a food short of its minimum rest.
  test('regression: when the hold no longer covers it, serve moves, and the row says so first', async () => {
    const { repos } = await show();
    await act1(/^Not yet, check again in 30 min/); // the brisket's hold is down to its 30 min minimum
    const sheet = await openOptions();
    expect(sheet.getByText('Check the brisket. Serve moves to 5:30 PM.')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: /^Not yet, check again in 30 min/ }));
    await settle();
    expect(repos.activeCook.load()!.plan.serveAt).toBe(SERVE + 30 * MIN);
    expect(screen.getByText('Smoker 225F, serve 5:30 PM')).toBeOnTheScreen();
    expect(screen.getByText('Check at 12:35 PM')).toBeOnTheScreen();
  });

  test('is not offered when the next step is not a check', async () => {
    const at = AT_1023 - 263 * MIN; // 6:00 AM: the next step is firing the smoker
    await show(cookAt(at), at);
    const sheet = await openOptions();
    expect(sheet.queryByText(/^Not yet/)).toBeNull();
  });
});

describe('Start over (Jason, 2026-11-15, T-064)', () => {
  test('asks first; Keep cooking changes nothing', async () => {
    const { repos, alarms, onGoPlan } = await show();
    await act1(/^Start over/);
    const sheet = within(screen.getByLabelText('Start over?'));
    expect(sheet.getByText("This cook won't be saved.")).toBeOnTheScreen();
    // The cook is still running while the question is up.
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    const calls = alarms.calls.length;
    await fireEvent.press(sheet.getByRole('button', { name: 'Keep cooking' }));
    await settle();
    expect(screen.queryByLabelText('Start over?')).toBeNull();
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(alarms.calls.length).toBe(calls);
    expect(onGoPlan).not.toHaveBeenCalled();
    expect(button('Done')).toBeOnTheScreen();
  });

  test('Start over drops the cook, clears the alarms once and goes to Plan; the menu and the history stay', async () => {
    const { repos, alarms, onGoPlan, history } = await show();
    await act1(/^Start over/);
    await fireEvent.press(within(screen.getByLabelText('Start over?')).getByRole('button', { name: 'Start over' }));
    await settle();
    expect(repos.activeCook.load()).toBeNull();
    expect(alarms.calls.filter(c => c === 'cancelAll')).toEqual(['cancelAll']);
    expect(onGoPlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'No cook running' })).toBeOnTheScreen();
    expect(repos.settings.draft()).toEqual(DRAFT);
    // Regression (T-064): a saved cook is only removed by Remove.
    expect(history).toHaveLength(1);
    expect(repos.history.list()).toEqual(history);
  });
});

describe('End cook', () => {
  test('hands over to Cook finished (T-023) and changes nothing itself: the cook, alarms and history stay', async () => {
    const { repos, alarms, onEnd, onGoPlan, history } = await show();
    const calls = alarms.calls.length;
    await act1(/^End cook/);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(optionsSheet()).toBeUndefined();
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(alarms.calls.length).toBe(calls);
    expect(onGoPlan).not.toHaveBeenCalled();
    expect(repos.history.list()).toEqual(history);
  });

  test('without an `onEnd` handler it only closes the sheet', async () => {
    const { repos } = await show(cookAt(AT_1023), AT_1023, false);
    await act1(/^End cook/);
    expect(optionsSheet()).toBeUndefined();
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
  });
});

describe('Done early or late asks keep or move', () => {
  test('an hour early: Keep serve is selected with the longer hold; nothing is saved until Apply', async () => {
    const { repos, alarms } = await show();
    const before = replaced(alarms.calls);
    await fireEvent.press(button('Done'));
    const sheet = within(screen.getByLabelText('1 hr 12 min earlier than planned'));
    expect(sheet.getByText('Brisket is ahead. Keep serve time and change the hold, or move serve?')).toBeOnTheScreen();
    expect(radio(/^Keep serve 5:00 PM Brisket holds 2 hr 10 min instead of 1 hr\.$/)).toBeChecked();
    expect(radio(/^Move serve Serve 3:50 PM, earlier by 1 hr 10 min\.$/)).not.toBeChecked();
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(replaced(alarms.calls)).toBe(before);

    await fireEvent.press(sheet.getByRole('button', { name: 'Apply' }));
    await settle();
    const saved = repos.activeCook.load()!;
    expect(saved.done['phase:b:wrap']).toBe(AT_1023);
    expect(saved.plan.serveAt).toBe(SERVE);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(screen.getByText('Smoker 225F, serve 5:00 PM')).toBeOnTheScreen();
  });

  test('picking Move serve moves serve time', async () => {
    const { repos, alarms } = await show();
    const before = replaced(alarms.calls);
    await fireEvent.press(button('Done'));
    await fireEvent.press(radio(/^Move serve/));
    await fireEvent.press(button('Apply'));
    await settle();
    const saved = repos.activeCook.load()!;
    expect(saved.done['phase:b:wrap']).toBe(AT_1023);
    expect(saved.plan.serveAt).toBe(SERVE - 70 * MIN);
    expect(replaced(alarms.calls) - before).toBe(1);
  });

  test('closing the question leaves the step not done', async () => {
    const { repos } = await show();
    await fireEvent.press(button('Done'));
    await fireEvent.press(
      within(screen.getByLabelText('1 hr 12 min earlier than planned')).getByRole('button', { name: 'Close' }),
    );
    await settle();
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(screen.getByText('Check at 11:35 AM')).toBeOnTheScreen();
  });

  // Live test of 2026-11-11: Keep serve was preselected and read as a plain hold change even when the food
  // would still be on the heat at serve.
  test('regression: 2 hr late, keeping serve says the food comes off after serve, and Move serve is selected', async () => {
    const { repos, clock } = await show();
    clock.now = AT_1023 + 192 * MIN; // 1:35 PM
    await act(() => jest.advanceTimersByTime(30_000));
    await fireEvent.press(button('Done'));
    const sheet = within(screen.getByLabelText('2 hr later than planned'));
    expect(sheet.getByText('Brisket is behind. Keep serve time and change the hold, or move serve?')).toBeOnTheScreen();
    expect(radio(/^Keep serve 5:00 PM Brisket: off heat 1 hr after serve\.$/)).not.toBeChecked();
    expect(radio(/^Move serve Serve 7:00 PM, later by 2 hr\.$/)).toBeChecked();
    await fireEvent.press(sheet.getByRole('button', { name: 'Apply' }));
    await settle();
    expect(repos.activeCook.load()!.plan.serveAt).toBe(SERVE + 120 * MIN);
    expect(screen.getByText('Smoker 225F, serve 7:00 PM')).toBeOnTheScreen();
  });
});

// T-063: a step marked Done by mistake is taken back from Cook options (Jason, 2026-11-15: a row that names
// the step, for the most recent Done only, until the next step is marked done).
describe('Undo the most recent Done', () => {
  const undoRow = /^Undo: /;
  /** 11:33 AM: the wrap check is 2 min away, so Done asks nothing. */
  const at1133 = async () => {
    const r = await show();
    r.clock.now = AT_1023 + 70 * MIN;
    await act(() => jest.advanceTimersByTime(30_000));
    return r;
  };
  const tapDone = async () => {
    await fireEvent.press(button('Done'));
    await act(async () => {});
  };

  test('no row until a step has been marked done', async () => {
    await show();
    const sheet = await openOptions();
    expect(sheet.queryByRole('button', { name: undoRow })).toBeNull();
  });

  test('the row names the step; tapping it puts the step, Next up and the alarms back', async () => {
    const { repos, alarms } = await at1133();
    const cookBefore = repos.activeCook.load()!;
    const rings = () => alarms.sets.at(-1)!.find(a => a.keys.includes('phase:b:wrap'))?.at;
    const heading = screen.getByTestId('next-title').props.children;
    await tapDone();
    expect(repos.activeCook.load()!.done['phase:b:wrap']).toBe(AT_1023 + 70 * MIN);
    expect(screen.getByText('At 3:15 PM')).toBeOnTheScreen();
    expect(rings()).toBeUndefined();
    const afterDone = alarms.sets.at(-1)!;

    const sheet = await openOptions();
    const row = sheet.getByRole('button', { name: undoRow });
    expect(within(row).getByText('Undo: Check the brisket')).toBeOnTheScreen();
    expect(within(row).getByText('Done at 11:33 AM. Puts the step and its alerts back.')).toBeOnTheScreen();
    // Its own icon, not Start over's.
    const hidden = { includeHiddenElements: true };
    expect(within(row).getByTestId('icon-undo', hidden)).toBeOnTheScreen();
    expect(within(sheet.getByRole('button', { name: /^Start over/ })).queryByTestId('icon-undo', hidden)).toBeNull();
    const before = replaced(alarms.calls);
    await fireEvent.press(row);
    await settle();

    expect(optionsSheet()).toBeUndefined();
    expect(repos.activeCook.load()).toEqual(cookBefore);
    expect(replaced(alarms.calls) - before).toBe(1);
    // The step's own alarm is back at its time; every other alarm is as it was.
    expect(rings()).toBe(AT_1023 + 72 * MIN);
    expect(alarms.sets.at(-1)!.filter(a => !a.keys.includes('phase:b:wrap'))).toEqual(afterDone);
    expect(screen.getByText('Check at 11:35 AM')).toBeOnTheScreen();
    expect(screen.getByTestId('next-title').props.children).toEqual(heading);
    // Taken back: nothing more to undo.
    const again = await openOptions();
    expect(again.queryByRole('button', { name: undoRow })).toBeNull();
  });

  test('a Done that moved serve: undo brings serve and the later steps back', async () => {
    const { repos } = await show();
    await fireEvent.press(button('Done')); // 1 hr 12 min early
    await fireEvent.press(radio(/^Move serve/));
    await fireEvent.press(button('Apply'));
    await settle();
    expect(repos.activeCook.load()!.plan.serveAt).toBe(SERVE - 70 * MIN);
    await act1(undoRow);
    expect(repos.activeCook.load()).toEqual(cookAt(AT_1023));
    expect(screen.getByText('Smoker 225F, serve 5:00 PM')).toBeOnTheScreen();
    expect(screen.getByText('Check at 11:35 AM')).toBeOnTheScreen();
  });

  test('only the most recent Done is offered', async () => {
    const { repos, clock } = await at1133();
    await tapDone(); // the wrap check
    clock.now = Date.UTC(2026, 10, 14, 20, 14); // 3:14 PM, a minute before the wings go on
    await act(() => jest.advanceTimersByTime(30_000));
    await tapDone();
    const sheet = await openOptions();
    expect(sheet.getAllByRole('button', { name: undoRow })).toHaveLength(1);
    expect(sheet.queryByText('Undo: Check the brisket')).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: undoRow }));
    await settle();
    // The wrap check stays done and cannot be taken back any more.
    expect(repos.activeCook.load()!.done['phase:b:wrap']).toBe(AT_1023 + 70 * MIN);
    const again = await openOptions();
    expect(again.queryByRole('button', { name: undoRow })).toBeNull();
  });

  test('after a change made since the tap, the row says the change is taken back too', async () => {
    const { repos } = await at1133();
    const cookBefore = repos.activeCook.load()!;
    await tapDone();
    const shiftSheet = await openOptions();
    await fireEvent.press(shiftSheet.getByRole('button', { name: 'More shift' }));
    await fireEvent.press(shiftSheet.getByRole('button', { name: 'Apply' }));
    await settle();
    expect(repos.activeCook.load()!.plan).not.toEqual(cookBefore.plan);
    const sheet = await openOptions();
    const row = sheet.getByRole('button', { name: undoRow });
    expect(within(row).getByText('Done at 11:33 AM. Also takes back the changes made since.')).toBeOnTheScreen();
    await fireEvent.press(row);
    await settle();
    expect(repos.activeCook.load()).toEqual(cookBefore);
  });

  test('an overdue step taken back rings again in 10 min and still shows as overdue', async () => {
    const { repos, alarms, clock } = await show();
    clock.now = AT_1023 + 75 * MIN; // 11:38 AM, 3 min after the wrap check came due
    await act(() => jest.advanceTimersByTime(30_000));
    await tapDone();
    clock.now += MIN;
    await act1(undoRow);
    const saved = repos.activeCook.load()!;
    expect(saved.done['phase:b:wrap']).toBeUndefined();
    expect(saved.ringAgain).toEqual({ 'phase:b:wrap': clock.now + 10 * MIN });
    expect(await alarms.scheduled()).toMatchObject({
      alarms: expect.arrayContaining([expect.objectContaining({ at: clock.now + 10 * MIN })]),
    });
    expect(screen.getByText('Overdue since 11:35 AM')).toBeOnTheScreen();
  });
});
