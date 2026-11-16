// The running cook: plan + what has actually happened. Every operation returns a new ActiveCook;
// the caller saves it and calls syncAlarms (cancel all, schedule the new set). SPEC section 5.

import { markStepDone, shiftRemaining, pitOutage, markPullDone, postponeStep, holdsCover } from '../../engine/live.ts';
import { alarmsFromPlan, keyedEvents, type KeyedEvent } from '../../engine/alarms.ts';
import type { Plan, PlanInput } from '../../engine/types.ts';
import { rememberDone, ringTimes, undoDone, type DoneUndo } from '../../engine/undo.ts';
import { rules } from './rules.ts';
import type { AlarmService, NotificationAction } from '../platform/types.ts';
import { fmtTime, tx, type Units } from './format.ts';

const MIN = 60_000;
export const QUIET_MIN = 30;
export const PIT_RECOVERY_MIN = 15;
/** Done earlier or later than planned by at least this much asks shift-or-keep-serve. */
export const ASK_SHIFT_MIN = 5;

export interface ActiveCook {
  input: PlanInput;
  original: Plan; // as started, for On plan / Behind / Ahead and planned vs actual
  plan: Plan;
  startedAt: number;
  done: Record<string, number>; // step key -> when Done was tapped
  reminders: Record<string, number>; // step key -> ring again at (+15 on fixed steps)
  onAt: Record<string, number>; // itemId -> actually went on heat
  offAt: Record<string, number>; // itemId -> actually came off heat
  pitDownAt: number | null;
  quietUntil: number | null;
  notice: string | null; // what an automatic change did, shown once on Cook
  ringAgain: Record<string, number>; // step key -> ring again at, the step's time unmoved (overdue step taken back)
  /**
   * The cook just before the most recent Done, so that Done can be taken back (T-063). Replaced by the next
   * Done, so only the most recent one is ever on offer. `changed`: the plan was adjusted after the tap
   * (Running behind, Not yet, +15, Back up to temp); taking the step back takes that back too.
   */
  undo: (DoneUndo & { changed: boolean }) | null;
  /**
   * Warnings made during the cook that the user hid with OK on the Live cook banner (T-069), as
   * `warningKey`s (cookView.ts). A hidden warning stays hidden; a different one shows.
   */
  warningsSeen: string[];
}

export function newCook(input: PlanInput, plan: Plan, now: number): ActiveCook {
  return {
    input,
    original: plan,
    plan,
    startedAt: now,
    done: {},
    reminders: {},
    onAt: {},
    offAt: {},
    pitDownAt: null,
    quietUntil: null,
    notice: null,
    ringAgain: {},
    undo: null,
    warningsSeen: [],
  };
}

/**
 * Older saves (before the Cook tab) only had input + plan. A field added since (undo, warningsSeen) is filled
 * from a new cook's, so the running cook needs no database migration: it is one JSON column.
 */
export function normalize(raw: Partial<ActiveCook> | null): ActiveCook | null {
  if (!raw?.plan || !raw?.input) return null;
  return { ...newCook(raw.input, raw.plan, raw.startedAt ?? Date.now()), ...raw, original: raw.original ?? raw.plan };
}

export const steps = (c: ActiveCook): KeyedEvent[] => keyedEvents(c.plan).filter(k => k.event.alarm);

/** When a step is due now: its plan time, or later if it was postponed with a reminder. */
export const dueAt = (c: ActiveCook, k: KeyedEvent) => Math.max(k.event.at, c.reminders[k.key] ?? -Infinity);

/** Steps not done yet, soonest first. The first one is "Next up". */
export function pending(c: ActiveCook): KeyedEvent[] {
  return steps(c)
    .filter(k => !(k.key in c.done))
    .sort((a, b) => dueAt(c, a) - dueAt(c, b));
}

/** Minutes the step is later (+) or earlier (-) than when the cook started. */
export function driftMin(c: ActiveCook, k: KeyedEvent): number {
  const orig = keyedEvents(c.original).find(o => o.key === k.key);
  return orig ? Math.round((dueAt(c, k) - orig.event.at) / MIN) : 0;
}

