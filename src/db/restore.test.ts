// Restoring a data file (T-036): replace the user's data in one transaction, touch nothing else.
import { buildPlan } from '../../engine/plan';
import type { Cookers } from '../../engine/types';
import { newCook } from '../lib/cook';
import { buildDataFile, readDataFile, type RestoreData } from '../lib/dataFile';
import { saturday } from '../lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '../lib/gear';
import type { CookRecord } from '../lib/history';
import { rules } from '../lib/rules';
import { loadState } from '../lib/store';
import type { Db } from './db';
import { openMigrated } from './migrate';
import { migrations } from './migrations';
import { repos, type Repos } from './repos';
import { restoreData } from './restore';
import { testDb } from './testDb';

const NOW = 1794500000000;
const DAY = 86_400_000;

function phone(): { db: Db; r: Repos } {
  const db = testDb();
  expect(openMigrated(db, migrations).ok).toBe(true);
  return { db, r: repos(db) };
}

const record = (id: string, daysAgo: number, over: Partial<CookRecord> = {}): CookRecord => ({
  id,
  date: NOW - daysAgo * DAY,
  notes: `cook ${id}`,
  pitTempF: 225,
  lateMin: 5,
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
        options: { wrap: 'paper' },
      },
    },
  ],
  ...over,
});

const gearA: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle() };

/** Phone A: the one the file comes from. */
function phoneA() {
  const p = phone();
  p.r.cookers.save(gearA, NOW);
  p.r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW);
  p.r.settings.setFlags({ supportShown: true }, NOW);
  p.r.rates.setRate('brisket', 0.8, NOW);
  p.r.rates.setLock('brisket', true, NOW);
  p.r.rates.setTotalHours('turkey', 4.5, NOW);
  p.r.history.save(record('a1', 30), NOW);
  p.r.history.save(record('a2', 20, { lateMin: null }), NOW);
  p.r.history.save(record('a3', 10, { lateMin: undefined }), NOW);
  return p;
}

/** Phone B: has its own data, which a restore replaces. */
function phoneB() {
  const p = phone();
  p.r.cookers.save({ smoker: { ...saturday.cookers.smoker!, id: 'other', name: 'Other' }, oven: defaultOven() }, NOW);
  p.r.settings.setFlags({ rateHintShown: true }, NOW);
  p.r.rates.setRate('butt', 1.3, NOW);
  p.r.rates.setTotalHours('brisket', 11, NOW);
  p.r.history.save(record('b1', 5), NOW);
  return p;
}

/** The file phone A shares, read back as the app would read it. */
function fileFrom(a: Repos): RestoreData {
  const s = loadState(a, NOW);
  const text = buildDataFile(
    {
      gear: s.gear,
      units: s.units,
      rates: s.rates,
      totalHours: s.totalHours,
      rateLocks: s.rateLocks,
      records: s.records,
      flags: s.flags,
    },
    NOW,
    '0.3.0',
  );
  const read = readDataFile(rules, text, NOW);
  if (!read.ok) throw new Error(read.problem);
  return read.data;
}

const userData = (r: Repos) => {
  const s = loadState(r, NOW);
  return {
    gear: s.gear,
    units: s.units,
    rates: s.rates,
    totalHours: s.totalHours,
    rateLocks: s.rateLocks,
    records: s.records,
    history: s.history,
    firstRun: s.firstRun,
  };
};
const rows = (db: Db, table: string) => db.all<Record<string, unknown>>(`SELECT * FROM "${table}" ORDER BY 1`);
const kvRows = (db: Db) => rows(db, 'kv');

test('export on one phone, restore on a fresh install: the data matches', () => {
  const a = phoneA();
  const b = phone();
  const result = restoreData(b.r, fileFrom(a.r), NOW + 1000, 'replace');
  expect(result).toEqual({ ok: true, counts: { cookers: 2, rates: 2, cooks: 3 } });
  expect(userData(b.r)).toEqual(userData(a.r));
  expect(userData(b.r).firstRun).toBe(false);
  expect(b.r.settings.flags()).toEqual({ supportShown: true });
});

test('restore replaces the phone own cookers, rates and history', () => {
  const a = phoneA();
  const b = phoneB();
  expect(restoreData(b.r, fileFrom(a.r), NOW + 1000, 'replace').ok).toBe(true);
  const after = userData(b.r);
  expect(after.gear).toEqual(gearA);
  expect(after.rates).toEqual({ brisket: 0.8 });
  expect(after.totalHours).toEqual({ turkey: 4.5 });
  expect(after.records.map(c => c.id)).toEqual(['a1', 'a2', 'a3']);
  expect(rows(b.db, 'rate_overrides').map(r => r.food_id)).toEqual(['brisket', 'turkey']);
  expect(rows(b.db, 'cook_history_items').every(i => i.cook_id !== 'b1')).toBe(true);
  // A hint seen on either phone stays seen.
  expect(b.r.settings.flags()).toEqual({ supportShown: true, rateHintShown: true });
});

