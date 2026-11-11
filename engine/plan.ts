// Pit Planner scheduling engine: backward scheduling from serve time, clear-pit rule,
// smoker temperature conflicts, pellet estimate, grate load, and the event list that
// drives the timeline and alarms. Pure functions: no clock, no storage, no UI.

import type { CookLog, ItemInput, Phase, Plan, PlanEvent, PlanInput, PlannedItem, Warning, TimingModel } from './types.ts';
import { isSettable } from './temps.ts';

const MIN = 60_000;
const HIGH_HEAT_DELTA_F = 50;     // a smoker phase this far above the pit set point is "high heat"
const CONFLICT_TOLERANCE_F = 25;  // two smoker phases further apart than this cannot share the pit
const PIT_CLIMB_MIN = 15;         // time to raise the pit before a high-heat phase
const OVEN_LEAD_MIN = 15;
const REFILL_AT_FRACTION = 0.1;   // top-off alert when the hopper is estimated under 10%

export type Rules = any; // data/foods.json; typed loosely so the rules file can grow without code changes

export function tempFactor(rules: Rules, tempF: number): number {
  const m = rules.tempModel;
  return Math.pow(m.basePer25F, (tempF - m.referenceF) / 25);
}

function findFood(rules: Rules, foodId: string) {
  const food = rules.foods.find((f: any) => f.id === foodId);
  if (!food) throw new Error(`Unknown food ${foodId}`);
  return food;
}

function resolveMethod(food: any, methodId: string) {
  const method = food.methods.find((m: any) => m.id === methodId);
  if (!method) throw new Error(`Unknown method ${methodId} for ${food.id}`);
  const shared = food.shared ?? {};
  return { ...shared, ...method, options: { ...(shared.options ?? {}), ...(method.options ?? {}) } };
}

function optionValue(method: any, input: ItemInput, key: string): string | undefined {
  const opt = method.options?.[key];
  if (!opt) return undefined;
  return input.options?.[key] ?? opt.default;
}

/** Learned or overridden rate in hr/lb at 225F, normalized to the reference weight for the size-adjusted model. */
export function rateFor(rules: Rules, input: ItemInput, smokerId: string, overrides: Record<string, number> | undefined, history: CookLog[] | undefined, model: TimingModel) {
  const food = findFood(rules, input.foodId);
  const method = resolveMethod(food, input.methodId);
  const prior = overrides?.[input.foodId] ?? method.timing.hrPerLbAt225;
  const source: 'default' | 'override' = overrides?.[input.foodId] != null ? 'override' : 'default';
  const logs = (history ?? []).filter(h => !h.discarded && h.foodId === input.foodId && h.methodId === input.methodId && h.smokerId === smokerId);
  const { priorWeight, sizeExponent } = rules.learning;
  const wRef = food.quantity.referenceWeight ?? food.quantity.default;
  const observed = logs.map(h => {
    const tf = tempFactor(rules, h.pitTempF);
    const wrapF = method.options?.wrap ? method.options.wrap.choices[h.options?.wrap ?? method.options.wrap.default].timeFactor : 1;
    const hours = h.minutesOnHeat / 60 / tf / wrapF;
    return model === 'sizeAdjusted' ? hours / (wRef * Math.pow(h.quantity / wRef, sizeExponent)) : hours / h.quantity;
  });
  const rate = (priorWeight * prior + observed.reduce((a, b) => a + b, 0)) / (priorWeight + observed.length);
  return { rate, source: logs.length ? 'learned' as const : source, cooksLogged: logs.length };
}

