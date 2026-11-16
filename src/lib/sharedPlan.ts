// Open shared plan (mockup 11, SPEC sections 3 and 9, failure modes 12-13): read a .pitplan file,
// keep only what this app knows, map foods onto the receiver's cookers, pick a serve date.
// Pure: rules are passed in (tests can't import rules.ts), no storage, no clock.

import { buildPlan } from '../../engine/plan.ts';
import type { Cookers, ItemInput, PlanInput, Warning } from '../../engine/types.ts';
import {
  canDoMethod,
  firstDoableMethod,
  missingCookers,
  resolveMethod,
  smokerTooCool,
  type ResolvedMethod,
  type RuleFood,
  type Rules,
} from '../../engine/rules.ts';
import { isSettable, settableTemps } from '../../engine/temps.ts';

const MAX_ITEMS = 20;
const REST_MAX = 240;
const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;

/**
 * Serve times a plan file can hold (T-035, security pass finding 4): from 2000 up to the end of 2099, UTC.
 * Fixed bounds, so the parser needs no clock; anything outside is a damaged file.
 */
export const SERVE_AT_RANGE: readonly [number, number] = [Date.UTC(2000, 0, 1), Date.UTC(2100, 0, 1)];
/**
 * Pit temps a plan file can hold, F (T-035, finding 4): clamped like quantity and rest. Wider than any smoker
 * the app knows (the checked ones are set from 180 to 500F), so a real plan is never changed; it only stops a
 * nonsense value (1e9, -400) from reaching the timing model. The receiver's smoker then picks the nearest
 * temp it can be set to (fitPitTemp).
 */
export const PIT_TEMP_RANGE_F: readonly [number, number] = [150, 700];

export interface SharedPlan {
  serveAt: number;
  pitTempF: number;
  items: ItemInput[];
  dropped: number;
}

const foodOf = (rules: Rules, id: unknown): RuleFood | undefined => rules.foods.find(f => f.id === id);
/** Method merged with the food's shared fields, as the engine reads it. */
function methodOf(food: RuleFood, id: unknown): ResolvedMethod | undefined {
  const m = food.methods.find(x => x.id === id);
  return m && resolveMethod(food, m);
}
/** A .pitplan file as read from disk: nothing is trusted until checked. */
interface RawFile {
  app?: unknown;
  version?: unknown;
  serveAt?: unknown;
  pitTempF?: unknown;
  items?: unknown;
}
interface RawItem {
  foodId?: unknown;
  methodId?: unknown;
  quantity?: unknown;
  restMin?: unknown;
  options?: unknown;
}
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Options the method knows, with a valid choice; everything else gets the method default. */
function cleanOptions(method: ResolvedMethod, given: unknown): Record<string, string> {
  const src = given && typeof given === 'object' ? (given as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(method.options).map(([k, o]) => [
      k,
      typeof src[k] === 'string' && o.choices[src[k] as string] ? (src[k] as string) : o.default,
    ]),
  );
}

/** Parse a .pitplan file. Returns an error message for the user instead of throwing. */
export function parsePitPlan(rules: Rules, text: string, newId: (i: number) => string): SharedPlan | { error: string } {
  let f: RawFile | null;
  try {
    f = JSON.parse(text) as RawFile | null;
  } catch {
    return { error: 'This file is not a Pit Planner plan.' };
  }
  if (!f || f.app !== 'pit-planner') return { error: 'This file is not a Pit Planner plan.' };
  if (f.version !== 1) return { error: 'This plan was made by a newer Pit Planner. Update the app to open it.' };
  const serveAt = typeof f.serveAt === 'string' ? Date.parse(f.serveAt) : NaN;
  const rawTemp = num(f.pitTempF);
  const inRange = Number.isFinite(serveAt) && serveAt >= SERVE_AT_RANGE[0] && serveAt < SERVE_AT_RANGE[1];
  if (!inRange || rawTemp == null || !Array.isArray(f.items)) return { error: 'This plan file is damaged.' };
  const pitTempF = clamp(Math.round(rawTemp), PIT_TEMP_RANGE_F[0], PIT_TEMP_RANGE_F[1]);

  const rawItems = f.items as (RawItem | null)[];
  const items: ItemInput[] = [];
  let dropped = 0;
  for (const raw of rawItems.slice(0, MAX_ITEMS)) {
    const food = foodOf(rules, raw?.foodId);
    if (!food) {
      dropped++;
      continue;
    }
    const method = methodOf(food, raw?.methodId) ?? resolveMethod(food, food.methods[0]);
    const q = food.quantity;
    const quantity = clamp(num(raw?.quantity) ?? q.default, q.min, q.max);
    const rest = num(raw?.restMin);
    // Times come from the receiver's own rates: the sender's rate, total hours and model are not used.
    items.push({
      id: newId(items.length),
      foodId: food.id,
      methodId: method.id,
      quantity: q.kind === 'count' ? Math.round(quantity) : quantity,
      options: cleanOptions(method, raw?.options),
      restMin: rest == null ? method.restMin.default : clamp(Math.round(rest), method.restMin.min, REST_MAX),
    });
  }
  dropped += Math.max(0, rawItems.length - MAX_ITEMS);
  if (!items.length) return { error: 'Nothing in this plan is a food Pit Planner knows.' };
  return { serveAt, pitTempF, items, dropped };
}

