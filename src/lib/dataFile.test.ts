// The data file (T-036): build from the app's data, read back as untrusted input.
import type { Cookers } from '../../engine/types';
import { exportDump } from '../db/export';
import { openMigrated } from '../db/migrate';
import { migrations } from '../db/migrations';
import { repos } from '../db/repos';
import { testDb } from '../db/testDb';
import {
  DATA_FORMAT,
  DATA_VERSION,
  MAX_CHARS,
  MAX_COOKS,
  MAX_ITEMS,
  MAX_NOTES,
  buildDataFile,
  dataFileName,
  readDataFile,
  type DataInput,
} from './dataFile';
import { saturday } from './fixtures/saturday';
import { defaultGriddle, defaultOven } from './gear';
import type { CookRecord } from './history';
import { rules } from './rules';

const NOW = 1794500000000;
const DAY = 86_400_000;

const gear: Cookers = {
  smoker: { ...saturday.cookers.smoker!, tempPresetsF: [225, 250] },
  griddle: defaultGriddle(),
  oven: { ...defaultOven(), warmingDrawer: true },
};

const brisket = (over: Partial<CookRecord['items'][number]['log']> = {}): CookRecord['items'][number] => ({
  name: '12 lb brisket',
  plannedMin: 540,
  actualMin: 555,
  log: {
    foodId: 'brisket',
    methodId: 'smoked',
    smokerId: 'pb820',
    quantity: 12,
    pitTempF: 225,
    minutesOnHeat: 555,
    options: { wrap: 'paper' },
    ...over,
  },
});

const records: CookRecord[] = [
  { id: '1794000000000', date: NOW - 30 * DAY, notes: 'Windy.', pitTempF: 225, lateMin: 12, items: [brisket()] },
  {
    id: '1794100000000',
    date: NOW - 20 * DAY,
    notes: '',
    pitTempF: 250,
    lateMin: null,
    items: [
      brisket({ discarded: true }),
      {
        name: 'Wings',
        plannedMin: 90,
        actualMin: 85,
        log: {
          foodId: 'wings',
          methodId: 'smokeCrisp',
          smokerId: 'pb820',
          quantity: 2,
          pitTempF: 250,
          minutesOnHeat: 85,
        },
      },
    ],
  },
  // Saved before lateness was kept: no lateMin at all.
  { id: 'cook-3', date: NOW - 10 * DAY, notes: 'Old one.', pitTempF: 225, items: [brisket()] },
];

const input: DataInput = {
  gear,
  units: { temp: 'C', weight: 'kg' },
  rates: { brisket: 0.8, butt: 1.4 },
  totalHours: { turkey: 4.5 },
  rateLocks: { brisket: true },
  records,
  flags: { supportShown: true },
};

/** A built file as an object, for tests that change one field. */
const fileObj = (over: Partial<DataInput> = {}) => JSON.parse(buildDataFile({ ...input, ...over }, NOW, '0.3.0'));
const read = (obj: unknown, now = NOW) => readDataFile(rules, JSON.stringify(obj), now);
const okRead = (obj: unknown) => {
  const r = read(obj);
  if (!r.ok) throw new Error(`refused: ${r.problem}`);
  return r;
};

describe('building the file', () => {
  test('holds the format, version, time, app version and the user data, nothing else', () => {
    const f = fileObj();
    expect(Object.keys(f)).toEqual([
      'format',
      'version',
      'exportedAt',
      'appVersion',
      'units',
      'gear',
      'rates',
      'totalHours',
      'rateLocks',
      'history',
      'flags',
    ]);
    expect(f).toMatchObject({ format: DATA_FORMAT, version: DATA_VERSION, exportedAt: NOW, appVersion: '0.3.0' });
    expect(DATA_FORMAT).toBe('pitplanner-data');
    expect(DATA_VERSION).toBe(1);
  });

  test('the file name has the UTC date and time', () => {
    expect(dataFileName(Date.UTC(2026, 10, 16, 9, 5))).toBe('pitplanner-data-2026-11-16-0905.json');
  });
});

