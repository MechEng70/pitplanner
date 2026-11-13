// expoDb maps the Db interface onto expo-sqlite's synchronous API. expo-sqlite is native, so here it is a
// stand-in with the same method names and result shapes on better-sqlite3: the adapter's mapping, the
// pragmas and the migrations run for real; only the native binding is replaced.
import { databaseFileUri, expoDb } from './expoDb';
import { openMigrated, userVersion } from './migrate';
import { migrations } from './migrations';

const mockOpened: string[] = [];

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/data/user/0/app/files/SQLite',
  openDatabaseSync(name: string) {
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const sqlite = new Database(':memory:');
    mockOpened.push(name);
    return {
      execSync: (sql: string) => void sqlite.exec(sql),
      runSync(sql: string, params: unknown[]) {
        const r = sqlite.prepare(sql).run(...params);
        return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
      },
      getAllSync: (sql: string, params: unknown[]) => sqlite.prepare(sql).all(...params),
      // expo-sqlite returns null, not undefined, when there is no row.
      getFirstSync: (sql: string, params: unknown[]) => sqlite.prepare(sql).get(...params) ?? null,
      closeSync: () => void sqlite.close(),
    };
  },
}));

test('opens pitplanner.db and migrates it through the expo-sqlite calls', () => {
  const db = expoDb();
  expect(mockOpened).toEqual(['pitplanner.db']);
  expect(openMigrated(db, migrations)).toMatchObject({ ok: true, from: 0, to: migrations.length });
  expect(userVersion(db)).toBe(migrations.length);
  expect(db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
});

test('run, get and all pass parameters and map results; no row is undefined', () => {
  const db = expoDb();
  openMigrated(db, migrations);
  const add = 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)';
  expect(db.run(add, ['a', '1', 5])).toEqual({ changes: 1, lastInsertRowId: 1 });
  db.run(add, ['b', '2', 6]);
  expect(db.all('SELECT key FROM kv WHERE updated_at > ? ORDER BY key', [0])).toEqual([{ key: 'a' }, { key: 'b' }]);
  expect(db.get('SELECT value FROM kv WHERE key = ?', ['b'])).toEqual({ value: '2' });
  expect(db.get('SELECT value FROM kv WHERE key = ?', ['zz'])).toBeUndefined();
});

test('a transaction rolls back on a throw', () => {
  const db = expoDb();
  openMigrated(db, migrations);
  expect(() =>
    db.transaction(() => {
      db.run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', ['a', '1', 5]);
      throw new Error('stop');
    }),
  ).toThrow('stop');
  expect(db.all('SELECT key FROM kv')).toEqual([]);
  db.close();
});

test('a caught failure inside a transaction leaves none of its writes (savepoints through expo-sqlite)', () => {
  const db = expoDb();
  openMigrated(db, migrations);
  const add = 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)';
  db.transaction(() => {
    db.run(add, ['kept', '1', 5]);
    try {
      db.transaction(() => {
        db.run(add, ['lost', '2', 5]);
        throw new Error('inner');
      });
    } catch {
      // caught
    }
  });
  expect(db.all('SELECT key FROM kv')).toEqual([{ key: 'kept' }]);
});

test('the database file is where expo-sqlite keeps it, as a file URI', () => {
  expect(databaseFileUri()).toBe('file:///data/user/0/app/files/SQLite/pitplanner.db');
});
