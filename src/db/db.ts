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
   * Commit when `fn` returns, roll back and rethrow when it throws. Inside another transaction it is a
   * savepoint: a throw undoes only this call's writes, whether or not the caller catches it.
   */
  transaction<T>(fn: () => T): T;
  close(): void;
}

/** Open transaction depth per connection: 0 none, 1 the transaction, 2 and up savepoints inside it. */
export interface TxState {
  depth: number;
}

/**
 * Shared by both implementations. The outermost call is BEGIN IMMEDIATE ... COMMIT (ROLLBACK on a throw). A
 * call inside it is a SAVEPOINT: when it throws, only its own writes are undone, so a caller that catches the
 * error and carries on commits nothing of the failed step.
 */
export function runTransaction<T>(exec: (sql: string) => void, state: TxState, fn: () => T): T {
  const outer = state.depth === 0;
  // The name is the nesting depth, an integer we count ourselves.
  const savepoint = `sp_${state.depth}`;
  exec(outer ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
  state.depth += 1;
  try {
    const result = fn();
    exec(outer ? 'COMMIT' : `RELEASE ${savepoint}`);
    return result;
  } catch (e) {
    try {
      exec(outer ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
    } catch {
      // SQLite already rolled back (for example on a full disk); the first error is the one to report.
    }
    throw e;
  } finally {
    state.depth -= 1;
  }
}

export const DB_NAME = 'pitplanner.db';
