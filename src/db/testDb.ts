// The Db interface on better-sqlite3, for Jest only (a dev dependency: never import this from app code).
// Same SQL engine as the phone, in memory by default.

import Database from 'better-sqlite3';
import { runTransaction, type Db, type SqlValue } from './db.ts';

export function testDb(file = ':memory:'): Db {
  const sqlite = new Database(file);
  const state = { depth: 0 };
  const exec = (sql: string) => void sqlite.exec(sql);
  return {
    exec,
    run(sql, params: readonly SqlValue[] = []) {
      const r = sqlite.prepare(sql).run(...params);
      return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all<T>(sql: string, params: readonly SqlValue[] = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    get<T>(sql: string, params: readonly SqlValue[] = []) {
      return sqlite.prepare(sql).get(...params) as T | undefined;
    },
    transaction: fn => runTransaction(exec, state, fn),
    close: () => void sqlite.close(),
  };
}