describe('round trip', () => {
  test('export then read gives the same data back, with nothing dropped', () => {
    const r = okRead(fileObj());
    expect(r.from).toBe('data');
    expect(r.exportedAt).toBe(NOW);
    expect(r.appVersion).toBe('0.3.0');
    expect(r.dropped).toEqual([]);
    expect(r.counts).toEqual({ cookers: 3, rates: 3, cooks: 3 });
    expect(r.data).toEqual({
      gear,
      units: input.units,
      rates: input.rates,
      totalHours: input.totalHours,
      rateLocks: input.rateLocks,
      history: records,
      flags: input.flags,
    });
    // lateMin keeps its three states: a number, null (ended early) and absent (older records).
    expect(r.data.history[1]).toHaveProperty('lateMin', null);
    expect(r.data.history[2]).not.toHaveProperty('lateMin');
  });

  test('"Export my data" (the raw table dump) reads back to the same data', () => {
    const db = testDb();
    expect(openMigrated(db, migrations).ok).toBe(true);
    const r = repos(db);
    r.cookers.save(gear, NOW);
    r.settings.setUnits(input.units, NOW);
    r.settings.setFlags(input.flags, NOW);
    r.rates.setRate('brisket', 0.8, NOW);
    r.rates.setRate('butt', 1.4, NOW);
    r.rates.setTotalHours('turkey', 4.5, NOW);
    r.rates.setLock('brisket', true, NOW);
    for (const rec of records) r.history.save(rec, NOW);
    const dumped = readDataFile(rules, JSON.stringify(exportDump(db, NOW, '0.3.0')), NOW);
    expect(dumped).toMatchObject({ ok: true, from: 'dump', exportedAt: NOW, appVersion: '0.3.0', dropped: [] });
    expect(dumped.ok && dumped.data).toEqual(okRead(fileObj()).data);
  });
});

describe('refused files', () => {
  test('too big: refused before it is parsed', () => {
    const big = JSON.stringify({ ...fileObj(), pad: 'x'.repeat(MAX_CHARS) });
    expect(readDataFile(rules, big, NOW)).toEqual({ ok: false, problem: 'too big' });
  });

  test('not JSON, not an object, or another app', () => {
    expect(readDataFile(rules, '{"format":', NOW)).toEqual({ ok: false, problem: 'not json' });
    expect(readDataFile(rules, '[1,2]', NOW)).toEqual({ ok: false, problem: 'not ours' });
    expect(readDataFile(rules, 'null', NOW)).toEqual({ ok: false, problem: 'not ours' });
    expect(read({ ...fileObj(), format: 'other-app' })).toEqual({ ok: false, problem: 'not ours' });
    // A shared plan is not a data file.
    expect(read({ app: 'pit-planner', version: 1, serveAt: '2026-11-14T22:00:00Z', items: [] })).toEqual({
      ok: false,
      problem: 'not ours',
    });
    expect(read({ format: 'pitplanner-debug', formatVersion: 1 })).toEqual({ ok: false, problem: 'not ours' });
  });

  test('a newer version asks for an app update; a broken version is damaged', () => {
    expect(read({ ...fileObj(), version: 2 })).toEqual({ ok: false, problem: 'newer' });
    expect(read({ ...fileObj(), version: '1' })).toEqual({ ok: false, problem: 'damaged' });
    expect(read({ ...fileObj(), version: 0 })).toEqual({ ok: false, problem: 'damaged' });
    expect(read({ ...fileObj(), version: 1.5 })).toEqual({ ok: false, problem: 'damaged' });
  });

  test('a dump from a newer database, or without its tables, is refused', () => {
    const dump = { format: 'pitplanner-export', formatVersion: 1, exportedAt: NOW, schemaVersion: 2, tables: {} };
    expect(read(dump)).toEqual({ ok: false, problem: 'newer' });
    expect(read({ ...dump, formatVersion: 2, schemaVersion: 1 })).toEqual({ ok: false, problem: 'newer' });
    expect(read({ ...dump, schemaVersion: 1, tables: [] })).toEqual({ ok: false, problem: 'damaged' });
  });

  test('a file with nothing to restore is refused, so it cannot wipe the phone', () => {
    const empty = fileObj({ gear: {}, rates: {}, totalHours: {}, rateLocks: {}, records: [] });
    expect(read(empty)).toEqual({ ok: false, problem: 'nothing to restore' });
    expect(read({ format: DATA_FORMAT, version: 1 })).toEqual({ ok: false, problem: 'nothing to restore' });
  });
});

