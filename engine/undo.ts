// Take back a step marked Done by mistake (T-063). Pure: the caller passes the cook's progress and the time.
//
// The rule (Jason, 2026-11-15): only the most recent Done can be taken back, until the next step is marked
// done. So one snapshot is enough: what the cook looked like just before the tap. Undo puts that back whole
// (the plan, so every step the Done re-timed, the reminders and the on / off heat times), which is what makes
// "done then undone" equal "never done". A change made between the tap and the undo (Running behind, Not
// yet, +15, Back up to temp) is taken back with it: the snapshot is from before those too.

import type { Plan } from './types.ts';
import { keyedEvents } from './alarms.ts';
import { NAG_EVERY_MIN } from './cookState.ts';

const MIN = 60_000;
/** An overdue step that is taken back rings again this long after the undo (the repeat interval). */
export const RING_AGAIN_MIN = NAG_EVERY_MIN;

/** The parts of a running cook that a Done changes. */
export interface Progress {
  plan: Plan;
  /** step key -> when Done was tapped */
  done: Record<string, number>;
  /** step key -> ring again at (+15 on a fixed step) */
  reminders: Record<string, number>;
  /** step key -> ring again at, without moving the step's own time (an overdue step taken back) */
  ringAgain: Record<string, number>;
  /** itemId -> actually went on heat */
  onAt: Record<string, number>;
  /** itemId -> actually came off heat */
  offAt: Record<string, number>;
  /** What an automatic change did, shown once on Cook. */
  notice: string | null;
}

/** The cook's progress just before `key` was marked done. */
export interface DoneUndo extends Omit<Progress, 'done'> {
  key: string;
}

/** Call with the progress as it is before the Done on `key` is applied. */
export function rememberDone(before: Progress, key: string): DoneUndo {
  return {
    key,
    plan: before.plan,
    reminders: before.reminders,
    ringAgain: before.ringAgain,
    onAt: before.onAt,
    offAt: before.offAt,
    notice: before.notice,
  };
}

/**
 * Put the step back to not done at `now`. Steps done before it stay done. If the step was already due, its
 * alert and repeats were stopped by the Done, so it rings again RING_AGAIN_MIN from now; its own time does
 * not move, so it still reads as overdue.
 */
export function undoDone(cur: Progress, undo: DoneUndo, now: number): Progress {
  const { [undo.key]: _, ...done } = cur.done;
  const step = keyedEvents(undo.plan).find(k => k.key === undo.key);
  const due = step ? Math.max(step.event.at, undo.reminders[undo.key] ?? -Infinity) : Infinity;
  const overdue = step?.event.alarm === true && due <= now;
  return {
    plan: undo.plan,
    done,
    reminders: undo.reminders,
    ringAgain: overdue ? { ...undo.ringAgain, [undo.key]: now + RING_AGAIN_MIN * MIN } : undo.ringAgain,
    onAt: undo.onAt,
    offAt: undo.offAt,
    // A notice the user has dismissed stays dismissed; otherwise it reads as it did before the tap.
    notice: cur.notice == null ? null : undo.notice,
  };
}

/** When each step rings again, for the alarm set: the later of its reminder and its ring-again. */
export function ringTimes(
  reminders: Record<string, number>,
  ringAgain: Record<string, number>,
): Record<string, number> {
  const out = { ...reminders };
  for (const [key, at] of Object.entries(ringAgain)) out[key] = Math.max(at, out[key] ?? -Infinity);
  return out;
}
