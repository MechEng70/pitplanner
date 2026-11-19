// Gear defaults. Smoker specs come only from verified entries in data/cookers.json;
// unverified entries stay blank until the user fills them in (Setup / Gear screens, "Enter it yourself").

import type { GriddleProfile, OvenProfile, SmokerProfile } from '../../engine/types.ts';
import { cToF, showStep, showTemp, type TempUnit } from '../../engine/units.ts';
import cookersJson from '../../data/cookers.json';

// Pellet burn estimates from SPEC.md section 12 (open item: learn from logged refills).
const PELLET_LB_PER_HR_LOW = 1.5;
const PELLET_LB_PER_HR_HIGH = 3;
const SMOKER_PREHEAT_MIN = 20;

/** Profile for a verified picker entry, or null when the entry has no checked specs. */
export function smokerFromCatalog(id: string): SmokerProfile | null {
  const e = catalog.smokers.find(s => s.id === id);
  if (!e?.verified) return null;
  return {
    id: e.id,
    name: `${e.brand} ${e.model}`.trim(),
    type: e.type,
    tempStepF: e.tempStepF ?? null,
    tempPresetsF: e.tempPresetsF,
    minTempF: e.minTempF!, // verified entries always have their range
    maxTempF: e.maxTempF!,
    hopperLb: e.hopperLb ?? null,
    mainGrateSqIn: e.mainGrateSqIn ?? null,
    upperRackSqIn: e.upperRackSqIn ?? null,
    pelletLbPerHrLow: PELLET_LB_PER_HR_LOW,
    pelletLbPerHrHigh: PELLET_LB_PER_HR_HIGH,
    preheatMin: SMOKER_PREHEAT_MIN,
  };
}

/** Starting point for the Griddle and Oven screens; the user edits these. */
export const defaultGriddle = (): GriddleProfile => ({
  id: 'griddle',
  name: 'Griddle',
  sizeIn: 36,
  burners: 4,
  hasDome: false,
  preheatMin: 15,
});
export const defaultOven = (): OvenProfile => ({ id: 'oven', lowestTempF: 170, holdIn: 'ask' });

/** Food safety floor for holding: the Oven sheet's stepper stops here and no stored hold is below it (T-077). */
export const OVEN_HOLD_MIN_F = 140;
/** The oven with its hold raised to the floor when it is below it; otherwise the same object. */
export const withSafeHold = (o: OvenProfile): OvenProfile =>
  o.lowestTempF < OVEN_HOLD_MIN_F ? { ...o, lowestTempF: OVEN_HOLD_MIN_F } : o;

export type SmokerType = SmokerProfile['type'];
export interface SmokerTypeInfo {
  chip: string;
  group: string;
  title: string;
  note: string;
}
export interface CatalogSmoker {
  id: string;
  brand: string;
  model: string;
  type: SmokerType;
  verified: boolean;
  minTempF?: number;
  maxTempF?: number;
  tempStepF?: number | null;
  tempPresetsF?: number[];
  hopperLb?: number | null;
  mainGrateSqIn?: number | null;
  upperRackSqIn?: number | null;
  sources?: string[];
}
/** data/cookers.json, the picker list. Only verified entries have specs. */
interface Catalog {
  smokerTypes: Record<SmokerType, SmokerTypeInfo>;
  smokers: CatalogSmoker[];
}
const catalog = cookersJson as unknown as Catalog;

/** Picker groups and chips, in display order (data/cookers.json smokerTypes). */
export const smokerTypes: [SmokerType, SmokerTypeInfo][] = Object.entries(catalog.smokerTypes) as [
  SmokerType,
  SmokerTypeInfo,
][];
export const smokerTypeInfo = (t: SmokerType): SmokerTypeInfo => catalog.smokerTypes[t] ?? catalog.smokerTypes.other;
export const catalogSmokers: CatalogSmoker[] = catalog.smokers;
export const catalogName = (e: CatalogSmoker) => `${e.brand} ${e.model}`.trim();
export const hasHopper = (t: SmokerType) => t === 'pellet' || t === 'gravity';

/**
 * Types that set their temp with a controller (T-082, answer 6A). Kamado, drum and offset are run by hand
 * with vents and fire (cookers.json: "Charcoal, long burns", "Fire checks every 1-2 hr"), so they have no
 * steps and Setup and Gear do not ask for one.
 */
export const hasTempStep = (t: SmokerType) => t !== 'kamado' && t !== 'drum' && t !== 'offset';

/* ---------- Typed temps (the manual form and the temp step sheet) ---------- */

/** A positive number as typed ("19,5" too), or null. */
export const positiveNum = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** A typed temp in the display unit, stored as whole F. */
export const typedTempF = (v: string, unit: TempUnit): number | null => {
  const n = positiveNum(v);
  return n == null ? null : Math.round(unit === 'C' ? cToF(n) : n);
};
/** A typed temp step in the display unit, stored as whole F, at least 1F. A difference: C is * 9/5. */
export const typedStepF = (v: string, unit: TempUnit): number | null => {
  const n = positiveNum(v);
  return n == null ? null : Math.max(1, Math.round(unit === 'C' ? (n * 9) / 5 : n));
};
/** Typed dial settings ("180, 225 250"), stored as whole F, ascending. */
export const typedPresetsF = (v: string, unit: TempUnit): number[] =>
  v
    .split(/[\s,;]+/)
    .map(t => typedTempF(t, unit))
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
/** The step or the dial settings a smoker is saved with: a step, or at least two settings; else null. */
export const typedTemps = (stepF: number | null, presetsF: number[]): SmokerTemps | null =>
  stepF != null ? { tempStepF: stepF } : presetsF.length >= 2 ? { tempStepF: null, tempPresetsF: presetsF } : null;

