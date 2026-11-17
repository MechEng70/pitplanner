// engine/live.ts: a change during the cook that makes a warning the plan did not have (T-069, parity T16),
// and the smoker conflict sentence (Jason, 2026-11-16).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan } from './plan.ts';
import { extendCook, markPullDone, markStepDone, shiftRemaining, smokerConflicts, smokerOverlaps } from './live.ts';
import type { ItemInput, Plan, PlanInput, SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
// Saturday Nov 14, 2026, 5:00 PM Eastern (UTC-5) = 22:00 UTC
const SERVE = Date.UTC(2026, 10, 14, 22, 0);
const local = (h: number, m = 0) => Date.UTC(2026, 10, 14, h + 5, m);

const pitBoss: SmokerProfile = {
  id: 'pb820',
  name: 'Pit Boss 820',
  type: 'pellet',
  tempStepF: 5,
  minTempF: 180,
  maxTempF: 500,
  hopperLb: 21,
  mainGrateSqIn: 593,
  upperRackSqIn: 256,
  pelletLbPerHrLow: 1.5,
  pelletLbPerHrHigh: 3,
  preheatMin: 20,
};
const brisket: ItemInput = {
  id: 'b',
  foodId: 'brisket',
  methodId: 'smoked',
  quantity: 12,
  options: { wrap: 'paper' },
  restMin: 60,
};
const wings: ItemInput = { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 };
const menu = (items: ItemInput[], over: Partial<PlanInput> = {}): PlanInput => ({
  mode: 'readyBy',
  at: SERVE,
  pitTempF: 225,
  rateOverrides: { brisket: 0.75 },
  cookers: {
    smoker: pitBoss,
    griddle: { id: 'bs', name: 'Blackstone', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 },
    oven: { id: 'oven', lowestTempF: 170, holdIn: 'oven' },
  },
  items,
  ...over,
});
// Brisket on 6:40 AM, wrap 11:35 AM, off 3:40 PM. Wings on 3:15 PM at 225F, the smoker goes to 400F at 4:05 PM.
const input = menu([brisket, wings]);
const plan = buildPlan(rules, input);
const conflicts = (p: Plan) => p.warnings.filter(w => w.code === 'PIT_CONFLICT');
const BRISKET_WINGS = 'Smoker conflict: brisket at 225F and chicken wings at 400F at the same time.';

test('the plan as built has no smoker conflict and no long hold', () => {
  assert.deepEqual(plan.warnings, []);
  assert.deepEqual(smokerConflicts(plan), []);
});

test('T16: Running behind on the brisket makes a new smoker conflict with the wings', () => {
  const late = shiftRemaining(rules, input, plan, local(10), 30, true, 'b');
  const c = conflicts(late);
  assert.equal(c.length, 1);
  assert.equal(c[0].level, 'warn');
  assert.deepEqual([...c[0].itemIds!].sort(), ['b', 'w']);
  assert.equal(c[0].message, BRISKET_WINGS);
});

test('T16: a wrap done 30 min late, Not yet at the pull check and a late pull each make the same conflict', () => {
  const wrapLate = markStepDone(rules, input, plan, 'b', 'wrap', local(12, 5), true).plan;
  const notYet = extendCook(rules, input, plan, 'b', local(15, 40), 30, true);
  const pullLate = markPullDone(rules, input, plan, 'b', local(16, 15));
  for (const p of [wrapLate, notYet, pullLate])
    assert.deepEqual(
      conflicts(p).map(w => w.message),
      [BRISKET_WINGS],
    );
});

test('T16: a change that keeps the brisket off before the smoker climbs makes no conflict', () => {
  // 20 min late: off at 4:00 PM, the smoker goes to 400F at 4:05 PM.
  assert.deepEqual(conflicts(shiftRemaining(rules, input, plan, local(10), 20, true, 'b')), []);
});

test('a brisket pulled early has a hold that grows past its 4 hr limit', () => {
  // Off at 11:30 AM, sliced at 4:40 PM: 310 min.
  const early = markPullDone(rules, input, plan, 'b', local(11, 30));
  const w = early.warnings.filter(x => x.code === 'HOLD_TOO_LONG');
  assert.deepEqual(
    w.map(x => x.itemIds),
    [['b']],
  );
  // No verb, durations as Live cook writes them, the same words on Plan (Jason, 2026-11-16).
  assert.equal(w[0].message, 'Long hold: brisket 5 hr 10 min, limit 4 hr. Keep it above 140F.');
});

test('conflict sentence: no verb to agree, food names in lower case, the earlier phase first', () => {
  const p = buildPlan(
    rules,
    menu([{ id: 'c', foodId: 'breasts', methodId: 'smoker', quantity: 4, options: { thickness: 'pounded' } }, wings], {
      clearPitBeforeHighHeat: false,
    }),
  );
  assert.deepEqual(
    conflicts(p).map(w => w.message),
    ['Smoker conflict: chicken breasts at 225F and chicken wings at 400F at the same time.'],
  );
});

test('conflict sentence: two of the same food read by their labels', () => {
  const p = buildPlan(
    rules,
    menu([
      { id: 'w1', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
      { id: 'w2', foodId: 'wings', methodId: 'hot', quantity: 2 },
    ]),
  );
  assert.deepEqual(
    conflicts(p).map(w => w.message),
    ['Smoker conflict: 2 lb chicken wings 1 at 225F and 2 lb chicken wings 2 at 350F at the same time.'],
  );
});

test('conflict sentence: St. Louis ribs keep their capitals', () => {
  const p = buildPlan(
    rules,
    menu(
      [
        { id: 'r', foodId: 'stlribs', methodId: '321', quantity: 2 },
        { id: 'w', foodId: 'wings', methodId: 'hot', quantity: 2 },
      ],
      { clearPitBeforeHighHeat: false },
    ),
  );
  const c = conflicts(p);
  assert.equal(c.length, 1);
  assert.match(
    c[0].message,
    /^Smoker conflict: (St\. Louis ribs at 225F and chicken wings at 350F|chicken wings at 350F and St\. Louis ribs at 225F) at the same time\.$/,
  );
});

test('smokerConflicts: the stretch where the temps are more than 25F apart, with each food and its temp', () => {
  // Brisket 30 min behind: off at 4:10 PM, the smoker goes to 400F for the wings at 4:05 PM.
  const late = shiftRemaining(rules, input, plan, local(10), 30, true, 'b');
  assert.deepEqual(smokerConflicts(late), [
    {
      start: local(16, 5),
      end: local(16, 10),
      foods: [
        { itemId: 'b', tempF: 225 },
        { itemId: 'w', tempF: 400 },
      ],
    },
  ]);
  // An hour behind: one stretch, 4:05 to 4:40 PM, though the wings go from ramp to crisp in it.
  const later = shiftRemaining(rules, input, plan, local(10), 60, true, 'b');
  assert.deepEqual(
    smokerConflicts(later).map(c => [c.start, c.end]),
    [[local(16, 5), local(16, 40)]],
  );
});

test('smokerOverlaps: the tri-tip climb takes no smoker space, but counts with withClimb (T-069 x T-075)', () => {
  // Serve 10 PM: tri-tip smokes 7:50 to 9:20 PM, climbs off the heat 9:20 to 9:35. The brisket pull, Not yet
  // at 8:45 PM for 45 min, keeps it on at 225F until 9:30.
  const both = menu([brisket, { id: 't', foodId: 'tritip', methodId: 'smokerSear', quantity: 2.5 }], {
    at: local(22),
  });
  const notYet = extendCook(rules, both, buildPlan(rules, both), 'b', local(20, 45), 45, true);
  const spans = (o: ReturnType<typeof smokerOverlaps>) => o.map(x => [x.start, x.end, x.itemIds, x.tempsF]);
  assert.deepEqual(spans(smokerOverlaps(notYet)), [[local(19, 50), local(21, 20), ['b', 't'], [225]]]);
  assert.deepEqual(spans(smokerOverlaps(notYet, { withClimb: true })), [
    [local(19, 50), local(21, 30), ['b', 't'], [225, 500]],
  ]);
  // The clash itself is the climb against the brisket.
  assert.deepEqual(
    smokerConflicts(notYet).map(c => [c.start, c.end]),
    [[local(21, 20), local(21, 30)]],
  );
});

test('long hold on Plan: one warning per food; a food that holds poorly keeps its advice as its own sentence', () => {
  // Breasts on the smoker come off before the 400F crisp and wait for serve.
  const p = buildPlan(
    rules,
    menu([{ id: 'c', foodId: 'breasts', methodId: 'smoker', quantity: 4, options: { thickness: 'pounded' } }, wings]),
  );
  const holds = p.warnings.filter(w => w.code === 'HOLD_TOO_LONG');
  assert.deepEqual(
    holds.map(w => [w.itemIds, w.level]),
    [[['c'], 'warn']],
  );
  assert.match(
    holds[0].message,
    /^Long hold: chicken breasts (\d+ hr)?( ?\d+ min)?, limit 20 min\. Move them to the griddle or start them later\.$/,
  );
});

// Jason, 2026-11-17: Done on a pull takes the tap time, so a hold can be a fraction of a minute past its
// limit. The minutes round up, so the sentence never reads as if the hold were at the limit.
test('long hold on Plan: a hold a fraction of a minute past the limit rounds up', () => {
  const holds = (p: Plan) => p.warnings.filter(w => w.code === 'HOLD_TOO_LONG').map(w => w.message);
  // Wings off at 4:29:42 PM, serve 5:00 PM: a 30.3 min hold, limit 30.
  const over = markPullDone(rules, input, plan, 'w', local(16, 29) + 42_000);
  assert.deepEqual(holds(over), ['Long hold: chicken wings 31 min, limit 30 min.']);
  // Exactly 30 min is not past the limit.
  assert.deepEqual(holds(markPullDone(rules, input, plan, 'w', local(16, 30))), []);
});

test('long hold on Plan: two of a food read by their labels', () => {
  const p = buildPlan(
    rules,
    menu([
      { ...brisket, id: 'b1', restMin: 300 },
      { ...brisket, id: 'b2', quantity: 11.5, restMin: 60 },
    ]),
  );
  assert.deepEqual(
    p.warnings.filter(w => w.code === 'HOLD_TOO_LONG').map(w => w.message),
    ['Long hold: 12 lb brisket 5 hr, limit 4 hr. Keep it above 140F.'],
  );
});
