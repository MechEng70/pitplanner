// Run with: node --test engine/   (Node 22.18+ runs .ts files directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan, rateHintFor, tempFactor } from './plan.ts';
import { shiftRemaining, markStepDone, pitOutage } from './live.ts';
import { showTemp } from './units.ts';
import type { Plan, PlanInput, SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const MIN = 60_000;
// Saturday Nov 14, 2026, 5:00 PM Eastern (UTC-5) = 22:00 UTC
const SERVE = Date.UTC(2026, 10, 14, 22, 0);
const local = (h: number, m: number) => Date.UTC(2026, 10, 14, h + 5, m); // Eastern wall clock on Nov 14

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

function saturday(over: Partial<PlanInput> = {}): PlanInput {
  return {
    mode: 'readyBy',
    at: SERVE,
    pitTempF: 225,
    cookers: {
      smoker: pitBoss,
      griddle: { id: 'bs', name: 'Blackstone', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 },
      oven: { id: 'oven', lowestTempF: 170, holdIn: 'oven' },
    },
    rateOverrides: { brisket: 0.75 },
    items: [
      { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
      { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
      { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
    ],
    ...over,
  };
}
function ev(plan: Plan, kind: string, itemId?: string, phaseId?: string) {
  const e = plan.events.find(
    x => x.kind === kind && (!itemId || x.itemId === itemId) && (!phaseId || x.phaseId === phaseId),
  );
  assert.ok(e, `no ${kind} event for ${itemId ?? 'any item'} ${phaseId ?? ''}`);
  return e;
}

test('temp factor: 15% faster per 25F, 1.0 at 225F', () => {
  assert.equal(tempFactor(rules, 225), 1);
  assert.ok(Math.abs(tempFactor(rules, 250) - 0.85) < 1e-9);
  assert.ok(Math.abs(tempFactor(rules, 275) - 0.7225) < 1e-9);
});

test('Saturday plan matches the mockups', () => {
  const p = buildPlan(rules, saturday());
  assert.equal(p.fireAt, local(6, 20));
  assert.equal(ev(p, 'phase', 'b', 'smoke').at, local(6, 40));
  assert.equal(ev(p, 'pull', 'b').at, local(15, 40));
  assert.equal(ev(p, 'phase', 'w', 'smoke').at, local(15, 15));
  assert.equal(ev(p, 'phase', 'w', 'ramp').at, local(16, 5));
  assert.equal(ev(p, 'pull', 'w').at, local(16, 55));
  assert.equal(ev(p, 'phase', 'c', 'cook').at, local(16, 40));
  assert.equal(p.griddleOnAt, local(16, 25));
  assert.ok(!p.warnings.some(w => w.code === 'PIT_CONFLICT'));
  assert.ok(p.pelletsLb > 15 && p.pelletsLb < 21, `pellets ${p.pelletsLb}`);
  assert.ok(!p.events.some(e => e.kind === 'refill'));
  assert.ok(!p.warnings.some(w => w.code === 'PELLETS_OVER_HOPPER'));
});

test('a cook that burns more than the hopper holds: refill alert plus an info warning', () => {
  const p = buildPlan(rules, saturday({ rateOverrides: {} })); // 15 hr brisket at the published rate
  assert.ok(p.pelletsLb > 21, `pellets ${p.pelletsLb}`);
  const refill = p.events.find(e => e.kind === 'refill')!;
  assert.equal(refill.label, 'Top off the hopper. It runs low in about 30 min.');
  const w = p.warnings.find(x => x.code === 'PELLETS_OVER_HOPPER')!;
  assert.equal(w.level, 'info');
  assert.match(w.message, /about \d+ lb of pellets, more than the 21 lb hopper/);
});

test('no-wrap brisket has no wrap check and takes 15% longer', () => {
  const paper = buildPlan(rules, saturday());
  const none = buildPlan(
    rules,
    saturday({
      items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'none' }, restMin: 60 }],
    }),
  );
  assert.equal(none.items[0].phases.length, 1);
  const len = (p: Plan) => p.items[0].phases.reduce((a, x) => a + x.minutes, 0);
  assert.ok(Math.abs(len(none) / len(paper) - 1.15) < 1e-9);
});

test('clear-pit rule moves a smoked item that would overlap the 400F crisp', () => {
  const input = saturday({
    items: [
      { id: 'c', foodId: 'breasts', methodId: 'smoker', quantity: 4, options: { thickness: 'pounded' } },
      { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
    ],
  });
  const p = buildPlan(rules, input);
  const breasts = p.items.find(i => i.input.id === 'c')!;
  const ramp = ev(p, 'phase', 'w', 'ramp').at;
  assert.ok(Math.max(...breasts.phases.map(x => x.end)) <= ramp);
  assert.ok(breasts.extraHoldMin > 0);
  assert.ok(p.warnings.some(w => w.code === 'HOLD_TOO_LONG' && w.level === 'warn'));
  const off = buildPlan(rules, { ...input, clearPitBeforeHighHeat: false });
  assert.ok(off.warnings.some(w => w.code === 'PIT_CONFLICT'));
});

test('start-at mode puts the first action at the chosen time', () => {
  const p = buildPlan(rules, saturday({ mode: 'startAt', at: local(7, 0) }));
  assert.equal(p.events[0].at <= local(7, 0), true);
  assert.equal(p.fireAt, local(7, 0));
  assert.equal(p.serveAt, SERVE + 40 * MIN);
});

test('Celsius display shows set points in 2C increments', () => {
  assert.equal(showTemp(225, 'C', true), '108C');
  assert.equal(showTemp(165, 'C'), '74C');
});

test('running 30 min late with serve kept: steps move, serve stays, brisket rest shrinks', () => {
  const p = buildPlan(rules, saturday());
  const now = local(10, 0);
  const s = shiftRemaining(rules, saturday(), p, now, 30, true);
  assert.equal(s.serveAt, SERVE);
  assert.equal(ev(s, 'pull', 'b').at, local(16, 10));
  assert.ok(s.warnings.some(w => w.code === 'REST_REDUCED' && w.itemIds?.includes('b')));
  const s2 = shiftRemaining(rules, saturday(), p, now, 45, true);
  assert.ok(s2.warnings.some(w => w.code === 'REST_SHORT' && w.itemIds?.includes('b')));
  const moved = shiftRemaining(rules, saturday(), p, now, 30, false);
  assert.equal(moved.serveAt, SERVE + 30 * MIN);
});

// Until T-076 this was "shifts only the brisket" with Move serve: the wings stayed and their hold grew.
test('wrapping 15 min late, Keep serve: only the brisket moves', () => {
  const p = buildPlan(rules, saturday());
  const wrap = ev(p, 'phase', 'b', 'wrap').at;
  const r = markStepDone(rules, saturday(), p, 'b', 'wrap', wrap + 15 * MIN, true);
  assert.equal(r.deltaMin, 15);
  assert.equal(r.plan.serveAt, SERVE);
  assert.equal(ev(r.plan, 'pull', 'b').at, ev(p, 'pull', 'b').at + 15 * MIN);
  assert.equal(ev(r.plan, 'phase', 'w', 'smoke').at, ev(p, 'phase', 'w', 'smoke').at);
});

test('wrapping 15 min late, Move serve: serve and the other foods move 15 min with the brisket (T-076)', () => {
  const p = buildPlan(rules, saturday());
  const wrap = ev(p, 'phase', 'b', 'wrap').at;
  const r = markStepDone(rules, saturday(), p, 'b', 'wrap', wrap + 15 * MIN, false);
  assert.equal(r.deltaMin, 15);
  assert.equal(r.plan.serveAt, SERVE + 15 * MIN);
  assert.equal(ev(r.plan, 'pull', 'b').at, ev(p, 'pull', 'b').at + 15 * MIN);
  assert.equal(ev(r.plan, 'phase', 'w', 'smoke').at, ev(p, 'phase', 'w', 'smoke').at + 15 * MIN);
  assert.equal(ev(r.plan, 'phase', 'c', 'cook').at, ev(p, 'phase', 'c', 'cook').at + 15 * MIN);
});

// Until T-076 the griddle breasts stayed put while serve moved, so their hold grew by the outage.
test('pit outage adds downtime plus recovery to smoker items; with serve moved the griddle food follows', () => {
  const p = buildPlan(rules, saturday());
  const o = pitOutage(rules, saturday(), p, local(9, 0), local(9, 20), 10, false);
  assert.equal(ev(o, 'pull', 'b').at, ev(p, 'pull', 'b').at + 30 * MIN);
  assert.equal(o.serveAt, SERVE + 30 * MIN);
  assert.equal(ev(o, 'pull', 'c').at, ev(p, 'pull', 'c').at + 30 * MIN);
});

test('overnight cook across the DST change keeps exact durations', () => {
  // Sunday Nov 1, 2026: US clocks fall back at 2:00 AM. Serve at noon Eastern (UTC-5) = 17:00 UTC.
  const serve = Date.UTC(2026, 10, 1, 17, 0);
  const p = buildPlan(
    rules,
    saturday({
      at: serve,
      items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 16, options: { wrap: 'paper' } }],
    }),
  );
  const b = p.items[0];
  const onHeat = (b.finish - b.phases[0].start) / MIN;
  assert.equal(Math.round(onHeat), 0.75 * 16 * 60);
});