function buildItem(rules: Rules, input: ItemInput, plan: PlanInput): Omit<PlannedItem, 'finish'> {
  const food = findFood(rules, input.foodId);
  const method = resolveMethod(food, input.methodId);
  const pit = plan.pitTempF;
  const tf = tempFactor(rules, pit);
  const W = input.quantity;
  const timing = method.timing;
  const wrapChoice = optionValue(method, input, 'wrap');
  const wrapF = wrapChoice ? method.options.wrap.choices[wrapChoice].timeFactor : 1;

  // Pick phases, dropping ones whose skipIf matches (e.g. no-wrap brisket has no wrap check).
  let rawPhases: any[] = method.phases.filter((p: any) => !p.skipIf || Object.entries(p.skipIf).every(([k, v]) => optionValue(method, input, k) !== v));
  if (rawPhases.length < method.phases.length) {
    const kept = rawPhases.reduce((a: number, p: any) => a + (p.fraction ?? 0), 0);
    rawPhases = rawPhases.map((p: any) => p.fraction != null ? { ...p, fraction: p.fraction / kept } : p);
  }

  let totalScaled = 0; // minutes shared out by fraction
  let rateInfo: PlannedItem['rateInfo'];
  const unlocked = (history: CookLog[] | undefined, smokerId: string) => (history ?? []).filter(h => !h.discarded && h.foodId === input.foodId && h.smokerId === smokerId).length >= rules.learning.unlockAfterCooks;
  const smokerId = plan.cookers.smoker?.id ?? 'none';

  if (timing.kind === 'perWeight') {
    const model: TimingModel = input.timingModel === 'sizeAdjusted' && unlocked(plan.history, smokerId) ? 'sizeAdjusted' : 'perPound';
    const r = rateFor(rules, input, smokerId, plan.rateOverrides, plan.history, model);
    const wRef = food.quantity.referenceWeight ?? food.quantity.default;
    const hours = model === 'sizeAdjusted' ? r.rate * wRef * Math.pow(W / wRef, rules.learning.sizeExponent) : r.rate * W;
    totalScaled = hours * 60 * tf * wrapF;
    rateInfo = { hrPerLbAt225: r.rate, source: r.source, cooksLogged: r.cooksLogged, model,
      rangeHours: [W * timing.rangeAt225[0] * tf * wrapF, W * timing.rangeAt225[1] * tf * wrapF] };
  } else if (timing.kind === 'perWeightMinutes') {
    totalScaled = Math.max(timing.minMinutes, timing.minPerLbAt225 * W) * tf;
  }

  const phases: Phase[] = rawPhases.map((p: any) => {
    const cooker = p.cooker ?? method.cooker;
    let minutes: number;
    if (p.fraction != null) minutes = totalScaled * p.fraction;
    else if (timing.kind === 'fixedScaled') minutes = p.fixedMin * tf;
    else if (timing.kind === 'byOption' || timing.kind === 'byOptionScaled') {
      const choice = method.options[timing.option].choices[optionValue(method, input, timing.option)!];
      minutes = choice.minutes[method.cooker] * (timing.kind === 'byOptionScaled' ? tf : 1);
    } else minutes = p.fixedMin * (p.scaleWithPit ? tf : 1);
    return {
      id: p.id, label: p.label, short: p.short, cooker,
      tempF: p.temp === 'pit' ? pit : p.temp,
      minutes, start: 0, end: 0,
      setsPit: !!p.setsPit, anchorToEnd: !!p.anchorToEnd, checkStep: !!p.checkStep,
    };
  });

  const prep = [...(method.prep ?? [])];
  for (const [key, opt] of Object.entries<any>(method.options ?? {})) {
    const choice = opt.choices[optionValue(method, input, key)!];
    if (choice?.prep) prep.push(choice.prep);
  }
  const layout = optionValue(method, input, 'layout');
  const perUnit = layout ? method.options.layout.choices[layout].footprintSqInPerUnit : method.footprintSqInPerUnit;
  let pullLabel = method.pull.label;
  const thickness = optionValue(method, input, 'thickness');
  if (thickness) {
    const t = method.options.thickness.choices[thickness].pullF;
    pullLabel = `Pull chicken breasts at ${t[0]}-${t[1]}F and tent 5-10 min. Confirm 165F in the thickest part.`;
  }

  return {
    input, name: food.name, holdsPoorly: !!food.holdsPoorly, phases,
    restMin: Math.max(method.restMin.min, input.restMin ?? method.restMin.default),
    restFloorMin: method.restMin.min,
    sliceMin: method.sliceMin ?? 0, extraHoldMin: 0,
    holdLimitMin: method.holdLimitMin, pullLabel, pullCheckStep: !!method.pull.checkStep,
    footprintSqIn: (perUnit ?? 0) * W, prep, rateInfo,
  };
}

