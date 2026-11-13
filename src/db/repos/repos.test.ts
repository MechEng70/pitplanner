import { buildPlan } from '../../../engine/plan';
import type { Cookers } from '../../../engine/types';
import { newCook } from '../../lib/cook';
import type { Draft } from '../../lib/draft';
import { saturday } from '../../lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '../../lib/gear';
import { logsOf, type CookRecord } from '../../lib/history';
import { serveStatus } from '../../lib/historyView';
import { rules } from '../../lib/rules';
import type { Db } from '../db';
import { openMigrated } from '../migrate';
import { migrations } from '../migrations';
import { testDb } from '../testDb';
import { repos, type Repos } from './index';

const NOW = 1794500000000;
let db: Db;
let r: Repos;
beforeEach(() => {
  db = testDb();
  expect(openMigrated(db, migrations).ok).toBe(true);
  r = repos(db);
});

/** Overwrite a stored value with something a bug or a bad import could have left there. */
const corrupt = (sql: string, params: (string | number | null)[] = []) =>
  expect(db.run(sql, params).changes).toBeGreaterThan(0);

const gear: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() };

const record = (id: string, over: Partial<CookRecord> = {}): CookRecord => ({
  id,
  date: NOW,
  notes: 'Wrapped at 165.',
  pitTempF: 225,
  lateMin: 12.5,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 562.5,
      log: {
        foodId: 'brisket',
        methodId: 'smoke',
        smokerId: 'pb820',
        quantity: 12.4,
        pitTempF: 225,
        minutesOnHeat: 562.5,
        options: { wrap: 'paper' },
      },
    },
    {
      name: 'Wings',
      plannedMin: 90,
      actualMin: 80,
      log: { foodId: 'wings', methodId: 'smoke', smokerId: 'pb820', quantity: 24, pitTempF: 250, minutesOnHeat: 80 },
    },
  ],
  ...over,
});

describe('settings (kv)', () => {
  test('defaults when nothing is saved', () => {
    expect(r.settings.units()).toEqual({ temp: 'F', weight: 'lb' });
    expect(r.settings.flags()).toEqual({});
    expect(r.settings.update()).toBeNull();
    expect(r.settings.draft()).toBeNull();
  });

  test('units, flags, update and draft round-trip; a second save replaces the first', () => {
    r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW);
    r.settings.setFlags({ rateHintShown: true }, NOW);
    r.settings.setUpdate({ checkedAt: NOW, latest: 'v0.3.0', url: 'https://example.com/r' }, NOW);
    const draft: Draft = { mode: 'readyBy', at: saturday.at, pitTempF: 225, items: saturday.items };
    r.settings.setDraft(draft, NOW);
    r.settings.setDraft({ ...draft, pitTempF: 250 }, NOW + 1);
    expect(r.settings.units()).toEqual({ temp: 'C', weight: 'kg' });
    expect(r.settings.flags()).toEqual({ rateHintShown: true });
    expect(r.settings.update()).toEqual({ checkedAt: NOW, latest: 'v0.3.0', url: 'https://example.com/r' });
    expect(r.settings.draft()).toEqual({ ...draft, pitTempF: 250 });
    expect(db.all('SELECT key FROM kv')).toHaveLength(4);
  });

  test.each([
    ['not JSON', '{"temp":'],
    ['the wrong shape', '{"temp":"K","weight":"stone"}'],
    ['not an object', '[1,2]'],
    ['null', 'null'],
  ])('corrupt values read as the default: %s', (_name, value) => {
    for (const key of ['units', 'flags', 'update', 'draft']) r.kv.set(key, 'x', NOW);
    corrupt('UPDATE kv SET value = ?', [value]);
    expect(r.settings.units()).toEqual({ temp: 'F', weight: 'lb' });
    expect(r.settings.flags()).toEqual({});
    expect(r.settings.update()).toBeNull();
    expect(r.settings.draft()).toBeNull();
  });

  test('a draft with one bad item is dropped whole, not half-loaded', () => {
    const items = [...saturday.items, { id: 'x', foodId: 'brisket', methodId: 'smoke', quantity: 'twelve' }];
    r.kv.set('draft', { mode: 'readyBy', at: NOW, pitTempF: 225, items }, NOW);
    expect(r.settings.draft()).toBeNull();
  });

  test('kv remove', () => {
    r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW);
    r.kv.remove('units', NOW);
    expect(r.settings.units()).toEqual({ temp: 'F', weight: 'lb' });
  });
});

