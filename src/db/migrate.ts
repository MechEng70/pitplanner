// Migration runner (TECH-DESIGN section 5). The schema version is PRAGMA user_version. Every migration
// above it runs in order, each in its own transaction together with its version bump, so a failed
// migration leaves the version and the data exactly as they were. Shipped migrations are never edited;
// a fix is a new migration.

import type { Db } from './db.ts';

export interface Migration {
  version: number;
  name: string;
  up(db: Db): void;
}

export interface MigrateResult {
  from: number;
  to: number;
}

export type MigrationFailure = 'failed' | 'newer';

/** `failed`: migration `version` threw and was rolled back. `newer`: the file was written by a newer app. */
export class MigrationError extends Error {
  readonly kind: MigrationFailure;
  readonly version: number;
  constructor(kind: MigrationFailure, version: number, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'MigrationError';
    this.kind = kind;
    this.version = version;
  }
}

export function userVersion(db: Db): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

/** Migrations must be numbered 1, 2, 3... with no gap: a mistake here is a bug, found by the tests. */
function checkList(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`migration ${m.name} has version ${m.version}, expected ${i + 1}`);
  });
}

export function migrate(db: Db, migrations: readonly Migration[]): MigrateResult {
  checkList(migrations);
  const from = userVersion(db);
  const latest = migrations.length;
  if (from > latest) {
    throw new MigrationError('newer', from, `database is version ${from}, this app knows up to ${latest}`);
  }
  for (const m of migrations.slice(from)) {
    try {
      db.transaction(() => {
        m.up(db);
        // PRAGMA takes no parameters; the version is a checked integer from our own list.
        db.exec(`PRAGMA user_version = ${m.version}`);
      });
    } catch (e) {
      throw new MigrationError('failed', m.version, `migration ${m.version} (${m.name}) failed`, e);
    }
  }
  return { from, to: latest };
}

export type OpenResult = { ok: true; db: Db; from: number; to: number } | { ok: false; error: MigrationError };

/**
 * Set the connection up (foreign keys, WAL) and migrate. A migration failure comes back as a value, not a
 * throw, so the root layout can show the error screen (TECH-DESIGN section 5) and never reset silently.
 * Both PRAGMAs must run outside a transaction.
 */
export function openMigrated(db: Db, migrations: readonly Migration[]): OpenResult {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  try {
    return { ok: true, db, ...migrate(db, migrations) };
  } catch (e) {
    if (e instanceof MigrationError) return { ok: false, error: e };
    throw e;
  }
}
