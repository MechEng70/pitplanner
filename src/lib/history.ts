// Cook history records (SPEC section 9). Only Save on Cook finished writes one; Discard logs nothing.
// Stored in SQLite through src/db/repos/history.ts (list, logs, save, remove); 0.2.0 kept them in
// files/history.json (imported in T-012).

import type { CookLog } from '../../engine/types.ts';

export interface CookRecord {
  id: string;
  date: number; // serve time, epoch ms
  notes: string;
  pitTempF: number;
  lateMin?: number | null; // served this many minutes after the planned serve; null when ended before serve
  items: { name: string; plannedMin: number; actualMin: number; log: CookLog }[];
}

/** The logs the engine learns from (rates, size-adjusted unlock). */
export const logsOf = (records: CookRecord[]): CookLog[] =>
  records.flatMap(r => r.items.map(i => i.log)).filter(l => !l.discarded);
