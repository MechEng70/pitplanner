// Export the plan as a .pitplan file (SPEC section 9). No personal data, no history.
// Opening a received file (intent filter + Shared screen) is a later step.

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ItemInput } from '../../engine/types.ts';

export interface PitPlanFile { app: 'pit-planner'; version: 1; serveAt: string; pitTempF: number; items: ItemInput[] }

export function toPitPlan(serveAt: number, pitTempF: number, items: ItemInput[]): PitPlanFile {
  return { app: 'pit-planner', version: 1, serveAt: new Date(serveAt).toISOString(), pitTempF, items };
}

export async function sharePlan(file: PitPlanFile): Promise<void> {
  const name = 'cook.pitplan';
  const body = JSON.stringify(file, null, 2);
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: body, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Pit Planner plan', files: [uri], dialogTitle: 'Share plan' });
}
