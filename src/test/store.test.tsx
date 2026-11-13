import { act, renderHook } from '@testing-library/react-native';
// The store (src/lib/store.tsx) over a real migrated database. Lives here, not beside the store: src/lib may
// not import React Native test tools (layer rule).
import { buildPlan } from '../../engine/plan';
import type { Cookers } from '../../engine/types';
import { repos as makeRepos } from '@/db/repos';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { newCook } from '@/lib/cook';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle } from '@/lib/gear';
import type { CookRecord } from '@/lib/history';
import { rules } from '@/lib/rules';
import { defaultServe, loadState, planInput, useStore } from '@/lib/store';

const gear: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle() };
const record = (id: string): CookRecord => ({
  id,
  date: NOW,
  notes: '',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 550,
      log: { foodId: 'brisket', methodId: 'smoke', smokerId: 'pb820', quantity: 12, pitTempF: 225, minutesOnHeat: 550 },
    },
  ],
});

async function mount(r = testRepos()) {
  const hook = await renderHook(() => useStore(), { wrapper: storeWrapper(r.repos) });
  return { ...r, hook, store: () => hook.result.current };
}
/** What a fresh start of the app would load from the same database. */
const reopened = (db: Parameters<typeof makeRepos>[0]) => loadState(makeRepos(db), NOW + 1000);

test('a new install: first run, default units, an empty Saturday 5 PM draft, nothing else', async () => {
  const { store } = await mount();
  const s = store().state;
  expect(s).toMatchObject({
    firstRun: true,
    gear: {},
    units: { temp: 'F', weight: 'lb' },
    rates: {},
    totalHours: {},
    rateLocks: {},
    update: null,
    history: [],
    records: [],
    cook: null,
    flags: {},
    draftLost: false,
  });
  expect(s.draft).toEqual({ mode: 'readyBy', at: defaultServe(NOW), pitTempF: 225, items: [] });
  expect(new Date(s.draft.at).getDay()).toBe(6);
});

test('every change is in the database at once: a fresh start loads the same state', async () => {
  const { db, store } = await mount();
  const cook = newCook(saturday, buildPlan(rules, saturday), NOW);
  await act(() => {
    store().finishSetup(gear, { temp: 'C', weight: 'kg' });
    store().setDraft(d => ({ ...d, pitTempF: 250, items: saturday.items }));
    store().setRate('brisket', 0.75);
    store().setTotalHours('ribs', 5.5);
    store().setRateLock('brisket', true);
    store().setFlags({ rateHintShown: true });
    store().setUpdate({ checkedAt: NOW, latest: 'v0.3.0', url: null });
    store().setCook(cook);
    store().addRecord(record('a'));
    store().addRecord(record('b'));
  });
  const s = store().state;
  expect(s).toMatchObject({
    firstRun: false,
    gear,
    units: { temp: 'C', weight: 'kg' },
    rates: { brisket: 0.75 },
    totalHours: { ribs: 5.5 },
    rateLocks: { brisket: true },
    flags: { rateHintShown: true },
    cook,
  });
  expect(s.draft).toMatchObject({ pitTempF: 250, items: saturday.items });
  expect(s.records.map(r => r.id)).toEqual(['a', 'b']);
  expect(s.history).toHaveLength(2);
  expect(reopened(db)).toEqual(s);
});

test('each single change survives a restart on its own', async () => {
  const { db, store } = await mount();
  const steps: [string, () => void][] = [
    ['setGear', () => store().setGear(gear)],
    ['setUnits', () => store().setUnits({ temp: 'C', weight: 'lb' })],
    ['setDraft', () => store().setDraft(d => ({ ...d, mode: 'startAt' }))],
    ['setRate', () => store().setRate('brisket', 0.8)],
    ['setRate null', () => store().setRate('brisket', null)],
    ['setCook', () => store().setCook(newCook(saturday, buildPlan(rules, saturday), NOW))],
    ['setCook null', () => store().setCook(null)],
    ['addRecord', () => store().addRecord(record('a'))],
    ['removeRecord', () => store().removeRecord('a')],
  ];
  for (const [name, change] of steps) {
    const before = store().state;
    await act(change);
    expect([name, store().state]).not.toEqual([name, before]);
    expect([name, reopened(db)]).toEqual([name, store().state]);
  }
});

test('two changes in one event build on each other', async () => {
  const { store } = await mount();
  await act(() => {
    store().setDraft(d => ({ ...d, pitTempF: d.pitTempF + 25 }));
    store().setDraft(d => ({ ...d, pitTempF: d.pitTempF + 25 }));
  });
  expect(store().state.draft.pitTempF).toBe(275);
});

test('planInput has the engine shape, from the draft, gear, rates and history', async () => {
  const { store } = await mount();
  await act(() => {
    store().setGear(gear);
    store().setDraft(d => ({ ...d, at: saturday.at, items: saturday.items }));
    store().setRate('brisket', 0.75);
    store().setRateLock('brisket', true);
    store().addRecord(record('a'));
  });
  const input = planInput(store().state);
  expect(Object.keys(input).sort()).toEqual(
    ['at', 'cookers', 'history', 'items', 'mode', 'pitTempF', 'rateLocks', 'rateOverrides'].sort(),
  );
  expect(input).toMatchObject({
    mode: 'readyBy',
    at: saturday.at,
    pitTempF: 225,
    cookers: gear,
    rateOverrides: { brisket: 0.75 },
  });
  expect(input.history).toEqual([record('a').items[0]!.log]);
  expect(buildPlan(rules, input).fireAt).not.toBeNull();
});

test('a draft that cannot be loaded: flagged, default shown, kept until the plan changes, then quarantined', async () => {
  const r = testRepos();
  r.db.run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', ['draft', '{"mode":"readyBy","items":', NOW]);
  const { store, db, repos } = await mount(r);
  expect(store().state.draftLost).toBe(true);
  expect(store().state.draft.items).toEqual([]);
  // Nothing was written by loading: the raw value is still there for the next start.
  expect(db.get("SELECT value FROM kv WHERE key = 'draft'")).toEqual({ value: '{"mode":"readyBy","items":' });
  expect(repos.quarantined()).toEqual([]);
  await act(() => store().setDraft(d => ({ ...d, items: saturday.items })));
  expect(store().state.draftLost).toBe(false);
  expect(repos.quarantined()).toEqual([
    { key: `quarantine:kv:draft:${NOW}`, origin: 'kv:draft', at: NOW, raw: '{"mode":"readyBy","items":' },
  ]);
  expect(reopened(db).draftLost).toBe(false);
});

test('gear that exists but cannot be read is not a first run', async () => {
  const r = testRepos();
  r.repos.cookers.save(gear, NOW);
  r.db.run("UPDATE cookers SET profile = '{bad'");
  const { store } = await mount(r);
  expect(store().state).toMatchObject({ firstRun: false, gear: {} });
});

test('useStore outside the provider is a bug', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(renderHook(() => useStore())).rejects.toThrow('useStore outside StoreProvider');
});
