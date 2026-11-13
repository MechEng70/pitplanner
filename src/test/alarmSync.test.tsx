import { act, renderHook, waitFor } from '@testing-library/react-native';
// Alarm wiring (T-015) over a real migrated database and the fake alarm service: the phone's alarm set is
// replaced as a whole after every change to the running cook, and notification taps are applied once.
import { alarmsFromPlan } from '../../engine/alarms';
import { buildPlan } from '../../engine/plan';
import { legacyHistoryJson, legacyPrefs } from '@/db/fixtures/legacy020';
import { importLegacy } from '@/db/legacyImport';
import { useAlarmWiring } from '@/lib/alarmWiring';
import { doneStep, newCook, pending, quiet, type ActiveCook } from '@/lib/cook';
import { saturday } from '@/lib/fixtures/saturday';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { NOW, storeWrapper, testRepos } from '@/test/store';

const cook = (): ActiveCook => newCook(saturday, buildPlan(rules, saturday), NOW);
const scheduling = (calls: string[]) => calls.filter(c => /^(replaceAll|cancelAll)/.test(c));

async function mount(start: ActiveCook | null = null) {
  const r = testRepos();
  if (start) r.repos.activeCook.save(start, NOW);
  const alarms = fakeAlarms();
  const hook = await renderHook(() => useStore(), { wrapper: storeWrapper(r.repos, () => NOW, alarms) });
  return { ...r, alarms, store: () => hook.result.current };
}

test('starting a cook replaces the whole alarm set once, with the plan steps still ahead', async () => {
  const { store, alarms } = await mount();
  const c = cook();
  await act(async () => store().setCook(c));
  await waitFor(() => expect(store().state.alarmSync).toBe('ok'));
  expect(alarms.calls).toEqual(['setQuiet off', `replaceAll ${alarmsFromPlan(c.plan, NOW).length}`]);
  expect(alarms.sets).toHaveLength(1);
  expect(alarms.sets[0]!.map(a => a.id)).toEqual(alarmsFromPlan(c.plan, NOW).map(a => a.id));
  expect(alarms.sets[0]!.length).toBeGreaterThan(3);
});

test('every change to the cook is one replaceAll of the whole set, never a patch', async () => {
  const { store, alarms } = await mount();
  const c = cook();
  await act(async () => store().setCook(c));
  const first = pending(c)[0]!;
  const done = doneStep(c, first.key, NOW, true).cook;
  await act(async () => store().setCook(done));
  await act(async () => store().setCook(quiet(done, NOW)));
  await waitFor(() => expect(alarms.sets).toHaveLength(3));
  // Three changes, three whole sets; the only other calls stop repeats of done steps and set Quiet.
  expect(scheduling(alarms.calls)).toHaveLength(3);
  expect(alarms.calls.filter(c2 => !/^(replaceAll|acknowledge|setQuiet)/.test(c2))).toEqual([]);
  expect(alarms.calls).toContain(`acknowledge ${first.key}`);
  // The done step is no longer in the set.
  expect(alarms.sets[1]!.flatMap(a => a.keys)).not.toContain(first.key);
  // Quiet reaches the phone, so repeats of an overdue step are held too (the 0.2.0 gap).
  expect(alarms.calls.at(-2)).toBe(`setQuiet ${NOW + 30 * 60_000}`);
});

test('changes made in a row reach the phone in order: it ends with the last set', async () => {
  const { store, alarms } = await mount();
  const c = cook();
  const done = doneStep(c, pending(c)[0]!.key, NOW, true).cook;
  await act(async () => {
    store().setCook(c);
    store().setCook(done);
  });
  await waitFor(() => expect(alarms.sets).toHaveLength(2));
  // Each sync reads the cook as it is when its turn comes, so the phone never goes back to an older set.
  expect(alarms.sets[1]!.flatMap(a => a.keys)).not.toContain(pending(c)[0]!.key);
  expect(alarms.stored.alarms).toBe(alarms.sets[1]);
});

test('ending the cook clears every alarm', async () => {
  const { store, alarms } = await mount(cook());
  await act(async () => store().setCook(null));
  await waitFor(() => expect(alarms.calls).toEqual(['cancelAll']));
  expect(store().state.alarmSync).toBeNull();
});