describe('cookers', () => {
  test('nothing saved: no cookers, count 0 (first run)', () => {
    expect(r.cookers.load()).toEqual({});
    expect(r.cookers.count()).toBe(0);
  });

  test('gear round-trips; saving again replaces the set', () => {
    r.cookers.save(gear, NOW);
    expect(r.cookers.load()).toEqual(gear);
    expect(r.cookers.count()).toBe(3);
    r.cookers.save({ smoker: gear.smoker }, NOW + 1);
    expect(r.cookers.load()).toEqual({ smoker: gear.smoker });
  });

  test('a smoker and a griddle with the same profile id do not collide', () => {
    const same: Cookers = { smoker: { ...gear.smoker!, id: 'griddle' }, griddle: defaultGriddle() };
    r.cookers.save(same, NOW);
    expect(r.cookers.load()).toEqual(same);
  });

  test('a corrupt cooker is skipped; the others still load', () => {
    r.cookers.save(gear, NOW);
    corrupt("UPDATE cookers SET profile = '{oops' WHERE kind = 'smoker'");
    corrupt('UPDATE cookers SET profile = ? WHERE kind = ?', [
      '{"id":"oven","lowestTempF":"hot","holdIn":"ask"}',
      'oven',
    ]);
    expect(r.cookers.load()).toEqual({ griddle: gear.griddle });
    expect(r.cookers.count()).toBe(3);
  });
});

describe('rate overrides', () => {
  test('rates, total hours and locks round-trip in the store shape', () => {
    r.rates.setRate('brisket', 0.75, NOW);
    r.rates.setTotalHours('brisket', 9, NOW);
    r.rates.setLock('brisket', true, NOW);
    r.rates.setTotalHours('ribs', 5.5, NOW);
    expect(r.rates.load()).toEqual({
      rates: { brisket: 0.75 },
      totalHours: { brisket: 9, ribs: 5.5 },
      rateLocks: { brisket: true },
    });
  });

  test('null removes one value and keeps the others; an empty row is deleted', () => {
    r.rates.setRate('brisket', 0.75, NOW);
    r.rates.setTotalHours('brisket', 9, NOW);
    r.rates.setRate('brisket', null, NOW);
    expect(r.rates.load()).toEqual({ rates: {}, totalHours: { brisket: 9 }, rateLocks: {} });
    r.rates.setTotalHours('brisket', null, NOW);
    r.rates.setLock('ribs', true, NOW);
    r.rates.setLock('ribs', false, NOW);
    expect(db.all('SELECT food_id FROM rate_overrides')).toEqual([]);
  });

  test('a value that is not a usable number is ignored', () => {
    r.rates.setRate('brisket', 0.75, NOW);
    r.rates.setRate('ribs', 1, NOW);
    corrupt("UPDATE rate_overrides SET hr_per_lb = 'fast', total_hours = -3 WHERE food_id = 'brisket'");
    expect(r.rates.load()).toEqual({ rates: { ribs: 1 }, totalHours: {}, rateLocks: {} });
  });
});