/** Time on heat for one item: first phase start to off-heat (holds between phases count). */
export function onHeatSpan(item: PlannedItem): { start: number; end: number; minutes: number } {
  const start = Math.min(...item.phases.map(p => p.start));
  const end = Math.max(item.finish, ...item.phases.map(p => p.end));
  return { start, end, minutes: Math.round((end - start) / MIN) };
}

/** Lay phases backward from finish, starts on 5-minute steps. Phases flagged anchorToEnd stay at the end even if others move. */
function layBackward(item: PlannedItem) {
  // Exact boundaries are laid back from finish, then each one snaps earlier onto the 5-minute
  // grid. Snapping each boundary once (not each phase) keeps the drift under 5 min per item:
  // the screen and the alarms show the same round times and the cook is never shorter overall.
  let exact = item.finish, end = item.finish;
  for (let i = item.phases.length - 1; i >= 0; i--) {
    const p = item.phases[i];
    exact -= p.minutes * MIN;
    p.end = end; p.start = floorToStep(exact); end = p.start;
  }
}

const STEP_MS = 5 * MIN;
const SNAP_TOLERANCE_MS = 1000; // absorbs float noise like 297.00000000000006 min
const floorToStep = (t: number) => Math.floor((t + SNAP_TOLERANCE_MS) / STEP_MS) * STEP_MS;

export function buildPlan(rules: Rules, input: PlanInput): Plan {
  const draftServe = input.mode === 'readyBy' ? input.at : 0;
  const items: PlannedItem[] = input.items.map(it => {
    const b = buildItem(rules, it, input) as PlannedItem;
    b.finish = draftServe - (b.sliceMin + b.restMin) * MIN;
    layBackward(b);
    return b;
  });
  applyClearPitRule(items, input);
  let serveAt = draftServe;
  if (input.mode === 'startAt') {
    // Start-at: the earliest action (fire the smoker or first phase) lands on input.at.
    const first = earliestAction(items, input);
    const offset = input.at - first;
    for (const it of items) { it.finish += offset; it.phases.forEach(p => { p.start += offset; p.end += offset; }); }
    serveAt = draftServe + offset;
  }
  return derive(rules, input, items, serveAt);
}

function earliestAction(items: PlannedItem[], input: PlanInput): number {
  let t = Infinity;
  for (const it of items) for (const p of it.phases) {
    const pre = p.cooker === 'smoker' ? input.cookers.smoker?.preheatMin ?? 20 : p.cooker === 'griddle' ? input.cookers.griddle?.preheatMin ?? 15 : 0;
    t = Math.min(t, p.start - pre * MIN);
  }
  return t;
}

const isHigh = (pit: number, p: Phase) => p.cooker === 'smoker' && p.tempF >= pit + HIGH_HEAT_DELTA_F;
const needStart = (p: Phase) => p.setsPit ? p.start : p.start - PIT_CLIMB_MIN * MIN;

/** Low-and-slow smoker items finish before any high-heat phase; the difference goes into their hold. */
export function applyClearPitRule(items: PlannedItem[], input: PlanInput) {
  if (input.clearPitBeforeHighHeat === false) return;
  const highs = items.flatMap(it => it.phases.filter(p => isHigh(input.pitTempF, p)));
  if (!highs.length) return;
  const H = Math.min(...highs.map(needStart));
  for (const it of items) {
    if (it.phases.some(p => isHigh(input.pitTempF, p))) continue;
    const sm = it.phases.filter(p => p.cooker === 'smoker');
    if (!sm.length) continue;
    const lastEnd = Math.max(...sm.map(p => p.end));
    if (lastEnd <= H) continue;
    const delta = Math.ceil((lastEnd - H) / (5 * MIN)) * 5 * MIN;
    it.phases.forEach(p => { if (!p.anchorToEnd) { p.start -= delta; p.end -= delta; } });
    if (!it.phases.some(p => p.anchorToEnd)) it.finish -= delta;
    it.extraHoldMin += delta / MIN;
  }
}

