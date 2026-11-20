// Start cook from Plan (T-021): the alert check, one cook and one alarm set per tap, and a running cook that
// is never replaced (T-064).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { AT_1023, cookAt, cookGear, cookMenu } from '@/test/cook';
import { EVENT_LOG_KEY, parseEventLog } from '@/lib/eventLog';
import { useStore } from '@/lib/store';
import { storeWrapper, testRepos } from '@/test/store';
import { PlanTab } from './PlanTab';

/** Thu Nov 12, 2026 8:00 PM Eastern: two days before the Saturday serve. */
const NOW = Date.UTC(2026, 10, 13, 1, 0);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

async function show(opts: { cooking?: boolean } = {}) {
  const r = testRepos();
  r.repos.cookers.save(cookGear, NOW);
  r.repos.rates.setRate('brisket', 0.75, NOW);
  r.repos.settings.setDraft(
    { mode: 'readyBy', at: Date.UTC(2026, 10, 14, 22, 0), pitTempF: 225, items: cookMenu },
    NOW,
  );
  if (opts.cooking) r.repos.activeCook.save(cookAt(AT_1023), NOW);
  const alarms = fakeAlarms();
  const resume = fakeResume();
  const onCookStarted = jest.fn();
  await render(
    <>
      <PlanTab
        pickDateTime={jest.fn(async () => null)}
        permissions={alarms}
        onResume={resume.onResume}
        onCookStarted={onCookStarted}
        now={() => NOW}
      />
      <DropCook />
    </>,
    { wrapper: storeWrapper(r.repos, () => NOW, alarms) },
  );
  return { repos: r.repos, alarms, resume, onCookStarted };
}
/**
 * The cook ending from another screen while Plan stays mounted, as the tabs keep it: End cook then Save to
 * history or Discard this cook, and Start over, all end in the store's setCook(null).
 */
function DropCook() {
  const { setCook } = useStore();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="drop the cook (test)" onPress={() => setCook(null)}>
      <Text>drop</Text>
    </Pressable>
  );
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const replaced = (calls: string[]) => calls.filter(c => c.startsWith('replaceAll')).length;
const flush = () => act(async () => {});

test('with every alert permission on, Start cook saves the cook, sets its alarms once and opens the Cook tab', async () => {
  const { repos, alarms, onCookStarted } = await show();
  await fireEvent.press(button('Start cook'));
  await flush();
  const cook = repos.activeCook.load()!;
  expect(cook.startedAt).toBe(NOW);
  expect(cook.plan.serveAt).toBe(Date.UTC(2026, 10, 14, 22, 0));
  expect(cook.input.items.map(i => i.id)).toEqual(['b', 'w', 'c']);
  expect(replaced(alarms.calls)).toBe(1);
  expect(alarms.sets[0]!.length).toBeGreaterThan(5);
  expect(onCookStarted).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Alerts may not ring')).toBeNull();
  // The cook is running: Start cook is greyed out (T-064).
  expect(button('Start cook')).toBeDisabled();
});

// Regression (found by Jason on his phone, 0.3.0-beta.1, 2026-11-17): the guard against a double tap was
// never cleared after a cook started, so once that cook had ended Start cook looked normal and did nothing
// until the app was restarted.
test('after a cook has ended, Start cook starts the next one without the app being restarted', async () => {
  const { repos, alarms, onCookStarted } = await show();
  await fireEvent.press(button('Start cook'));
  await flush();
  expect(repos.activeCook.load()).not.toBeNull();
  expect(onCookStarted).toHaveBeenCalledTimes(1);

  await fireEvent.press(button('drop the cook (test)'));
  await flush();
  expect(repos.activeCook.load()).toBeNull();
  expect(button('Start cook')).toBeEnabled();
  const before = replaced(alarms.calls);

  await fireEvent.press(button('Start cook'));
  await flush();
  expect(repos.activeCook.load()).not.toBeNull();
  expect(onCookStarted).toHaveBeenCalledTimes(2);
  expect(replaced(alarms.calls)).toBe(before + 1);

  // And a third time, with two quick taps: still one cook, one alarm set.
  await fireEvent.press(button('drop the cook (test)'));
  await flush();
  const again = replaced(alarms.calls);
  const start = button('Start cook');
  await act(async () => {
    fireEvent.press(start);
    fireEvent.press(start);
  });
  await flush();
  expect(onCookStarted).toHaveBeenCalledTimes(3);
  expect(replaced(alarms.calls)).toBe(again + 1);
});

