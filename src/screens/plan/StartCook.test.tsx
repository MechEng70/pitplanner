// Start cook from Plan (T-021): the alert check, one cook and one alarm set per tap, and a running cook that
// is never replaced (T-064).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { AT_1023, cookAt, cookGear, cookMenu } from '@/test/cook';
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
    <PlanTab
      pickDateTime={jest.fn(async () => null)}
      permissions={alarms}
      onResume={resume.onResume}
      onCookStarted={onCookStarted}
      now={() => NOW}
    />,
    { wrapper: storeWrapper(r.repos, () => NOW, alarms) },
  );
  return { repos: r.repos, alarms, resume, onCookStarted };
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

describe('an alert permission is missing (failure mode 9)', () => {
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
