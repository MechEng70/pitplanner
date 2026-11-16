import { act, renderHook } from '@testing-library/react-native';
// The store's restore (T-036): the screen state follows the restored data at once.
import { buildPlan } from '../../engine/plan';
import { newCook } from '@/lib/cook';
import { buildDataFile, readDataFile, type RestoreData } from '@/lib/dataFile';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle } from '@/lib/gear';
import type { CookRecord } from '@/lib/history';
import { rules } from '@/lib/rules';
import { loadState, useStore } from '@/lib/store';
import { NOW, storeWrapper, testRepos } from '@/test/store';

const record: CookRecord = {
  id: 'r1',
  date: NOW - 86_400_000,
  notes: 'Good bark.',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 550,
      log: {
        foodId: 'brisket',
        methodId: 'smoked',
        smokerId: 'pb820',
        quantity: 12,
        pitTempF: 225,
        minutesOnHeat: 550,
      },
    },
  ],
};

function fileData(): RestoreData {
  const text = buildDataFile(
    {
      gear: { smoker: saturday.cookers.smoker!, griddle: defaultGriddle() },
      units: { temp: 'C', weight: 'kg' },
      rates: { brisket: 0.8 },
      totalHours: {},
      rateLocks: { brisket: true },
      records: [record],
      flags: {},
    },
    NOW,
    '0.3.0',
  );
  const r = readDataFile(rules, text, NOW);
  if (!r.ok) throw new Error(r.problem);
  return r.data;
}

async function mount() {
  const t = testRepos();
  const hook = await renderHook(() => useStore(), { wrapper: storeWrapper(t.repos) });
  return { ...t, store: () => hook.result.current };
}

test('a restore on a fresh install ends the first run and shows the restored data', async () => {
  const { repos, store } = await mount();
  expect(store().state.firstRun).toBe(true);
  let result;
  await act(() => {
    result = store().restoreData(fileData());
  });
  expect(result).toEqual({ ok: true, counts: { cookers: 2, rates: 1, cooks: 1 } });
  const s = store().state;
  expect(s).toMatchObject({
    firstRun: false,
    units: { temp: 'C', weight: 'kg' },
    rates: { brisket: 0.8 },
    rateLocks: { brisket: true },
    records: [record],
    history: [record.items[0]!.log],
  });
  expect(s.gear.smoker?.id).toBe('pb820');
  // The same as a fresh start would load.
  const { draft: _d, ...shown } = s;
  const { draft: _r, ...reloaded } = loadState(repos, NOW);
  expect(shown).toEqual({ ...reloaded, alarmSync: s.alarmSync });
});

test('refused while a cook runs; the state and the database stay as they were', async () => {
  const { repos, store } = await mount();
  await act(() => store().setCook(newCook(saturday, buildPlan(rules, saturday), NOW)));
  const before = store().state;
  let result;
  await act(() => {
    result = store().restoreData(fileData());
  });
  expect(result).toEqual({ ok: false, problem: 'cook running' });
  expect(store().state).toBe(before);
  expect(repos.history.list()).toEqual([]);
});
