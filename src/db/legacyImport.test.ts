import type { LegacyStore } from '../platform/types';
import type { Db } from './db';
import {
  legacyCook,
  legacyDraft,
  legacyGear,
  legacyHistoryJson,
  legacyPrefs,
  legacyRecords,
} from './fixtures/legacy020';
import { importLegacy, importNotice, importReport, markNoticeSeen, type ImportReport } from './legacyImport';
import { openMigrated } from './migrate';
import { migrations } from './migrations';
import { repos, type Repos } from './repos';
import { testDb } from './testDb';

// The Saturday fixture serves Nov 14, 2026 22:00 UTC. "Now" is the morning of the cook: it is still running.
const NOW = Date.UTC(2026, 10, 14, 12, 0);
const STARTED = NOW - 3_600_000;

let db: Db;
let r: Repos;
beforeEach(() => {
  db = testDb();
  expect(openMigrated(db, migrations).ok).toBe(true);
  r = repos(db);
});

/** A fake of the phone's old files that records what was retired. */
function fakeLegacy(prefs: Record<string, string>, history: string | null) {
  const calls: string[] = [];
  const store: LegacyStore = {
    readCapacitorPrefs: () => prefs,
    readHistoryFile: () => history,
    retireCapacitorPrefs: () => (calls.push('prefs'), true),
    retireHistoryFile: () => void calls.push('history'),
  };
  return { store, calls };
}
const full = () => fakeLegacy(legacyPrefs(STARTED), legacyHistoryJson());
const withPref = (key: string, value: string | undefined) => {
  const prefs = legacyPrefs(STARTED);
  if (value === undefined) delete prefs[key];
  else prefs[key] = value;
  return fakeLegacy(prefs, legacyHistoryJson());
};

describe('a full 0.2.0 install', () => {
  test('everything comes along, the old files are retired, and there is nothing to announce', () => {
    const legacy = full();
    const report = importLegacy(db, legacy.store, NOW);
    expect(report).toEqual({
      status: 'done',
      at: NOW,
      cookers: 3,
      rates: 2,
      cooks: 2,
      plan: true,
      runningCook: true,
      lost: [],
      noticeSeen: false,
    });
    expect(r.cookers.load()).toEqual(legacyGear);
    expect(r.settings.units()).toEqual({ temp: 'F', weight: 'lb' });
    expect(r.settings.draft()).toEqual(legacyDraft);
    expect(r.rates.load()).toEqual({
      rates: { brisket: 0.75 },
      totalHours: { ribs: 5.5 },
      rateLocks: { brisket: true },
    });
    expect(r.settings.flags()).toEqual({ rateHintShown: true });
    expect(r.settings.update()).toEqual({ checkedAt: STARTED, latest: null, url: null });
    expect(r.activeCook.load()).toEqual(legacyCook(STARTED));
    expect(r.history.list()).toEqual(legacyRecords);
    // The record from before lateness was kept still has none; the discarded item is not learned from.
    expect(r.history.list()[0]).not.toHaveProperty('lateMin');
    expect(r.history.logs().map(l => l.foodId)).toEqual(['brisket', 'brisket']);
    expect(r.quarantined()).toEqual([]);
    expect(legacy.calls).toEqual(['prefs', 'history']);
    expect(importNotice(report)).toBeNull();
  });

  test('it runs once: a second start changes nothing and retires nothing', () => {
    const first = importLegacy(db, full().store, NOW);
    r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW + 1);
    const again = full();
    expect(importLegacy(db, again.store, NOW + 5000)).toEqual(first);
    expect(again.calls).toEqual([]);
    expect(r.settings.units()).toEqual({ temp: 'C', weight: 'kg' });
    expect(r.history.list()).toHaveLength(2);
  });

  test('a cook whose serve time has passed is over: not imported, not reported as lost', () => {
    const report = importLegacy(db, full().store, Date.UTC(2026, 10, 15, 12, 0));
    expect(report).toMatchObject({ status: 'done', runningCook: false, lost: [] });
    expect(r.activeCook.load()).toBeNull();
  });
});

describe('no 0.2.0 data', () => {
  test('a new install: nothing imported, no notice, nothing retired, and it does not look again', () => {
    const legacy = fakeLegacy({}, null);
    const report = importLegacy(db, legacy.store, NOW);
    expect(report).toMatchObject({ status: 'none', cookers: 0, lost: [] });
    expect(importNotice(report)).toBeNull();
    expect(legacy.calls).toEqual([]);
    expect(r.cookers.count()).toBe(0);
    expect(importReport(db)).toEqual(report);
  });
});