test('two quick taps start one cook and set the alarms once', async () => {
  const { alarms, onCookStarted } = await show();
  const start = button('Start cook');
  await act(async () => {
    fireEvent.press(start);
    fireEvent.press(start);
  });
  await flush();
  expect(replaced(alarms.calls)).toBe(1);
  expect(onCookStarted).toHaveBeenCalledTimes(1);
});

// Regression (after-readout checklist, "A start that fails shows nothing"): when saving the new cook threw,
// no cook existed but the double-tap guard stayed set, so Start cook did nothing until the app was restarted;
// and the event log said "cook started" for a cook that was never saved.
describe('a start whose save fails', () => {
  const started = (repos: Awaited<ReturnType<typeof show>>['repos']) =>
    (repos.kv.get(EVENT_LOG_KEY, parseEventLog) ?? []).filter(e => e.text.startsWith('cook started'));
  async function failedStart() {
    const r = await show();
    const save = jest.spyOn(r.repos.activeCook, 'save').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    await fireEvent.press(button('Start cook'));
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    return r;
  }
  afterEach(() => jest.restoreAllMocks());

  test('no cook, no alarms, no Cook tab, and the next tap on Start cook starts it without a restart', async () => {
    const { repos, alarms, onCookStarted } = await failedStart();
    expect(repos.activeCook.load()).toBeNull();
    expect(replaced(alarms.calls)).toBe(0);
    expect(onCookStarted).not.toHaveBeenCalled();
    expect(button('Start cook')).toBeEnabled();

    await fireEvent.press(button('Start cook'));
    await flush();
    expect(repos.activeCook.load()!.startedAt).toBe(NOW);
    expect(replaced(alarms.calls)).toBe(1);
    expect(onCookStarted).toHaveBeenCalledTimes(1);
  });

  test('the event log has no "cook started" line for it, and the error is written there instead', async () => {
    const { repos } = await failedStart();
    expect(started(repos)).toEqual([]);
    const errors = (repos.kv.get(EVENT_LOG_KEY, parseEventLog) ?? []).filter(e => e.kind === 'error');
    expect(errors.map(e => e.text)).toEqual(['cook not started: Error: disk full']);
  });

  test('a start that is saved is logged as started once', async () => {
    const { repos } = await failedStart();
    await fireEvent.press(button('Start cook'));
    await flush();
    expect(started(repos)).toHaveLength(1);
  });
});