describe('active cook', () => {
  const plan = buildPlan(rules, saturday);
  const cook = newCook(saturday, plan, NOW);

  test('no cook saved', () => {
    expect(r.activeCook.load()).toBeNull();
  });

  test('a cook round-trips; saving again rewrites the one row; clear removes it', () => {
    r.activeCook.save(cook, NOW);
    expect(r.activeCook.load()).toEqual(cook);
    const later = { ...cook, done: { 'fire:0': NOW + 5 }, quietUntil: NOW + 60000, notice: 'Serve moved 15 min.' };
    r.activeCook.save(later, NOW + 5);
    expect(r.activeCook.load()).toEqual(later);
    expect(db.all('SELECT id FROM active_cook')).toEqual([{ id: 1 }]);
    r.activeCook.clear(NOW);
    expect(r.activeCook.load()).toBeNull();
  });

  test('an older save with only input and plan is normalized; startedAt comes from the row', () => {
    r.activeCook.save(cook, NOW);
    corrupt('UPDATE active_cook SET data = ?', [JSON.stringify({ input: saturday, plan })]);
    expect(r.activeCook.load()).toEqual(cook);
  });

  test.each([
    ['not JSON', '{"plan":'],
    ['an array', '[]'],
    ['no plan', JSON.stringify({ input: saturday })],
    ['a plan with no events', JSON.stringify({ input: saturday, plan: { serveAt: 1 } })],
    ['a plan that is not an object', JSON.stringify({ input: saturday, plan: 5 })],
  ])('a corrupt cook reads as no cook: %s', (_name, data) => {
    r.activeCook.save(cook, NOW);
    corrupt('UPDATE active_cook SET data = ?', [data]);
    expect(r.activeCook.load()).toBeNull();
  });
});

describe('cook history', () => {
  test('no history', () => {
    expect(r.history.list()).toEqual([]);
    expect(r.history.logs()).toEqual([]);
  });

  test('records round-trip in the order saved, items in order', () => {
    const a = record('a');
    const b = record('b', { date: NOW - 86400000, notes: '', pitTempF: 250 });
    r.history.save(a, NOW);
    r.history.save(b, NOW + 1);
    expect(r.history.list()).toEqual([a, b]);
  });

  test('lateMin keeps its three meanings: late by N, ended early (null), not recorded (absent)', () => {
    const { lateMin: _none, ...old } = record('old');
    r.history.save(record('late', { lateMin: 20 }), NOW);
    r.history.save(record('early', { lateMin: null }), NOW);
    r.history.save(old, NOW);
    r.history.save(record('ontime', { lateMin: 0 }), NOW);
    const [late, early, unknown, onTime] = r.history.list();
    expect(late!.lateMin).toBe(20);
    expect(early!.lateMin).toBeNull();
    expect(unknown).not.toHaveProperty('lateMin');
    expect(onTime!.lateMin).toBe(0);
    expect(serveStatus(early!)?.text).toBe('Ended early');
    expect(serveStatus(unknown!)).toBeNull();
    expect(serveStatus(onTime!)?.text).toBe('On time');
  });

  test('logs() is logsOf(list()): discarded items left out, same order', () => {
    const a = record('a');
    a.items[1]!.log.discarded = true;
    r.history.save(a, NOW);
    r.history.save(record('b'), NOW);
    r.history.save(record('c', { items: [] }), NOW);
    const records = r.history.list();
    expect(records[0]!.items[1]!.log.discarded).toBe(true);
    expect(r.history.logs()).toEqual(logsOf(records));
    expect(r.history.logs().map(l => l.foodId)).toEqual(['brisket', 'brisket', 'wings']);
  });

  test('saving a record with an existing id replaces it in place', () => {
    r.history.save(record('a'), NOW);
    r.history.save(record('b'), NOW);
    const edited = record('a', { notes: 'Edited.', items: [record('a').items[1]!] });
    r.history.save(edited, NOW + 9);
    expect(r.history.list()).toEqual([edited, record('b')]);
    expect(db.get('SELECT COUNT(*) AS n FROM cook_history_items')).toEqual({ n: 3 });
  });

  test('remove deletes the record and its items', () => {
    r.history.save(record('a'), NOW);
    r.history.save(record('b'), NOW);
    r.history.remove('a', NOW);
    expect(r.history.list().map(x => x.id)).toEqual(['b']);
    expect(db.get('SELECT COUNT(*) AS n FROM cook_history_items')).toEqual({ n: 2 });
    r.history.remove('missing', NOW);
  });

  test('corrupt options read as no options; the cook still loads and still counts', () => {
    r.history.save(record('a'), NOW);
    corrupt("UPDATE cook_history_items SET options = '{bad' WHERE food_id = 'brisket'");
    const [a] = r.history.list();
    expect(a!.items[0]!.log).not.toHaveProperty('options');
    expect(a!.items).toHaveLength(2);
    corrupt("UPDATE cook_history_items SET options = '[1]' WHERE food_id = 'brisket'");
    expect(r.history.logs()[0]).not.toHaveProperty('options');
  });

  test('a failed save leaves history as it was', () => {
    r.history.save(record('a'), NOW);
    const bad = record('b');
    (bad.items[1]!.log as { foodId: unknown }).foodId = null; // NOT NULL column: the second item fails
    expect(() => r.history.save(bad, NOW)).toThrow();
    expect(r.history.list()).toEqual([record('a')]);
  });
});