describe('partial import', () => {
  test('a corrupt gear entry: the rest comes along, the notice names what did not, the old files stay', () => {
    const legacy = withPref('gear', '{"smoker":{"id":"pb820","name":');
    const report = importLegacy(db, legacy.store, NOW);
    expect(report).toMatchObject({ status: 'partial', cookers: 0, rates: 2, cooks: 2, plan: true, lost: ['cookers'] });
    expect(r.cookers.count()).toBe(0);
    expect(r.history.list()).toHaveLength(2);
    expect(importNotice(report)).toEqual({
      title: 'Pit Planner has a new look',
      body: 'Your rates, plan, running cook and 2 past cooks came along. Your cookers could not be moved.',
    });
    expect(legacy.calls).toEqual([]);
    expect(r.quarantined()).toEqual([
      { key: `quarantine:legacy:gear:${NOW}`, origin: 'legacy:gear', at: NOW, raw: '{"smoker":{"id":"pb820","name":' },
    ]);
  });

  test('one unreadable cooker does not cost the others', () => {
    const gear = { ...legacyGear, oven: { id: 'oven', lowestTempF: 'hot', holdIn: 'ask' } };
    const report = importLegacy(db, withPref('gear', JSON.stringify(gear)).store, NOW);
    expect(report).toMatchObject({ status: 'partial', cookers: 2, lost: ['cookers'] });
    expect(r.cookers.load()).toEqual({ smoker: legacyGear.smoker, griddle: legacyGear.griddle });
    expect(r.quarantined().map(q => q.origin)).toEqual(['legacy:gear']);
  });

  test.each([
    [
      'draft',
      'not json',
      'plan',
      'Your cookers, rates, running cook and 2 past cooks came along. Your plan could not be moved.',
    ],
    [
      'settings',
      '{"temp":"K"}',
      'units',
      'Your cookers, rates, plan, running cook and 2 past cooks came along. Your units could not be moved.',
    ],
    [
      'activeCook',
      '{"plan":5}',
      'running cook',
      'Your cookers, rates, plan and 2 past cooks came along. Your running cook could not be moved.',
    ],
    [
      'rates',
      '[1]',
      'rates',
      'Your cookers, rates, plan, running cook and 2 past cooks came along. Your rates could not be moved.',
    ],
  ] as const)('an unreadable %s is named in the notice', (key, value, part, body) => {
    const report = importLegacy(db, withPref(key, value).store, NOW);
    expect(report).toMatchObject({ status: 'partial', lost: [part] });
    expect(importNotice(report)?.body).toBe(body);
    expect(r.quarantined().map(q => q.origin)).toContain(`legacy:${key}`);
  });

  test('a rate of the wrong type costs only itself', () => {
    const report = importLegacy(db, withPref('rates', '{"brisket":0.75,"ribs":"fast"}').store, NOW);
    expect(report).toMatchObject({ status: 'partial', rates: 2, lost: ['rates'] });
    expect(r.rates.load().rates).toEqual({ brisket: 0.75 });
  });

  test('history: readable cooks come along, the others are named, the file is quarantined whole', () => {
    const records = [...legacyRecords, { id: 'cook-3', date: 'yesterday', items: [] }];
    const legacy = fakeLegacy(legacyPrefs(STARTED), JSON.stringify(records));
    const report = importLegacy(db, legacy.store, NOW);
    expect(report).toMatchObject({ status: 'partial', cooks: 2, lost: ['past cooks'] });
    expect(importNotice(report)?.body).toBe(
      'Your cookers, rates, plan, running cook and 2 past cooks came along. Your other past cooks could not be moved.',
    );
    expect(r.quarantined().map(q => q.origin)).toEqual(['legacy:history.json']);
  });

  test('a cook exactly as the 0.2.0 app wrote it (read from an emulator install) comes along', () => {
    // 0.2.0 saved `lateMin: null` for a cook ended early and used the save time as the id.
    const record = {
      id: '1794577672929',
      date: 1794693600000,
      notes: '',
      pitTempF: 225,
      lateMin: null,
      items: [
        {
          name: 'Brisket',
          plannedMin: 540,
          actualMin: 542,
          log: {
            foodId: 'brisket',
            methodId: 'smoked',
            smokerId: 'pitboss-820',
            quantity: 12,
            pitTempF: 225,
            minutesOnHeat: 542,
            options: { wrap: 'paper' },
            discarded: true,
          },
        },
      ],
    };
    const report = importLegacy(db, fakeLegacy({}, JSON.stringify([record], null, 1)).store, NOW);
    expect(report).toMatchObject({ status: 'done', cooks: 1, lost: [] });
    expect(r.history.list()).toEqual([record]);
    expect(r.quarantined()).toEqual([]);
  });

  test('a history file that is not JSON: no cooks, named plainly', () => {
    const report = importLegacy(db, fakeLegacy(legacyPrefs(STARTED), '[{"id":').store, NOW);
    expect(report).toMatchObject({ status: 'partial', cooks: 0, lost: ['past cooks'] });
    expect(importNotice(report)?.body).toMatch(/Your past cooks could not be moved\.$/);
  });

  test('unreadable flags or update check are quarantined but not worth a notice', () => {
    const prefs = { ...legacyPrefs(STARTED), flags: '[', update: '"soon"' };
    const legacy = fakeLegacy(prefs, legacyHistoryJson());
    const report = importLegacy(db, legacy.store, NOW);
    expect(report).toMatchObject({ status: 'done', lost: [] });
    expect(
      r
        .quarantined()
        .map(q => q.origin)
        .sort(),
    ).toEqual(['legacy:flags', 'legacy:update']);
    expect(legacy.calls).toEqual(['prefs', 'history']);
  });

  test('several losses read as one sentence; one past cook is singular', () => {
    const prefs = { ...legacyPrefs(STARTED), gear: 'x', draft: 'x', activeCook: 'x' };
    const report = importLegacy(db, fakeLegacy(prefs, JSON.stringify([legacyRecords[0]])).store, NOW);
    expect(importNotice(report)?.body).toBe(
      'Your rates and 1 past cook came along. Your cookers, plan and running cook could not be moved.',
    );
  });
});

