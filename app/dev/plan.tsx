// Plan seed (T-017, dev builds only): puts a known menu on the plan and opens the Plan tab, for the device
// tests and for comparing with the mockups while Setup, Add food and food details are not ported yet. Not a
// screen of the app.
//   pitplanner://dev/plan?seed=mockup   mockup 05: Pit Boss Sportsman 850, griddle and oven; brisket (0.75 hr/lb saved),
//                                       wings and chicken breasts for Sat Nov 14, 2026, 5:00 PM Eastern
//   pitplanner://dev/plan?seed=empty    the same cookers, nothing on the menu (mockup 04, no past cook)
//   pitplanner://dev/plan?seed=past     as empty, plus one past cook, so Cook a past plan again shows
//   pitplanner://dev/plan?seed=clash    two batches of wings, smoked at 225F and hot at 350F: one conflict
//   pitplanner://dev/plan?seed=briskets an 11.5 lb and a 6 lb brisket: labelled cards (T-061)
//   pitplanner://dev/plan?seed=twins    two 6 lb briskets: the labels are numbered (T-061)
//   pitplanner://dev/plan?seed=tomorrow the mockup menu for 5:00 PM tomorrow, so Start cook has alarms to set (T-021)
//   pitplanner://dev/plan?seed=cooking  mockup 12: the mockup menu as a running cook, 6 hr 37 min before serve
//                                       (10:23 AM on a 5:00 PM serve; up to 5 min more, as serve lands on a 5 minute mark), earlier steps done; opens the Cook tab.
//                                       End it with pitplanner://dev/alarm?cook=end
//   pitplanner://dev/plan?seed=conflict the mockup cook 40 min before serve with the brisket an hour behind (Not yet
//                                       on the wrap, Keep serve): it is still on at 225F while the wings crisp at
//                                       400F, so Live cook shows the smoker conflict banner (T-069)
//   pitplanner://dev/plan?seed=warned   the same, plus the wings on 30 min early and the breasts on 25 min early,
//                                       each with Keep serve: the banner has the conflict and two long holds (T-069)
//   pitplanner://dev/plan?seed=finished mockup 15: the mockup cook with every step done but Serve, which is due at
//                                       the next 5 minute mark (brisket off 25 min early, breasts 3 min late); opens the
//                                       Cook tab: Done on Serve leads to Cook finished. The saved 0.75 hr/lb
//                                       has no logged cooks yet, so the rate card says the rate stays. The
//                                       support link shows again (it shows once, on a first cook).
//   pitplanner://dev/plan?seed=finished-blend  the same with three logged briskets and this one off an hour
//                                       early, so the rate moves and the card offers Use or Keep
//   pitplanner://dev/plan?seed=history  mockup 20: the mockup cookers and the Saturday cook saved in history
//   pitplanner://dev/plan?seed=fast     the fast test cook (T-067): the mockup menu as a running cook, 60 times
//                                       faster (a minute for an hour), its first step 20 seconds from now; about
//                                       12 minutes to Serve. The times on screen are the real, squeezed ones.
//                                       Opens the Cook tab. Add &x=<n> for another speed (x=5: about 2 hr 20 min,
//                                       every step at least a minute apart, so each rings on its own). Steps that
//                                       land in the same minute share one alert, as in any cook: at 60 times
//                                       faster most do. Tap Done within 2 minutes of a step, or it counts as late
//                                       and the app asks to keep or move serve. Discard the cook at the end (or
//                                       pitplanner://dev/alarm?cook=end): saved, a 9 minute brisket would feed
//                                       the brisket rate.
// Add &edit=<item id> (b, w, c on the mockup seed) to open food details for that item, or &add=<food id> to
// open it for a new food (mockups 08-10: seed=empty with add=brisket, stlribs or breasts).
// The seeds' saved cooks have fixed ids; every seed takes away those it does not use (only those, never a real cook).
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { buildPlan } from '../../engine/plan';
import type { ItemInput, PlanInput } from '../../engine/types';
import { doneStep, newCook, postpone, steps, type ActiveCook } from '@/lib/cook';
import { BLEND_RECORDS, finishedCook, HISTORY_RECORD, MOCKUP_MENU } from '@/lib/fixtures/finishedCook';
import { FAST_FACTOR, squeezeCook } from '@/lib/fastCook';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import { logsOf, type CookRecord } from '@/lib/history';
import { defaultOptions, method, rules } from '@/lib/rules';
import { useStore } from '@/lib/store';

const MENU = MOCKUP_MENU;

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
  conflict: MENU,
  warned: MENU,
  finished: MENU,
  'finished-blend': MENU,
  history: [],
  fast: MENU,
};

const MIN = 60_000;
/** The fast test cook's first step lands this long after the link is opened, on a whole second. */
const FAST_LEAD_MS = 20_000;
/** The speed asked for with &x=, or 60. */
const fastFactor = (x?: string) => (Number(x) >= 1 ? Number(x) : FAST_FACTOR);
/** Mockup 12 shows 10:23 AM on a 5:00 PM serve. */
const COOKING_BEFORE_SERVE_MIN = 397;
/** The two banner seeds show the cook 40 min before serve (4:20 PM on a 5:00 PM serve; up to 5 min more). */
const WARNED_BEFORE_SERVE_MIN = 40;

