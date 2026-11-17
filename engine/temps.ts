// Which smoker set points a cooker can actually be set to. Pure: no UI, no storage.

import type { SmokerProfile } from './types.ts';
import { isCelsiusStep } from './units.ts';

/**
 * Where a smoker's steps are counted from (T-082, Jason 2026-11-17): the settable temps are the multiples of
 * the step at or above the lowest temp. An F step counts from 0F (25F from 180F gives 200, 225, 250). A
 * Celsius step counts its multiples in C, from 0C = 32F: each C step of a 9F multiple is a whole F, so the
 * grid is 32F plus whole steps (5C from 180F = 82.2C starts at 85C = 185F).
 */
const gridOrigin = (stepF: number) => (isCelsiusStep(stepF) ? 32 : 0);

/** True when the smoker can be set to tempF (same rule as the TEMP_NOT_SETTABLE warning). */
export function isSettable(smoker: SmokerProfile, tempF: number): boolean {
  if (tempF < smoker.minTempF || tempF > smoker.maxTempF) return false;
  const step = smoker.tempStepF;
  return step ? (tempF - gridOrigin(step)) % step === 0 : (smoker.tempPresetsF ?? []).includes(tempF);
}

/**
 * Set points the smoker offers, ascending: the multiples of its step inside its range (see gridOrigin), or its
 * fixed settings. range limits the list (e.g. the trusted 200-300F band); omit it for the full cooker range.
 */
export function settableTemps(smoker: SmokerProfile, range?: [number, number]): number[] {
  const lo = Math.max(smoker.minTempF, range?.[0] ?? -Infinity);
  const hi = Math.min(smoker.maxTempF, range?.[1] ?? Infinity);
  const step = smoker.tempStepF;
  if (!step) return [...(smoker.tempPresetsF ?? [])].filter(t => t >= lo && t <= hi).sort((a, b) => a - b);
  const origin = gridOrigin(step);
  const out: number[] = [];
  for (let t = origin + Math.ceil((lo - origin) / step) * step; t <= hi; t += step) out.push(t);
  return out;
}