export type DoneResult = { cook: ActiveCook; ask?: { deltaMin: number; keepServe: ActiveCook; moveServe: ActiveCook } };

/**
 * Done on a step at `at`. A food going on or a phase starting early or late moves that food's later
 * phases (markStepDone); a pull sets off-heat (markPullDone). If a phase moved by ASK_SHIFT_MIN or more
 * and keepServe is not given, both outcomes come back so the UI can ask.
 */
export function doneStep(c: ActiveCook, key: string, at: number, keepServe?: boolean): DoneResult {
  const k = steps(c).find(s => s.key === key);
  if (!k) return { cook: c };
  const base: ActiveCook = {
    ...c,
    done: { ...c.done, [key]: at },
    reminders: without(c.reminders, key),
    ringAgain: without(c.ringAgain, key),
    undo: { ...rememberDone(c, key), changed: false },
  };
  const e = k.event;

  if (e.kind === 'phase' && e.itemId && e.phaseId) {
    const item = c.plan.items.find(i => i.input.id === e.itemId)!;
    const first = item.phases[0]?.id === e.phaseId;
    const withOn = first ? { ...base, onAt: { ...base.onAt, [e.itemId]: at } } : base;
    const run = (keep: boolean) => ({
      ...withOn,
      plan: markStepDone(rules, c.input, c.plan, e.itemId!, e.phaseId!, at, keep).plan,
    });
    const deltaMin = Math.round((at - e.at) / MIN);
    if (keepServe != null || Math.abs(deltaMin) < ASK_SHIFT_MIN) return { cook: run(keepServe ?? true) };
    return { cook: withOn, ask: { deltaMin, keepServe: run(true), moveServe: run(false) } };
  }
  if (e.kind === 'pull' && e.itemId) {
    return {
      cook: {
        ...base,
        offAt: { ...base.offAt, [e.itemId]: at },
        plan: markPullDone(rules, c.input, c.plan, e.itemId, at),
      },
    };
  }
  return { cook: base };
}

/** +15 from the alert, or Not yet: see engine postponeStep. */
export function postpone(c: ActiveCook, key: string, now: number, minutes: number, keepServe: boolean): ActiveCook {
  const r = postponeStep(rules, c.input, c.plan, key, now, minutes, keepServe);
  return {
    ...adjusted(c),
    plan: r.plan,
    reminders: r.reminderAt ? { ...c.reminders, [key]: r.reminderAt } : without(c.reminders, key),
    ringAgain: without(c.ringAgain, key),
  };
}

export const shift = (c: ActiveCook, now: number, deltaMin: number, keepServe: boolean): ActiveCook => ({
  ...adjusted(c),
  plan: shiftRemaining(rules, c.input, c.plan, now, deltaMin, keepServe),
});

/** The plan is being adjusted: a Done that can still be taken back now takes this change back with it. */
const adjusted = (c: ActiveCook): ActiveCook => (c.undo ? { ...c, undo: { ...c.undo, changed: true } } : c);

/** The Done that can be taken back: the most recent one, until the next step is marked done. */
export function undoable(c: ActiveCook): { key: string; label: string; doneAt: number; changed: boolean } | null {
  const u = c.undo;
  const doneAt = u ? c.done[u.key] : undefined;
  if (!u || doneAt == null) return null;
  const step = keyedEvents(u.plan).find(k => k.key === u.key);
  return step ? { key: u.key, label: step.event.label, doneAt, changed: u.changed } : null;
}

/** The Done that can be taken back is the one on Serve: Cook finished offers "Back to the cook". */
export function serveUndoable(c: ActiveCook): boolean {
  const u = undoable(c);
  return u != null && keyedEvents(c.undo!.plan).some(k => k.key === u.key && k.event.kind === 'serve');
}

/**
 * Take back the most recent Done (T-063): the step is not done again and the plan, reminders and on / off
 * heat times are what they were before the tap. A step that was already due rings again in 10 min. The
 * pit-out and quiet states are left as they are now.
 */
export function undoStep(c: ActiveCook, now: number): ActiveCook {
  if (!c.undo || !undoable(c)) return c;
  return { ...c, ...undoDone(c, c.undo, now), undo: null };
}

