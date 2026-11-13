// The Db interface on expo-sqlite. The only file that may import expo-sqlite (ESLint layer rule).

import { defaultDatabaseDirectory, openDatabaseSync } from 'expo-sqlite';
import { DB_NAME, runTransaction, type Db, type SqlValue } from './db.ts';

/** Where expo-sqlite keeps the file (for sharing it raw when it cannot be opened). */
export function databaseFileUri(name: string = DB_NAME): string {
  const path = `${String(defaultDatabaseDirectory)}/${name}`;
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function expoDb(name: string = DB_NAME): Db {
  const sqlite = openDatabaseSync(name);
  const state = { depth: 0 };
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