test('learned rate blends with the default when no rate is saved', () => {
  const log = (min: number) => ({
    foodId: 'brisket',
    methodId: 'smoked',
    smokerId: 'pb820',
    quantity: 12,
    pitTempF: 225,
    minutesOnHeat: min,
    options: { wrap: 'paper' },
  });
  const p = buildPlan(
    rules,
    saturday({
      rateOverrides: {},
      history: [log(540), log(540)],
      items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12 }],
    }),
  );
  const expected = (3 * 1.25 + 0.75 + 0.75) / 5;
  assert.ok(Math.abs(p.items[0].rateInfo!.hrPerLbAt225 - expected) < 1e-9);
  assert.equal(p.items[0].rateInfo!.source, 'learned');
});

const brisketOnly = (it: Partial<import('./types.ts').ItemInput>, over: Partial<PlanInput> = {}) =>
  saturday({
    items: [
      { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60, ...it },
    ],
    ...over,
  });
const heatMin = (p: Plan) => p.items[0].phases.reduce((a, x) => a + x.minutes, 0);

test('a 12 lb brisket at 0.75 hr/lb plans 9 hr: on 6:40 AM, fire 6:20 AM for a 5:00 PM serve', () => {
  const p = buildPlan(rules, brisketOnly({}));
  assert.equal(Math.round(heatMin(p)), 9 * 60);
  assert.equal(p.items[0].phases[0].start, local(6, 40));
  assert.equal(p.fireAt, local(6, 20));
});

