// Timing controls shared by Food details and Cook rates: hr/lb and total-hours steppers,
// stored as hr/lb (at 225F) and hours, shown in the user's weight unit.

import { lbToKg } from '../../engine/units.ts';
import type { Units } from './format.ts';

const RATE_STEP = 0.05;      // in the shown unit (hr/lb or hr/kg)
export const HOURS_STEP = 0.25;
export const HOURS_MIN = 0.25;
export const HOURS_MAX = 36;

const perKg = (u: Units) => u.weight === 'kg' ? 1 / lbToKg(1) : 1;

/** hr/lb -> the number shown in the stepper (hr/lb or hr/kg), on the 0.05 grid. */
export const rateShown = (hrPerLb: number, u: Units) => Math.round(hrPerLb * perKg(u) / RATE_STEP) * RATE_STEP;

/** One stepper tap: move the shown value by one step, clamp to the stored hr/lb limits. */
export function stepRate(hrPerLb: number, dir: 1 | -1, u: Units, [lo, hi]: [number, number]): number {
  // Off-grid values (1.67 published) snap to the next grid point in the tap's direction.
  const x = hrPerLb * perKg(u) / RATE_STEP;
  const shown = (dir > 0 ? Math.floor(x + 1e-6) + 1 : Math.ceil(x - 1e-6) - 1) * RATE_STEP;
  const lb = shown / perKg(u);
  return +Math.min(hi, Math.max(lo, lb)).toFixed(4);
}

export const rateText = (hrPerLb: number, u: Units) => (hrPerLb * perKg(u)).toFixed(2);

/** Outside the usual range: a soft warning, never a block. */
export const rateUnusual = (hrPerLb: number, [lo, hi]: [number, number]) => hrPerLb < lo - 1e-9 || hrPerLb > hi + 1e-9;

export const stepHours = (h: number, dir: 1 | -1) => Math.min(HOURS_MAX, Math.max(HOURS_MIN, Math.round((h + dir * HOURS_STEP) / HOURS_STEP) * HOURS_STEP));
export const roundHours = (min: number) => Math.min(HOURS_MAX, Math.max(HOURS_MIN, Math.round(min / 60 / HOURS_STEP) * HOURS_STEP));
/** "9", "9.25", "1.5" */
export const hoursText = (h: number) => String(+h.toFixed(2));
