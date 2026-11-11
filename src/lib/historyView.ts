// Cook history view (mockup 20): learned rates per food per cooker and the cook list lines.
// Pure: no storage; rules are passed in. Records come from history.ts.

import type { CookLog, ItemInput } from '../../engine/types.ts';
import { rateFor, type Rules } from '../../engine/plan.ts';
import { fmtDuration, fmtWeight, type Units } from './format.ts';
import type { CookRecord } from './history.ts';

/** Within this many minutes reads as on plan / on time (same as Cook finished). */
const ON_PLAN_MIN = 2;

const foodOf = (rules: Rules, id: string): any => rules.foods.find((f: any) => f.id === id);
/** Method merged with the food's shared fields, as the engine reads it. */
function methodOf(rules: Rules, foodId: string, methodId: string): any {
  const f = foodOf(rules, foodId);
  const m = f?.methods.find((x: any) => x.id === methodId);
  return m && { ...(f.shared ?? {}), ...m };
}
/** "4 chicken breasts", "3 racks St. Louis ribs" */
const lower = (name: string) => /^St\. /.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
function countLine(f: any, n: number): string {
  const name = lower(f.name);
  return name.endsWith(f.quantity.unit.toLowerCase()) ? `${n} ${name}` : `${n} ${f.quantity.unit} ${name}`;
}

export interface RateRow { foodId: string; methodId: string; smokerId: string; foodName: string; hrPerLb: number; cooks: number; untilSize: number }

/** Learned rate per food per cooker, most cooks first. Only by-weight foods have a rate. */
export function rateRows(rules: Rules, logs: CookLog[], overrides: Record<string, number>): RateRow[] {
  const groups = new Map<string, CookLog[]>();
  for (const l of logs) {
    if (l.discarded) continue;
    if (methodOf(rules, l.foodId, l.methodId)?.timing?.kind !== 'perWeight') continue;
    const k = `${l.foodId}|${l.methodId}|${l.smokerId}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const unlock = rules.learning.unlockAfterCooks;
  return [...groups.values()].map(g => {
    const { foodId, methodId, smokerId } = g[0];
    const r = rateFor(rules, { id: 'rate', foodId, methodId, quantity: g[0].quantity }, smokerId, overrides, logs, 'perPound');
    const sameFood = logs.filter(l => !l.discarded && l.foodId === foodId && l.smokerId === smokerId).length;
    return { foodId, methodId, smokerId, foodName: foodOf(rules, foodId).name, hrPerLb: r.rate, cooks: r.cooksLogged, untilSize: Math.max(0, unlock - sameFood) };
  }).sort((a, b) => b.cooks - a.cooks);
}

/** "Brisket 12 lb, wings 2 lb, 4 chicken breasts" */
export function menuLine(rules: Rules, r: CookRecord, units: Units): string {
  const parts = r.items.map(it => {
    const f = foodOf(rules, it.log.foodId);
    if (!f) return lower(it.name);
    return f.quantity.kind === 'weight' ? `${lower(f.name)} ${fmtWeight(it.log.quantity, units)}` : countLine(f, it.log.quantity);
  });
  const s = parts.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The food furthest from plan: "Brisket 25 min ahead of plan", or "All on plan". Null when nothing was logged. */
export function missLine(r: CookRecord): string | null {
  const logged = r.items.filter(i => !i.log.discarded);
  if (!logged.length) return null;
  const worst = logged.reduce((a, b) => Math.abs(b.actualMin - b.plannedMin) > Math.abs(a.actualMin - a.plannedMin) ? b : a);
  const d = worst.actualMin - worst.plannedMin;
  if (Math.abs(d) < ON_PLAN_MIN) return logged.length > 1 ? 'All on plan' : `${worst.name} on plan`;
  return `${worst.name} ${fmtDuration(Math.abs(d))} ${d < 0 ? 'ahead of' : 'behind'} plan`;
}

/** Serve status for the cook card: "On time", "20 min late", "Ended early"; null for records saved before this was kept. */
export function serveStatus(r: CookRecord): { text: string; tone: 'ok' | 'warn' | 'secondary' } | null {
  if (r.lateMin === undefined) return null;
  if (r.lateMin === null) return { text: 'Ended early', tone: 'secondary' };
  if (Math.abs(r.lateMin) < ON_PLAN_MIN) return { text: 'On time', tone: 'ok' };
  return r.lateMin > 0 ? { text: `${fmtDuration(r.lateMin)} late`, tone: 'warn' } : { text: `${fmtDuration(-r.lateMin)} early`, tone: 'ok' };
}

/** Plan items for Cook again: same foods, methods, sizes and options; rest goes back to the rules default. */
export function cookAgainItems(rules: Rules, r: CookRecord, newId: (i: number) => string): ItemInput[] {
  return r.items.filter(it => methodOf(rules, it.log.foodId, it.log.methodId)).map((it, i) => {
    const m = methodOf(rules, it.log.foodId, it.log.methodId);
    return { id: newId(i), foodId: it.log.foodId, methodId: it.log.methodId, quantity: it.log.quantity, options: { ...(it.log.options ?? {}) }, restMin: m.restMin?.default };
  });
}