describe('quarantine: an unreadable value is copied aside before a write replaces it', () => {
  const draft: Draft = { mode: 'readyBy', at: saturday.at, pitTempF: 225, items: saturday.items };

  test('nothing is quarantined when what was stored could be read', () => {
    r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW);
    r.settings.setUnits({ temp: 'F', weight: 'lb' }, NOW + 1);
    r.settings.setDraft(draft, NOW);
    r.settings.setDraft(draft, NOW + 1);
    r.cookers.save(gear, NOW);
    r.cookers.save(gear, NOW + 1);
    r.rates.setRate('brisket', 0.75, NOW);
    r.rates.setRate('brisket', 0.8, NOW + 1);
    r.rates.setLock('brisket', true, NOW + 2);
    r.history.save(record('a'), NOW);
    r.history.save(record('a'), NOW + 1);
    r.history.remove('a', NOW + 2);
    expect(r.quarantined()).toEqual([]);
  });

  test('a corrupt draft: reading keeps it, the first save quarantines the raw text with its time', () => {
    r.settings.setDraft(draft, NOW);
    corrupt('UPDATE kv SET value = \'{"mode":"readyBy","items":\' WHERE key = \'draft\'');
    expect(r.settings.readDraft()).toEqual({ value: null, corrupt: true });
    expect(r.settings.readDraft()).toEqual({ value: null, corrupt: true });
    expect(r.quarantined()).toEqual([]);
    r.settings.setDraft(draft, NOW + 500);
    expect(r.quarantined()).toEqual([
      { key: `quarantine:kv:draft:${NOW + 500}`, origin: 'kv:draft', at: NOW + 500, raw: '{"mode":"readyBy","items":' },
    ]);
    expect(r.settings.readDraft()).toEqual({ value: draft, corrupt: false });
    r.settings.setDraft({ ...draft, pitTempF: 250 }, NOW + 600);
    expect(r.quarantined()).toHaveLength(1);
  });

  test('a missing draft is not corrupt', () => {
    expect(r.settings.readDraft()).toEqual({ value: null, corrupt: false });
  });

  test('valid JSON of the wrong shape is quarantined too (units)', () => {
    r.kv.set('units', { temp: 'K' }, NOW);
    r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW + 1);
    expect(r.quarantined().map(q => [q.origin, q.raw])).toEqual([['kv:units', '{"temp":"K"}']]);
  });

  test('kv.remove quarantines an unreadable value before deleting it', () => {
    r.kv.set('update', 1, NOW);
    corrupt("UPDATE kv SET value = 'not json' WHERE key = 'update'");
    r.kv.remove('update', NOW + 1);
    expect(r.quarantined().map(q => [q.origin, q.raw])).toEqual([['kv:update', 'not json']]);
  });

  test('two values quarantined from the same place in the same millisecond both stay', () => {
    for (const bad of ['first{', 'second{']) {
      r.kv.set('flags', {}, NOW);
      corrupt('UPDATE kv SET value = ? WHERE key = ?', [bad, 'flags']);
      r.settings.setFlags({ supportShown: true }, NOW + 1);
    }
    expect(r.quarantined().map(q => q.raw)).toEqual(['first{', 'second{']);
    expect(new Set(r.quarantined().map(q => q.key)).size).toBe(2);
  });

  test('cookers: saving gear keeps the unreadable profile, not the readable ones', () => {
    r.cookers.save(gear, NOW);
    corrupt("UPDATE cookers SET profile = '{oops' WHERE kind = 'smoker'");
    r.cookers.save({ ...r.cookers.load(), smoker: gear.smoker }, NOW + 1);
    expect(r.quarantined().map(q => [q.origin, q.raw])).toEqual([['cookers:smoker:pb820', '{oops']]);
    expect(r.cookers.load()).toEqual(gear);
  });

  test('active cook: save and clear both keep an unreadable cook first', () => {
    const cook = newCook(saturday, buildPlan(rules, saturday), NOW);
    r.activeCook.save(cook, NOW);
    corrupt('UPDATE active_cook SET data = \'{"plan":5}\'');
    r.activeCook.clear(NOW + 1);
    r.activeCook.save(cook, NOW + 2);
    corrupt("UPDATE active_cook SET data = 'x'");
    r.activeCook.save(cook, NOW + 3);
    expect(r.quarantined().map(q => [q.origin, q.at, q.raw])).toEqual([
      ['active_cook', NOW + 1, '{"plan":5}'],
      ['active_cook', NOW + 3, 'x'],
    ]);
  });

  test('rates: replacing an unusable rate keeps the row as it was', () => {
    r.rates.setRate('brisket', 0.75, NOW);
    r.rates.setTotalHours('brisket', 9, NOW);
    corrupt("UPDATE rate_overrides SET hr_per_lb = 'fast' WHERE food_id = 'brisket'");
    r.rates.setTotalHours('brisket', 10, NOW + 1); // another column: the bad rate is still there, nothing lost yet
    expect(r.quarantined()).toEqual([]);
    r.rates.setRate('brisket', 0.8, NOW + 2);
    const [q] = r.quarantined();
    expect(q).toMatchObject({ origin: 'rate_overrides:brisket', at: NOW + 2 });
    expect(JSON.parse(q!.raw)).toEqual({ food_id: 'brisket', hr_per_lb: 'fast', total_hours: 10, locked: 0 });
    expect(r.rates.load().rates).toEqual({ brisket: 0.8 });
  });

  test('history: replacing or removing a cook keeps item options that could not be read', () => {
    r.history.save(record('a'), NOW);
    r.history.save(record('b'), NOW);
    corrupt("UPDATE cook_history_items SET options = '{bad' WHERE food_id = 'brisket'");
    r.history.save(record('a', { notes: 'Edited.' }), NOW + 1);
    r.history.remove('b', NOW + 2);
    expect(r.quarantined().map(q => [q.origin, q.at, q.raw])).toEqual([
      ['cook_history_items:a:0', NOW + 1, '{bad'],
      ['cook_history_items:b:0', NOW + 2, '{bad'],
    ]);
  });

  test('a failed write quarantines nothing (same transaction)', () => {
    r.history.save(record('a'), NOW);
    corrupt("UPDATE cook_history_items SET options = '{bad' WHERE food_id = 'brisket'");
    const bad = record('a');
    (bad.items[1]!.log as { foodId: unknown }).foodId = null;
    expect(() => r.history.save(bad, NOW + 1)).toThrow();
    expect(r.quarantined()).toEqual([]);
    expect(db.get("SELECT options FROM cook_history_items WHERE food_id = 'brisket'")).toEqual({ options: '{bad' });
  });
});
