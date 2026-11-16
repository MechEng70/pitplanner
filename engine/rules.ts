// Shape of data/foods.json (the cooking rules). Types only: the engine reads the file as data, so adding a
// food or a method needs no code change. New optional fields can be added here as the rules file grows.
// Temperatures in F, quantities in lb or count, times in minutes unless the name says hours.

import type { CookerKind, Cookers } from './types.ts';

export interface PrepRule {
  leadMin: number; // minutes before the item's first phase
  label: string;
}

export interface RuleChoice {
  label: string;
  short?: string;
  note?: string;
  timeFactor?: number; // wrap: multiplies time on heat
  footprintSqInPerUnit?: number; // layout: grate area per unit
  minutes?: Partial<Record<CookerKind, number>>; // byOption timing: minutes per cooker
  pullF?: [number, number]; // thickness: pull range
  prep?: PrepRule; // extra prep step when chosen (brine, dry brine)
}

export interface RuleOption {
  label: string;
  default: string;
  choices: Record<string, RuleChoice>;
}

export type TimingKind = 'perWeight' | 'perWeightMinutes' | 'fixedScaled' | 'byOption' | 'byOptionScaled' | 'phases';

export interface RuleTiming {
  kind: TimingKind;
  hrPerLbAt225?: number; // perWeight
  rangeAt225?: [number, number]; // perWeight: published range, hr/lb
  /** perWeight: rates measured at other smoker temps, hr/lb. The food's own curve runs through them (tempFactorFor). */
  tempPoints?: { tempF: number; hrPerLb: number }[];
  minHours?: number; // perWeight floor
  minPerLbAt225?: number; // perWeightMinutes
  minMinutes?: number; // perWeightMinutes floor
  option?: string; // byOption*: the option whose choice holds the minutes
}

export interface RulePhase {
  id: string;
  label: string;
  short: string;
  temp: number | 'pit';
  /** Used instead of `temp` when the smoker tops out below it (tri-tip sears at 450F on one that cannot reach 500F). */
  fallbackTemp?: number;
  fraction?: number; // share of the scaled total
  fixedMin?: number;
  cooker?: CookerKind; // defaults to the method's cooker
  checkStep?: boolean;
  skipIf?: Record<string, string>; // option key -> choice that drops this phase
  anchorToEnd?: boolean;
  scaleWithPit?: boolean;
  setsPit?: boolean;
}

export interface RulePull {
  label: string;
  tempF?: [number, number];
  checkStep?: boolean;
}

/** Fields a method can take from its food's `shared` block. */
export interface MethodShared {
  options?: Record<string, RuleOption>;
  restMin?: { default: number; min: number };
  sliceMin?: number;
  pull?: RulePull;
  holdLimitMin?: number;
  /** Added to the note for a hold past holdLimitMin ("Keep it above 140F."). */
  holdNote?: string;
  /** holdNote as it reads inside a food's brackets when several foods hold long ("keep above 140F"). */
  holdNoteInline?: string;
  prep?: PrepRule[];
  footprintSqInPerUnit?: number;
  timing?: RuleTiming;
  phases?: RulePhase[];
}

export interface RuleMethod extends MethodShared {
  id: string;
  label: string;
  cooker: CookerKind;
  short?: string;
  note?: string;
  /**
   * Open shared plan: what a shared food moved onto this method will do, after "will", when its own cooker
   * stays and only a step moves ("be seared on the smoker"). Without it the box says "move to the smoker".
   */
  importMove?: string;
  minPitTempF?: number; // lowest smoker set point for this method; below it the plan reports an issue
  /** By-weight foods: above this weight the plan adds an info line (never a block), `text` after the weight. */
  sizeNote?: { aboveLb: number; text: string };
}

/**
 * What a source backs: the food-safety numbers (done temp, smoker temp floor, rate, size), the rest time, the
 * time a smoker takes to climb to a high temp (preheat) and a step at a fixed high temp, its temp and minutes
 * (highHeat).
 */
export type SourceTopic = 'doneTemp' | 'minPitTemp' | 'rate' | 'rest' | 'size' | 'preheat' | 'highHeat';

/**
 * Where a food's numbers come from. `cite` names the source and who read it when; `says` is what it gives.
 * `methods`: the methods it backs (T-075); without it, every method of the food.
 */
export interface RuleSource {
  cite: string;
  covers: SourceTopic[];
  says: string;
  methods?: string[];
}

/** A method after merging the food's shared fields (resolveMethod). Required fields must be present by then. */
export interface ResolvedMethod extends RuleMethod {
  options: Record<string, RuleOption>;
  restMin: { default: number; min: number };
  pull: RulePull;
  holdLimitMin: number;
  timing: RuleTiming;
  phases: RulePhase[];
}

export interface RuleFood {
  id: string;
  name: string;
  group: string;
  blurb?: string;
  holdsPoorly?: boolean;
  sources?: RuleSource[]; // required for a food with a smoker temp floor (rules.test.ts)
  rateHint?: [number, number]; // this food's own usual range, hr/lb at 225F; default learning.rateHint
  quantity: {
    kind: 'weight' | 'count';
    unit: string;
    label?: string;
    default: number;
    min: number;
    max: number;
    step: number;
    referenceWeight?: number; // size-adjusted anchor (12 lb brisket, 8 lb butt)
  };
  shared?: MethodShared;
  methods: RuleMethod[];
}

export interface Rules {
  version: number;
  tempModel: { referenceF: number; basePer25F: number; trustedRangeF: [number, number] };
  learning: {
    priorWeight: number;
    savedRateLearnsAfter: number;
    rateHint: [number, number];
    rateLimits: [number, number];
    sizeExponent: number;
  };
  foods: RuleFood[];
}

/** Merge a food's shared fields under the method's own (method wins; options merge key by key). */
export function resolveMethod(food: RuleFood, method: RuleMethod): ResolvedMethod {
  const shared = food.shared ?? {};
  return {
    ...shared,
    ...method,
    options: { ...(shared.options ?? {}), ...(method.options ?? {}) },
  } as ResolvedMethod;
}

/** Every cooker a method's steps use, the method's own cooker first (tri-tip's griddle sear: smoker, griddle). */
export function methodCookers(food: RuleFood, method: RuleMethod): CookerKind[] {
  const m = resolveMethod(food, method);
  return [...new Set([m.cooker, ...m.phases.map(p => p.cooker ?? m.cooker)])];
}

/** The cookers a method needs that are not set up, the method's own cooker first. */
export function missingCookers(food: RuleFood, method: RuleMethod, cookers: Cookers): CookerKind[] {
  return methodCookers(food, method).filter(k => !cookers[k]);
}

/** The first of a food's methods the cookers can do every step of (T-075), if any. */
export function firstDoableMethod<M extends RuleMethod>(
  food: Omit<RuleFood, 'methods'> & { methods: M[] },
  cookers: Cookers,
): M | undefined {
  return food.methods.find(m => missingCookers(food, m, cookers).length === 0);
}
