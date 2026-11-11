// Gear defaults. Smoker specs come only from verified entries in data/cookers.json;
// unverified entries stay blank until the user fills them in (Setup / Gear screens, "Enter it yourself").

import type { GriddleProfile, OvenProfile, SmokerProfile } from '../../engine/types.ts';
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

export type SmokerType = SmokerProfile['type'];
export interface SmokerTypeInfo { chip: string; group: string; title: string; note: string }
export interface CatalogSmoker { id: string; brand: string; model: string; type: SmokerType; verified: boolean }

/** Picker groups and chips, in display order (data/cookers.json smokerTypes). */
export const smokerTypes: [SmokerType, SmokerTypeInfo][] = Object.entries(catalog.smokerTypes) as any;
export const smokerTypeInfo = (t: SmokerType): SmokerTypeInfo => catalog.smokerTypes[t] ?? catalog.smokerTypes.other;
export const catalogSmokers: CatalogSmoker[] = catalog.smokers;
export const catalogName = (e: CatalogSmoker) => `${e.brand} ${e.model}`.trim();
export const hasHopper = (t: SmokerType) => t === 'pellet' || t === 'gravity';

/** What the user typed in "Enter it yourself" (or to finish an unverified model). Stored units: F, lb. */
export interface ManualSmoker {
  id?: string; name: string; type: SmokerType; minTempF: number; maxTempF: number;
  tempStepF: number | null; tempPresetsF?: number[]; hopperLb: number | null; mainGrateSqIn: number | null;
}
export function manualSmoker(m: ManualSmoker): SmokerProfile {
  return {
    id: m.id ?? 'custom', name: m.name, type: m.type, tempStepF: m.tempStepF, tempPresetsF: m.tempStepF ? undefined : m.tempPresetsF,
    minTempF: m.minTempF, maxTempF: m.maxTempF, hopperLb: hasHopper(m.type) ? m.hopperLb : null,
    mainGrateSqIn: m.mainGrateSqIn, upperRackSqIn: null,
    pelletLbPerHrLow: PELLET_LB_PER_HR_LOW, pelletLbPerHrHigh: PELLET_LB_PER_HR_HIGH, preheatMin: SMOKER_PREHEAT_MIN,
  };
}
