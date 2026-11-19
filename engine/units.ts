// Storage is always Fahrenheit and pounds. Convert only at the display edge.

export type TempUnit = 'F' | 'C';
export type WeightUnit = 'lb' | 'kg';

export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const lbToKg = (lb: number) => lb * 0.45359237;
export const kgToLb = (kg: number) => kg / 0.45359237;

/**
 * Display a stored Fahrenheit value. Celsius rounds to whole degrees; set points show in 2C increments
 * (Jason, 2026-11-14), so a smoker's 5F steps (2.8C apart) each read differently. Fahrenheit set points are
 * the cooker's own steps (5F on Jason's smoker) and show as stored.
 */
const SET_POINT_STEP_C = 2;

export function showTemp(f: number, unit: TempUnit, setPoint = false): string {
  if (unit === 'F') return `${Math.round(f)}F`;
  const c = fToC(f);
  return `${setPoint ? Math.round(c / SET_POINT_STEP_C) * SET_POINT_STEP_C : Math.round(c)}C`;
}

/** The stored F of the four Celsius choices, 5C, 10C, 15C and 25C (T-082). */
export const CELSIUS_STEPS_F = [9, 18, 27, 45];

/**
 * A Celsius step (T-082, Jason 2026-11-17): the display unit decides, as steps are stored in F only. In
 * Celsius display a stored 9F, 18F, 27F or 45F step is 5C, 10C, 15C or 25C: its grid counts in C
 * (engine/temps.ts) and its set points read as exact C. In Fahrenheit display every step is an F step, and in
 * Celsius display any other step stays an F step. So switching units changes the meaning of those four steps
 * (a stored step unit is planned for 0.3.x).
 */
export const isCelsiusStep = (stepF: number | null | undefined, unit: TempUnit): boolean =>
  unit === 'C' && stepF != null && CELSIUS_STEPS_F.includes(stepF);

/** A step in the display unit: "5F", "5C" for 9F. A step is a difference, so C is step * 5/9 with no offset. */
export function showStep(stepF: number, unit: TempUnit): string {
  return unit === 'F' ? `${stepF}F` : `${+((stepF * 5) / 9).toFixed(1)}C`;
}

/**
 * A smoker set point in the display unit, given the smoker's step (null: it has fixed settings). With a Celsius
 * step it reads as the grid's exact C (85C, 90C, 95C), whole degrees off the grid. A dial smoker's settings are
 * real marks, so they read to the whole degree too (105C, not 106C; Jason, 2026-11-17). Any other smoker keeps
 * showTemp's 2C set point rounding.
 */
export function showSetPoint(f: number, unit: TempUnit, stepF: number | null | undefined): string {
  return !stepF || isCelsiusStep(stepF, unit) ? showTemp(f, unit) : showTemp(f, unit, true);
}

export function showWeight(lb: number, unit: WeightUnit): string {
  return unit === 'lb' ? `${+lb.toFixed(2)} lb` : `${+lbToKg(lb).toFixed(2)} kg`;
}

const TEMP_IN_TEXT = /(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?F\b/g;
const LB_IN_TEXT = /(\d+(?:\.\d+)?) lb\b/g;
/** Single temps at or above this are cooker set points (smoker, oven) in the rules and engine wording. */
const SET_POINT_MIN_F = 170;

/**
 * Convert the F temperatures and lb weights written into rules and engine text ("pull at 200-205F",
 * "Fire the smoker to 225F", "about 26 lb of pellets") to the user's units. Ranges and readings round to
 * whole degrees; a single temp of 170F or more is a set point and rounds like showTemp(setPoint).
 */
export function localizeText(text: string, temp: TempUnit, weight: WeightUnit): string {
  let s = text;
  if (temp === 'C')
    s = s.replace(TEMP_IN_TEXT, (_m, a: string, b?: string) =>
      b ? `${Math.round(fToC(+a))}-${Math.round(fToC(+b))}C` : showTemp(+a, 'C', +a >= SET_POINT_MIN_F),
    );
  if (weight === 'kg') s = s.replace(LB_IN_TEXT, (_m, a: string) => `${+lbToKg(+a).toFixed(1)} kg`);
  return s;
}

/** "12 min", "9 hr", "1 hr 40 min": how every screen and engine sentence writes a length of time. */
export function durationText(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}
