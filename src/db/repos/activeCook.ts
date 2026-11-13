// active_cook: the one running cook, rewritten on every change. A row that cannot be read is no cook.

import { normalize, type ActiveCook } from '../../lib/cook.ts';
import type { Db } from '../db.ts';
import { isNum, isObj, parseJson } from './json.ts';

/** Enough shape for the Cook screen and the alarm sync not to crash on it. */
function looksLikeCook(raw: unknown): raw is Partial<ActiveCook> {
  if (!isObj(raw) || !isObj(raw.plan) || !isObj(raw.input)) return false;
  if (!Array.isArray(raw.plan.events) || !Array.isArray(raw.input.items)) return false;
  return raw.original === undefined || (isObj(raw.original) && Array.isArray(raw.original.events));
}

export function activeCookRepo(db: Db) {
  return {
    load(): ActiveCook | null {
      const row = db.get<{ data: string; started_at: number }>('SELECT data, started_at FROM active_cook WHERE id = 1');
      if (!row) return null;
      const raw = parseJson(row.data);
      if (!looksLikeCook(raw)) return null;
      return normalize({ ...raw, startedAt: isNum(raw.startedAt) ? raw.startedAt : row.started_at });
    },
    save(cook: ActiveCook, now: number): void {
      db.run(
        'INSERT INTO active_cook (id, data, started_at, updated_at) VALUES (1, ?, ?, ?)' +
          ' ON CONFLICT(id) DO UPDATE SET data = excluded.data, started_at = excluded.started_at,' +
          ' updated_at = excluded.updated_at',
        [JSON.stringify(cook), cook.startedAt, now],
      );
    },
    clear(): void {
      db.run('DELETE FROM active_cook');
    },
  };
}
export type ActiveCookRepo = ReturnType<typeof activeCookRepo>;
