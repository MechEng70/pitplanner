// Cook history view (mockup 20): learned rates per food per cooker and the cook list lines.
// Pure: no storage; rules are passed in. Records come from history.ts.

import type { CookLog, ItemInput, RateSource } from '../../engine/types.ts';
import { rateFor } from '../../engine/plan.ts';
import { resolveMethod, type ResolvedMethod, type RuleFood, type Rules } from '../../engine/rules.ts';
import { fmtDuration, fmtRate, fmtWeight, type Units } from './format.ts';
import type { CookRecord } from './history.ts';

/** Within this many minutes reads as on plan / on time (same as Cook finished). */
const ON_PLAN_MIN = 2;

const foodOf = (rules: Rules, id: string): RuleFood | undefined => rules.foods.find(f => f.id === id);
/** Method merged with the food's shared fields, as the engine reads it. */
function methodOf(rules: Rules, foodId: string, methodId: string): ResolvedMethod | undefined {
  const f = foodOf(rules, foodId);
  const m = f?.methods.find(x => x.id === methodId);
  return f && m && resolveMethod(f, m);
}
/** "4 chicken breasts", "3 racks St. Louis ribs" */
const lower = (name: string) => (/^St\. /.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));
function countLine(f: RuleFood, n: number): string {
  const name = lower(f.name);
  return name.endsWith(f.quantity.unit.toLowerCase()) ? `${n} ${name}` : `${n} ${f.quantity.unit} ${name}`;
}

export type { RateSource };
export interface RateRow {
  foodId: string;
  foodName: string;
  methodId: string | null; // the by-weight method, null when the food only has saved total hours
  hrPerLb: number | null; // rate the planner uses
  source: RateSource | null;
  saved: number | null; // the user's saved rate
  locked: boolean; // saved rate never blends with logged cooks
  cooks: number; // logged cooks of that method on this smoker
  totalHours: number | null; // saved default total hours
}

/**
 * Cook rates (Gear): every by-weight food with the rate the planner will use and where it comes from,
 * then any other food with saved total hours. Rules order.
 */
export function rateRows(
  rules: Rules,
  logs: CookLog[],
  smokerId: string,
  overrides: Record<string, number>,
  totalHours: Record<string, number>,
  locks: Record<string, boolean> = {},
): RateRow[] {
  const rows: RateRow[] = [];
  for (const f of rules.foods) {
    const m = f.methods.map(x => resolveMethod(f, x)).find(x => x.timing?.kind === 'perWeight');
    const hours = totalHours[f.id] ?? null;
    if (m) {
      const r = rateFor(
        rules,
        { id: 'rate', foodId: f.id, methodId: m.id, quantity: f.quantity.default },
        smokerId,
        overrides,
        logs,
        'perPound',
        locks,
      );
      rows.push({
        foodId: f.id,
        foodName: f.name,
        methodId: m.id,
        hrPerLb: r.rate,
        source: r.source,
        saved: overrides[f.id] ?? null,
        locked: !!locks[f.id],
        cooks: r.cooksLogged,
        totalHours: hours,
      });
    } else if (hours != null) {
      rows.push({
        foodId: f.id,
        foodName: f.name,
        methodId: null,
        hrPerLb: null,
        source: null,
        saved: null,
        locked: false,
        cooks: 0,
        totalHours: hours,
      });
    }
  }
  return rows;
}

/** Gear row: "Brisket 0.75 hr/lb, your setting", or the published-estimate line when nothing is set or learned. */
export function ratesSummary(rows: RateRow[], u: Units): string {
  const mine =
    rows.find(r => r.source === 'override' || r.source === 'blended') ?? rows.find(r => r.source === 'learned');
  if (mine) return `${mine.foodName} ${fmtRate(mine.hrPerLb!, u)}, ${sourceText(mine.source!, mine.cooks)}`;
  const hours = rows.find(r => r.totalHours != null);
  if (hours) return `${hours.foodName} ${+hours.totalHours!.toFixed(2)} hr total, your setting`;
  return 'Published estimates. Set your own.';
}

/** "your setting", "learned from 2 cooks", "published estimate" */
export function sourceText(source: RateSource, cooks: number): string {
  if (source === 'item') return 'this cook only';
  if (source === 'override') return 'your setting';
  if (source === 'blended') return `your setting, adjusted by ${cooks} ${cooks === 1 ? 'cook' : 'cooks'}`;
  if (source === 'learned') return `learned from ${cooks} ${cooks === 1 ? 'cook' : 'cooks'}`;
  return 'published estimate';
}

/** "Brisket 12 lb, wings 2 lb, 4 chicken breasts" */
export function menuLine(rules: Rules, r: CookRecord, units: Units): string {
  const parts = r.items.map(it => {
    const f = foodOf(rules, it.log.foodId);
    if (!f) return lower(it.name);
    return f.quantity.kind === 'weight'
      ? `${lower(f.name)} ${fmtWeight(it.log.quantity, units)}`
      : countLine(f, it.log.quantity);
  });
  const s = parts.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The food furthest from plan: "Brisket 25 min ahead of plan", or "All on plan". Null when nothing was logged. */
export function missLine(r: CookRecord): string | null {
  const logged = r.items.filter(i => !i.log.discarded);
  if (!logged.length) return null;
  const worst = logged.reduce((a, b) =>
    Math.abs(b.actualMin - b.plannedMin) > Math.abs(a.actualMin - a.plannedMin) ? b : a,
  );
  const d = worst.actualMin - worst.plannedMin;
  if (Math.abs(d) < ON_PLAN_MIN) return logged.length > 1 ? 'All on plan' : `${worst.name} on plan`;
  return `${worst.name} ${fmtDuration(Math.abs(d))} ${d < 0 ? 'ahead of' : 'behind'} plan`;
}

/** Serve status for the cook card: "On time", "20 min late", "Ended early"; null for records saved before this was kept. */
export function serveStatus(r: CookRecord): { text: string; tone: 'ok' | 'warn' | 'secondary' } | null {
  if (r.lateMin === undefined) return null;
  if (r.lateMin === null) return { text: 'Ended early', tone: 'secondary' };
  if (Math.abs(r.lateMin) < ON_PLAN_MIN) return { text: 'On time', tone: 'ok' };
  return r.lateMin > 0
    ? { text: `${fmtDuration(r.lateMin)} late`, tone: 'warn' }
    : { text: `${fmtDuration(-r.lateMin)} early`, tone: 'ok' };
}

/** Plan items for Cook again: same foods, methods, sizes and options; rest goes back to the rules default. */
export function cookAgainItems(rules: Rules, r: CookRecord, newId: (i: number) => string): ItemInput[] {
  return r.items
    .filter(it => methodOf(rules, it.log.foodId, it.log.methodId))
    .map((it, i) => {
      const m = methodOf(rules, it.log.foodId, it.log.methodId);
      return {
        id: newId(i),
        foodId: it.log.foodId,
        methodId: it.log.methodId,
        quantity: it.log.quantity,
        options: { ...(it.log.options ?? {}) },
        restMin: m!.restMin?.default,
      };
    });
}
