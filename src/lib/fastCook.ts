// Fast test cook (T-067, dev builds only): a real plan squeezed so the whole cook runs 60 times faster. An
// hour becomes a minute and a minute a second, so an 11 hr 25 min cook takes 11 min 25 s. The squeezed cook is
// an ordinary ActiveCook: the store saves it and sets its alarms like any other, and the Cook tab shows the
// real (squeezed) clock times. Nothing here changes how a real cook is timed.
//
// Pure: no clock, no rules. The caller passes the plan and the instant its first step should land on.
//
// Every instant moves toward `startAt` by the factor. The lengths the engine reads again when a live change
// re-derives the plan (rest, slice, hold, prep lead, cooker preheat) shrink by the same factor, so a Done on a
// pull leaves the other steps where they are. Three kinds of step hang on engine constants in real minutes
// (Oven for holding: 15 min before the first food comes off, and only for a rest of 15 min or more; Set the
// smoker: 15 min before a hotter phase; the hopper top-off: 30 min). In the squeezed plan they sit at their
// squeezed times; a re-derive (a Done on a pull, or any change to the cook) moves them to the real-minute
// lead or drops them. By then they have rung, so a fast cook followed step by step is not affected.

import type { Plan, PlanInput } from '../../engine/types.ts';

/** Minutes become seconds. */
export const FAST_FACTOR = 60;

export interface Squeezed {
  input: PlanInput;
  plan: Plan;
}

/**
 * The cook squeezed by `factor`, its first step (the earliest plan event) at `startAt`. Neither argument is
 * changed. Pass a `startAt` on a whole second: steps 5 minutes apart then land 5 seconds apart, to the second.
 */
export function squeezeCook(input: PlanInput, plan: Plan, startAt: number, factor = FAST_FACTOR): Squeezed {
  const from = Math.min(plan.serveAt, ...plan.events.map(e => e.at));
  const at = (t: number) => Math.round(startAt + (t - from) / factor);
  const atOrNull = (t: number | null) => (t == null ? null : at(t));
  const len = (minutes: number) => minutes / factor;
  const { smoker, griddle } = input.cookers;
  return {
    input: {
      ...input,
      at: at(input.at),
      cookers: {
        ...input.cookers,
        ...(smoker ? { smoker: { ...smoker, preheatMin: len(smoker.preheatMin) } } : {}),
        ...(griddle ? { griddle: { ...griddle, preheatMin: len(griddle.preheatMin) } } : {}),
      },
    },
    plan: {
      ...plan,
      serveAt: at(plan.serveAt),
      fireAt: atOrNull(plan.fireAt),
      pitOffAt: atOrNull(plan.pitOffAt),
      griddleOnAt: atOrNull(plan.griddleOnAt),
      events: plan.events.map(e => ({ ...e, at: at(e.at) })),
      warnings: plan.warnings.map(w => ({ ...w })),
      items: plan.items.map(it => ({
        ...it,
        phases: it.phases.map(p => ({ ...p, start: at(p.start), end: at(p.end), minutes: len(p.minutes) })),
        finish: at(it.finish),
        restMin: len(it.restMin),
        restFloorMin: len(it.restFloorMin),
        sliceMin: len(it.sliceMin),
        extraHoldMin: len(it.extraHoldMin),
        holdLimitMin: len(it.holdLimitMin),
        prep: it.prep.map(pr => ({ ...pr, leadMin: len(pr.leadMin) })),
      })),
    },
  };
}
