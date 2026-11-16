// Live-cook adjustments. Each returns a new Plan; the caller then cancels and
// reschedules all alarms in one step from plan.events (never patch alarms piecemeal).

import type { Plan, PlanInput, PlannedItem } from './types.ts';
import { CONFLICT_TOLERANCE_F, derive, type Rules } from './plan.ts';
import { keyedEvents, type KeyedEvent } from './alarms.ts';

const MIN = 60_000;
const STEP_MIN = 5;
const STEP = STEP_MIN * MIN;
/** Live changes keep scheduled times on the 5-minute grid (Done at 6:41 moves the next check to 6:40, not 6:41). */
const roundMin = (min: number) => Math.round(min / STEP_MIN) * STEP_MIN;
const roundAt = (t: number) => Math.round(t / STEP) * STEP;
const ceilAt = (t: number) => Math.ceil(t / STEP) * STEP;

function clone(plan: Plan): Plan {
  return structuredClone(plan);
}

/**
 * One food runs d ms later from `now`: a phase not started moves whole, the phase it is in ends later (it
 * cooks that much longer). A food already off the heat stays. Its hold is not touched here.
 */
function shiftItem(it: PlannedItem, now: number, d: number) {
  let moved = false;
  for (const p of it.phases) {
    if (p.end <= now) continue;
    if (p.start >= now) p.start += d;
    p.end += d;
    moved = true;
  }
  if (moved || it.finish > now) it.finish += d;
}

/** Serve moved later by d ms for one food: every other food follows from `now` and keeps its hold (T-076). */
function followServe(items: PlannedItem[], exceptId: string, now: number, d: number) {
  for (const it of items) if (it.input.id !== exceptId) shiftItem(it, now, d);
}

/**
 * Shift everything not yet started by deltaMin (positive = running late).
 * A phase in progress has its end moved. keepServe: serve time stays and the
 * difference comes out of (or goes into) the holds; otherwise serve moves too.
 */
export function shiftRemaining(
  rules: Rules,
  input: PlanInput,
  plan: Plan,
  now: number,
  deltaMin: number,
  keepServe: boolean,
  onlyItemId?: string,
): Plan {
  const next = clone(plan);
  const d = deltaMin * MIN;
  for (const it of next.items) {
    if (onlyItemId && it.input.id !== onlyItemId) continue;
    shiftItem(it, now, d);
    it.extraHoldMin -= keepServe ? deltaMin : 0;
  }
  const serveAt = keepServe ? next.serveAt : next.serveAt + d;
  return derive(rules, input, next.items, serveAt);
}

/** What the app knows that the plan does not, for Done early with Move serve (T-076). */
export interface DoneContext {
  /** When Done was tapped. Default: doneAt. */
  now?: number;
  /** Step keys already done (`ActiveCook.done`). Default: every step due before `now`. */
  done?: Iterable<string>;
  /** Nothing may move to before this (the end of Quiet time). */
  notBefore?: number | null;
}

/**
 * The user tapped Done on a check step at doneAt. Shift that item's later phases by the difference.
 * keepServe false and late: serve moves by the same minutes and every other food follows (T-076). keepServe
 * false and early: serve moves earlier only as far as every other food can still be ready (moveServeEarlier).
 */
export function markStepDone(
  rules: Rules,
  input: PlanInput,
  plan: Plan,
  itemId: string,
  phaseId: string,
  doneAt: number,
  keepServe: boolean,
  ctx: DoneContext = {},
): { plan: Plan; deltaMin: number } {
  const it = plan.items.find(i => i.input.id === itemId);
  const p = it?.phases.find(x => x.id === phaseId);
  if (!it || !p) throw new Error('Unknown step');
  const deltaMin = roundMin((doneAt - p.start) / MIN);
  if (deltaMin === 0) return { plan, deltaMin };
  const now = ctx.now ?? doneAt;
  // Phases from this one on move by the difference; the phase before it ends when the step was done.
  const next = clone(plan);
  const ni = next.items.find(i => i.input.id === itemId)!;
  const idx = ni.phases.findIndex(x => x.id === phaseId);
  if (ni.phases[idx - 1]) ni.phases[idx - 1].end = doneAt;
  for (let i = idx; i < ni.phases.length; i++) {
    ni.phases[i].start += deltaMin * MIN;
    ni.phases[i].end += deltaMin * MIN;
  }
  ni.finish += deltaMin * MIN;
  if (keepServe || deltaMin < 0) ni.extraHoldMin -= deltaMin;
  if (keepServe) return { plan: derive(rules, input, next.items, next.serveAt), deltaMin };
  if (deltaMin < 0) {
    const kept = derive(rules, input, next.items, next.serveAt);
    return { plan: moveServeEarlier(rules, input, kept, itemId, -deltaMin, now, ctx), deltaMin };
  }
  followServe(next.items, itemId, now, deltaMin * MIN);
  return { plan: derive(rules, input, next.items, next.serveAt + deltaMin * MIN), deltaMin };
}

