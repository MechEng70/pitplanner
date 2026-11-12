// Open shared plan (mockup 11): parse a .pitplan, map to the receiver's cookers, serve date, menu lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fitPitTemp,
  mapToCookers,
  parsePitPlan,
  sharedLine,
  suggestServe,
  type SharedPlan,
} from '../src/lib/sharedPlan.ts';
import type { SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const id = (i: number) => `n${i}`;
type Parsed = ReturnType<typeof parsePitPlan>;
const errorOf = (r: Parsed): string => ('error' in r ? r.error : '');
const opened = (r: Parsed): SharedPlan => {
  assert.ok(!('error' in r), 'expected the plan to open');
  return r;
};
const SERVE = Date.UTC(2026, 10, 14, 22, 0);
const file = (over: object = {}) =>
  JSON.stringify({
    app: 'pit-planner',
    version: 1,
    serveAt: new Date(SERVE).toISOString(),
    pitTempF: 225,
    items: [
      {
        id: 'b',
        foodId: 'brisket',
        methodId: 'smoked',
        quantity: 12,
        options: { wrap: 'paper' },
        restMin: 60,
        timingModel: 'totalHours',
        totalHours: 9,
        hrPerLb: 0.7,
      },
      { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
      { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
    ],
    ...over,
  });
const traeger: SmokerProfile = {
  id: 't',
  name: 'Traeger Pro 780',
  type: 'pellet',
  tempStepF: 5,
  minTempF: 165,
  maxTempF: 500,
  hopperLb: 18,
  mainGrateSqIn: 570,
  upperRackSqIn: 210,
  pelletLbPerHrLow: 1.5,
  pelletLbPerHrHigh: 3,
  preheatMin: 15,
};

test('share: parse keeps known foods, drops the sender timing, fresh ids', () => {
  const p = parsePitPlan(rules, file(), id);
  assert.ok(!('error' in p));
  assert.equal(p.serveAt, SERVE);
  assert.deepEqual(
    p.items.map(i => i.id),
    ['n0', 'n1', 'n2'],
  );
  assert.deepEqual(opened(p).items[0], {
    id: 'n0',
    foodId: 'brisket',
    methodId: 'smoked',
    quantity: 12,
    options: { wrap: 'paper' },
    restMin: 60,
  });
  assert.equal(p.items[1].options!.drybrine, 'yes'); // missing options get the rules default
});

test('share: bad files are rejected with a message; unknown foods and bad values are cleaned', () => {
  assert.match(errorOf(parsePitPlan(rules, 'not json', id)), /not a Pit Planner plan/);
  assert.match(errorOf(parsePitPlan(rules, '{"app":"other"}', id)), /not a Pit Planner plan/);
  assert.match(errorOf(parsePitPlan(rules, file({ version: 2 }), id)), /newer Pit Planner/);
  assert.match(errorOf(parsePitPlan(rules, file({ serveAt: 'soon' }), id)), /damaged/);
  assert.match(errorOf(parsePitPlan(rules, file({ items: [{ foodId: 'tofu' }] }), id)), /Nothing in this plan/);
  const p = parsePitPlan(
    rules,
    file({
      items: [
        { foodId: 'tofu' },
        { foodId: 'brisket', methodId: 'x', quantity: 99, options: { wrap: 'saran' }, restMin: 1 },
      ],
    }),
    id,
  );
  assert.equal(opened(p).dropped, 1);
  assert.deepEqual(opened(p).items[0], {
    id: 'n0',
    foodId: 'brisket',
    methodId: 'smoked',
    quantity: 22,
    options: { wrap: 'paper' },
    restMin: 30,
  });
});

test('share: import with no griddle moves breasts to the smoker (failure mode 13)', () => {
  const p = opened(parsePitPlan(rules, file(), id));
  const m = mapToCookers(rules, p.items, { smoker: traeger });
  assert.deepEqual(m.moves, [{ foodName: 'Chicken breasts', from: 'griddle', to: 'smoker' }]);
  assert.equal(m.items[2].methodId, 'smoker');
  assert.equal(m.items[2].options!.thickness, 'pounded');
  assert.deepEqual(m.gaps, []);
  const none = mapToCookers(rules, p.items, {});
  assert.equal(none.gaps.length, 3);
});

test('share: pit temp snaps to what the receiver can set (failure mode 12)', () => {
  assert.equal(fitPitTemp(225, { smoker: traeger }), 225);
  assert.equal(fitPitTemp(227, { smoker: traeger }), 225);
  assert.equal(fitPitTemp(227, { smoker: { ...traeger, tempStepF: null, tempPresetsF: [180, 225, 250] } }), 225);
  assert.equal(fitPitTemp(227, {}), 227);
});

test('share: serve stays when ahead, else the next same weekday at the same time', () => {
  assert.equal(suggestServe(SERVE, SERVE - 5 * 3_600_000), SERVE);
  const later = suggestServe(SERVE, SERVE + 3_600_000);
  assert.equal(
    later,
    SERVE +
      7 * 24 * 3_600_000 +
      (new Date(SERVE + 7 * 864e5).getTimezoneOffset() - new Date(SERVE).getTimezoneOffset()) * 60_000,
  );
  assert.equal(new Date(later).getDay(), new Date(SERVE).getDay());
});

test('share: menu lines', () => {
  const p = opened(parsePitPlan(rules, file(), id));
  assert.equal(sharedLine(rules, p.items[0], '12 lb'), 'Brisket, 12 lb, butcher paper');
  assert.equal(sharedLine(rules, p.items[1], '2 lb'), 'Chicken wings, 2 lb, smoke then 400F crisp');
  assert.equal(sharedLine(rules, p.items[2], '4'), 'Chicken breasts, 4, griddle');
});