test('total hours are used exactly and ignore pit temp and wrap', () => {
  for (const pitTempF of [225, 275])
    for (const wrap of ['paper', 'none']) {
      const p = buildPlan(
        rules,
        brisketOnly({ timingModel: 'totalHours', totalHours: 9, totalHoursAtF: 225, options: { wrap } }, { pitTempF }),
      );
      assert.ok(Math.abs(heatMin(p) - 540) < 1e-9, `${pitTempF} ${wrap}`);
      assert.equal(p.items[0].rateInfo!.model, 'totalHours');
      assert.equal(
        p.warnings.some(w => w.code === 'TOTAL_HOURS_FIXED'),
        pitTempF !== 225,
      );
    }
  // Any food: ribs keep their phase shares (3-2-1) inside the total.
  const r = buildPlan(
    rules,
    saturday({
      items: [{ id: 'r', foodId: 'stlribs', methodId: '321', quantity: 2, timingModel: 'totalHours', totalHours: 5 }],
    }),
  );
  assert.deepEqual(
    r.items[0].phases.map(x => Math.round(x.minutes)),
    [150, 100, 50],
  );
});

test('a per-item rate beats the saved rate', () => {
  const p = buildPlan(rules, brisketOnly({ hrPerLb: 0.6 }));
  assert.equal(p.items[0].rateInfo!.hrPerLbAt225, 0.6);
  assert.equal(p.items[0].rateInfo!.source, 'item');
  assert.equal(Math.round(heatMin(p)), Math.round(0.6 * 12 * 60));
});

