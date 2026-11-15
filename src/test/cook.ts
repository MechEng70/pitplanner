// Test fixture: the cook of mockup 12. The Saturday brisket (12 lb at 0.75 hr/lb), wings and chicken breasts,
// serve 5:00 PM Eastern on Sat Nov 14, 2026. At 10:23 AM the brisket is on and "wrap" is the next step.
import { buildPlan } from '../../engine/plan';
import type { Cookers, ItemInput, PlanInput } from '../../engine/types';
import { newCook, steps, type ActiveCook } from '@/lib/cook';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import { rules } from '@/lib/rules';

export const MIN = 60_000;
/** Sat Nov 14, 2026 10:23 AM Eastern: the "now" of mockup 12. */
export const AT_1023 = Date.UTC(2026, 10, 14, 15, 23);

export const cookGear: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() };
export const cookMenu: ItemInput[] = [
  saturday.items[0]!,
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
export const cookInput: PlanInput = { ...saturday, cookers: cookGear, items: cookMenu };

/** The cook as it stands at `now`: started the evening before, every step due before `now` done on time. */
export function cookAt(now: number): ActiveCook {
  const cook = newCook(cookInput, buildPlan(rules, cookInput), Date.UTC(2026, 10, 14, 1, 0));
  const done = Object.fromEntries(
    steps(cook)
      .filter(k => k.event.at < now)
      .map(k => [k.key, k.event.at]),
  );
  return { ...cook, done };
}