/**
 * Done early with Move serve (T-076; Jason, 2026-11-16, choices 1A, 2A, 3A, 4A). `kept` is the Keep serve
 * plan: the done food is d minutes earlier and serve is where it was. Serve moves earlier only as far as
 * every other food can still come off the heat and rest to its minimum (min(restFloorMin, restMin)) before
 * it. A food not on yet starts sooner by up to d minutes ("slack"), but none of its future steps moves to
 * before now or into Quiet time, and the move stops short of any smoker conflict `kept` does not have. A food
 * on or off the heat, or late for its next step, cannot start sooner: its hold gives. A food never cooks
 * shorter. When no earlier serve is possible the result is `kept`.
 */
function moveServeEarlier(
  rules: Rules,
  input: PlanInput,
  kept: Plan,
  itemId: string,
  dMin: number,
  now: number,
  ctx: DoneContext,
): Plan {
  const others = kept.items.filter(i => i.input.id !== itemId);
  const nowG = ceilAt(now);
  const floor = ceilAt(Math.max(now, ctx.notBefore ?? now));
  const done = ctx.done ? new Set(ctx.done) : null;
  const isDone = (k: KeyedEvent) => (done ? done.has(k.key) : k.event.at < now);
  const keyed = keyedEvents(kept);
  const slack = new Map<string, number>();
  let ready = -Infinity;
  for (const it of others) {
    const id = it.input.id;
    const first = keyed.find(
      k => k.event.itemId === id && (k.event.kind === 'phase' || k.event.kind === 'pull') && !isDone(k),
    );
    const lateBy = first && first.event.at < nowG ? nowG - first.event.at : 0;
    const notOn = first?.event.kind === 'phase' && first.event.phaseId === it.phases[0]?.id;
    const s = notOn && lateBy === 0 ? startSooner(rules, input, kept, id, dMin, now, floor) : 0;
    slack.set(id, s);
    const minRest = Math.min(it.restFloorMin, it.restMin) + it.sliceMin;
    ready = Math.max(ready, it.finish + lateBy - s * MIN + minRest * MIN);
  }
  // The rule's S = ceil5(max(kept serve - d, ready)), written as how far serve moves (D, at most d, a multiple
  // of 5) so that a serve time off the 5-min grid still moves the full d with one food.
  const most = Math.min(dMin, Math.floor((kept.serveAt - ready) / STEP) * STEP_MIN);
  // 3A on the whole result, not only each food alone. It cannot fail today: a clash between two foods
  // depends only on how far one moved against the other, and that gap (m_a - m_b, at most one food's slack)
  // is a move startSooner already checked step by step against the Keep plan. Kept as a guard: if it ever
  // fails, serve backs off 5 min at a time (every food's move is min(D, its slack), so each one shrinks with
  // it) until nothing clashes that Keep serve does not; at D = 0 the result is the Keep plan.
  const clash = new Map(others.map(it => [it.input.id, conflictMin(kept, it.input.id)]));
  for (let D = most; D > 0; D -= STEP_MIN) {
    const next = clone(kept);
    for (const it of next.items) {
      if (it.input.id === itemId) {
        it.extraHoldMin -= D;
        continue;
      }
      const m = Math.min(D, slack.get(it.input.id) ?? 0);
      moveEarlier(it, m);
      it.extraHoldMin -= D - m;
    }
    const result = derive(rules, input, next.items, kept.serveAt - D * MIN);
    const worse = others.some(it =>
      [...conflictMin(result, it.input.id)].some(([o, m]) => m > (clash.get(it.input.id)?.get(o) ?? 0)),
    );
    if (!worse) return result;
  }
  return kept;
}

function moveEarlier(it: PlannedItem, min: number) {
  for (const p of it.phases) {
    p.start -= min * MIN;
    p.end -= min * MIN;
  }
  it.finish -= min * MIN;
}

