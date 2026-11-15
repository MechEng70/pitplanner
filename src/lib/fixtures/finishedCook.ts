// A cook with every step done but Serve (mockup 15's cook, one tap before Cook finished), for the dev seeds
// and their tests. Each step was done on time, except the pulls named in `pulledMin`: minutes after (+) or
// before (-) the plan, per item id. Pure: the plan and the times come from the input.
import { buildPlan } from '../../../engine/plan.ts';
import type { ItemInput, PlanInput } from '../../../engine/types.ts';
import { doneStep, dueAt, newCook, pending, steps, type ActiveCook } from '../cook.ts';
import type { CookRecord } from '../history.ts';
import { rules } from '../rules.ts';
import { saturday } from './saturday.ts';

/** Mockup 05's menu: a 12 lb brisket, 2 lb of wings, 4 chicken breasts on the griddle. */
export const MOCKUP_MENU: ItemInput[] = [
  { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
  { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 },
  {
    id: 'c',
    foodId: 'breasts',
    methodId: 'griddle',
    quantity: 4,
    options: { thickness: 'pounded', brine: 'none' },
    restMin: 8,
  },
];

const MIN = 60_000;
const WEEK_MS = 7 * 24 * 60 * MIN;

export function finishedCook(input: PlanInput, pulledMin: Record<string, number> = {}): ActiveCook {
  const plan = buildPlan(rules, input);
  let cook = newCook(input, plan, Math.min(...plan.events.map(e => e.at)));
  // More passes than there are steps cannot happen; the bound only stops a loop on a step that will not close.
  for (let left = steps(cook).length; left > 0; left--) {
    const next = pending(cook)[0];
    if (!next || next.event.kind === 'serve') break;
    const off = next.event.kind === 'pull' && next.event.itemId ? (pulledMin[next.event.itemId] ?? 0) : 0;
    cook = doneStep(cook, next.key, dueAt(cook, next) + off * MIN, true).cook;
  }
  return cook;
}

/** Mockup 20's cook: the Saturday menu as it reads on mockup 15, saved. */
export const HISTORY_RECORD: CookRecord = {
  id: 'dev-seed-history',
  date: saturday.at,
  notes: 'Windy. Wrapped at 165F.',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 515,
      log: {
        foodId: 'brisket',
        methodId: 'smoked',
        smokerId: saturday.cookers.smoker!.id,
        quantity: 12,
        pitTempF: 225,
        minutesOnHeat: 515,
        options: { wrap: 'paper' },
      },
    },
    {
      name: 'Chicken wings',
      plannedMin: 100,
      actualMin: 100,
      log: {
        foodId: 'wings',
        methodId: 'smokeCrisp',
        smokerId: saturday.cookers.smoker!.id,
        quantity: 2,
        pitTempF: 225,
        minutesOnHeat: 100,
        options: { drybrine: 'yes' },
      },
    },
    {
      name: 'Chicken breasts',
      plannedMin: 12,
      actualMin: 15,
      log: {
        foodId: 'breasts',
        methodId: 'griddle',
        smokerId: saturday.cookers.smoker!.id,
        quantity: 4,
        pitTempF: 225,
        minutesOnHeat: 15,
        options: { thickness: 'pounded', brine: 'none' },
      },
    },
  ],
};

/** Three earlier briskets at the saved 0.75 hr/lb: enough logged cooks for the next one to move the rate. */
export const BLEND_RECORDS: CookRecord[] = [1, 2, 3].map(n => ({
  id: `dev-seed-blend-${n}`,
  date: saturday.at - n * WEEK_MS,
  notes: '',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 540,
      log: {
        foodId: 'brisket',
        methodId: 'smoked',
        smokerId: saturday.cookers.smoker!.id,
        quantity: 12,
        pitTempF: 225,
        minutesOnHeat: 540,
        options: { wrap: 'paper' },
      },
    },
  ],
}));
