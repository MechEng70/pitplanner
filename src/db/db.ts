// The storage interface (TECH-DESIGN section 5). Everything in src/db and src/lib talks to this; the only
// file that imports expo-sqlite is expoDb.ts, and tests run the same SQL on better-sqlite3 (testDb.ts).
//
// The interface is synchronous on purpose: a transaction is one uninterrupted block of JS, so no other
// query can slip in between its statements, and the app can read its state before the first render. The
// rows are small (settings, a few cookers, one cook, history), so calls take well under a frame.

export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  /** Run one or more statements with no parameters (schema, PRAGMA). */
  exec(sql: string): void;
  run(sql: string, params?: readonly SqlValue[]): RunResult;
  all<T>(sql: string, params?: readonly SqlValue[]): T[];
  get<T>(sql: string, params?: readonly SqlValue[]): T | undefined;
  /**
   * Commit when `fn` returns, roll back and rethrow when it throws. Called inside another transaction it
   * joins that one (no savepoint): a throw must be left to reach the outer call, which rolls everything back.
   */
  transaction<T>(fn: () => T): T;
  close(): void;
}

/** Shared by both implementations: one BEGIN IMMEDIATE ... COMMIT around `fn`, ROLLBACK on a throw. */
export function runTransaction<T>(exec: (sql: string) => void, state: { open: boolean }, fn: () => T): T {
  if (state.open) return fn();
  exec('BEGIN IMMEDIATE');
  state.open = true;
  try {
    const result = fn();
    exec('COMMIT');
    return result;
  } catch (e) {
    try {
      exec('ROLLBACK');
    } catch {
      // SQLite already rolled back (for example on a full disk); the first error is the one to report.
    }
    throw e;
  } finally {
    state.open = false;
  }
}
