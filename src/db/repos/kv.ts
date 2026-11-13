// kv: small JSON settings, one row per key.

import type { Db } from '../db.ts';
import { parseJson } from './json.ts';

export interface KvRepo {
  /** The parsed value, or null when the key is missing, is not JSON or fails `parse`. */
  get<T>(key: string, parse: (raw: unknown) => T | null): T | null;
  set(key: string, value: unknown, now: number): void;
  remove(key: string): void;
}

export function kvRepo(db: Db): KvRepo {
  return {
    get(key, parse) {
      const row = db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
      const raw = parseJson(row?.value);
      return raw === undefined ? null : parse(raw);
    },
    set(key, value, now) {
      db.run(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)' +
          ' ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        [key, JSON.stringify(value), now],
      );
    },
    remove(key) {
      db.run('DELETE FROM kv WHERE key = ?', [key]);
    },
  };
}
