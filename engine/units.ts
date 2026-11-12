// Storage is always Fahrenheit and pounds. Convert only at the display edge.

export type TempUnit = 'F' | 'C';
export type WeightUnit = 'lb' | 'kg';

export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const lbToKg = (lb: number) => lb * 0.45359237;
export const kgToLb = (kg: number) => kg / 0.45359237;

/** Display a stored Fahrenheit value. Celsius rounds to whole degrees; set points round to the nearest 5C. */
export function showTemp(f: number, unit: TempUnit, setPoint = false): string {
  if (unit === 'F') return `${Math.round(f)}F`;
  const c = fToC(f);
  return `${setPoint ? Math.round(c / 5) * 5 : Math.round(c)}C`;
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
