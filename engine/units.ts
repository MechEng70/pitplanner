// Storage is always Fahrenheit and pounds. Convert only at the display edge.

export type TempUnit = 'F' | 'C';
export type WeightUnit = 'lb' | 'kg';

export const fToC = (f: number) => (f - 32) * 5 / 9;
export const cToF = (c: number) => c * 9 / 5 + 32;
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
