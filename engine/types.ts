// Pit Planner engine types. All times are epoch milliseconds (absolute instants),
// so daylight saving changes during an overnight cook cannot shift alerts.
// All temperatures are stored in Fahrenheit; convert only for display (see units.ts).

export type CookerKind = 'smoker' | 'griddle' | 'oven';

export interface SmokerProfile {
  id: string;
  name: string;
  type: 'pellet' | 'kamado' | 'drum' | 'gravity' | 'offset' | 'electric' | 'other';
  tempStepF: number | null; // 5 for Jason's Pit Boss 820; null when the cooker uses a fixed list
  tempPresetsF?: number[]; // used when tempStepF is null
  minTempF: number;
  maxTempF: number;
  hopperLb: number | null; // pellet and gravity only
  mainGrateSqIn: number | null;
  upperRackSqIn: number | null;
  pelletLbPerHrLow: number; // estimate, user editable, learned later
  pelletLbPerHrHigh: number; // at 325F and up
  preheatMin: number;
}

export interface GriddleProfile {
  id: string;
  name: string;
  sizeIn: number;
  burners: number;
  hasDome: boolean;
  preheatMin: number;
}
export interface OvenProfile {
  id: string;
  lowestTempF: number;
  holdIn: 'oven' | 'cooler' | 'ask';
  warmingDrawer?: boolean;
}

export interface Cookers {
  smoker?: SmokerProfile;
  griddle?: GriddleProfile;
  oven?: OvenProfile;
}

export type TimingModel = 'perPound' | 'sizeAdjusted' | 'totalHours';

export interface ItemInput {
  id: string;
  foodId: string;
  methodId: string;
  quantity: number; // lb or count, per the food's quantity.kind
  options?: Record<string, string>;
  restMin?: number;
  timingModel?: TimingModel; // default perPound (weight-based foods) or the rules timing
  hrPerLb?: number; // this cook's hr/lb at 225F; beats the saved and learned rate
  totalHours?: number; // timingModel totalHours: time on heat used as-is (no temp or wrap scaling)
  totalHoursAtF?: number; // pit temp when totalHours was set, to flag a later temp change
}

/** item: this cook only. override: saved, used as-is. blended: saved rate adjusted by logged cooks. learned: published default adjusted by logged cooks. */
export type RateSource = 'default' | 'override' | 'blended' | 'learned' | 'item';

export interface CookLog {
  foodId: string;
  methodId: string;
  smokerId: string;
  quantity: number;
  pitTempF: number;
  minutesOnHeat: number; // actual, from first phase start to pull
  options?: Record<string, string>;
  discarded?: boolean;
}

export interface PlanInput {
  mode: 'readyBy' | 'startAt';
  at: number; // serve time (readyBy) or first-step time (startAt)
  pitTempF: number;
  cookers: Cookers;
  items: ItemInput[];
  clearPitBeforeHighHeat?: boolean; // default true
  rateOverrides?: Record<string, number>; // foodId -> hr/lb at 225F set by the user
  rateLocks?: Record<string, boolean>; // foodId -> true: the saved rate never blends with logged cooks
  history?: CookLog[];
}

export interface Phase {
  id: string;
  label: string;
  short: string;
  cooker: CookerKind;
  tempF: number;
  minutes: number;
  start: number;
  end: number;
  setsPit?: boolean;
  anchorToEnd?: boolean;
  checkStep?: boolean;
}

export interface PlannedItem {
  input: ItemInput;
  name: string;
  holdsPoorly: boolean;
  phases: Phase[];
  restMin: number;
  restFloorMin: number; // shortest acceptable rest for this food
  sliceMin: number;
  extraHoldMin: number; // added by the clear-pit rule or live adjustments
  finish: number; // off heat
  holdLimitMin: number;
  pullLabel: string;
  pullCheckStep: boolean;
  footprintSqIn: number;
  prep: { leadMin: number; label: string }[];
  rateInfo?: {
    hrPerLbAt225: number;
    source: RateSource;
    cooksLogged: number;
    model: TimingModel;
    rangeHours?: [number, number];
  };
}

export type EventKind =
  | 'prep'
  | 'fire'
  | 'setPit'
  | 'phase'
  | 'phaseEnd'
  | 'pull'
  | 'slice'
  | 'pitOff'
  | 'griddleOn'
  | 'ovenOn'
  | 'refill'
  | 'serve';

export interface PlanEvent {
  id: string;
  at: number;
  kind: EventKind;
  label: string;
  itemId?: string;
  phaseId?: string;
  alarm: boolean; // gets a setAlarmClock alert
  checkStep: boolean; // temp or tenderness check, not a fixed appointment
  critical: boolean;
}

export interface Warning {
  code: string;
  level: 'info' | 'warn';
  message: string;
  itemIds?: string[];
}

export interface Plan {
  serveAt: number;
  pitTempF: number;
  items: PlannedItem[];
  events: PlanEvent[];
  warnings: Warning[];
  fireAt: number | null;
  pitOffAt: number | null;
  griddleOnAt: number | null;
  pelletsLb: number;
  peakFootprintSqIn: number;
}
