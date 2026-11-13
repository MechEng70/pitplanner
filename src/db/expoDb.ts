// The Db interface on expo-sqlite. The only file that may import expo-sqlite (ESLint layer rule).

import { openDatabaseSync } from 'expo-sqlite';
import { runTransaction, type Db, type SqlValue } from './db.ts';

export const DB_NAME = 'pitplanner.db';

export function expoDb(name: string = DB_NAME): Db {
  const sqlite = openDatabaseSync(name);
  const state = { open: false };
  const exec = (sql: string) => sqlite.execSync(sql);
  return {
    exec,
    run(sql, params: readonly SqlValue[] = []) {
      const r = sqlite.runSync(sql, [...params]);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all<T>(sql: string, params: readonly SqlValue[] = []) {
      return sqlite.getAllSync<T>(sql, [...params]);
    },
    get<T>(sql: string, params: readonly SqlValue[] = []) {
      return sqlite.getFirstSync<T>(sql, [...params]) ?? undefined;
    },
    transaction: fn => runTransaction(exec, state, fn),
    close: () => sqlite.closeSync(),
  };
}