test('a saved rate is used as-is until 3 logged cooks, then blends with them unless locked', () => {
  const log = {
    foodId: 'brisket',
    methodId: 'smoked',
    smokerId: 'pb820',
    quantity: 12,
    pitTempF: 225,
    minutesOnHeat: 12 * 60,
    options: { wrap: 'paper' },
  };
  const two = buildPlan(rules, brisketOnly({}, { history: [log, log] })).items[0].rateInfo!;
  assert.deepEqual([two.hrPerLbAt225, two.source], [0.75, 'override']);
  const three = buildPlan(rules, brisketOnly({}, { history: [log, log, log] })).items[0].rateInfo!;
  assert.equal(three.source, 'blended');
  assert.ok(Math.abs(three.hrPerLbAt225 - (3 * 0.75 + 3 * 1) / 6) < 1e-9);
  const locked = buildPlan(rules, brisketOnly({}, { history: [log, log, log], rateLocks: { brisket: true } })).items[0]
    .rateInfo!;
  assert.deepEqual([locked.hrPerLbAt225, locked.source], [0.75, 'override']);
});

test('size-adjusted works with no history and matches hr/lb at the reference weight', () => {
  const p = buildPlan(rules, brisketOnly({ timingModel: 'sizeAdjusted' }, { history: [] }));
  assert.equal(p.items[0].rateInfo!.model, 'sizeAdjusted');
  assert.ok(Math.abs(heatMin(p) - 0.75 * 12 * 60) < 1e-9);
  const big = buildPlan(rules, brisketOnly({ timingModel: 'sizeAdjusted', quantity: 16 }, { history: [] }));
  assert.ok(Math.abs(heatMin(big) - 0.75 * 12 * Math.pow(16 / 12, 0.67) * 60) < 1e-9);
});

test('brisket-style tri-tip is by weight with a 3.5 hr floor', () => {
  const mk = (quantity: number) =>
    buildPlan(
      rules,
      saturday({ rateOverrides: {}, items: [{ id: 't', foodId: 'tritip', methodId: 'brisketStyle', quantity }] }),
    );
  assert.ok(Math.abs(heatMin(mk(1)) - 210) < 1e-9);
  assert.ok(Math.abs(heatMin(mk(3)) - 1.67 * 3 * 60) < 1e-9);
});

test('size-adjusted model: a 16 lb brisket takes less time per pound than a 12 lb one', () => {
  const log = {
    foodId: 'brisket',
    methodId: 'smoked',
    smokerId: 'pb820',
    quantity: 12,
    pitTempF: 225,
    minutesOnHeat: 540,
    options: { wrap: 'paper' },
  };
  const mk = (w: number) =>
    buildPlan(
      rules,
      saturday({
        rateOverrides: {},
        history: [log, log, log],
        items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: w, timingModel: 'sizeAdjusted' }],
      }),
    );
  const mins = (p: Plan) => p.items[0].phases.reduce((a, x) => a + x.minutes, 0);
  assert.ok(mins(mk(16)) / 16 < mins(mk(12)) / 12);
});

test('temp not settable on the cooker is flagged', () => {
  const p = buildPlan(rules, saturday({ pitTempF: 227 }));
  assert.ok(p.warnings.some(w => w.code === 'TEMP_NOT_SETTABLE'));
});

test('missing griddle is flagged for a griddle item', () => {
  const p = buildPlan(rules, saturday({ cookers: { smoker: pitBoss } }));
  assert.ok(p.warnings.some(w => w.code === 'NO_GRIDDLE'));
});