/**
 * How many minutes (a multiple of 5, at most maxMin) food `id` can start sooner than in `kept`: each step of
 * 5 min up to it keeps every future step it drags (its own steps and prep, and the fire, griddle, oven and
 * smoker temp steps worked out from it) at or after `floor`, and adds no smoker conflict.
 */
function startSooner(
  rules: Rules,
  input: PlanInput,
  kept: Plan,
  id: string,
  maxMin: number,
  now: number,
  floor: number,
): number {
  const before = new Map(keyedEvents(kept).map(k => [k.key, k.event.at]));
  const clash = conflictMin(kept, id);
  let ok = 0;
  for (let s = STEP_MIN; s <= maxMin; s += STEP_MIN) {
    const next = clone(kept);
    const food = next.items.find(i => i.input.id === id);
    if (food) moveEarlier(food, s);
    const cand = derive(rules, input, next.items, kept.serveAt);
    const dragged = keyedEvents(cand).filter(k => {
      if (k.event.kind === 'refill' || k.event.kind === 'pitOff') return false;
      const was = before.get(k.key);
      return was == null || (was !== k.event.at && was >= now);
    });
    if (dragged.some(k => k.event.at < floor)) break;
    const c = conflictMin(cand, id);
    if ([...c].some(([other, m]) => m > (clash.get(other) ?? 0))) break;
    ok = s;
  }
  return ok;
}

/** Minutes food `id` is on the smoker with each other food at temps too far apart to share it. */
function conflictMin(plan: Plan, id: string): Map<string, number> {
  const mine = plan.items.find(i => i.input.id === id)?.phases.filter(p => p.cooker === 'smoker') ?? [];
  const out = new Map<string, number>();
  for (const it of plan.items) {
    if (it.input.id === id) continue;
    for (const q of it.phases.filter(p => p.cooker === 'smoker'))
      for (const p of mine) {
        const overlap = Math.min(p.end, q.end) - Math.max(p.start, q.start);
        if (overlap > 0 && Math.abs(p.tempF - q.tempF) > CONFLICT_TOLERANCE_F)
          out.set(it.input.id, (out.get(it.input.id) ?? 0) + overlap / MIN);
      }
  }
  return out;
}

/**
 * Pit went out at downAt and was back to temp at upAt. Smoker items lose that time plus a recovery allowance.
 * Move serve: every other food follows the later serve from upAt and keeps its hold (T-076).
 */
