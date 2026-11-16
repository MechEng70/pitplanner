// Notification taps applied once (T-079). The phone keeps each Done / +15 tap queued until the app
// acknowledges it, and the app acknowledges only after the cook with the tap applied is saved. If the app dies
// between that save and the acknowledge, the tap is read again; +15 has no guard of its own and would move the
// step a second time. So the ids of applied taps are saved inside the running cook, in the same write as the
// change they made, and a tap whose id is there is skipped.
// The ids live in the cook's JSON (`active_cook.data`) as `appliedTaps`; no migration. A cook saved before
// T-079 has none, which reads as an empty list. Every cook operation (src/lib/cook.ts) spreads the cook it is
// given, so the list rides along with each change. Pure: no React, storage or platform imports.
import type { QueuedAction } from '../platform/types.ts';
import type { ActiveCook } from './cook.ts';

/**
 * Most tap ids a cook keeps, newest last. A tap is only read again until its acknowledge, which follows the
 * save at once, so only the last read matters; 50 is many times the taps one read ever holds.
 */
export const APPLIED_TAPS_MAX = 50;

type WithTaps = ActiveCook & { appliedTaps?: unknown };

/** The ids of the taps already applied to this cook. */
export function appliedTaps(c: ActiveCook): string[] {
  const v = (c as WithTaps).appliedTaps;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** The taps read that this cook has not had yet, in the order read (each id once). All of them with no cook. */
export function unapplied(c: ActiveCook | null, taps: QueuedAction[]): QueuedAction[] {
  const seen = new Set(c ? appliedTaps(c) : []);
  return taps.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/** The cook with these tap ids noted as applied, keeping the newest `APPLIED_TAPS_MAX` (all of `ids` at least). */
export function noteApplied(c: ActiveCook, ids: string[]): ActiveCook {
  const add = [...new Set(ids)];
  const kept = [...appliedTaps(c).filter(id => !add.includes(id)), ...add];
  return { ...c, appliedTaps: kept.slice(-Math.max(APPLIED_TAPS_MAX, add.length)) } as WithTaps;
}
