// Quarantine (Jason, 2026-11-12): a stored value that cannot be read is never silently lost. Before a write
// replaces or deletes it, its raw text is copied to a kv row `quarantine:<origin>:<time>`, so "Export my
// data" (src/db/export.ts dumps every kv row) still includes it. Callers run this inside their transaction.

import type { Db } from '../db.ts';
import { isNum, isObj, isStr, parseJson } from './json.ts';

export const QUARANTINE_PREFIX = 'quarantine:';

export interface Quarantined {
  key: string;
  /** Where it was: `kv:draft`, `cookers:smoker:pb820`, `active_cook`, `rate_overrides:brisket`... */
  origin: string;
  at: number;
  raw: string;
}

export function quarantine(db: Db, origin: string, raw: string, now: number): void {
  const base = `${QUARANTINE_PREFIX}${origin}:${now}`;
  // Two corrupt values from the same place in the same millisecond both stay.
  let key = base;
  for (let n = 2; db.get('SELECT 1 FROM kv WHERE key = ?', [key]); n++) key = `${base}:${n}`;
  db.run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', [
    key,
    JSON.stringify({ origin, at: now, raw }),
    now,
  ]);
}

export function quarantined(db: Db): Quarantined[] {
  const rows = db.all<{ key: string; value: string }>(
    "SELECT key, value FROM kv WHERE key LIKE 'quarantine:%' ORDER BY updated_at, key",
  );
  return rows.flatMap(row => {
    const v = parseJson(row.value);
    return isObj(v) && isStr(v.origin) && isNum(v.at) && isStr(v.raw)
      ? [{ key: row.key, origin: v.origin, at: v.at, raw: v.raw }]
      : [];
  });
}
