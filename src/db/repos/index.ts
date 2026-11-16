// Every repository over one Db (TASKS T-009). The store (T-010) is the only caller in the app.

import type { Db } from '../db.ts';
import { exportDump } from '../export.ts';
import { activeCookRepo } from './activeCook.ts';
import { cookersRepo } from './cookers.ts';
import { historyRepo } from './history.ts';
import { kvRepo } from './kv.ts';
import { quarantined } from './quarantine.ts';
import { ratesRepo } from './rates.ts';
import { settingsRepo } from './settings.ts';

export function repos(db: Db) {
  const kv = kvRepo(db);
  return {
    kv,
    settings: settingsRepo(kv),
    cookers: cookersRepo(db),
    rates: ratesRepo(db),
    activeCook: activeCookRepo(db),
    history: historyRepo(db),
    /** Unreadable values kept before a write replaced them (quarantine.ts). */
    quarantined: () => quarantined(db),
    /** Every row of every table, for "Send to developer" (T-065); the same read as Export my data. */
    dump: (now: number) => exportDump(db, now, ''),
    /** Several repository writes as one: all of them land or none (src/db/restore.ts, T-036). */
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  };
}
export type Repos = ReturnType<typeof repos>;