/** Everything that follows from phase times: events, warnings, pellets, grate load. Re-run after any live change. */
export function derive(rules: Rules, input: PlanInput, items: PlannedItem[], serveAt: number): Plan {
  const pit = input.pitTempF;
  const warnings: Warning[] = [];
  const events: PlanEvent[] = [];
  let seq = 0;
  const add = (e: Omit<PlanEvent, 'id' | 'alarm' | 'checkStep' | 'critical'> & Partial<PlanEvent>) =>
    events.push({ id: `e${seq++}`, alarm: false, checkStep: false, critical: false, ...e });

  const [lo, hi] = rules.tempModel.trustedRangeF;
  if (pit < lo || pit > hi) warnings.push({ code: 'TEMP_UNTRUSTED', level: 'warn', message: `Times at ${pit}F are a rough guess. The timing model is built on ${lo}-${hi}F.` });

  const smoker = input.cookers.smoker;
  if (smoker) {
    if (!isSettable(smoker, pit)) warnings.push({ code: 'TEMP_NOT_SETTABLE', level: 'warn', message: `${smoker.name} cannot be set to ${pit}F.` });
  }
  for (const it of items) for (const p of it.phases) {
    if (p.cooker === 'smoker' && !smoker) warnings.push({ code: 'NO_SMOKER', level: 'warn', message: `${it.name} needs a smoker. Add one in Gear.`, itemIds: [it.input.id] });
    if (p.cooker === 'griddle' && !input.cookers.griddle) warnings.push({ code: 'NO_GRIDDLE', level: 'warn', message: `${it.name} needs a griddle. Add one in Gear or move it to the smoker.`, itemIds: [it.input.id] });
  }

  // Smoker temperature conflicts between items
  const sm = items.flatMap(it => it.phases.filter(p => p.cooker === 'smoker').map(p => ({ it, p }))).sort((a, b) => a.p.start - b.p.start);
  const seen = new Set<string>();
  for (let i = 0; i < sm.length; i++) for (let j = i + 1; j < sm.length; j++) {
    const a = sm[i], b = sm[j];
    if (a.it === b.it) continue;
    if (a.p.start < b.p.end && b.p.start < a.p.end && Math.abs(a.p.tempF - b.p.tempF) > CONFLICT_TOLERANCE_F) {
      const key = [a.it.input.id, b.it.input.id].sort().join('|');
      if (seen.has(key)) continue; seen.add(key);
      warnings.push({ code: 'PIT_CONFLICT', level: 'warn', itemIds: [a.it.input.id, b.it.input.id],
        message: `${a.it.name} needs ${a.p.tempF}F while ${b.it.name} needs ${b.p.tempF}F at the same time.` });
    }
  }

  // Holds
  for (const it of items) {
    const hold = (serveAt - (it.sliceMin * MIN) - it.finish) / MIN;
    if (hold > it.holdLimitMin) warnings.push({ code: 'HOLD_TOO_LONG', level: it.holdsPoorly ? 'warn' : 'info', itemIds: [it.input.id],
      message: `${it.name} holds ${Math.round(hold)} min, past its ${it.holdLimitMin} min limit.${it.holdsPoorly ? ' Move it to the griddle or start it later.' : ''}` });
    if (hold < it.restFloorMin - 0.5) warnings.push({ code: 'REST_SHORT', level: 'warn', itemIds: [it.input.id], message: `${it.name} only gets ${Math.max(0, Math.round(hold))} min of rest, under the ${it.restFloorMin} min minimum.` });
    else if (hold < it.restMin - 0.5) warnings.push({ code: 'REST_REDUCED', level: 'info', itemIds: [it.input.id], message: `${it.name} rest drops to ${Math.round(hold)} min. Still OK.` });
  }

  // Grate load (estimate)
  let peak = 0;
  for (const x of sm) {
    const t = x.p.start;
    const active = new Set(sm.filter(y => y.p.start <= t && t < y.p.end).map(y => y.it));
    peak = Math.max(peak, [...active].reduce((a, it) => a + it.footprintSqIn, 0));
  }
  if (smoker?.mainGrateSqIn) {
    const total = smoker.mainGrateSqIn + (smoker.upperRackSqIn ?? 0);
    if (peak > total) warnings.push({ code: 'SPACE_OVER', level: 'warn', message: `About ${Math.round(peak)} sq in of food at once, more than the ${total} sq in available.` });
    else if (peak > smoker.mainGrateSqIn * 0.95) warnings.push({ code: 'SPACE_UPPER', level: 'info', message: `About ${Math.round(peak)} sq in at once. Plan on the upper rack.` });
  }

  // Smoker events and pellets
  let fireAt: number | null = null, pitOffAt: number | null = null, pellets = 0;
  if (sm.length && smoker) {
    const first = sm[0].p;
    fireAt = first.start - smoker.preheatMin * MIN;
    pitOffAt = Math.max(...sm.map(x => x.p.end));
    add({ at: fireAt, kind: 'fire', label: `Fire the smoker to ${first.tempF}F.`, alarm: true, critical: true });
    let cur = first.tempF;
    for (const x of sm) {
      if (x.p.tempF !== cur) {
        if (!x.p.setsPit) add({ at: needStart(x.p), kind: 'setPit', label: `Set the smoker to ${x.p.tempF}F.`, alarm: true, critical: true });
        cur = x.p.tempF;
      }
    }
    if (smoker.hopperLb) {
      let level = smoker.hopperLb;
      for (let t = fireAt; t < pitOffAt; t += 5 * MIN) {
        const act = sm.filter(x => x.p.start <= t && t < x.p.end);
        const temp = act.length ? Math.max(...act.map(x => x.p.tempF)) : pit;
        const use = (temp >= 325 ? smoker.pelletLbPerHrHigh : smoker.pelletLbPerHrLow) * 5 / 60;
        pellets += use; level -= use;
        if (level < smoker.hopperLb * REFILL_AT_FRACTION) {
          add({ at: t - 30 * MIN, kind: 'refill', label: 'Top off the hopper (estimated under 25% left).', alarm: true, critical: true });
          level = smoker.hopperLb;
        }
      }
    }
    add({ at: pitOffAt, kind: 'pitOff', label: 'Smoker done. Run the shutdown cycle.' });
  }

  const gp = items.flatMap(it => it.phases.filter(p => p.cooker === 'griddle'));
  let griddleOnAt: number | null = null;
  if (gp.length) {
    griddleOnAt = Math.min(...gp.map(p => p.start)) - (input.cookers.griddle?.preheatMin ?? 15) * MIN;
    add({ at: griddleOnAt, kind: 'griddleOn', label: 'Fire the griddle. Set a hot zone and a cooler zone.', alarm: true });
  }

  const holders = items.filter(it => it.restMin >= 15 || it.extraHoldMin > 0);
  if (holders.length && input.cookers.oven && input.cookers.oven.holdIn !== 'cooler') {
    const t = Math.min(...holders.map(it => it.finish)) - OVEN_LEAD_MIN * MIN;
    add({ at: t, kind: 'ovenOn', label: `Oven to ${input.cookers.oven.lowestTempF}F for holding.`, alarm: true });
  }

  for (const it of items) {
    const start = Math.min(...it.phases.map(p => p.start));
    for (const pr of it.prep) add({ at: start - pr.leadMin * MIN, kind: 'prep', label: pr.label, itemId: it.input.id });
    it.phases.forEach((p, i) => {
      add({ at: p.start, kind: 'phase', label: p.label, itemId: it.input.id, phaseId: p.id, alarm: true,
        checkStep: p.checkStep, critical: isHigh(pit, p) || i === 0 });
      const next = it.phases[i + 1];
      if (next && next.start > p.end) add({ at: p.end, kind: 'phaseEnd', label: `${it.name} off the smoker. Tent and hold until the next step.`, itemId: it.input.id, phaseId: p.id, alarm: true });
    });
    add({ at: it.finish, kind: 'pull', label: it.pullLabel, itemId: it.input.id, alarm: true, checkStep: it.pullCheckStep, critical: true });
    if (it.sliceMin) add({ at: serveAt - it.sliceMin * MIN, kind: 'slice', label: `Slice or plate the ${it.name.toLowerCase()}.`, itemId: it.input.id, alarm: true });
  }
  add({ at: serveAt, kind: 'serve', label: 'Serve.', alarm: true, critical: true });

  const order: Record<string, number> = { prep: 0, ovenOn: 1, griddleOn: 1, fire: 1, setPit: 2, refill: 2, phase: 3, phaseEnd: 3, pull: 4, slice: 5, pitOff: 6, serve: 7 };
  events.sort((a, b) => (a.at - b.at) || (order[a.kind] - order[b.kind]));

  return { serveAt, pitTempF: pit, items, events, warnings, fireAt, pitOffAt, griddleOnAt, pelletsLb: pellets, peakFootprintSqIn: peak };
}
