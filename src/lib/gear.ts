// Gear defaults. Smoker specs come only from verified entries in data/cookers.json;
// unverified entries stay blank until the user fills them in (Setup / Gear screens).

import type { Cookers, GriddleProfile, OvenProfile, SmokerProfile } from '../../engine/types.ts';
import { catalog } from './rules.ts';

// Pellet burn estimates from SPEC.md section 12 (open item: learn from logged refills).
const PELLET_LB_PER_HR_LOW = 1.5;
const PELLET_LB_PER_HR_HIGH = 3;
const SMOKER_PREHEAT_MIN = 20;

/** Profile for a verified picker entry, or null when the entry has no checked specs. */
export function smokerFromCatalog(id: string): SmokerProfile | null {
  const e = catalog.smokers.find((s: any) => s.id === id);
  if (!e?.verified) return null;
  return {
    id: e.id, name: `${e.brand} ${e.model}`.trim(), type: e.type,
    tempStepF: e.tempStepF ?? null, tempPresetsF: e.tempPresetsF,
    minTempF: e.minTempF, maxTempF: e.maxTempF,
    hopperLb: e.hopperLb ?? null, mainGrateSqIn: e.mainGrateSqIn ?? null, upperRackSqIn: e.upperRackSqIn ?? null,
    pelletLbPerHrLow: PELLET_LB_PER_HR_LOW, pelletLbPerHrHigh: PELLET_LB_PER_HR_HIGH, preheatMin: SMOKER_PREHEAT_MIN,
  };
}

/** Starting point for the Griddle and Oven screens; the user edits these. */
export const defaultGriddle = (): GriddleProfile =>
  ({ id: 'griddle', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: false, preheatMin: 15 });
export const defaultOven = (): OvenProfile => ({ id: 'oven', lowestTempF: 170, holdIn: 'ask' });

/**
 * TEMPORARY until the first-launch Setup screens exist: start with the one verified
 * smoker so the Plan screen has something to plan against. Remove when Setup lands.
 */
export function seedGear(): Cookers {
  const smoker = smokerFromCatalog('pitboss-820');
  return smoker ? { smoker } : {};
}
