// Plan seed (T-017, dev builds only): puts a known menu on the plan and opens the Plan tab, for the device
// tests and for comparing with the mockups while Setup, Add food and food details are not ported yet. Not a
// screen of the app.
//   pitplanner://dev/plan?seed=mockup   mockup 05: Pit Boss 820, griddle and oven; brisket (0.75 hr/lb saved),
//                                       wings and chicken breasts for Sat Nov 14, 2026, 5:00 PM Eastern
//   pitplanner://dev/plan?seed=empty    the same cookers, nothing on the menu (mockup 04, no past cook)
//   pitplanner://dev/plan?seed=past     as empty, plus one past cook, so Cook a past plan again shows
//   pitplanner://dev/plan?seed=clash    two batches of wings, smoked at 225F and hot at 350F: one conflict
//   pitplanner://dev/plan?seed=briskets an 11.5 lb and a 6 lb brisket: labelled cards (T-061)
//   pitplanner://dev/plan?seed=twins    two 6 lb briskets: the labels are numbered (T-061)
//   pitplanner://dev/plan?seed=tomorrow the mockup menu for 5:00 PM tomorrow, so Start cook has alarms to set (T-021)
//   pitplanner://dev/plan?seed=cooking  mockup 12: the mockup menu as a running cook, 6 hr 37 min before serve
//                                       (10:23 AM on a 5:00 PM serve; up to 4 min more, as serve lands on a 5 minute mark), earlier steps done; opens the Cook tab.
//                                       End it with pitplanner://dev/alarm?cook=end
// Add &edit=<item id> (b, w, c on the mockup seed) to open food details for that item, or &add=<food id> to
// open it for a new food (mockups 08-10: seed=empty with add=brisket, stlribs or breasts).
// The past cook has a fixed id; the other two seeds take it away again (only that one, never a real cook).
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { buildPlan } from '../../engine/plan';
import type { ItemInput, PlanInput } from '../../engine/types';
import { newCook, steps } from '@/lib/cook';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import type { CookRecord } from '@/lib/history';
import { defaultOptions, method, rules } from '@/lib/rules';
import { useStore } from '@/lib/store';

const MENU: ItemInput[] = [
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

/** The smoker cannot hold 225F and 350F at once: the Conflicts tile reads 1 (T-018 device test). */
const CLASH: ItemInput[] = [
  { id: 'w1', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 },
  {
    id: 'w2',
    foodId: 'wings',
    methodId: 'hot',
    quantity: 2,
    options: defaultOptions(method('wings', 'hot')),
    restMin: 5,
  },
];
/** Two of the same food (T-061): by weight they differ, at the same weight they are numbered. */
const brisket = (id: string, quantity: number): ItemInput => ({
  id,
  foodId: 'brisket',
  methodId: 'smoked',
  quantity,
  options: { wrap: 'paper' },
  restMin: 60,
});
const SEEDS: Record<string, ItemInput[]> = {
  mockup: MENU,
  clash: CLASH,
  empty: [],
  past: [],
  briskets: [brisket('b1', 11.5), brisket('b2', 6)],
  twins: [brisket('b1', 6), brisket('b2', 6)],
  tomorrow: MENU,
  cooking: MENU,
};

const MIN = 60_000;
/** Mockup 12 shows 10:23 AM on a 5:00 PM serve. */
const COOKING_BEFORE_SERVE_MIN = 397;

/** When the seed's plan serves: the fixture's Saturday, or a time set from the clock for the two cook seeds. */
function serveAt(seed: string, now: number): number {
  if (seed === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.getTime();
  }
  // On a 5 minute mark, as a serve time picked on Plan would be.
  if (seed === 'cooking') return Math.ceil((now + COOKING_BEFORE_SERVE_MIN * MIN) / (5 * MIN)) * 5 * MIN;
  return saturday.at;
}

const PAST_ID = 'dev-seed-past';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** A brisket cooked the Saturday before the fixture's. */
const PAST: CookRecord = {
  id: PAST_ID,
  date: saturday.at - WEEK_MS,
  notes: '',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 550,
      log: {
        foodId: 'brisket',
        methodId: 'smoked',
        smokerId: saturday.cookers.smoker!.id,
        quantity: 12,
        pitTempF: 225,
        minutesOnHeat: 550,
      },
    },
  ],
};

export default function PlanSeed() {
  const { seed, edit, add } = useLocalSearchParams<{ seed?: string; edit?: string; add?: string }>();
  const { setGear, setDraft, setRate, setCook, addRecord, removeRecord, ui } = useStore();
  const router = useRouter();
  useEffect(() => {
    const items = seed ? SEEDS[seed] : undefined;
    if (!__DEV__ || !items) return;
    const now = Date.now();
    const cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() };
    const at = serveAt(seed!, now);
    setGear(cookers);
    setRate('brisket', 0.75);
    setDraft(() => ({ mode: 'readyBy', at, pitTempF: 225, items }));
    // A seed starts clean: no food details left open by an earlier run (T-058 restores it otherwise).
    ui.write({ food: null });
    if (seed === 'past') addRecord(PAST);
    else removeRecord(PAST_ID);
    if (seed === 'cooking') {
      // The cook as it would stand now: every step due before now was done on time.
      const input: PlanInput = { ...saturday, at, cookers, items };
      const cook = newCook(input, buildPlan(rules, input), now);
      const done = Object.fromEntries(
        steps(cook)
          .filter(k => k.event.at < now)
          .map(k => [k.key, k.event.at]),
      );
      setCook({ ...cook, done });
      router.replace('/cook');
      return;
    }
    router.replace({ pathname: '/plan', params: { ...(edit ? { edit } : {}), ...(add ? { add } : {}) } });
  }, [seed, edit, add, setGear, setDraft, setRate, setCook, addRecord, removeRecord, ui, router]);
  if (!__DEV__) return <Redirect href="/plan" />;
  return null;
}