describe('an alert permission is missing (failure mode 9)', () => {
  // Jason, 2026-11-20 (T-102): full-screen alerts off does not stop Start cook.
  test('full-screen alerts off alone: the cook starts with no check sheet', async () => {
    const { repos, alarms, onCookStarted } = await show();
    alarms.granted = { ...alarms.granted, fullScreen: false };
    await fireEvent.press(button('Start cook'));
    await flush();
    expect(screen.queryByLabelText('Alerts may not ring')).toBeNull();
    expect(repos.activeCook.load()).not.toBeNull();
    expect(onCookStarted).toHaveBeenCalledTimes(1);
  });

  async function blocked() {
    const r = await show();
    r.alarms.granted = { ...r.alarms.granted, batteryUnrestricted: false };
    await fireEvent.press(button('Start cook'));
    await flush();
    return { ...r, sheet: within(screen.getByLabelText('Alerts may not ring')) };
  }

  test('the cook does not start: the sheet lists what is off, and its Start cook is greyed out', async () => {
    const { repos, alarms, onCookStarted, sheet } = await blocked();
    expect(repos.activeCook.load()).toBeNull();
    expect(replaced(alarms.calls)).toBe(0);
    expect(onCookStarted).not.toHaveBeenCalled();
    expect(sheet.getByText('No battery limits')).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: 'Allow no battery limits' })).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: 'Start cook' })).toBeDisabled();
    expect(sheet.getByRole('button', { name: 'Start anyway' })).toBeEnabled();
  });

  test('once it is fixed in Settings, Start cook in the sheet starts the cook', async () => {
    const { repos, alarms, resume, onCookStarted, sheet } = await blocked();
    await fireEvent.press(sheet.getByRole('button', { name: 'Allow no battery limits' }));
    expect(alarms.calls).toContain('openSettings battery');
    alarms.granted = { ...alarms.granted, batteryUnrestricted: true };
    await act(() => resume.resume());
    expect(sheet.queryByRole('button', { name: 'Start anyway' })).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: 'Start cook' }));
    await settle();
    await flush();
    expect(repos.activeCook.load()!.startedAt).toBe(NOW);
    expect(replaced(alarms.calls)).toBe(1);
    expect(onCookStarted).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Alerts may not ring')).toBeNull();
  });

  test('Start anyway starts it without the permission', async () => {
    const { repos, alarms, onCookStarted, sheet } = await blocked();
    await fireEvent.press(sheet.getByRole('button', { name: 'Start anyway' }));
    await settle();
    await flush();
    expect(repos.activeCook.load()).not.toBeNull();
    expect(replaced(alarms.calls)).toBe(1);
    expect(onCookStarted).toHaveBeenCalledTimes(1);
  });

  test('closing the sheet starts nothing, and Start cook can be tapped again', async () => {
    const { repos, sheet } = await blocked();
    await fireEvent.press(sheet.getByRole('button', { name: 'Close' }));
    await settle();
    expect(repos.activeCook.load()).toBeNull();
    await fireEvent.press(button('Start cook'));
    await flush();
    expect(screen.getByLabelText('Alerts may not ring')).toBeOnTheScreen();
  });

  // Regression (T-036 follow-up): the same shape as Replace your data?, whose Replace button sat off screen at
  // 115%. The kit's footer is a row; `block` is `w-full` (width 100%) and React Native's flexShrink defaults to
  // 0, so two block buttons in it are each as wide as the row. RNTL has no layout, so this checks the classes
  // Yoga lays the row out from, not pixels: each button shares the row, Start anyway first.
  const footerOf = (sheet: ReturnType<typeof within>) => within(sheet.getByTestId('footer'));
  const classesIn = (footer: ReturnType<typeof within>, name: string) =>
    String(footer.getByRole('button', { name }).props.className).split(' ');

  test('Start anyway and Start cook share the footer row instead of each taking all of it', async () => {
    const footer = footerOf((await blocked()).sheet);
    for (const name of ['Start anyway', 'Start cook']) {
      expect(classesIn(footer, name)).not.toContain('w-full');
      expect(classesIn(footer, name)).toEqual(expect.arrayContaining(['min-w-0', 'flex-1']));
    }
    expect(footer.getAllByRole('button')).toEqual([
      footer.getByRole('button', { name: 'Start anyway' }),
      footer.getByRole('button', { name: 'Start cook' }),
    ]);
  });

  test('once fixed, Start cook is alone in the footer and still fills the row', async () => {
    const { alarms, resume, sheet } = await blocked();
    alarms.granted = { ...alarms.granted, batteryUnrestricted: true };
    await act(() => resume.resume());
    const footer = footerOf(sheet);
    expect(footer.getAllByRole('button')).toEqual([footer.getByRole('button', { name: 'Start cook' })]);
    // Fills the row: grows into it (flex-1) or is as wide as it (w-full).
    expect(classesIn(footer, 'Start cook').some(c => c === 'flex-1' || c === 'w-full')).toBe(true);
  });

  test('a status that cannot be read counts as missing', async () => {
    const { repos, alarms } = await show();
    alarms.status = async () => {
      throw new Error('no module');
    };
    await fireEvent.press(button('Start cook'));
    await flush();
    expect(repos.activeCook.load()).toBeNull();
    expect(screen.getByLabelText('Alerts may not ring')).toBeOnTheScreen();
  });
});

// T-064 regression: in 0.2.0 Start cook with a cook running replaced it, with no save and no question.
test('with a cook running, Start cook does not replace it or touch its alarms', async () => {
  const { repos, alarms, onCookStarted } = await show({ cooking: true });
  const before = repos.activeCook.load()!;
  expect(button('Start cook')).toBeDisabled();
  await fireEvent.press(button('Start cook'));
  await flush();
  expect(repos.activeCook.load()).toEqual(before);
  expect(alarms.calls).toEqual([]);
  expect(onCookStarted).not.toHaveBeenCalled();
});
