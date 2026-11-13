// Every repository over one Db (TASKS T-009). The store (T-010) is the only caller in the app.

import type { Db } from '../db.ts';
import { activeCookRepo } from './activeCook.ts';
import { cookersRepo } from './cookers.ts';
import { historyRepo } from './history.ts';
import { kvRepo } from './kv.ts';
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
  };
}
export type Repos = ReturnType<typeof repos>;
