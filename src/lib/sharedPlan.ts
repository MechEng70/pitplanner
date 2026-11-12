// Open shared plan (mockup 11, SPEC sections 3 and 9, failure modes 12-13): read a .pitplan file,
// keep only what this app knows, map foods onto the receiver's cookers, pick a serve date.
// Pure: rules are passed in (tests can't import rules.ts), no storage, no clock.

import type { Cookers, ItemInput } from '../../engine/types.ts';
import type { Rules } from '../../engine/plan.ts';
import { isSettable, settableTemps } from '../../engine/temps.ts';

const MAX_ITEMS = 20;
const REST_MAX = 240;
const HOUR = 3_600_000;

export interface SharedPlan { serveAt: number; pitTempF: number; items: ItemInput[]; dropped: number }

const foodOf = (rules: Rules, id: unknown): any => rules.foods.find((f: any) => f.id === id);
/** Method merged with the food's shared fields, as the engine reads it. */
function methodOf(food: any, id: unknown): any {
  const m = food.methods.find((x: any) => x.id === id);
  return m && { ...(food.shared ?? {}), ...m, options: { ...(food.shared?.options ?? {}), ...(m.options ?? {}) } };
}
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Options the method knows, with a valid choice; everything else gets the method default. */
function cleanOptions(method: any, given: unknown): Record<string, string> {
  const src = given && typeof given === 'object' ? given as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries<any>(method.options ?? {}).map(([k, o]) =>
    [k, typeof src[k] === 'string' && o.choices[src[k] as string] ? src[k] as string : o.default]));
}

/** Parse a .pitplan file. Returns an error message for the user instead of throwing. */
export function parsePitPlan(rules: Rules, text: string, newId: (i: number) => string): SharedPlan | { error: string } {
  let f: any;
  try { f = JSON.parse(text); } catch { return { error: 'This file is not a Pit Planner plan.' }; }
  if (!f || f.app !== 'pit-planner') return { error: 'This file is not a Pit Planner plan.' };
  if (f.version !== 1) return { error: 'This plan was made by a newer Pit Planner. Update the app to open it.' };
  const serveAt = typeof f.serveAt === 'string' ? Date.parse(f.serveAt) : NaN;
  const pitTempF = num(f.pitTempF);
  if (!Number.isFinite(serveAt) || pitTempF == null || !Array.isArray(f.items)) return { error: 'This plan file is damaged.' };

  const items: ItemInput[] = [];
  let dropped = 0;
  for (const raw of f.items.slice(0, MAX_ITEMS)) {
    const food = foodOf(rules, raw?.foodId);
    if (!food) { dropped++; continue; }
    const method = methodOf(food, raw.methodId) ?? methodOf(food, food.methods[0].id);
    const q = food.quantity;
    const quantity = clamp(num(raw.quantity) ?? q.default, q.min, q.max);
    const rest = num(raw.restMin);
    // Times come from the receiver's own rates: the sender's rate, total hours and model are not used.
    items.push({
      id: newId(items.length), foodId: food.id, methodId: method.id,
      quantity: q.kind === 'count' ? Math.round(quantity) : quantity,
      options: cleanOptions(method, raw.options),
      restMin: rest == null ? method.restMin.default : clamp(Math.round(rest), method.restMin.min, REST_MAX),
    });
  }
  dropped += Math.max(0, f.items.length - MAX_ITEMS);
  if (!items.length) return { error: 'Nothing in this plan is a food Pit Planner knows.' };
  return { serveAt, pitTempF, items, dropped };
}

export interface CookerMove { foodName: string; from: string; to: string }
export interface CookerGap { foodName: string; cooker: string }

/**
 * Put each food on a cooker the receiver has (failure mode 13): a griddle food moves to the smoker when there
 * is no griddle. Foods with no possible cooker stay as they are and are listed in gaps.
 */
export function mapToCookers(rules: Rules, items: ItemInput[], cookers: Cookers): { items: ItemInput[]; moves: CookerMove[]; gaps: CookerGap[] } {
  const moves: CookerMove[] = [], gaps: CookerGap[] = [];
  const out = items.map(it => {
    const food = foodOf(rules, it.foodId);
    const m = methodOf(food, it.methodId);
    if (cookers[m.cooker as keyof Cookers]) return it;
    const alt = food.methods.map((x: any) => methodOf(food, x.id)).find((x: any) => cookers[x.cooker as keyof Cookers]);
    if (!alt) { gaps.push({ foodName: food.name, cooker: m.cooker }); return it; }
    moves.push({ foodName: food.name, from: m.cooker, to: alt.cooker });
    return { ...it, methodId: alt.id, options: cleanOptions(alt, it.options), restMin: alt.restMin.default };
  });
  return { items: out, moves, gaps };
}

/** The shared set point, or the nearest one the receiver's smoker can be set to (failure mode 12). */
export function fitPitTemp(pitTempF: number, cookers: Cookers): number {
  const s = cookers.smoker;
  if (!s || isSettable(s, pitTempF)) return pitTempF;
  const opts = settableTemps(s);
  if (!opts.length) return pitTempF;
  return opts.reduce((a, b) => Math.abs(b - pitTempF) < Math.abs(a - pitTempF) ? b : a);
}

/** The shared serve time if it is at least an hour out, else the next same weekday at the same local time. */
export function suggestServe(sharedServe: number, now: number): number {
  if (sharedServe >= now + HOUR) return sharedServe;
  const d = new Date(sharedServe);
  while (d.getTime() < now + HOUR) d.setDate(d.getDate() + 7);
  return d.getTime();
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Menu line as the sender set it: "Brisket, 12 lb, butcher paper", "Chicken breasts, 4, griddle". */
export function sharedLine(rules: Rules, it: ItemInput, qty: string): string {
  const food = foodOf(rules, it.foodId);
  const m = methodOf(food, it.methodId);
  const parts = [food.name, qty];
  if (food.methods.length > 1) parts.push(m.short ?? lowerFirst(m.label));
  const wrap = m.options?.wrap?.choices[it.options?.wrap ?? m.options.wrap.default];
  if (wrap) parts.push(lowerFirst(wrap.label));
  return parts.join(', ');
}