// ---- T-059 whole turkey ----
const turkeyPlan = (over: Partial<PlanInput> = {}) =>
  buildPlan(
    rules,
    saturday({ rateOverrides: {}, items: [{ id: 't', foodId: 'turkey', methodId: 'smoked', quantity: 12 }], ...over }),
  );

test('turkey: 12 lb at 225F is 6 hr on heat, a 30 min rest, fire 20 min ahead and a pull check at 165F', () => {
  const p = turkeyPlan();
  const it = p.items[0];
  assert.equal(it.rateInfo?.hrPerLbAt225, 0.5);
  assert.equal(it.rateInfo?.source, 'default');
  assert.equal(it.restMin, 30);
  assert.equal(it.restFloorMin, 20);
  // Backward from serve: slice, rest, then rate x weight on heat (0.5 hr/lb x 12 lb = 360 min).
  assert.equal(it.finish, SERVE - (it.sliceMin + 30) * MIN);
  assert.equal(ev(p, 'phase', 't', 'smoke').at, it.finish - 360 * MIN);
  assert.equal(p.fireAt, it.finish - 360 * MIN - pitBoss.preheatMin * MIN);
  assert.equal(ev(p, 'fire').label, 'Fire the smoker to 225F.');
  const pull = ev(p, 'pull', 't');
  assert.equal(pull.at, it.finish);
  assert.equal(pull.checkStep, true);
  assert.match(pull.label, /165F in the innermost thigh, the innermost wing and the thickest part of the breast/);
  assert.deepEqual(p.warnings, []);
});

// Jason, 2026-11-16: his measured turkey rate at 275F is 18 min per lb (the shared curve gave 21.7). The
// rate runs from 30 min per lb at 225F through that point (about 23 at 250F) and on from it with the shared
// curve (about 15 at 300F).
const turkeyMinPerLb = (pitTempF: number) => {
  const p = turkeyPlan({ pitTempF });
  const smoke = p.items[0].phases.find(x => x.id === 'smoke')!;
  return smoke.minutes / 12;
};

test('turkey: 18 min per lb at 275F, about 23 at 250F and about 15 at 300F; 30 at 225F as before', () => {
  assert.ok(Math.abs(turkeyMinPerLb(275) - 18) < 1e-9, String(turkeyMinPerLb(275)));
  assert.ok(Math.abs(turkeyMinPerLb(225) - 30) < 1e-9);
  assert.ok(Math.abs(turkeyMinPerLb(250) - 60 * Math.sqrt(0.5 * 0.3)) < 1e-9); // 23.2: halfway on the curve
  assert.ok(Math.abs(turkeyMinPerLb(300) - 18 * 0.85) < 1e-9); // 15.3: the shared curve from the 275F point
  assert.ok(turkeyMinPerLb(250) > 23 && turkeyMinPerLb(250) < 23.5);
  assert.ok(turkeyMinPerLb(300) > 15 && turkeyMinPerLb(300) < 15.5);
});

test("turkey's measured point changes no other food: brisket at 275F still follows the shared curve", () => {
  const at = (pitTempF: number) =>
    buildPlan(
      rules,
      saturday({ pitTempF, items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12 }] }),
    ).items[0].phases.reduce((a, x) => a + (x.cooker === 'smoker' ? x.minutes : 0), 0);
  assert.ok(Math.abs(at(275) / at(225) - tempFactor(rules, 275)) < 1e-9);
});

test('turkey: a logged cook at 275F is read back with the same curve (216 min for 12 lb keeps the rate at 0.5)', () => {
  const log = {
    foodId: 'turkey',
    methodId: 'smoked',
    smokerId: pitBoss.id,
    pitTempF: 275,
    quantity: 12,
    minutesOnHeat: 216,
  };
  const p = turkeyPlan({ history: [log] as PlanInput['history'] });
  assert.equal(p.items[0].rateInfo?.source, 'learned');
  assert.ok(Math.abs(p.items[0].rateInfo!.hrPerLbAt225 - 0.5) < 1e-9, String(p.items[0].rateInfo!.hrPerLbAt225));
});

