// Live-cook adjustments. Each returns a new Plan; the caller then cancels and
// reschedules all alarms in one step from plan.events (never patch alarms piecemeal).

import type { Plan, PlanInput } from './types.ts';
import { derive, type Rules } from './plan.ts';
import { keyedEvents } from './alarms.ts';

const MIN = 60_000;

function clone(plan: Plan): Plan { return structuredClone(plan); }

/**
 * Shift everything not yet started by deltaMin (positive = running late).
 * A phase in progress has its end moved. keepServe: serve time stays and the
 * difference comes out of (or goes into) the holds; otherwise serve moves too.
 */
export function shiftRemaining(rules: Rules, input: PlanInput, plan: Plan, now: number, deltaMin: number, keepServe: boolean, onlyItemId?: string): Plan {
  const next = clone(plan);
  const d = deltaMin * MIN;
  for (const it of next.items) {
    if (onlyItemId && it.input.id !== onlyItemId) continue;
    let moved = false;
    for (const p of it.phases) {
      if (p.end <= now) continue;
      if (p.start >= now) { p.start += d; p.end += d; moved = true; }
      else { p.end += d; moved = true; }
    }
    if (moved || it.finish > now) it.finish += d;
    it.extraHoldMin -= keepServe ? deltaMin : 0;
  }
  const serveAt = keepServe ? next.serveAt : next.serveAt + d;
  return derive(rules, input, next.items, serveAt);
}

/** The user tapped Done on a check step at doneAt. Shift that item's later phases by the difference. */
export function markStepDone(rules: Rules, input: PlanInput, plan: Plan, itemId: string, phaseId: string, doneAt: number, keepServe: boolean): { plan: Plan; deltaMin: number } {
  const it = plan.items.find(i => i.input.id === itemId);
  const p = it?.phases.find(x => x.id === phaseId);
  if (!it || !p) throw new Error('Unknown step');
  const deltaMin = Math.round((doneAt - p.start) / MIN);
  if (deltaMin === 0) return { plan, deltaMin };
  // Phases from this one on move by the difference; the phase before it ends when the step was done.
  const next = clone(plan);
  const ni = next.items.find(i => i.input.id === itemId)!;
  const idx = ni.phases.findIndex(x => x.id === phaseId);
  ni.phases[idx - 1] && (ni.phases[idx - 1].end = doneAt);
  for (let i = idx; i < ni.phases.length; i++) { ni.phases[i].start += deltaMin * MIN; ni.phases[i].end += deltaMin * MIN; }
  ni.finish += deltaMin * MIN;
  ni.extraHoldMin -= keepServe ? deltaMin : 0;
  const serveAt = keepServe ? next.serveAt : next.serveAt + deltaMin * MIN;
  return { plan: derive(rules, input, next.items, serveAt), deltaMin };
}

/** Pit went out at downAt and was back to temp at upAt. Smoker items lose that time plus a recovery allowance. */
export function pitOutage(rules: Rules, input: PlanInput, plan: Plan, downAt: number, upAt: number, recoveryMin: number, keepServe: boolean): Plan {
  const lost = Math.round((upAt - downAt) / MIN) + recoveryMin;
  const next = clone(plan);
  for (const it of next.items) {
    if (!it.phases.some(p => p.cooker === 'smoker' && p.end > downAt)) continue;
    for (const p of it.phases) {
      if (p.end <= downAt) continue;
      if (p.start >= downAt) { p.start += lost * MIN; p.end += lost * MIN; } else p.end += lost * MIN;
    }
    it.finish += lost * MIN;
    it.extraHoldMin -= keepServe ? lost : 0;
  }
  return derive(rules, input, next.items, keepServe ? next.serveAt : next.serveAt + lost * MIN);
}

/**
 * The food came off heat at doneAt (pull check answered, early or late). Its last phase ends then
 * and the hold before serve absorbs the difference; serve time does not move.
 */
export function markPullDone(rules: Rules, input: PlanInput, plan: Plan, itemId: string, doneAt: number): Plan {
  const next = clone(plan);
  const it = next.items.find(i => i.input.id === itemId);
  if (!it) throw new Error('Unknown item');
  const delta = doneAt - it.finish;
  const last = it.phases[it.phases.length - 1];
  if (last) last.end = doneAt;
  it.finish = doneAt;
  it.extraHoldMin -= delta / MIN;
  return derive(rules, input, next.items, next.serveAt);
}

/**
 * "Not yet" at a pull check: the food stays on until max(planned off, now) + minutes.
 * Unlike shiftRemaining this also works once every phase is nominally in the past.
 * keepServe: the hold shrinks; otherwise serve moves by the same amount.
 */
export function extendCook(rules: Rules, input: PlanInput, plan: Plan, itemId: string, now: number, minutes: number, keepServe: boolean): Plan {
  const next = clone(plan);
  const it = next.items.find(i => i.input.id === itemId);
  if (!it) throw new Error('Unknown item');
  const newFinish = Math.max(it.finish, now) + minutes * MIN;
  const d = newFinish - it.finish;
  // Phases not started yet move whole; the one running (or last finished) stretches to meet them.
  for (const p of it.phases) if (p.start >= now) { p.start += d; p.end += d; }
  it.phases.forEach((p, i) => { if (p.start < now) p.end = it.phases[i + 1]?.start ?? newFinish; });
  it.finish = newFinish;
  if (keepServe) it.extraHoldMin -= d / MIN;
  return derive(rules, input, next.items, keepServe ? next.serveAt : next.serveAt + d);
}

/**
 * +15 min on a step's alert, or Adjust > Not yet. A phase step starts later (that food's later phases
 * follow); a pull extends the cook; anything else (fire, refill, serve) just reminds again.
 */
export function postponeStep(rules: Rules, input: PlanInput, plan: Plan, key: string, now: number, minutes: number, keepServe: boolean): { plan: Plan; reminderAt: number | null } {
  const ke = keyedEvents(plan).find(k => k.key === key);
  if (!ke) throw new Error(`Unknown step ${key}`);
  const e = ke.event;
  const at = Math.max(e.at, now) + minutes * MIN;
  if (e.kind === 'phase' && e.itemId && e.phaseId) return { plan: markStepDone(rules, input, plan, e.itemId, e.phaseId, at, keepServe).plan, reminderAt: null };
  if (e.kind === 'pull' && e.itemId) return { plan: extendCook(rules, input, plan, e.itemId, now, minutes, keepServe), reminderAt: null };
  return { plan, reminderAt: at };
}

/** Time ranges where two or more foods are on the smoker at once (lane chart highlight, shared-pit note). */
export function smokerOverlaps(plan: Plan): { start: number; end: number; itemIds: string[]; tempsF: number[] }[] {
  const spans = plan.items.flatMap(it => it.phases.filter(p => p.cooker === 'smoker').map(p => ({ id: it.input.id, start: p.start, end: p.end, tempF: p.tempF })));
  const cuts = [...new Set(spans.flatMap(s => [s.start, s.end]))].sort((a, b) => a - b);
  const out: { start: number; end: number; itemIds: string[]; tempsF: number[] }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1];
    const on = spans.filter(s => s.start <= a && s.end >= b);
    const ids = [...new Set(on.map(s => s.id))].sort();
    if (ids.length < 2) continue;
    const prev = out[out.length - 1];
    if (prev && prev.end === a && prev.itemIds.join() === ids.join()) { prev.end = b; prev.tempsF = [...new Set([...prev.tempsF, ...on.map(s => s.tempF)])]; }
    else out.push({ start: a, end: b, itemIds: ids, tempsF: [...new Set(on.map(s => s.tempF))] });
  }
  return out;
}