export interface CookerMove {
  foodName: string;
  /** The cooker that is not set up. */
  from: string;
  /** The cooker the food is cooked on now (its new method's own). */
  to: string;
  /**
   * What the food will do instead, after "will", from the new method's `importMove` (T-075: "be seared on the
   * smoker", "cook brisket-style with no sear").
   */
  how?: string;
}
export interface CookerGap {
  foodName: string;
  cooker: string;
}

/**
 * Put each food on cookers the receiver has (failure mode 13). Every cooker a method's steps need is checked,
 * not only its own (T-075): a griddle food moves to the smoker when there is no griddle, and a tri-tip with a
 * griddle sear takes the first of its methods the receiver can fully do (the smoker sear). Foods with no
 * method the receiver can do stay as they are and are listed in gaps, under the first cooker missing. A
 * method the receiver's smoker cannot get hot enough for (the smoker sear on one that tops out under 450F)
 * also takes the first method they can do, and counts as moved for the import's conflicts. It gets a box
 * line only when it stays on its own cooker, its new method has words for that (`importMove`: "cook
 * brisket-style with no sear") and a method ahead of it needs only a cooker that is not set up: the line goes
 * under that cooker ("or add a griddle in Gear"). With every cooker set up (a griddle: the smoker sear falls
 * to the griddle sear) nothing is said (Jason, 2026-11-16: no words for it yet).
 */
export function mapToCookers(
  rules: Rules,
  items: ItemInput[],
  cookers: Cookers,
): { items: ItemInput[]; moves: CookerMove[]; gaps: CookerGap[] } {
  const moves: CookerMove[] = [],
    gaps: CookerGap[] = [];
  const out = items.map(it => {
    const food = foodOf(rules, it.foodId)!;
    const m = methodOf(food, it.methodId)!;
    if (canDoMethod(food, m, cookers)) return it;
    const missing = missingCookers(food, m, cookers);
    const found = firstDoableMethod(food, cookers);
    if (!found) {
      if (missing.length) gaps.push({ foodName: food.name, cooker: missing[0]! });
      return it;
    }
    const alt = resolveMethod(food, found);
    const swap = { ...it, methodId: alt.id, options: cleanOptions(alt, it.options), restMin: alt.restMin.default };
    const stays = alt.importMove != null && alt.cooker === m.cooker;
    if (!missing.length) {
      // The smoker is too cool (T-075 follow-up). The cooker that would give a method ahead of the new one.
      const ahead = food.methods.slice(0, food.methods.indexOf(found));
      const want = ahead.find(x => !smokerTooCool(food, x, cookers) && missingCookers(food, x, cookers).length);
      if (stays && want)
        moves.push({
          foodName: food.name,
          from: missingCookers(food, want, cookers)[0]!,
          to: alt.cooker,
          how: alt.importMove!,
        });
      return swap;
    }
    moves.push({
      foodName: food.name,
      from: missing[0]!,
      to: alt.cooker,
      ...(stays ? { how: alt.importMove! } : {}),
    });
    return swap;
  });
  return { items: out, moves, gaps };
}

