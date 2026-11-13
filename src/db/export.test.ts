import { openApp, armForcedFailure } from './appDb';
import { exportDump, exportFileName } from './export';
import { openMigrated } from './migrate';
import { migrations } from './migrations';
import { repos } from './repos';
import { testDb } from './testDb';

const NOW = 1794500000000;

function seeded() {
  const db = testDb();
  expect(openMigrated(db, migrations).ok).toBe(true);
  const r = repos(db);
  r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW);
  r.rates.setRate('brisket', 0.75, NOW);
  return { db, r };
}

test('the dump holds every row of every table, with the schema and app versions', () => {
  const { db } = seeded();
  const dump = exportDump(db, NOW + 5, '0.3.0');
  expect(dump).toMatchObject({
    format: 'pitplanner-export',
    formatVersion: 1,
    exportedAt: NOW + 5,
    appVersion: '0.3.0',
    schemaVersion: 1,
    errors: {},
  });
  expect(Object.keys(dump.tables)).toEqual([
    'active_cook',
    'cook_history',
    'cook_history_items',
    'cookers',
    'kv',
    'rate_overrides',
  ]);
  expect(dump.tables.kv).toEqual([{ key: 'units', value: '{"temp":"C","weight":"kg"}', updated_at: NOW }]);
  expect(dump.tables.rate_overrides).toEqual([
    { food_id: 'brisket', hr_per_lb: 0.75, total_hours: null, locked: 0, updated_at: NOW },
  ]);
  expect(JSON.parse(JSON.stringify(dump))).toEqual(dump);
});

test('quarantined values are in the dump, raw', () => {
  const { db, r } = seeded();
  db.run("UPDATE kv SET value = '{\"temp\":' WHERE key = 'units'");
  r.settings.setUnits({ temp: 'F', weight: 'lb' }, NOW + 1);
  const kv = exportDump(db, NOW + 2, '0.3.0').tables.kv!;
  const kept = kv.find(row => String(row.key).startsWith('quarantine:kv:units:'));
  expect(JSON.parse(String(kept?.value))).toEqual({ origin: 'kv:units', at: NOW + 1, raw: '{"temp":' });
});

test('after a failed migration the dump still has the data, at the old version', () => {
  const { db } = seeded();
  armForcedFailure(db, NOW);
  const r = openApp(db, true);
  expect(r.ok).toBe(false);
  const dump = exportDump(db, NOW, '0.3.0');
  expect(dump.schemaVersion).toBe(1);
  expect(dump.tables.rate_overrides).toHaveLength(1);
  expect(dump.tables).not.toHaveProperty('forced_failure_probe');
});

test('a table that cannot be read is reported and the rest still exports', () => {
  const { db } = seeded();
  const all = db.all.bind(db);
  db.all = ((sql: string, params?: never) => {
    if (sql.includes('"cookers"')) throw new Error('disk I/O error');
    return all(sql, params);
  }) as typeof db.all;
  const dump = exportDump(db, NOW, '0.3.0');
  expect(dump.errors).toEqual({ cookers: 'disk I/O error' });
  expect(dump.tables.kv).toHaveLength(1);
});

test('the file name has the UTC date and time', () => {
  expect(exportFileName(Date.UTC(2026, 10, 12, 22, 5))).toBe('pitplanner-export-2026-11-12-2205.json');
});