describe('fresh start', () => {
  test('data was there but none of it readable: the app starts fresh and says so; the old files stay', () => {
    const prefs = Object.fromEntries(Object.keys(legacyPrefs(STARTED)).map(k => [k, '{broken']));
    const legacy = fakeLegacy(prefs, 'not a history file');
    const report = importLegacy(db, legacy.store, NOW);
    expect(report).toMatchObject({ status: 'fresh', cookers: 0, rates: 0, cooks: 0, plan: false, runningCook: false });
    expect(report.lost).toEqual(['cookers', 'units', 'plan', 'rates', 'running cook', 'past cooks']);
    expect(importNotice(report)).toEqual({
      title: 'Pit Planner has a new look',
      body: 'It starts fresh. Set up your cookers again.',
    });
    expect(legacy.calls).toEqual([]);
    expect(r.cookers.count()).toBe(0);
    // Every unreadable value is kept for Export my data.
    expect(r.quarantined()).toHaveLength(Object.keys(prefs).length + 1);
  });

  test('the old files cannot even be read: fresh, nothing saved, so the next start tries again', () => {
    const store: LegacyStore = {
      readCapacitorPrefs: () => {
        throw new Error('native module missing');
      },
      readHistoryFile: () => null,
      retireCapacitorPrefs: () => false,
      retireHistoryFile: () => {},
    };
    expect(importLegacy(db, store, NOW)).toMatchObject({ status: 'fresh' });
    expect(importReport(db)).toBeNull();
    expect(importLegacy(db, full().store, NOW + 1)).toMatchObject({ status: 'done' });
  });

  test('a write that fails imports nothing at all (one transaction) and leaves the old files', () => {
    const legacy = full();
    const run = db.run.bind(db);
    db.run = ((sql: string, params?: never) => {
      if (sql.includes('INTO cook_history_items')) throw new Error('disk full');
      return run(sql, params);
    }) as typeof db.run;
    expect(importLegacy(db, legacy.store, NOW)).toMatchObject({ status: 'fresh', cookers: 0 });
    db.run = run;
    expect(r.cookers.count()).toBe(0);
    expect(r.rates.load().rates).toEqual({});
    expect(importReport(db)).toBeNull();
    expect(legacy.calls).toEqual([]);
  });
});

describe('the notice shows once', () => {
  test('closing it is remembered', () => {
    const report = importLegacy(db, withPref('draft', 'x').store, NOW);
    expect(importNotice(report)).not.toBeNull();
    markNoticeSeen(db, NOW + 1);
    const later = importLegacy(db, full().store, NOW + 2);
    expect(later.noticeSeen).toBe(true);
    expect(importNotice(later)).toBeNull();
  });

  test('retiring that fails does not undo the import or run it again', () => {
    const store: LegacyStore = {
      ...full().store,
      retireCapacitorPrefs: () => {
        throw new Error('prefs locked');
      },
    };
    const report: ImportReport = importLegacy(db, store, NOW);
    expect(report.status).toBe('done');
    expect(r.history.list()).toHaveLength(2);
    expect(importLegacy(db, full().store, NOW + 1)).toEqual(report);
  });
});