export const pitDown = (c: ActiveCook, now: number): ActiveCook => ({ ...c, pitDownAt: now });

export function pitUp(c: ActiveCook, now: number, keepServe: boolean): ActiveCook {
  if (c.pitDownAt == null) return c;
  return {
    ...adjusted(c),
    pitDownAt: null,
    plan: pitOutage(rules, c.input, c.plan, c.pitDownAt, now, PIT_RECOVERY_MIN, keepServe),
  };
}

export const quiet = (c: ActiveCook, now: number): ActiveCook => ({ ...c, quietUntil: now + QUIET_MIN * MIN });

/**
 * Replace the phone's alarm set with what this cook still needs, and stop nagging finished steps.
 * `units` are the display settings, so alert text reads in C / kg when chosen.
 */
export async function syncAlarms(c: ActiveCook, now: number, alarms: AlarmService, units: Units) {
  const done = Object.keys(c.done);
  if (done.length) await alarms.acknowledge(done);
  // Quiet also holds the repeats of a step that is already overdue (they are native; 0.2.0 let them ring).
  await alarms.setQuiet(c.quietUntil != null && c.quietUntil > now ? c.quietUntil : null);
  // Pit out stops the clock: step alerts wait, one reminder asks whether it is back up.
  if (c.pitDownAt != null)
    return alarms.replaceAll([
      {
        id: 'pitcheck',
        keys: ['pitcheck'],
        at: now + PIT_RECOVERY_MIN * MIN,
        critical: false,
        title: 'Pit back up to temp?',
        body: 'Tap Back up to temp in Pit Planner so the steps re-time.',
      },
    ]);
  return alarms.replaceAll(
    alarmsFromPlan(c.plan, now, undefined, {
      done,
      reminders: ringTimes(c.reminders, c.ringAgain),
      quietUntil: c.quietUntil ?? undefined,
      text: s => tx(s, units),
    }),
  );
}

/** For changes made without asking: keep serve if the holds absorb it, else move serve. */
export function keepServeIfCovered(run: (keepServe: boolean) => ActiveCook): ActiveCook {
  const kept = run(true);
  return holdsCover(kept.plan) ? kept : run(false);
}

/**
 * Done and +15 tapped on a notification while the app was closed. Keeps serve when the holds absorb
 * the change, else moves serve (no food comes off after serve). Adds to `notice` so the Cook tab
 * says what changed.
 */
export function applyActions(c: ActiveCook, actions: NotificationAction[]): ActiveCook {
  let cur = c;
  const said: string[] = [];
  for (const a of [...actions].sort((x, y) => x.at - y.at)) {
    if (a.type === 'open') continue;
    for (const key of a.keys) {
      const k = steps(cur).find(s => s.key === key);
      if (!k || key in cur.done) continue;
      const title = stepText(k.event.label).title;
      const run = (keep: boolean) =>
        a.type === 'done' ? doneStep(cur, key, a.at, keep).cook : postpone(cur, key, a.at, 15, keep);
      const next = keepServeIfCovered(run);
      said.push(
        a.type === 'done'
          ? `${title}: done at ${fmtTime(a.at)} from the alert.`
          : `${title}: moved 15 min from the alert.`,
      );
      if (next.plan.serveAt !== cur.plan.serveAt) said.push(`Serve moves to ${fmtTime(next.plan.serveAt)}.`);
      cur = next;
    }
  }
  return said.length ? { ...cur, notice: [cur.notice, ...said].filter(Boolean).join(' ') } : cur;
}

/** Step text for the Next up card: "Check the brisket" / "Wrap once the bark is set, about 165-170F." */
export function stepText(label: string): { title: string; body: string } {
  const i = label.indexOf(': ');
  if (i < 0) {
    // "Brisket on the smoker, unwrapped. Probe in the thickest part." -> first sentence is the title.
    const j = label.indexOf('. ');
    return j < 0
      ? { title: label.replace(/\.$/, ''), body: '' }
      : { title: label.slice(0, j), body: label.slice(j + 2) };
  }
  const rest = label.slice(i + 2);
  return { title: label.slice(0, i), body: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

function without<T>(o: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = o;
  return rest;
}
