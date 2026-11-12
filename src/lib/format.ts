// Display formatting. The engine works in epoch ms, F and lb; this is the only place
// those become wall-clock strings, and units.ts is the only place they change units.

import { showTemp, showWeight, lbToKg, localizeText, type TempUnit, type WeightUnit } from '../../engine/units.ts';

export type Units = { temp: TempUnit; weight: WeightUnit };

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** "6:40 AM" */
export const fmtTime = (ms: number) => timeFmt.format(ms).replace(/\u202f/g, ' ');

/** "Sat, Nov 14 at 5:00 PM" */
export const fmtDayTime = (ms: number) => `${dayFmt.format(ms)} at ${fmtTime(ms)}`;

/** "12 min", "9 hr", "1 hr 40 min" */
export function fmtDuration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

export const fmtTemp = (f: number, u: Units, setPoint = false) => showTemp(f, u.temp, setPoint);
export const fmtWeight = (lb: number, u: Units) => showWeight(lb, u.weight);

/** Pellets read as an estimate: "~18 lb" or "~8 kg". */
export const fmtPellets = (lb: number, u: Units) =>
  u.weight === 'lb' ? `~${Math.round(lb)} lb` : `~${Math.round(lbToKg(lb))} kg`;

/** Value for <input type="datetime-local"> in the phone's time zone. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Parse a datetime-local value as phone-local wall time to epoch ms. */
export function fromLocalInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
}

/** "163-165F" or "73-74C" */
export function fmtTempRange([a, b]: [number, number], u: Units): string {
  const unit = u.temp;
  const [x, y] = [a, b].map(f => showTemp(f, unit).slice(0, -1));
  return `${x}-${y}${unit}`;
}

/** Cook rate in the user's weight unit: "0.75 hr/lb" or "1.65 hr/kg". */
export const fmtRate = (hrPerLb: number, u: Units) =>
  u.weight === 'lb' ? `${hrPerLb.toFixed(2)} hr/lb` : `${(hrPerLb / lbToKg(1)).toFixed(2)} hr/kg`;

/** Rules and engine wording in the user's units ("pull at 93-96C"). */
export const tx = (s: string, u: Units) => localizeText(s, u.temp, u.weight);