test('a restore touches only the user data: plan, running state, logs and markers stay as they were', () => {
  const a = phoneA();
  const b = phoneB();
  b.r.kv.set('draft', { mode: 'readyBy', at: NOW + DAY, pitTempF: 250, items: [] }, NOW);
  b.r.kv.set('ui', { tab: 'gear' }, NOW);
  b.r.kv.set('eventLog', [{ at: NOW, kind: 'cook', text: 'started' }], NOW);
  b.r.kv.set('update', { checkedAt: NOW, latest: '0.3.1', url: null }, NOW);
  b.r.kv.set('legacy_import', { status: 'done' }, NOW);
  b.r.kv.set('quarantine:kv:units:1', { origin: 'kv:units', at: 1, raw: 'x' }, NOW);
  const otherKv = (db: Db) => kvRows(db).filter(r => r.key !== 'units' && r.key !== 'flags');
  const before = otherKv(b.db);
  expect(restoreData(b.r, fileFrom(a.r), NOW + 1000, 'replace').ok).toBe(true);
  expect(otherKv(b.db)).toEqual(before);
  expect(rows(b.db, 'active_cook')).toEqual([]);
});

test('refused while a cook is running; nothing changes', () => {
  const a = phoneA();
  const b = phoneB();
  b.r.activeCook.save(newCook(saturday, buildPlan(rules, saturday), NOW), NOW);
  const tables = ['cookers', 'kv', 'rate_overrides', 'cook_history', 'cook_history_items', 'active_cook'];
  const before = tables.map(t => rows(b.db, t));
  expect(restoreData(b.r, fileFrom(a.r), NOW + 1000, 'replace')).toEqual({ ok: false, problem: 'cook running' });
  expect(tables.map(t => rows(b.db, t))).toEqual(before);
});

test('a write that fails half way undoes the whole restore', () => {
  const a = phoneA();
  const b = phoneB();
  const tables = ['cookers', 'kv', 'rate_overrides', 'cook_history', 'cook_history_items'];
  const before = tables.map(t => rows(b.db, t));
  const save = b.r.history.save;
  let n = 0;
  b.r.history.save = (rec, now) => {
    if (++n === 2) throw new Error('disk full');
    save(rec, now);
  };
  expect(restoreData(b.r, fileFrom(a.r), NOW + 1000, 'replace')).toEqual({
    ok: false,
    problem: 'failed',
    message: 'disk full',
  });
  expect(tables.map(t => rows(b.db, t))).toEqual(before);
});

test('parts the file does not have leave the phone as it is: no cookers, units or flags', () => {
  const a = phoneA();
  const b = phoneB();
  const data = { ...fileFrom(a.r), gear: {}, units: null, flags: null };
  const gearB = b.r.cookers.load();
  expect(restoreData(b.r, data, NOW + 1000, 'replace')).toEqual({
    ok: true,
    counts: { cookers: 0, rates: 2, cooks: 3 },
  });
  expect(b.r.cookers.load()).toEqual(gearB);
  expect(b.r.settings.units()).toEqual({ temp: 'F', weight: 'lb' });
  expect(b.r.settings.flags()).toEqual({ rateHintShown: true });
});

test('unreadable values on the phone are quarantined before the restore replaces them, never lost', () => {
  const a = phoneA();
  const b = phoneB();
  b.db.run("UPDATE cookers SET profile = '{\"broken' WHERE kind = 'oven'");
  b.db.run("UPDATE rate_overrides SET hr_per_lb = -1 WHERE food_id = 'butt'");
  b.db.run("UPDATE cook_history_items SET options = 'not json' WHERE cook_id = 'b1'");
  b.db.run("UPDATE kv SET value = '{\"supp' WHERE key = 'flags'");
  expect(restoreData(b.r, fileFrom(a.r), NOW + 1000, 'replace').ok).toBe(true);
  expect(
    b.r
      .quarantined()
      .map(q => q.origin)
      .sort(),
  ).toEqual(['cook_history_items:b1:0', 'cookers:oven:oven', 'kv:flags', 'rate_overrides:butt']);
});

// T-077 (parity T18): a file written by an older build, or by hand, cannot bring a hold below 140F back.
test('a data file with an oven hold of 130F restores as 140F', () => {
  const a = phoneA();
  const b = phone();
  const s = loadState(a.r, NOW);
  const text = buildDataFile(
    {
      gear: { ...s.gear, oven: { ...defaultOven(), lowestTempF: 130 } },
      units: s.units,
      rates: s.rates,
      totalHours: s.totalHours,
      rateLocks: s.rateLocks,
      records: s.records,
      flags: s.flags,
    },
    NOW,
    '0.3.0',
  );
  const read = readDataFile(rules, text, NOW);
  if (!read.ok) throw new Error(read.problem);
  expect(restoreData(b.r, read.data, NOW + 1000, 'replace').ok).toBe(true);
  expect(b.r.cookers.load().oven).toEqual({ ...defaultOven(), lowestTempF: 140 });
  expect(loadState(b.r, NOW).gear.oven?.lowestTempF).toBe(140);
  const row = b.db.get<{ profile: string }>("SELECT profile FROM cookers WHERE kind = 'oven'");
  expect(JSON.parse(row!.profile).lowestTempF).toBe(140);
});
