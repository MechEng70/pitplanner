// The app's one database: opened and migrated once, before the first screen (app/_layout.tsx). The root
// layout is the only UI file that calls this; screens get their data from the store (src/lib/store.tsx).
//
// Dev builds only: a forced migration failure for the device test of the error screen (TASKS T-010). The
// dev database screen sets a kv flag; the next start removes the flag and adds one migration that throws, so
// that start shows the error screen and the one after is normal again. `dev` false (every release build)
// never reads the flag.

import type { Db } from './db.ts';
import { DB_NAME } from './db.ts';
import { databaseFileUri, expoDb } from './expoDb.ts';
import { MigrationError, openMigrated, userVersion, type Migration, type OpenResult } from './migrate.ts';
import { migrations } from './migrations/index.ts';

export const FORCE_FAILURE_KEY = 'dev:forceMigrationFailure';

function takeForcedFailure(db: Db): boolean {
  try {
    if (!db.get('SELECT 1 FROM kv WHERE key = ?', [FORCE_FAILURE_KEY])) return false;
    db.run('DELETE FROM kv WHERE key = ?', [FORCE_FAILURE_KEY]);
    return true;
  } catch {
    return false; // no kv table yet (a new database)
  }
}

/** The migrations for this start: the real list, plus one that throws when a dev build armed the test. */
export function startupMigrations(db: Db, list: readonly Migration[], dev: boolean): readonly Migration[] {
  if (!dev || !takeForcedFailure(db)) return list;
  const forced: Migration = {
    version: list.length + 1,
    name: 'forced_failure',
    up(d) {
      // Something real to roll back, so the test shows the transaction undoing it.
      d.exec('CREATE TABLE forced_failure_probe (id INTEGER PRIMARY KEY)');
      throw new Error('Forced by the dev database screen to test this screen.');
    },
  };
  return [...list, forced];
}

/** Open `db` for the app: forced failure (dev only), pragmas, migrations. */
export function openApp(db: Db, dev: boolean, list: readonly Migration[] = migrations): OpenResult {
  return openMigrated(db, startupMigrations(db, list, dev));
}

let opened: OpenResult | undefined;

/** The app database, opened on first call. A database that cannot be opened at all is a failure too. */
export function openAppDb(dev: boolean): OpenResult {
  if (opened) return opened;
  try {
    opened = openApp(expoDb(), dev);
  } catch (e) {
    opened = { ok: false, db: null, error: new MigrationError('failed', 0, 'the database could not be opened', e) };
  }
  return opened;
}

/** Dev database screen: make the next start fail its migration (once). */
export function armForcedFailure(db: Db, now: number): void {
  db.run('INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)', [FORCE_FAILURE_KEY, '1', now]);
}

export interface DbStatus {
  userVersion: number;
  journalMode: string;
  tables: string[];
  failureArmed: boolean;
}

/** What the dev database screen shows (and the device test reads). */
export function dbStatus(db: Db): DbStatus {
  return {
    userVersion: userVersion(db),
    journalMode: db.get<{ journal_mode: string }>('PRAGMA journal_mode')?.journal_mode ?? '',
    tables: db
      .all<{ name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .map(r => r.name),
    failureArmed: db.get('SELECT 1 FROM kv WHERE key = ?', [FORCE_FAILURE_KEY]) !== undefined,
  };
}

/**
 * What Export my data shares when the database cannot be opened: the file with its write-ahead log and
 * rollback journal (the log holds the newest data; on a phone the .db file alone can be almost empty), and a
 * dated name for the tar they go into.
 */
export function rawDatabaseFiles(now: number): { uris: string[]; name: string } {
  const [date, time] = new Date(now).toISOString().split('T') as [string, string];
  const db = databaseFileUri();
  return {
    uris: [db, `${db}-wal`, `${db}-journal`],
    name: `pitplanner-database-${date}-${time.slice(0, 5).replace(':', '')}.tar`,
  };
}
export { DB_NAME };