/** A shared plan as the receiver will cook it: on their cookers, at a temp their smoker can be set to. */
export interface ImportedPlan {
  items: ItemInput[];
  pitTempF: number;
  moves: CookerMove[];
  gaps: CookerGap[];
  /** Ids of the foods that changed cooker. */
  movedIds: string[];
}

export function importPlan(rules: Rules, shared: SharedPlan, cookers: Cookers): ImportedPlan {
  const mapped = mapToCookers(rules, shared.items, cookers);
  const movedIds = mapped.items.filter((it, i) => it.methodId !== shared.items[i]?.methodId).map(it => it.id);
  return { ...mapped, pitTempF: fitPitTemp(shared.pitTempF, cookers), movedIds };
}

/**
 * Conflicts the import itself made (T-030): the warnings of the receiver's plan that name a food which
 * changed cooker. Breasts moved off a griddle the receiver does not have now share the smoker with the rest
 * of the menu, so the plan can need two temps at once or hold a food too long. Notes (level info) and
 * warnings about foods that stayed where the sender had them are not counted. `input` is the plan as it
 * will be built on the receiver's phone (their cookers, rates and history).
 */
export function importConflicts(rules: Rules, input: PlanInput, movedIds: readonly string[]): Warning[] {
  if (movedIds.length === 0) return [];
  let warnings: Warning[];
  try {
    warnings = buildPlan(rules, input).warnings;
  } catch {
    return [];
  }
  return warnings.filter(w => w.level === 'warn' && (w.itemIds ?? []).some(id => movedIds.includes(id)));
}

/** The shared set point, or the nearest one the receiver's smoker can be set to (failure mode 12). */
export function fitPitTemp(pitTempF: number, cookers: Cookers): number {
  const s = cookers.smoker;
  if (!s || isSettable(s, pitTempF)) return pitTempF;
  const opts = settableTemps(s);
  if (!opts.length) return pitTempF;
  return opts.reduce((a, b) => (Math.abs(b - pitTempF) < Math.abs(a - pitTempF) ? b : a));
}

/** `t` moved by whole weeks of calendar days: the same weekday at the same local time. */
function weeksLater(t: number, weeks: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + 7 * weeks);
  return d.getTime();
}

/**
 * The shared serve time if it is at least an hour out, else the next same weekday at the same local time.
 * One computation however far back the date is (T-035, finding 4: a week-at-a-time loop took millions of
 * turns for a date in the distant past and froze the app). A week of calendar days is a week of
 * milliseconds give or take the clock changes in between, which add up to less than a week, so the count
 * of weeks worked out from milliseconds is off by one at most: one step forward or back corrects it.
 */
export function suggestServe(sharedServe: number, now: number): number {
  const target = now + HOUR;
  if (sharedServe >= target) return sharedServe;
  let weeks = Math.max(1, Math.ceil((target - sharedServe) / WEEK));
  if (weeksLater(sharedServe, weeks) < target) weeks++;
  else if (weeks > 1 && weeksLater(sharedServe, weeks - 1) >= target) weeks--;
  return weeksLater(sharedServe, weeks);
}

/** Why the serve date offered is not the shared one: the shared time has passed, or it is under an hour away. */
export type ServeMove = 'kept' | 'passed' | 'soon';

/**
 * What suggestServe did with the shared serve time (T-073), for the note under "Serve on". The edges follow
 * suggestServe: exactly one hour out is 'kept' (it keeps `sharedServe >= now + HOUR`), and a time that is
 * exactly now is 'soon', not 'passed' (it has not passed yet, and it is under an hour away).
 */
export function serveMove(sharedServe: number, now: number): ServeMove {
  if (sharedServe >= now + HOUR) return 'kept';
  return sharedServe < now ? 'passed' : 'soon';
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Menu line as the sender set it: "Brisket, 12 lb, butcher paper", "Chicken breasts, 4, griddle". */
export function sharedLine(rules: Rules, it: ItemInput, qty: string): string {
  const food = foodOf(rules, it.foodId)!;
  const m = methodOf(food, it.methodId)!;
  const parts = [food.name, qty];
  if (food.methods.length > 1) parts.push(m.short ?? lowerFirst(m.label));
  const wrap = m.options?.wrap?.choices[it.options?.wrap ?? m.options.wrap.default];
  if (wrap) parts.push(lowerFirst(wrap.label));
  return parts.join(', ');
}