test('changing the display units re-times nothing but rewrites the alert text', async () => {
  const { store, alarms } = await mount(cook());
  await act(async () => store().setUnits({ temp: 'C', weight: 'kg' }));
  await waitFor(() => expect(alarms.sets).toHaveLength(1));
  expect(JSON.stringify(alarms.sets[0])).not.toMatch(/\d\d\dF/);
});

test('exact alarms denied or a refused set is kept in the state for the Cook screen to warn', async () => {
  const { store, alarms } = await mount();
  alarms.exact = false;
  await act(async () => store().setCook(cook()));
  await waitFor(() => expect(store().state.alarmSync).toBe('inexact'));
  alarms.failNext = new Error('refused');
  await act(async () => store().setCook(cook()));
  await waitFor(() => expect(store().state.alarmSync).toBe('failed'));
  // The cook itself is saved either way, and the next change tries again.
  alarms.exact = true;
  await act(async () => store().setCook(cook()));
  await waitFor(() => expect(store().state.alarmSync).toBe('ok'));
});

test('a Done tapped on a notification is applied once', async () => {
  const c = cook();
  const { store, alarms, repos } = await mount(c);
  const first = pending(c)[0]!;
  alarms.queued = [{ type: 'done', alarmId: 'a1', keys: [first.key], at: NOW + 60_000 }];
  let changed = false;
  await act(async () => {
    changed = await store().drainAlerts();
  });
  expect(changed).toBe(true);
  expect(store().state.cook!.done).toEqual({ [first.key]: NOW + 60_000 });
  expect(store().state.cook!.notice).toMatch(/done at .* from the alert\./);
  expect(repos.activeCook.load()!.done).toEqual({ [first.key]: NOW + 60_000 });
  await waitFor(() => expect(alarms.sets).toHaveLength(1));
  // A second read finds the queue empty: nothing changes and nothing is scheduled again.
  const after = store().state.cook;
  await act(async () => {
    changed = await store().drainAlerts();
  });
  expect(changed).toBe(false);
  expect(store().state.cook).toBe(after);
  expect(scheduling(alarms.calls)).toHaveLength(1);
});

test('the same Done delivered twice by the phone still applies once', async () => {
  const c = cook();
  const { store, alarms } = await mount(c);
  const first = pending(c)[0]!;
  const tap = { type: 'done' as const, alarmId: 'a1', keys: [first.key], at: NOW + 60_000 };
  alarms.queued = [tap];
  await act(async () => void (await store().drainAlerts()));
  const once = store().state.cook;
  alarms.queued = [tap];
  await act(async () => void (await store().drainAlerts()));
  expect(store().state.cook).toBe(once);
});

test('taps with no cook running are dropped without scheduling anything', async () => {
  const { store, alarms } = await mount();
  alarms.queued = [{ type: 'done', alarmId: 'a1', keys: ['fire::'], at: NOW }];
  await act(async () => void (await store().drainAlerts()));
  expect(alarms.calls).toEqual(['drainActions']);
});