describe('trimmed with a reason', () => {
  test('unknown top-level and nested fields are ignored, never copied', () => {
    const f = fileObj();
    f.extra = { path: '/data/data/other.app/files/x' };
    f.gear.smoker.uri = 'content://evil/1';
    f.history[0].items[0].log.extra = 1;
    f.history[0].photo = 'file:///sdcard/x.jpg';
    const r = okRead(f);
    expect(r.dropped).toEqual([]);
    expect(r.data.gear.smoker).toEqual(gear.smoker);
    expect(JSON.stringify(r.data)).not.toMatch(/content:|file:|extra|photo|path/);
  });

  test('wrong types: each bad part is dropped on its own and named', () => {
    const f = fileObj();
    f.units = { temp: 'K', weight: 'lb' };
    f.gear.griddle.burners = 'four';
    f.gear.spaceship = { id: 'x' };
    f.rates.butt = '1.4';
    f.totalHours = 'lots';
    f.rateLocks.brisket = 'yes';
    f.flags = [true];
    f.history[2].date = 'yesterday';
    const r = okRead(f);
    expect(r.data.units).toBeNull();
    expect(r.data.flags).toBeNull();
    expect(r.data.gear).toEqual({ smoker: gear.smoker, oven: gear.oven });
    expect(r.data.rates).toEqual({ brisket: 0.8 });
    expect(r.data.totalHours).toEqual({});
    expect(r.data.rateLocks).toEqual({});
    expect(r.data.history.map(h => h.id)).toEqual(['1794000000000', '1794100000000']);
    expect(r.dropped).toEqual([
      { part: 'units', key: 'units', reason: 'bad value' },
      { part: 'gear', key: 'griddle', reason: 'bad value' },
      { part: 'gear', key: 'spaceship', reason: 'unknown kind' },
      { part: 'rates', key: 'butt', reason: 'bad value' },
      { part: 'totalHours', key: 'totalHours', reason: 'bad value' },
      { part: 'rateLocks', key: 'brisket', reason: 'bad value' },
      { part: 'history', key: 'cook-3', reason: 'bad value' },
      { part: 'flags', key: 'flags', reason: 'bad value' },
    ]);
  });

  test('numbers out of range are dropped, not clamped', () => {
    const f = fileObj();
    f.gear.smoker.maxTempF = 1e9;
    f.gear.oven.lowestTempF = -40;
    f.rates.brisket = 40; // rateLimits are 0.3 to 2.5 hr/lb
    f.rates.butt = 0;
    f.totalHours.turkey = 1000;
    f.history[0].pitTempF = 5000;
    f.history[1].items[1].log.quantity = 1e12;
    f.history[2].lateMin = Number.MAX_SAFE_INTEGER;
    const r = okRead(f);
    expect(r.data.gear).toEqual({ griddle: gear.griddle });
    expect(r.data.rates).toEqual({});
    expect(r.data.totalHours).toEqual({});
    expect(r.data.rateLocks).toEqual({ brisket: true });
    expect(r.data.history.map(h => [h.id, h.items.length])).toEqual([['1794100000000', 1]]);
    expect(r.dropped).toEqual([
      { part: 'gear', key: 'smoker', reason: 'out of range' },
      { part: 'gear', key: 'oven', reason: 'out of range' },
      { part: 'rates', key: 'brisket', reason: 'out of range' },
      { part: 'rates', key: 'butt', reason: 'out of range' },
      { part: 'totalHours', key: 'turkey', reason: 'out of range' },
      { part: 'history', key: '1794000000000', reason: 'out of range' },
      { part: 'history', key: '1794100000000 item 2', reason: 'out of range' },
      { part: 'history', key: 'cook-3', reason: 'out of range' },
    ]);
  });

  test('a smoker whose lowest temp is above its highest is out of range', () => {
    const f = fileObj();
    f.gear.smoker.minTempF = 600;
    expect(okRead(f).dropped).toEqual([{ part: 'gear', key: 'smoker', reason: 'out of range' }]);
  });

  test('a cook dated in the far future or before 2000 is out of range; `now` is passed in', () => {
    const f = fileObj();
    f.history[0].date = NOW + 400 * DAY;
    f.history[1].date = Date.UTC(1999, 0, 1);
    expect(okRead(f).data.history.map(h => h.id)).toEqual(['cook-3']);
    // The same file read a year later keeps the first one.
    const later = readDataFile(rules, JSON.stringify(f), NOW + 400 * DAY);
    expect(later.ok && later.data.history.map(h => h.id)).toEqual(['1794000000000', 'cook-3']);
  });

  test('unknown foods and methods are reported, not crashed on; a cooked food the app does not know is kept', () => {
    const f = fileObj();
    f.rates.lamb = 1.2;
    f.rateLocks.lamb = true;
    // From a newer app (Jason, 2026-11-16): a food this app does not know is kept in history, method and all.
    f.history[1].items[1].log.foodId = 'lamb';
    f.history[1].items[1].log.methodId = 'spit';
    f.history[0].items[0].log.methodId = 'sous-vide';
    // JSON.parse makes "__proto__" an own key; it must never reach an object's prototype.
    const text = JSON.stringify(f).replace('"totalHours":{', '"totalHours":{"__proto__":2,');
    expect(text).toContain('"__proto__":2');
    const r = readDataFile(rules, text, NOW);
    if (!r.ok) throw new Error(r.problem);
    expect(r.data.rates).toEqual({ brisket: 0.8, butt: 1.4 });
    expect(r.data.rateLocks).toEqual({ brisket: true });
    expect(Object.getPrototypeOf(r.data.totalHours)).toBe(Object.prototype);
    expect(r.data.totalHours).toEqual({ turkey: 4.5 });
    // A cook keeps the items that are left; one with none left goes. The unknown food stays as it was.
    expect(r.data.history.map(h => [h.id, h.items.map(i => i.log.foodId)])).toEqual([
      ['1794100000000', ['brisket', 'lamb']],
      ['cook-3', ['brisket']],
    ]);
    expect(r.data.history[0]!.items[1]).toEqual({
      ...records[1]!.items[1],
      log: { ...records[1]!.items[1]!.log, foodId: 'lamb', methodId: 'spit' },
    });
    expect(r.counts.cooks).toBe(2);
    expect(r.dropped).toEqual([
      { part: 'rates', key: 'lamb', reason: 'unknown food' },
      { part: 'totalHours', key: '__proto__', reason: 'unknown food' },
      { part: 'rateLocks', key: 'lamb', reason: 'unknown food' },
      { part: 'history', key: '1794000000000 item 1', reason: 'unknown method' },
      { part: 'history', key: '1794000000000', reason: 'no items left' },
    ]);
  });

  test('a cooked food the app does not know still has every other check', () => {
    const f = fileObj();
    const lamb = f.history[0].items[0];
    lamb.log.foodId = 'lamb';
    lamb.log.quantity = -1;
    f.history[2].items[0].log.foodId = 'x'.repeat(65);
    const r = okRead(f);
    expect(r.data.history.map(h => h.id)).toEqual(['1794100000000']);
    expect(r.dropped).toEqual([
      { part: 'history', key: '1794000000000 item 1', reason: 'out of range' },
      { part: 'history', key: '1794000000000', reason: 'no items left' },
      { part: 'history', key: 'cook-3 item 1', reason: 'bad value' },
      { part: 'history', key: 'cook-3', reason: 'no items left' },
    ]);
  });

  test('a cook id that is not a plain short name, or used twice, is dropped', () => {
    const f = fileObj();
    f.history[1].id = '../../etc/passwd';
    f.history[2].id = '1794000000000';
    const r = okRead(f);
    expect(r.data.history.map(h => h.id)).toEqual(['1794000000000']);
    expect(r.dropped).toEqual([
      { part: 'history', key: 'cook 2', reason: 'bad value' },
      { part: 'history', key: '1794000000000', reason: 'duplicate' },
    ]);
  });

  test('huge arrays: the newest cooks are kept, items past the plan limit go', () => {
    const many = Array.from({ length: MAX_COOKS + 5 }, (_, i) => ({ ...records[0], id: `c${i}` }));
    const f = fileObj({ records: many });
    f.history[MAX_COOKS + 4].items = Array.from({ length: MAX_ITEMS + 3 }, () => brisket());
    const r = okRead(f);
    expect(r.data.history).toHaveLength(MAX_COOKS);
    expect(r.data.history[0]!.id).toBe('c5');
    expect(r.data.history[MAX_COOKS - 1]!.items).toHaveLength(MAX_ITEMS);
    expect(r.dropped).toEqual([
      { part: 'history', key: '5 cooks', reason: 'too many' },
      { part: 'history', key: `c${MAX_COOKS + 4} 3 items`, reason: 'too many' },
    ]);
  });

  test('a huge options map or overlong strings drop the item; long notes are cut and kept', () => {
    const f = fileObj();
    f.history[0].items[0].log.options = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, 'v']));
    f.history[1].items[1].name = 'w'.repeat(500);
    f.history[2].notes = 'n'.repeat(MAX_NOTES + 10);
    const r = okRead(f);
    expect(r.data.history.map(h => h.id)).toEqual(['1794100000000', 'cook-3']);
    expect(r.data.history[0]!.items).toHaveLength(1);
    expect(r.data.history[1]!.notes).toHaveLength(MAX_NOTES);
    expect(r.dropped).toEqual([
      { part: 'history', key: '1794000000000 item 1', reason: 'bad value' },
      { part: 'history', key: '1794000000000', reason: 'no items left' },
      { part: 'history', key: '1794100000000 item 2', reason: 'bad value' },
      { part: 'history', key: 'cook-3', reason: 'notes cut' },
    ]);
  });

  test('a dump with odd rows is read row by row and never throws', () => {
    const dump = {
      format: 'pitplanner-export',
      formatVersion: 1,
      exportedAt: NOW,
      appVersion: '0.3.0',
      schemaVersion: 1,
      tables: {
        cookers: [
          { id: 'smoker:pb820', kind: 'smoker', profile: '{"broken', position: 0 },
          { id: 'griddle:g', kind: 'griddle', profile: JSON.stringify(gear.griddle), position: 1 },
          'not a row',
        ],
        kv: [
          { key: 'units', value: '{"temp":"C","weight":"lb"}' },
          { key: 'draft', value: '{}' },
          { key: 'quarantine:kv:units:1', value: '{}' },
        ],
        rate_overrides: [{ food_id: 'brisket', hr_per_lb: 0.9, total_hours: null, locked: 1 }, null],
        cook_history: [{ id: 'x', served_at: NOW - DAY, pit_temp_f: 225, late_min: null, ended_early: 0, notes: '' }],
        cook_history_items: [
          {
            cook_id: 'x',
            position: 1,
            name: 'Wings',
            food_id: 'wings',
            method_id: 'hot',
            smoker_id: 'pb820',
            quantity: 2,
            pit_temp_f: 225,
            minutes_on_heat: 60,
            planned_min: 60,
            actual_min: 60,
            options: 'not json',
            discarded: 0,
          },
          {
            cook_id: 'x',
            position: 0,
            name: 'Brisket',
            food_id: 'brisket',
            method_id: 'smoked',
            smoker_id: 'pb820',
            quantity: 12,
            pit_temp_f: 225,
            minutes_on_heat: 600,
            planned_min: 600,
            actual_min: 600,
            options: null,
            discarded: 0,
          },
          {
            cook_id: 'gone',
            position: 0,
            name: 'B',
            food_id: 'brisket',
            method_id: 'smoked',
            smoker_id: 'pb820',
            quantity: 12,
            pit_temp_f: 225,
            minutes_on_heat: 600,
            planned_min: 600,
            actual_min: 600,
            options: null,
            discarded: 0,
          },
        ],
        active_cook: [{ id: 1, data: '{}', started_at: NOW, updated_at: NOW }],
      },
      errors: { cookers: 'disk I/O error' },
    };
    const r = okRead(dump);
    expect(r.from).toBe('dump');
    expect(r.data.gear).toEqual({ griddle: gear.griddle });
    expect(r.data.units).toEqual({ temp: 'C', weight: 'lb' });
    expect(r.data.flags).toBeNull();
    expect(r.data.rates).toEqual({ brisket: 0.9 });
    expect(r.data.rateLocks).toEqual({ brisket: true });
    // Items in position order; options that are not readable JSON are dropped from the item, as the app reads them.
    expect(r.data.history).toEqual([
      {
        id: 'x',
        date: NOW - DAY,
        notes: '',
        pitTempF: 225,
        items: [
          expect.objectContaining({ name: 'Brisket' }),
          {
            name: 'Wings',
            plannedMin: 60,
            actualMin: 60,
            log: { foodId: 'wings', methodId: 'hot', smokerId: 'pb820', quantity: 2, pitTempF: 225, minutesOnHeat: 60 },
          },
        ],
      },
    ]);
    expect(r.dropped).toEqual([{ part: 'gear', key: 'smoker', reason: 'bad value' }]);
  });
});
