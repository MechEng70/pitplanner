// Live-cook adjustments. Each returns a new Plan; the caller then cancels and
// reschedules all alarms in one step from plan.events (never patch alarms piecemeal).

import type { Plan, PlanInput } from './types.ts';
import { derive, type Rules } from './plan.ts';

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
