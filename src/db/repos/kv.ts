// kv: small JSON settings, one row per key.

import type { Db } from '../db.ts';
import { parseJson } from './json.ts';
import { quarantine } from './quarantine.ts';

type Parse<T> = (raw: unknown) => T | null;

export interface KvRepo {
  /** The parsed value, or null when the key is missing, is not JSON or fails `parse`. */
  get<T>(key: string, parse: Parse<T>): T | null;
  /** Like `get`, and says whether a stored value was there but unreadable. */
  read<T>(key: string, parse: Parse<T>): { value: T | null; corrupt: boolean };
  /**
   * Save a value. If the stored one is unreadable (not JSON, or `parse` rejects it), its raw text is
   * quarantined first.
   */
  set(key: string, value: unknown, now: number, parse?: Parse<unknown>): void;
  /** Delete a key; an unreadable value is quarantined first, as in `set`. */
  remove(key: string, now: number, parse?: Parse<unknown>): void;
}

export function kvRepo(db: Db): KvRepo {
  const read = <T>(key: string, parse: Parse<T>) => {
    const row = db.get<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    if (!row) return { value: null, corrupt: false, raw: undefined };
    const json = parseJson(row.value);
    const value = json === undefined ? null : parse(json);
    return { value, corrupt: value === null, raw: row.value };
  };
  const keepIfCorrupt = (key: string, now: number, parse: Parse<unknown> = v => v ?? null) => {
    const old = read(key, parse);
    // A stored JSON null is nothing worth keeping.
    if (old.corrupt && old.raw !== undefined && old.raw !== 'null') quarantine(db, `kv:${key}`, old.raw, now);
  };
  return {
    get: (key, parse) => read(key, parse).value,
    read(key, parse) {
      const { value, corrupt } = read(key, parse);
      return { value, corrupt };
    },
    set(key, value, now, parse) {
      db.transaction(() => {
        keepIfCorrupt(key, now, parse);
        db.run(
          'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)' +
            ' ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
          [key, JSON.stringify(value), now],
        );
      });
    },
    remove(key, now, parse) {
      db.transaction(() => {
        keepIfCorrupt(key, now, parse);
        db.run('DELETE FROM kv WHERE key = ?', [key]);
      });
    },
  };
}
