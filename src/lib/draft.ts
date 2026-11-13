// The plan being edited on the Plan tab (saved on every change). Pure: type and validation only.

import type { ItemInput } from '../../engine/types.ts';

export interface Draft {
  mode: 'readyBy' | 'startAt';
  at: number; // serve time (readyBy) or first-step time (startAt), epoch ms
  pitTempF: number;
  items: ItemInput[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const optNum = (v: unknown) => v === undefined || isNum(v);

function isItem(v: unknown): v is ItemInput {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.foodId) &&
    isStr(v.methodId) &&
    isNum(v.quantity) &&
    (v.options === undefined || (isObj(v.options) && Object.values(v.options).every(isStr))) &&
    optNum(v.restMin) &&
    (v.timingModel === undefined || ['perPound', 'sizeAdjusted', 'totalHours'].includes(v.timingModel as string)) &&
    optNum(v.hrPerLb) &&
    optNum(v.totalHours) &&
    optNum(v.totalHoursAtF)
  );
}

/** A stored draft, or null when any part of it is not what the planner expects. */
export function parseDraft(raw: unknown): Draft | null {
  if (!isObj(raw)) return null;
  if (raw.mode !== 'readyBy' && raw.mode !== 'startAt') return null;
  if (!isNum(raw.at) || !isNum(raw.pitTempF) || !Array.isArray(raw.items) || !raw.items.every(isItem)) return null;
  return { mode: raw.mode, at: raw.at, pitTempF: raw.pitTempF, items: raw.items };
}
