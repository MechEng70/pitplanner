// Restore a checked data file (T-036; the file is read and checked by src/lib/dataFile.ts `readDataFile`).
//
// Replace, not merge (no decision from Jason yet; the simplest safe rule): the file's cookers, rates and
// history take the place of the phone's, in one transaction through the repositories. The caller has asked
// the user first and says so with `'replace'`. What stays as it is:
// - a running cook: a restore is refused while one runs, and the active_cook row is never touched;
// - the plan draft, where the user was, the event log, the update check, the 0.2.0 import marker and the
//   quarantined values (no kv row but `units` and `flags` is written);
// - a part the file does not have: no cookers in it keeps the phone's (a phone with no cookers would go back
//   to Setup), unreadable units keep the phone's units.
// Flags (one-time hints) are joined, not replaced: a hint seen on either phone stays seen.
// Unreadable values on the phone are quarantined by the repositories before they are replaced, as on any
// write, so nothing is lost without a copy. Any write that fails undoes the whole restore.

import type { RestoreData } from '../lib/dataFile.ts';
import type { Repos } from './repos/index.ts';

export type RestoreResult =
  | { ok: true; counts: { cookers: number; rates: number; cooks: number } }
  | { ok: false; problem: 'cook running' }
  | { ok: false; problem: 'failed'; message: string };

export function restoreData(r: Repos, data: RestoreData, now: number, confirmed: 'replace'): RestoreResult {
  if (confirmed !== 'replace') throw new Error('restoreData: the user has not agreed to replace their data');
  if (r.activeCook.load()) return { ok: false, problem: 'cook running' };
  const cookers = Object.keys(data.gear).length;
  try {
    r.transaction(() => {
      if (cookers > 0) r.cookers.save(data.gear, now);
      if (data.units) r.settings.setUnits(data.units, now);
      if (data.flags) r.settings.setFlags({ ...r.settings.flags(), ...data.flags }, now);

      r.rates.clear(now);
      for (const [food, v] of Object.entries(data.rates)) r.rates.setRate(food, v, now);
      for (const [food, v] of Object.entries(data.totalHours)) r.rates.setTotalHours(food, v, now);
      for (const [food, v] of Object.entries(data.rateLocks)) if (v) r.rates.setLock(food, true, now);

      // Remove, then add in the file's order, so the list reads as it did on the phone it came from.
      for (const old of r.history.list()) r.history.remove(old.id, now);
      for (const record of data.history) r.history.save(record, now);
    });
  } catch (e) {
    return { ok: false, problem: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
  const foods = new Set([...Object.keys(data.rates), ...Object.keys(data.totalHours), ...Object.keys(data.rateLocks)]);
  return { ok: true, counts: { cookers, rates: foods.size, cooks: data.history.length } };
}