// Parity D10 (Jason, 2026-11-16): past 4 hours the hold note for brisket and pork butt says to keep it above 140F.
test('a hold past 4 hours says "Keep it above 140F." for brisket and pork butt, and for no other food', () => {
  const holdNote = (foodId: string, methodId: string, restMin: number) =>
    buildPlan(rules, saturday({ items: [{ id: 'x', foodId, methodId, quantity: 8, restMin }] })).warnings.find(
      w => w.code === 'HOLD_TOO_LONG',
    )?.message;
  assert.equal(holdNote('brisket', 'smoked', 300), 'Long hold: brisket 5 hr, limit 4 hr. Keep it above 140F.');
  assert.equal(holdNote('butt', 'smoked', 300), 'Long hold: pork butt 5 hr, limit 4 hr. Keep it above 140F.');
  assert.equal(holdNote('brisket', 'smoked', 240), undefined);
  assert.doesNotMatch(holdNote('turkey', 'smoked', 120) ?? 'none', /140F/);
  assert.equal(holdNote('turkey', 'smoked', 120), 'Long hold: whole turkey 2 hr, limit 1 hr.');
});

test('prep steps say when, not how (Jason, 2026-11-15): a plain "Prep the ..." reminder', () => {
  assert.deepEqual(
    turkeyPlan()
      .events.filter(e => e.kind === 'prep')
      .map(e => [e.label, e.alarm]),
    [['Prep the turkey.', false]],
  );
  // Every prep label in the rules, a method's own or one that comes with a chosen option.
  const labels: string[] = [];
  const walk = (v: unknown, inPrep: boolean): void => {
    if (Array.isArray(v)) v.forEach(x => walk(x, inPrep));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (inPrep && k === 'label' && typeof x === 'string') labels.push(x);
        else walk(x, k === 'prep');
      }
  };
  walk(rules.foods, false);
  assert.ok(labels.length >= 10, `${labels.length} prep labels found`);
  for (const l of labels) assert.match(l, /^(Prep|Brine|Dry brine) the [a-z -]+\.$/);
});

test("rate hint: turkey's own usual range starts at 0.33 hr/lb, other foods keep the shared one", () => {
  assert.deepEqual(rateHintFor(rules, 'turkey'), [0.33, rules.learning.rateHint[1]]);
  assert.deepEqual(rateHintFor(rules, 'brisket'), rules.learning.rateHint);
  assert.deepEqual(rateHintFor(rules, 'no-such-food'), rules.learning.rateHint);
});

test('turkey: the size-adjusted model gives the same 6 hr at its 12 lb reference weight', () => {
  const p = turkeyPlan({
    items: [{ id: 't', foodId: 'turkey', methodId: 'smoked', quantity: 12, timingModel: 'sizeAdjusted' }],
  });
  assert.equal(ev(p, 'phase', 't', 'smoke').at, p.items[0].finish - 360 * MIN);
});

test('turkey: a rest under 20 min is raised to the 20 min minimum', () => {
  const p = turkeyPlan({ items: [{ id: 't', foodId: 'turkey', methodId: 'smoked', quantity: 12, restMin: 5 }] });
  assert.equal(p.items[0].restMin, 20);
});

test('turkey: below 225F the plan reports an issue and keeps the temp; at 225F it does not', () => {
  const low = turkeyPlan({ pitTempF: 220 });
  const w = low.warnings.filter(x => x.code === 'TEMP_BELOW_FOOD_MIN');
  assert.equal(w.length, 1);
  assert.equal(w[0].level, 'warn');
  assert.deepEqual(w[0].itemIds, ['t']);
  assert.equal(w[0].message, 'Whole turkey needs the smoker at 225F or hotter. It is set to 220F.');
  // Never changed silently: the plan is still built at the temp the user chose.
  assert.equal(low.pitTempF, 220);
  assert.equal(low.items[0].phases[0].tempF, 220);
  assert.equal(ev(low, 'fire').label, 'Fire the smoker to 220F.');

  for (const t of [225, 250, 275])
    assert.ok(!turkeyPlan({ pitTempF: t }).warnings.some(x => x.code === 'TEMP_BELOW_FOOD_MIN'), `${t}F`);
});