describe('wiring at start, on resume and on a tap while open', () => {
  const fakeResumeOnce = fakeResume();
  async function wired(start: ActiveCook | null) {
    const r = testRepos();
    if (start) r.repos.activeCook.save(start, NOW);
    const alarms = fakeAlarms();
    const resume = fakeResume();
    const applied = jest.fn();
    const hook = await renderHook(
      () => {
        useAlarmWiring(alarms, resume.onResume, applied);
        return useStore();
      },
      { wrapper: storeWrapper(r.repos, () => NOW, alarms) },
    );
    return { alarms, resume, applied, hook, store: () => hook.result.current };
  }

  test('a cook imported from 0.2.0 gets its alarms at the first start', async () => {
    const r = testRepos();
    // The 0.2.0 fixture: a cook started an hour ago, serve still ahead.
    const report = importLegacy(
      r.db,
      {
        readCapacitorPrefs: () => legacyPrefs(NOW - 3_600_000),
        readHistoryFile: () => legacyHistoryJson(),
        retireCapacitorPrefs: () => true,
        retireHistoryFile: () => {},
      },
      NOW,
    );
    expect(report.runningCook).toBe(true);
    const alarms = fakeAlarms();
    const resume = fakeResume();
    await renderHook(() => useAlarmWiring(alarms, resume.onResume, () => {}), {
      wrapper: storeWrapper(r.repos, () => NOW, alarms),
    });
    await waitFor(() => expect(alarms.sets).toHaveLength(1));
    expect(alarms.sets[0]!.length).toBeGreaterThan(3);
    expect(alarms.sets[0]!.every(a => a.at > NOW)).toBe(true);
    expect(scheduling(alarms.calls)).toHaveLength(1);
  });

  test('start with no cook and nothing on the phone schedules and cancels nothing', async () => {
    const { alarms } = await wired(null);
    await waitFor(() => expect(alarms.calls).toEqual(['drainActions']));
    await act(async () => {});
    expect(scheduling(alarms.calls)).toEqual([]);
  });

  test('start with no cook clears step alarms left on the phone, but not a lone test alarm', async () => {
    const stale = {
      id: 'wrap',
      at: NOW + 60_000,
      title: 'Brisket',
      body: 'Wrap.',
      critical: false,
      keys: ['wrap:b:p1'],
    };
    const withTest = fakeAlarms();
    withTest.stored = { alarms: [{ ...stale, id: 'test:1', test: true }], nags: [] };
    await renderHook(() => useAlarmWiring(withTest, fakeResumeOnce.onResume, () => {}), {
      wrapper: storeWrapper(testRepos().repos, () => NOW, withTest),
    });
    await act(async () => {});
    expect(scheduling(withTest.calls)).toEqual([]);

    const withStale = fakeAlarms();
    withStale.stored = { alarms: [stale], nags: [] };
    await renderHook(() => useAlarmWiring(withStale, fakeResumeOnce.onResume, () => {}), {
      wrapper: storeWrapper(testRepos().repos, () => NOW, withStale),
    });
    await waitFor(() => expect(scheduling(withStale.calls)).toEqual(['cancelAll']));
  });

  test('a tap waiting at start is applied, the set replaced once, and the Cook tab opened', async () => {
    const c = cook();
    const r = testRepos();
    r.repos.activeCook.save(c, NOW);
    const alarms = fakeAlarms();
    alarms.queued = [{ type: 'snooze15', alarmId: 'a1', keys: [pending(c)[0]!.key], at: NOW }];
    const applied = jest.fn();
    const resume = fakeResume();
    await renderHook(() => useAlarmWiring(alarms, resume.onResume, applied), {
      wrapper: storeWrapper(r.repos, () => NOW, alarms),
    });
    await waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alarms.sets).toHaveLength(1));
    expect(scheduling(alarms.calls)).toHaveLength(1);
  });

  test('coming back to the app and a tap while it is open both read the queue; no tap, no reschedule', async () => {
    const c = cook();
    const { alarms, resume, applied, store } = await wired(c);
    await waitFor(() => expect(alarms.sets).toHaveLength(1)); // the start
    await act(async () => resume.resume());
    await waitFor(() => expect(alarms.calls.filter(x => x === 'drainActions')).toHaveLength(2));
    expect(alarms.sets).toHaveLength(1);
    expect(applied).not.toHaveBeenCalled();

    alarms.queued = [{ type: 'done', alarmId: 'a1', keys: [pending(c)[0]!.key], at: NOW + 1000 }];
    await act(async () => alarms.emitAction({ alarmId: 'a1', keys: [pending(c)[0]!.key], action: 'done' }));
    await waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alarms.sets).toHaveLength(2));
    expect(Object.keys(store().state.cook!.done)).toEqual([pending(c)[0]!.key]);
  });

  test('the listeners are removed when the app closes', async () => {
    const { resume, alarms, hook } = await wired(null);
    expect(resume.listeners()).toBe(1);
    await hook.unmount();
    expect(resume.listeners()).toBe(0);
    const before = alarms.calls.length;
    alarms.emitAction({ alarmId: 'a', keys: [] });
    expect(alarms.calls).toHaveLength(before);
  });
});
