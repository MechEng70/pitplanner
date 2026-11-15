// Share plan (T-029, SPEC section 3 "Share"): the .pitplan text goes to a cache file and the Android share
// sheet opens for it. This is the `sharePlanFile` half of `ShareService` (types.ts). `onPlanOpened`, a
// .pitplan opened from another app, comes with T-030, so nothing claiming the whole service is exported yet.
import { shareTextFile } from './shareFile';
import type { ShareService } from './types';

export const sharePlanFile: ShareService['sharePlanFile'] = (name, text) =>
  shareTextFile(name, text, 'application/json', 'Share plan');