// Jason, 2026-11-16: a warning, not a block, above 16 lb for a whole turkey on the smoker (USDA FSIS:
// "Turkeys 16 pounds or less are the recommended size for safe smoking"). An info line in Conflicts.
const sizeNotes = (quantity: number, foodId = 'turkey', methodId = 'smoked') =>
  buildPlan(rules, saturday({ rateOverrides: {}, items: [{ id: 't', foodId, methodId, quantity }] })).warnings.filter(
    w => w.code === 'SIZE_OVER_RECOMMENDED',
  );

test('turkey: 16 lb has no size note; 16.5 lb has one info line that names the weight and the USDA size', () => {
  assert.deepEqual(sizeNotes(16), []);
  assert.deepEqual(sizeNotes(12), []);
  assert.deepEqual(sizeNotes(16.5), [
    {
      code: 'SIZE_OVER_RECOMMENDED',
      level: 'info',
      itemIds: ['t'],
      message: 'Whole turkey is 16.5 lb. USDA recommends 16 lb or less for safe smoking.',
    },
  ]);
  assert.equal(sizeNotes(24)[0].message, 'Whole turkey is 24 lb. USDA recommends 16 lb or less for safe smoking.');
});

test('turkey: the size note blocks nothing (the plan is built as asked) and no other food has one', () => {
  const p = buildPlan(
    rules,
    saturday({ rateOverrides: {}, items: [{ id: 't', foodId: 'turkey', methodId: 'smoked', quantity: 20 }] }),
  );
  assert.equal(p.items[0].input.quantity, 20);
  assert.equal(p.items[0].phases.find(x => x.id === 'smoke')!.minutes, 20 * 30);
  assert.ok(!p.warnings.some(w => w.level === 'warn'));
  assert.deepEqual(sizeNotes(18, 'brisket', 'smoked'), []);
});

test("turkey: the temp floor is the food's own; brisket at 200F has no such issue", () => {
  const p = buildPlan(rules, saturday({ pitTempF: 200, items: [saturday().items[0]] }));
  assert.ok(!p.warnings.some(x => x.code === 'TEMP_BELOW_FOOD_MIN'));
});

test('turkey: two turkeys below 225F get one issue each, named by label', () => {
  const p = turkeyPlan({
    pitTempF: 200,
    items: [
      { id: 't1', foodId: 'turkey', methodId: 'smoked', quantity: 12 },
      { id: 't2', foodId: 'turkey', methodId: 'smoked', quantity: 14 },
    ],
  });
  const w = p.warnings.filter(x => x.code === 'TEMP_BELOW_FOOD_MIN');
  assert.deepEqual(
    w.map(x => x.itemIds),
    [['t1'], ['t2']],
  );
  assert.match(w[0].message, /^12 lb whole turkey needs the smoker at 225F or hotter/);
});

test('turkey: the shared temp model (0.85 per 25F) against the cited rates, in min per lb', () => {
  const perLb = (t: number) => 0.5 * 60 * tempFactor(rules, t);
  // FSIS: 20 to 30 min per lb with smoker air at 225F to 300F. Jason: closer to 30 at 225F to 250F.
  assert.equal(perLb(225), 30);
  assert.ok(Math.abs(perLb(250) - 25.5) < 0.01);
  // Jason: 15 to 20 min per lb at 275F to 325F. The model gives 21.7 at 275F (1.7 over, the slow side),
  // 18.4 at 300F and 15.7 at 325F. No turkey-specific temp model.
  assert.ok(perLb(275) > 20 && perLb(275) < 22, `275F: ${perLb(275)}`);
  assert.ok(perLb(300) > 15 && perLb(300) < 20, `300F: ${perLb(300)}`);
  assert.ok(perLb(325) > 15 && perLb(325) < 20, `325F: ${perLb(325)}`);
});