export interface SmokerTemps {
  tempStepF: number | null;
  tempPresetsF?: number[];
}
/** The smoker with a new step (and no settings) or new dial settings (and no step); the rest unchanged. */
export function withTemps(s: SmokerProfile, t: SmokerTemps): SmokerProfile {
  const out: SmokerProfile = { ...s, tempStepF: t.tempStepF ?? null };
  if (t.tempStepF) delete out.tempPresetsF;
  else out.tempPresetsF = t.tempPresetsF;
  return out;
}

/* ---------- The temp step question (T-082) ---------- */

/** The four choices, in the display unit. Stored as F: 5F, 10F, 15F, 25F, or 9F, 18F, 27F, 45F for 5C-25C. */
export const STEP_CHOICES = [5, 10, 15, 25] as const;
export const stepChoiceF = (n: number, unit: TempUnit) => (unit === 'C' ? (n * 9) / 5 : n);

/** The step the catalog gives this model, or null (a smoker of the user's own, or a model with no checked step). */
const catalogStepF = (s: SmokerProfile) => catalog.smokers.find(e => e.id === s.id && e.verified)?.tempStepF ?? null;

/**
 * Which choice the saved step shows: "5" to "25"; "other" for dial settings and for a step that is none of
 * the four. One case shows "" (none): in Celsius, the catalog's own step when it is none of 5C to 25C (a 5F
 * catalog smoker, answer 3A), which stays as it is. A step the user typed in Celsius is Other with its line,
 * as in Fahrenheit (Jason, 2026-11-17, the branch read).
 */
export function stepChoice(s: SmokerProfile, unit: TempUnit): string {
  const step = s.tempStepF;
  if (!step) return 'other';
  const hit = STEP_CHOICES.find(n => stepChoiceF(n, unit) === step);
  if (hit != null) return String(hit);
  return unit === 'C' && step === catalogStepF(s) ? '' : 'other';
}

/** Dial settings as typed text in the display unit, ascending, whole degrees: "180, 225, 250". */
const presetsText = (s: SmokerProfile, unit: TempUnit) =>
  [...(s.tempPresetsF ?? [])]
    .sort((a, b) => a - b)
    .map(f => showTemp(f, unit).slice(0, -1))
    .join(', ');

/**
 * What the Other sheet's two fields open with (Jason, 2026-11-17, the branch read): the saved step or the
 * saved dial settings, as text in the display unit, when Other is what is saved. Blank when one of the four
 * choices (or none, in Celsius) is saved, as mocked (proposal picture 01b).
 */
export function stepSheetStart(s: SmokerProfile, unit: TempUnit): { step: string; presets: string } {
  if (stepChoice(s, unit) !== 'other') return { step: '', presets: '' };
  if (s.tempStepF) return { step: showStep(s.tempStepF, unit).slice(0, -1), presets: '' };
  return { step: '', presets: presetsText(s, unit) };
}

/**
 * The line under the question when Other is what is saved: "Sets in 20F steps." or "Has fixed settings:
 * 180, 225, 250F." in the display unit; null otherwise. Dial settings are real dial marks, so they read as
 * typed, to the whole degree, not with the 2C set point rounding (Jason, 2026-11-17).
 */
export function stepNote(s: SmokerProfile, unit: TempUnit): string | null {
  if (stepChoice(s, unit) !== 'other') return null;
  if (s.tempStepF) return `Sets in ${showStep(s.tempStepF, unit)} steps.`;
  const presets = presetsText(s, unit);
  return presets ? `Has fixed settings: ${presets}${unit}.` : null;
}

/** What the user typed in "Enter it yourself" (or to finish an unverified model). Stored units: F, lb. */
export interface ManualSmoker {
  id?: string;
  name: string;
  type: SmokerType;
  minTempF: number;
  maxTempF: number;
  tempStepF: number | null;
  tempPresetsF?: number[];
  hopperLb: number | null;
  mainGrateSqIn: number | null;
}
export function manualSmoker(m: ManualSmoker): SmokerProfile {
  return {
    id: m.id ?? 'custom',
    name: m.name,
    type: m.type,
    tempStepF: m.tempStepF,
    tempPresetsF: m.tempStepF ? undefined : m.tempPresetsF,
    minTempF: m.minTempF,
    maxTempF: m.maxTempF,
    hopperLb: hasHopper(m.type) ? m.hopperLb : null,
    mainGrateSqIn: m.mainGrateSqIn,
    upperRackSqIn: null,
    pelletLbPerHrLow: PELLET_LB_PER_HR_LOW,
    pelletLbPerHrHigh: PELLET_LB_PER_HR_HIGH,
    preheatMin: SMOKER_PREHEAT_MIN,
  };
}
