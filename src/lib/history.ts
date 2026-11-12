// Cook history: one JSON file in app data (SPEC sections 2 and 9). Exportable, survives app updates.
// Only Save on Cook finished writes here; Discard logs nothing.

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { CookLog } from '../../engine/types.ts';

export interface CookRecord {
  id: string;
  date: number; // serve time, epoch ms
  notes: string;
  pitTempF: number;
  lateMin?: number | null; // served this many minutes after the planned serve; null when ended before serve
  items: { name: string; plannedMin: number; actualMin: number; log: CookLog }[];
}

const FILE = 'history.json';

export async function loadHistory(): Promise<CookRecord[]> {
  try {
    const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    const parsed = JSON.parse(typeof r.data === 'string' ? r.data : await r.data.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // no file yet
  }
}

export async function saveHistory(records: CookRecord[]): Promise<void> {
  await Filesystem.writeFile({
    path: FILE,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    data: JSON.stringify(records, null, 1),
  });
}

/** The logs the engine learns from (rates, size-adjusted unlock). */
export const logsOf = (records: CookRecord[]): CookLog[] =>
  records.flatMap(r => r.items.map(i => i.log)).filter(l => !l.discarded);
