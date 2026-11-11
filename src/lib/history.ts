// Cook history: one JSON file in app data (SPEC sections 2 and 9). Exportable, survives app updates.
// Only Save on Cook finished writes here; Discard logs nothing.

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { CookLog } from '../../engine/types.ts';
import { rateFor } from '../../engine/plan.ts';
import { food, foods, rules } from './rules.ts';

export interface CookRecord {
  id: string;
  date: number;              // serve time, epoch ms
  notes: string;
  pitTempF: number;
  items: { name: string; plannedMin: number; actualMin: number; log: CookLog }[];
}

const FILE = 'history.json';

export async function loadHistory(): Promise<CookRecord[]> {
  try {
    const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    const parsed = JSON.parse(typeof r.data === 'string' ? r.data : await r.data.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];   // no file yet
  }
}

export async function saveHistory(records: CookRecord[]): Promise<void> {
  await Filesystem.writeFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8, data: JSON.stringify(records, null, 1) });
}

/** The logs the engine learns from (rates, size-adjusted unlock). */
export const logsOf = (records: CookRecord[]): CookLog[] => records.flatMap(r => r.items.map(i => i.log)).filter(l => !l.discarded);

export interface RateRow { foodId: string; methodId: string; smokerId: string; foodName: string; hrPerLb: number; cooks: number; untilSize: number }

/** Learned rate per food per cooker (Cook history, mockup 20), most cooks first. */
export function rateRows(logs: CookLog[], overrides: Record<string, number>): RateRow[] {
  const groups = new Map<string, CookLog[]>();
  for (const l of logs) {
    const m = foods.find(f => f.id === l.foodId)?.methods.find(x => x.id === l.methodId);
    if (m?.timing.kind !== 'perWeight') continue;
    const k = `${l.foodId}|${l.methodId}|${l.smokerId}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const unlock = rules.learning.unlockAfterCooks;
  return [...groups.values()].map(g => {
    const { foodId, methodId, smokerId } = g[0];
    const r = rateFor(rules, { id: 'rate', foodId, methodId, quantity: g[0].quantity }, smokerId, overrides, logs, 'perPound');
    const sameFood = logs.filter(l => l.foodId === foodId && l.smokerId === smokerId).length;
    return { foodId, methodId, smokerId, foodName: food(foodId).name, hrPerLb: r.rate, cooks: r.cooksLogged, untilSize: Math.max(0, unlock - sameFood) };
  }).sort((a, b) => b.cooks - a.cooks);
}
