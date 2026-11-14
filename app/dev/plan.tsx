// Plan seed (T-017, dev builds only): puts a known menu on the plan and opens the Plan tab, for the device
// tests and for comparing with the mockups while Setup, Add food and food details are not ported yet. Not a
// screen of the app.
//   pitplanner://dev/plan?seed=mockup   mockup 05: Pit Boss 820, griddle and oven; brisket (0.75 hr/lb saved),
//                                       wings and chicken breasts for Sat Nov 14, 2026, 5:00 PM Eastern
//   pitplanner://dev/plan?seed=empty    the same cookers, nothing on the menu (mockup 04, no past cook)
//   pitplanner://dev/plan?seed=past     as empty, plus one past cook, so Cook a past plan again shows
//   pitplanner://dev/plan?seed=clash    two batches of wings, smoked at 225F and hot at 350F: one conflict
// The past cook has a fixed id; the other two seeds take it away again (only that one, never a real cook).
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import type { ItemInput } from '../../engine/types';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import type { CookRecord } from '@/lib/history';
import { defaultOptions, method } from '@/lib/rules';
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
const SEEDS: Record<string, ItemInput[]> = { mockup: MENU, clash: CLASH, empty: [], past: [] };

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
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const { setGear, setDraft, setRate, addRecord, removeRecord } = useStore();
  const router = useRouter();
  useEffect(() => {
    const items = seed ? SEEDS[seed] : undefined;
    if (!__DEV__ || !items) return;
    setGear({ smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() });
    setRate('brisket', 0.75);
    setDraft(() => ({ mode: 'readyBy', at: saturday.at, pitTempF: 225, items }));
    if (seed === 'past') addRecord(PAST);
    else removeRecord(PAST_ID);
    router.replace('/plan');
  }, [seed, setGear, setDraft, setRate, addRecord, removeRecord, router]);
  if (!__DEV__) return <Redirect href="/plan" />;
  return null;
}
