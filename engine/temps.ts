// Which smoker set points a cooker can actually be set to. Pure: no UI, no storage.

import type { SmokerProfile } from './types.ts';

/** True when the smoker can be set to tempF (same rule as the TEMP_NOT_SETTABLE warning). */
export function isSettable(smoker: SmokerProfile, tempF: number): boolean {
  if (tempF < smoker.minTempF || tempF > smoker.maxTempF) return false;
  const step = smoker.tempStepF;
  return step ? (tempF - smoker.minTempF) % step === 0 : (smoker.tempPresetsF ?? []).includes(tempF);
}

/**
 * Set points the smoker offers, ascending. Steps count from the cooker's minimum.
 * range limits the list (e.g. the trusted 200-300F band); omit it for the full cooker range.
 */
export function settableTemps(smoker: SmokerProfile, range?: [number, number]): number[] {
  const lo = Math.max(smoker.minTempF, range?.[0] ?? -Infinity);
  const hi = Math.min(smoker.maxTempF, range?.[1] ?? Infinity);
  const step = smoker.tempStepF;
  if (!step) return [...(smoker.tempPresetsF ?? [])].filter(t => t >= lo && t <= hi).sort((a, b) => a - b);
  const out: number[] = [];
  for (let t = smoker.minTempF + Math.ceil((lo - smoker.minTempF) / step) * step; t <= hi; t += step) out.push(t);
  return out;
}
