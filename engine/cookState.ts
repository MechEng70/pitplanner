// The live-cook states (TECH-DESIGN section 7) as one pure function: which state a cook is in, what the
// user may do there and what the alarms do. No clock and no storage: the caller passes the few facts of the
// running cook and the time. The Cook UI is built on this (T-021 to T-023); the operations themselves are in
// live.ts and src/lib/cook.ts.

const MIN = 60_000;

/** An overdue step rings again this often until it is done. */
export const NAG_EVERY_MIN = 10;
/** Done earlier or later than planned by at least this much asks keep serve or move serve. */
export const ASK_SERVE_MIN = 5;
/** With the pit out, one reminder asks whether it is back up, this long after the last change. */
export const PIT_CHECK_MIN = 15;

/** The facts of the running cook that decide its state. `null` for the whole snapshot: no cook. */
export interface CookFacts {
  /** When the pit went out, or null while it is up. */
  pitDownAt: number | null;
  /** End of the quiet window, or null. A window that has ended counts as none. */
  quietUntil: number | null;
  /** When the first step not done yet is due (its reminder included), or null when every step is done. */
  nextDueAt: number | null;
  /** End cook was tapped, or the last step (Serve) was done: the summary is showing. */
  finishing: boolean;
}

export type CookPhase = 'planning' | 'cooking' | 'pitDown' | 'finishing';

export type CookAction =
  | 'editPlan'
  | 'startCook'
  | 'done'
  | 'plus15'
  | 'notYet'
  | 'runningBehind'
  | 'runningAhead'
  | 'quiet'
  | 'pitWentOut'
  | 'startOver'
  | 'endCook'
  | 'backUpToTemp'
  | 'save'
  | 'discard';

/**
 * What the alarm set is in this state:
 * - `none`: nothing scheduled.
 * - `full`: every step still to come, from `plan.events`.
 * - `pitCheck`: step alerts wait; one reminder asks whether the pit is back up.
 * - `cancelAll`: the cook is over; everything is cancelled.
 */
export type AlarmSet = 'none' | 'full' | 'pitCheck' | 'cancelAll';

export interface CookState {
  phase: CookPhase;
  /** Inside a quiet window: steps and nags are held to its end, then one summary. */
  quiet: boolean;
  /** The next step is past due. Not while the pit is out: the clock is stopped. */
  overdue: boolean;
  actions: readonly CookAction[];
  alarms: AlarmSet;
  /** Alerts and repeats are held until this time (the end of the quiet window), or null. */
  heldUntil: number | null;
  /** The overdue step rings again every this many minutes, or null when nothing is overdue. */
  nagEveryMin: number | null;
}

const PLANNING: readonly CookAction[] = ['editPlan', 'startCook'];
const COOKING: readonly CookAction[] = [
  'done',
  'plus15',
  'notYet',
  'runningBehind',
  'runningAhead',
  'quiet',
  'pitWentOut',
  'startOver',
  'endCook',
];
const PIT_DOWN: readonly CookAction[] = ['backUpToTemp', 'endCook'];
const FINISHING: readonly CookAction[] = ['save', 'discard'];

export function cookState(cook: CookFacts | null, now: number): CookState {
  if (!cook)
    return {
      phase: 'planning',
      quiet: false,
      overdue: false,
      actions: PLANNING,
      alarms: 'none',
      heldUntil: null,
      nagEveryMin: null,
    };
  if (cook.finishing)
    return {
      phase: 'finishing',
      quiet: false,
      overdue: false,
      actions: FINISHING,
      alarms: 'cancelAll',
      heldUntil: null,
      nagEveryMin: null,
    };
  const quiet = cook.quietUntil != null && cook.quietUntil > now;
  const heldUntil = quiet ? cook.quietUntil : null;
  if (cook.pitDownAt != null)
    return {
      phase: 'pitDown',
      quiet,
      overdue: false,
      actions: PIT_DOWN,
      alarms: 'pitCheck',
      heldUntil,
      nagEveryMin: null,
    };
  const overdue = cook.nextDueAt != null && cook.nextDueAt < now;
  return {
    phase: 'cooking',
    quiet,
    overdue,
    actions: COOKING,
    alarms: 'full',
    heldUntil,
    nagEveryMin: overdue ? NAG_EVERY_MIN : null,
  };
}

/** Whether `action` is allowed in this state. */
export const can = (state: CookState, action: CookAction): boolean => state.actions.includes(action);

/**
 * Done on a step due at `dueAt`, tapped at `doneAt`: minutes late (+) or early (-), and whether that is far
 * enough off to ask keep serve or move serve.
 */
export function doneOffBy(dueAt: number, doneAt: number): { deltaMin: number; asksServe: boolean } {
  const deltaMin = Math.round((doneAt - dueAt) / MIN);
  return { deltaMin, asksServe: Math.abs(deltaMin) >= ASK_SERVE_MIN };
}
