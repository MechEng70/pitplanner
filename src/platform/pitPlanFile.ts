// The .pitplan share file (SPEC section 9), as 0.2.0 wrote it (legacy/src/lib/share.ts). Pure: no expo
// imports, no clock, no storage. Reading one back is `parsePitPlan` in src/lib/sharedPlan.ts.
import type { ItemInput } from '../../engine/types.ts';

/** The shared file's name, as in 0.2.0. */
export const PLAN_FILE_NAME = 'cook.pitplan';

/** What the file holds: the menu, the serve time and the smoker temp. No personal data, no history. */
export interface PitPlanFile {
  app: 'pit-planner';
  version: 1;
  serveAt: string;
  pitTempF: number;
  items: ItemInput[];
}

/** The sender's own rates and total hours stay on their phone; the receiver plans with theirs. */
export function toPitPlan(serveAt: number, pitTempF: number, items: ItemInput[]): PitPlanFile {
  const shared = items.map(({ id, foodId, methodId, quantity, options, restMin }) => ({
    id,
    foodId,
    methodId,
    quantity,
    ...(options === undefined ? {} : { options }),
    ...(restMin === undefined ? {} : { restMin }),
  }));
  return { app: 'pit-planner', version: 1, serveAt: new Date(serveAt).toISOString(), pitTempF, items: shared };
}

/** The file's text, indented as 0.2.0 wrote it. */
export const pitPlanText = (file: PitPlanFile): string => JSON.stringify(file, null, 2);