/** When the seed's plan serves: the fixture's Saturday, or a time set from the clock for the two cook seeds. */
function serveAt(seed: string, now: number): number {
  if (seed === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.getTime();
  }
  // On a 5 minute mark, as a serve time picked on Plan would be: off the mark the plan's on-heat minutes grow
  // by the distance to it, so Cook finished would read "Planned 9 hr 2 min" (seen 2026-11-17).
  // Serve is the one step left, due at the next mark at least 30 seconds away (30 seconds to 5.5 minutes
  // out). The device tests open the link 30 to 90 seconds before a mark, so Done reads as served on time.
  if (seed === 'finished' || seed === 'finished-blend') return Math.ceil((now + 0.5 * MIN) / (5 * MIN)) * 5 * MIN;
  if (seed === 'cooking') return Math.ceil((now + COOKING_BEFORE_SERVE_MIN * MIN) / (5 * MIN)) * 5 * MIN;
  if (seed === 'conflict' || seed === 'warned')
    return Math.ceil((now + WARNED_BEFORE_SERVE_MIN * MIN) / (5 * MIN)) * 5 * MIN;
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
  const { seed, edit, add, x } = useLocalSearchParams<{ seed?: string; edit?: string; add?: string; x?: string }>();
  const { state, setGear, setDraft, setRate, setRateLock, setCook, addRecord, removeRecord, setFlags, ui } = useStore();
  // As they were when the seed opened: a change to them is not a reason to run the seed again.
  const [flags] = useState(state.flags);
  const router = useRouter();
  useEffect(() => {
    const items = seed ? SEEDS[seed] : undefined;
    if (!__DEV__ || !items) return;
    const now = Date.now();
    const cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() };
    const at = serveAt(seed!, now);
    setGear(cookers);
    setRate('brisket', 0.75);
    // Not locked: a lock left by an earlier run would hide the rate card on Cook finished.
    setRateLock('brisket', false);
    setDraft(() => ({ mode: 'readyBy', at, pitTempF: 225, items }));
    // A seed starts clean: no food details left open by an earlier run (T-058 restores it otherwise).
    ui.write({ food: null });
    const records: CookRecord[] =
      seed === 'past' ? [PAST] : seed === 'history' ? [HISTORY_RECORD] : seed === 'finished-blend' ? BLEND_RECORDS : [];
    for (const r of [PAST, HISTORY_RECORD, ...BLEND_RECORDS]) {
      if (records.includes(r)) addRecord(r);
      else removeRecord(r.id);
    }
    if (seed === 'history') {
      router.replace({ pathname: '/gear', params: { history: '1' } });
      return;
    }
    if (seed === 'finished' || seed === 'finished-blend') {
      const input: PlanInput = { ...saturday, at, cookers, items, history: logsOf(records) };
      // Mockup 15 is a first cook: the support link shows (it shows once, ever). The other seed leaves the flag alone.
      if (seed === 'finished') setFlags({ ...flags, supportShown: false });
      setCook(finishedCook(input, seed === 'finished' ? { b: -25, c: 3 } : { b: -60, c: 3 }));
      router.replace('/cook');
      return;
    }
    if (seed === 'fast') {
      const input: PlanInput = { ...saturday, at, cookers, items };
      const start = Math.ceil((now + FAST_LEAD_MS) / 1000) * 1000;
      const fast = squeezeCook(input, buildPlan(rules, input), start, fastFactor(x));
      setCook(newCook(fast.input, fast.plan, now));
      router.replace('/cook');
      return;
    }
    if (seed === 'conflict' || seed === 'warned') {
      // Every change is a real cook operation with Keep serve, at the times the CookScreen tests use
      // (10:23 AM, 2:45 PM and 4:15 PM on a 5:00 PM serve); steps due before each moment were done on time.
      const input: PlanInput = { ...saturday, at, cookers, items };
      const doneBefore = (c: ActiveCook, t: number): ActiveCook => ({
        ...c,
        done: {
          ...Object.fromEntries(
            steps(c)
              .filter(k => k.event.at < t)
              .map(k => [k.key, k.event.at]),
          ),
          ...c.done,
        },
      });
      const t0 = at - COOKING_BEFORE_SERVE_MIN * MIN;
      let cook = doneBefore(newCook(input, buildPlan(rules, input), t0), t0);
      cook = postpone(cook, 'phase:b:wrap', t0, 60, true);
      if (seed === 'warned') {
        cook = doneStep(doneBefore(cook, at - 135 * MIN), 'phase:w:smoke', at - 135 * MIN, true).cook;
        cook = doneStep(doneBefore(cook, at - 45 * MIN), 'phase:c:cook', at - 45 * MIN, true).cook;
      }
      setCook(doneBefore(cook, now));
      router.replace('/cook');
      return;
    }
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
  }, [
    seed,
    edit,
    add,
    x,
    setGear,
    setDraft,
    setRate,
    setRateLock,
    setCook,
    addRecord,
    removeRecord,
    setFlags,
    flags,
    ui,
    router,
  ]);
  if (!__DEV__) return <Redirect href="/plan" />;
  return null;
}