export function pitOutage(
  rules: Rules,
  input: PlanInput,
  plan: Plan,
  downAt: number,
  upAt: number,
  recoveryMin: number,
  keepServe: boolean,
): Plan {
  const lost = roundMin((upAt - downAt) / MIN + recoveryMin);
  const next = clone(plan);
  for (const it of next.items) {
    if (!it.phases.some(p => p.cooker === 'smoker' && p.end > downAt)) {
      if (!keepServe) shiftItem(it, upAt, lost * MIN);
      continue;
    }
    for (const p of it.phases) {
      if (p.end <= downAt) continue;
      if (p.start >= downAt) {
        p.start += lost * MIN;
        p.end += lost * MIN;
      } else p.end += lost * MIN;
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
export function extendCook(
  rules: Rules,
  input: PlanInput,
  plan: Plan,
  itemId: string,
  now: number,
  minutes: number,
  keepServe: boolean,
): Plan {
  const next = clone(plan);
  const it = next.items.find(i => i.input.id === itemId);
  if (!it) throw new Error('Unknown item');
  const newFinish = roundAt(Math.max(it.finish, now) + minutes * MIN);
  const d = newFinish - it.finish;
  // Phases not started yet move whole; the one running (or last finished) stretches to meet them.
  for (const p of it.phases)
    if (p.start >= now) {
      p.start += d;
      p.end += d;
    }
  it.phases.forEach((p, i) => {
    if (p.start < now) p.end = it.phases[i + 1]?.start ?? newFinish;
  });
  it.finish = newFinish;
  if (keepServe) it.extraHoldMin -= d / MIN;
  // Move serve: every other food follows from now and keeps its hold (T-076).
  else followServe(next.items, itemId, now, d);
  return derive(rules, input, next.items, keepServe ? next.serveAt : next.serveAt + d);
}

/**
 * +15 min on a step's alert, or Adjust > Not yet. A phase step starts later (that food's later phases
 * follow); a pull extends the cook; anything else (fire, refill, serve) just reminds again.
 */
export function postponeStep(
  rules: Rules,
  input: PlanInput,
  plan: Plan,
  key: string,
  now: number,
  minutes: number,
  keepServe: boolean,
): { plan: Plan; reminderAt: number | null } {
  const ke = keyedEvents(plan).find(k => k.key === key);
  if (!ke) throw new Error(`Unknown step ${key}`);
  const e = ke.event;
  const at = Math.max(e.at, now) + minutes * MIN;
  if (e.kind === 'phase' && e.itemId && e.phaseId)
    return {
      plan: markStepDone(rules, input, plan, e.itemId, e.phaseId, at, keepServe, { now }).plan,
      reminderAt: null,
    };
  if (e.kind === 'pull' && e.itemId)
    return { plan: extendCook(rules, input, plan, e.itemId, now, minutes, keepServe), reminderAt: null };
  // Fixed step (fire, refill...): ring again `minutes` from now, unless its own alarm comes later anyway.
  const remind = roundAt(now + minutes * MIN);
  return { plan, reminderAt: remind > e.at ? remind : null };
}

/** Time ranges where two or more foods are on the smoker at once (lane chart highlight, shared-pit note). */
export function smokerOverlaps(plan: Plan): { start: number; end: number; itemIds: string[]; tempsF: number[] }[] {
  const spans = plan.items.flatMap(it =>
    it.phases
      .filter(p => p.cooker === 'smoker')
      .map(p => ({ id: it.input.id, start: p.start, end: p.end, tempF: p.tempF })),
  );
  const cuts = [...new Set(spans.flatMap(s => [s.start, s.end]))].sort((a, b) => a - b);
  const out: { start: number; end: number; itemIds: string[]; tempsF: number[] }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i],
      b = cuts[i + 1];
    const on = spans.filter(s => s.start <= a && s.end >= b);
    const ids = [...new Set(on.map(s => s.id))].sort();
    if (ids.length < 2) continue;
    const prev = out[out.length - 1];
    if (prev && prev.end === a && prev.itemIds.join() === ids.join()) {
      prev.end = b;
      prev.tempsF = [...new Set([...prev.tempsF, ...on.map(s => s.tempF)])];
    } else out.push({ start: a, end: b, itemIds: ids, tempsF: [...new Set(on.map(s => s.tempF))] });
  }
  return out;
}

export interface SmokerConflict {
  start: number;
  end: number;
  /** Every food on the smoker in the stretch, in menu order, with the temp it needs there. */
  foods: { itemId: string; tempF: number }[];
}

/**
 * Time ranges where the foods on the smoker need temps too far apart to share it (the PIT_CONFLICT rule of
 * plan.ts), soonest first. A range runs on while a food only changes phase at a temp that still conflicts,
 * and then lists the temp it needs first.
 */
export function smokerConflicts(plan: Plan): SmokerConflict[] {
  const spans = plan.items.flatMap(it =>
    it.phases
      .filter(p => p.cooker === 'smoker')
      .map(p => ({ id: it.input.id, start: p.start, end: p.end, tempF: p.tempF })),
  );
  const cuts = [...new Set(spans.flatMap(s => [s.start, s.end]))].sort((a, b) => a - b);
  const out: SmokerConflict[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i],
      b = cuts[i + 1];
    const foods: SmokerConflict['foods'] = [];
    for (const s of spans)
      if (s.start <= a && s.end >= b && !foods.some(f => f.itemId === s.id))
        foods.push({ itemId: s.id, tempF: s.tempF });
    const temps = foods.map(f => f.tempF);
    if (foods.length < 2 || Math.max(...temps) - Math.min(...temps) <= CONFLICT_TOLERANCE_F) continue;
    const prev = out[out.length - 1];
    const ids = (c: SmokerConflict['foods']) => c.map(f => f.itemId).join();
    if (prev && prev.end === a && ids(prev.foods) === ids(foods)) prev.end = b;
    else out.push({ start: a, end: b, foods });
  }
  return out;
}

/**
 * Keep serve only works while the hold absorbs the change: every food still gets its minimum rest
 * (or its planned rest, if that was set lower) between coming off heat and serve.
 */
export function holdsCover(plan: Plan): boolean {
  return plan.items.every(it => {
    const hold = (plan.serveAt - it.sliceMin * MIN - it.finish) / MIN;
    return hold >= Math.min(it.restFloorMin, it.restMin);
  });
}
