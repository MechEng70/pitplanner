// The app database on a stand-in for expo-sqlite (better-sqlite3 behind the same method names): opening,
// migrating, and the dev-only forced migration failure the device test uses.
import { armForcedFailure, dbStatus, FORCE_FAILURE_KEY, openApp, rawDatabaseFiles, startupMigrations } from './appDb';
import { MigrationError, userVersion } from './migrate';
import { migrations } from './migrations';
import { testDb } from './testDb';

const NOW = 1794500000000;
const mockOpen = jest.fn();
jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: 'file:///data/files/SQLite',
  openDatabaseSync: (name: string) => mockOpen(name),
}));

function standIn() {
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  const sqlite = new Database(':memory:');
  return {
    execSync: (sql: string) => void sqlite.exec(sql),
    runSync(sql: string, params: unknown[]) {
      const r = sqlite.prepare(sql).run(...params);
      return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getAllSync: (sql: string, params: unknown[]) => sqlite.prepare(sql).all(...params),
    getFirstSync: (sql: string, params: unknown[]) => sqlite.prepare(sql).get(...params) ?? null,
    closeSync: () => void sqlite.close(),
  };
}

const migrated = () => {
  const db = testDb();
  expect(openApp(db, true).ok).toBe(true);
  return db;
};

describe('openAppDb', () => {
  // The module keeps the opened database, so each case loads it fresh.
  const load = () => {
    let mod!: typeof import('./appDb');
    jest.isolateModules(() => {
      mod = require('./appDb');
    });
    return mod;
  };
  beforeEach(() => mockOpen.mockReset());

  test('opens pitplanner.db once and migrates it', () => {
    mockOpen.mockImplementation(standIn);
    const { openAppDb, dbStatus: status } = load();
    const first = openAppDb(false);
    expect(first).toMatchObject({ ok: true, from: 0, to: migrations.length });
    expect(openAppDb(false)).toBe(first);
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledWith('pitplanner.db');
    if (first.ok) expect(status(first.db).userVersion).toBe(migrations.length);
  });

  test('a database that cannot be opened is a failure with no database, not a crash', () => {
    mockOpen.mockImplementation(() => {
      throw new Error('disk full');
    });
    const r = load().openAppDb(false);
    expect(r).toMatchObject({
      ok: false,
      db: null,
      error: { kind: 'failed', message: 'the database could not be opened' },
    });
    if (!r.ok) expect((r.error.cause as Error).message).toBe('disk full');
  });
});

describe('forced migration failure (dev builds only)', () => {
  test('armed in a dev build: the next start fails, nothing changes, and the start after is normal', () => {
    const db = migrated();
    db.run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', ['units', '{"temp":"C","weight":"kg"}', NOW]);
    armForcedFailure(db, NOW);
    expect(dbStatus(db).failureArmed).toBe(true);

    const failed = openApp(db, true);
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.db).toBe(db);
    expect(failed.error).toBeInstanceOf(MigrationError);
    expect(failed.error).toMatchObject({ kind: 'failed', version: migrations.length + 1 });
    expect(userVersion(db)).toBe(migrations.length);
    expect(dbStatus(db).tables).not.toContain('forced_failure_probe');
    expect(db.all('SELECT key FROM kv')).toEqual([{ key: 'units' }]);

    expect(openApp(db, true)).toMatchObject({ ok: true, from: migrations.length, to: migrations.length });
  });

  test('a release build never takes the switch: the flag is ignored and the app opens', () => {
    const db = migrated();
    armForcedFailure(db, NOW);
    expect(startupMigrations(db, migrations, false)).toBe(migrations);
    expect(openApp(db, false).ok).toBe(true);
    expect(db.get('SELECT 1 AS n FROM kv WHERE key = ?', [FORCE_FAILURE_KEY])).toEqual({ n: 1 });
  });

  test('a new database (no kv table yet) opens normally in a dev build', () => {
    expect(openApp(testDb(), true)).toMatchObject({ ok: true, from: 0 });
  });
});

test('dbStatus: version, journal mode, tables', () => {
  const s = dbStatus(migrated());
  expect(s).toMatchObject({ userVersion: migrations.length, failureArmed: false });
  expect(s.tables).toEqual(['active_cook', 'cook_history', 'cook_history_items', 'cookers', 'kv', 'rate_overrides']);
});

test('the raw database files to share when it cannot be opened: the file, its log and journal, and a dated tar name', () => {
  expect(rawDatabaseFiles(Date.UTC(2026, 10, 12, 22, 5))).toEqual({
    uris: [
      'file:///data/files/SQLite/pitplanner.db',
      'file:///data/files/SQLite/pitplanner.db-wal',
      'file:///data/files/SQLite/pitplanner.db-journal',
    ],
    name: 'pitplanner-database-2026-11-12-2205.tar',
  });
});
