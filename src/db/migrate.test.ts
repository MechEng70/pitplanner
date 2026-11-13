import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Db } from './db';
import { migrate, MigrationError, openMigrated, userVersion, type Migration } from './migrate';
import { migrations } from './migrations';
import { testDb } from './testDb';

/** The schema as SQLite stores it: one statement per object, by name. This is what the snapshot holds. */
function dumpSchema(db: Db): string {
  const rows = db.all<{ sql: string }>(
    "SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name",
  );
  return rows.map(r => `${r.sql};\n`).join('\n');
}

const snapshot = () => readFileSync(join(__dirname, 'schema.snapshot.sql'), 'utf8');

const NOW = 1794500000000;
const addKv = (db: Db, key: string, value: string) =>
  db.run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', [key, value, NOW]);
const kvRows = (db: Db) => db.all<{ key: string; value: string }>('SELECT key, value FROM kv ORDER BY key');

function opened(list: readonly Migration[] = migrations): Db {
  const db = testDb();
  const r = openMigrated(db, list);
  if (!r.ok) throw r.error;
  return db;
}

describe('migrations', () => {
  test('0 -> latest matches the schema snapshot', () => {
    const db = testDb();
    expect(userVersion(db)).toBe(0);
    expect(openMigrated(db, migrations)).toMatchObject({ ok: true, from: 0, to: migrations.length });
    expect(userVersion(db)).toBe(migrations.length);
    expect(dumpSchema(db)).toBe(snapshot());
  });

  test('schema v1 has the six tables of TECH-DESIGN section 5', () => {
    const names = opened()
      .all<{ name: string }>("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .map(r => r.name);
    expect(names).toEqual(['active_cook', 'cook_history', 'cook_history_items', 'cookers', 'kv', 'rate_overrides']);
  });

  test('running again is a no-op: same schema, same data, nothing re-applied', () => {
    const db = opened();
    addKv(db, 'units', '{"temp":"F"}');
    const up = jest.fn();
    const counted = migrations.map(m => ({ ...m, up }));
    expect(openMigrated(db, counted)).toMatchObject({ ok: true, from: 1, to: 1 });
    expect(up).not.toHaveBeenCalled();
    expect(dumpSchema(db)).toBe(snapshot());
    expect(kvRows(db)).toEqual([{ key: 'units', value: '{"temp":"F"}' }]);
  });

  test('a failing migration leaves the version and the data unchanged', () => {
    const db = opened();
    addKv(db, 'units', '{"temp":"F"}');
    const bad: Migration = {
      version: 2,
      name: 'bad',
      up(d) {
        d.exec('CREATE TABLE half_done (id INTEGER PRIMARY KEY)');
        d.run('DELETE FROM kv');
        addKv(d, 'written_by_bad', '1');
        throw new Error('boom');
      },
    };
    const r = openMigrated(db, [...migrations, bad]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBeInstanceOf(MigrationError);
    expect(r.error).toMatchObject({ kind: 'failed', version: 2 });
    expect((r.error.cause as Error).message).toBe('boom');
    expect(userVersion(db)).toBe(1);
    expect(dumpSchema(db)).toBe(snapshot());
    expect(kvRows(db)).toEqual([{ key: 'units', value: '{"temp":"F"}' }]);
  });

  test('a migration whose SQL is wrong fails the same way', () => {
    const db = opened();
    const bad: Migration = { version: 2, name: 'typo', up: d => d.exec('ALTER TABLE kv ADD COLUMN; nonsense') };
    expect(openMigrated(db, [...migrations, bad])).toMatchObject({ ok: false, error: { kind: 'failed', version: 2 } });
    expect(userVersion(db)).toBe(1);
    expect(dumpSchema(db)).toBe(snapshot());
  });

  test('migrations before the failing one stay applied', () => {
    const db = testDb();
    const two: Migration = { version: 2, name: 'two', up: d => d.exec('CREATE TABLE two (id INTEGER PRIMARY KEY)') };
    const three: Migration = {
      version: 3,
      name: 'three',
      up: () => {
        throw new Error('no');
      },
    };
    expect(openMigrated(db, [...migrations, two, three])).toMatchObject({ ok: false, error: { version: 3 } });
    expect(userVersion(db)).toBe(2);
    expect(db.get("SELECT name FROM sqlite_schema WHERE name = 'two'")).toBeDefined();
  });

  test('a database from a newer app is refused and not touched', () => {
    const db = opened();
    addKv(db, 'units', '{"temp":"C"}');
    db.exec('PRAGMA user_version = 7');
    expect(openMigrated(db, migrations)).toMatchObject({ ok: false, error: { kind: 'newer', version: 7 } });
    expect(userVersion(db)).toBe(7);
    expect(kvRows(db)).toHaveLength(1);
  });

  test('a misnumbered migration list is a bug and throws', () => {
    const db = testDb();
    expect(() => migrate(db, [{ ...migrations[0]!, version: 2 }])).toThrow(/expected 1/);
    expect(userVersion(db)).toBe(0);
  });
});

describe('connection setup', () => {
  test('foreign keys are on: removing a cook removes its items; an item needs its cook', () => {
    const db = opened();
    const item =
      'INSERT INTO cook_history_items (cook_id, position, name, food_id, method_id, smoker_id, quantity,' +
      " pit_temp_f, minutes_on_heat, planned_min, actual_min) VALUES (?, 0, 'Brisket', 'brisket', 'smoke', 's1'," +
      ' 12, 225, 540, 540, 555)';
    db.run('INSERT INTO cook_history (id, served_at, pit_temp_f, created_at) VALUES (?, ?, 225, ?)', ['c1', NOW, NOW]);
    db.run(item, ['c1']);
    expect(() => db.run(item, ['missing'])).toThrow(/FOREIGN KEY/);
    db.run('DELETE FROM cook_history WHERE id = ?', ['c1']);
    expect(db.all('SELECT id FROM cook_history_items')).toEqual([]);
  });

  test('the journal is WAL on a file database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pitdb-'));
    try {
      const db = testDb(join(dir, 'pitplanner.db'));
      expect(openMigrated(db, migrations).ok).toBe(true);
      expect(db.get<{ journal_mode: string }>('PRAGMA journal_mode')).toEqual({ journal_mode: 'wal' });
      db.close();
      // Reopening the file finds version 1 and applies nothing.
      const again = testDb(join(dir, 'pitplanner.db'));
      expect(openMigrated(again, migrations)).toMatchObject({ ok: true, from: 1, to: 1 });
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('ended early has no lateness: ended_early = 1 requires late_min IS NULL', () => {
    const db = opened();
    const cook =
      'INSERT INTO cook_history (id, served_at, pit_temp_f, created_at, late_min, ended_early) VALUES (?, ?, 225, ?, ?, ?)';
    db.run(cook, ['late', NOW, NOW, 20, 0]);
    db.run(cook, ['unknown', NOW, NOW, null, 0]);
    db.run(cook, ['early', NOW, NOW, null, 1]);
    expect(() => db.run(cook, ['both', NOW, NOW, 20, 1])).toThrow(/CHECK/);
    expect(() => db.run(cook, ['two', NOW, NOW, null, 2])).toThrow(/CHECK/);
    expect(() => db.run('UPDATE cook_history SET ended_early = 1 WHERE id = ?', ['late'])).toThrow(/CHECK/);
    expect(db.all('SELECT id FROM cook_history ORDER BY id')).toEqual([
      { id: 'early' },
      { id: 'late' },
      { id: 'unknown' },
    ]);
  });

  test('schema checks: cooker kinds, and one active cook at most', () => {
    const db = opened();
    const cooker = 'INSERT INTO cookers (id, kind, profile, position, updated_at) VALUES (?, ?, ?, 0, ?)';
    db.run(cooker, ['s1', 'smoker', '{}', NOW]);
    expect(() => db.run(cooker, ['x1', 'microwave', '{}', NOW])).toThrow(/CHECK/);
    const cook = 'INSERT INTO active_cook (id, data, started_at, updated_at) VALUES (?, ?, ?, ?)';
    db.run(cook, [1, '{}', NOW, NOW]);
    expect(() => db.run(cook, [2, '{}', NOW, NOW])).toThrow(/CHECK/);
    expect(() => db.run(cook, [1, '{}', NOW, NOW])).toThrow(/UNIQUE|PRIMARY/);
  });
});

describe('Db (test implementation)', () => {
  test('run reports changes and the new row id; get returns undefined for no row', () => {
    const db = opened();
    expect(addKv(db, 'a', '1')).toMatchObject({ changes: 1 });
    expect(db.run('UPDATE kv SET value = ? WHERE key = ?', ['2', 'nope'])).toMatchObject({ changes: 0 });
    expect(db.get('SELECT value FROM kv WHERE key = ?', ['nope'])).toBeUndefined();
    expect(db.get('SELECT value FROM kv WHERE key = ?', ['a'])).toEqual({ value: '1' });
  });

  test('a transaction commits on return and rolls back on a throw; an inner one joins the outer', () => {
    const db = opened();
    expect(db.transaction(() => addKv(db, 'a', '1').changes)).toBe(1);
    expect(() =>
      db.transaction(() => {
        addKv(db, 'b', '2');
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(kvRows(db).map(r => r.key)).toEqual(['a']);
    expect(db.transaction(() => db.transaction(() => addKv(db, 'c', '3').changes))).toBe(1);
    // A throw in the inner one rolls back the outer one's writes too.
    expect(() =>
      db.transaction(() => {
        addKv(db, 'd', '4');
        db.transaction(() => {
          addKv(db, 'e', '5');
          throw new Error('inner');
        });
      }),
    ).toThrow('inner');
    expect(kvRows(db).map(r => r.key)).toEqual(['a', 'c']);
  });
});
