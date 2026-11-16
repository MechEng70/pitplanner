// T-061: two of the same food on one menu are told apart by a default label ("11.5 lb brisket").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemLabels, longHold } from './labels.ts';
import { buildPlan } from './plan.ts';
import { markStepDone } from './live.ts';
import { alarmsFromPlan, keyedEvents } from './alarms.ts';
import { localizeText } from './units.ts';
import type { ItemInput, PlanInput } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const SERVE = Date.UTC(2026, 10, 14, 22, 0);

const brisket = (id: string, quantity: number): ItemInput => ({
  id,
  foodId: 'brisket',
  methodId: 'smoked',
  quantity,
  options: { wrap: 'paper' },
});
const tritip: ItemInput = { id: 't', foodId: 'tritip', methodId: rules.foods[1].methods[0].id, quantity: 2.5 };

function input(items: ItemInput[]): PlanInput {
  return {
    mode: 'readyBy',
    at: SERVE,
    pitTempF: 250,
    cookers: {
      smoker: {
        id: 'pb850',
        name: 'Pit Boss Sportsman 850',
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
      },
      griddle: { id: 'bs', name: 'Blackstone', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 },
      oven: { id: 'oven', lowestTempF: 170, holdIn: 'oven' },
    },
    items,
  };
}

test('one of each food: no labels', () => {
  assert.equal(itemLabels(rules, [brisket('a', 11.5), tritip]).size, 0);
});

test('two briskets are labelled by weight; other foods are not', () => {
  const l = itemLabels(rules, [brisket('a', 11.5), brisket('b', 6), tritip]);
  assert.deepEqual(
    [...l],
    [
      ['a', '11.5 lb brisket'],
      ['b', '6 lb brisket'],
    ],
  );
});

test('two of the same food at the same weight are numbered in menu order', () => {
  const l = itemLabels(rules, [brisket('a', 6), brisket('b', 11.5), brisket('c', 6)]);
  assert.equal(l.get('a'), '6 lb brisket 1');
  assert.equal(l.get('b'), '11.5 lb brisket');
  assert.equal(l.get('c'), '6 lb brisket 2');
});

test('count foods: "3 racks St. Louis ribs", "4 chicken breasts"', () => {
  const ribs = (id: string, quantity: number): ItemInput => ({ id, foodId: 'stlribs', methodId: '', quantity });
  const breasts = (id: string, quantity: number): ItemInput => ({ id, foodId: 'breasts', methodId: '', quantity });
  const l = itemLabels(rules, [ribs('r1', 3), ribs('r2', 2), breasts('c1', 4), breasts('c2', 6)]);
  assert.equal(l.get('r1'), '3 racks St. Louis ribs');
  assert.equal(l.get('r2'), '2 racks St. Louis ribs');
  assert.equal(l.get('c1'), '4 chicken breasts');
  assert.equal(l.get('c2'), '6 chicken breasts');
});

test('an unknown food gets no label and does not throw', () => {
  const ghost: ItemInput = { id: 'x', foodId: 'nope', methodId: 'm', quantity: 1 };
  assert.equal(itemLabels(rules, [ghost, { ...ghost, id: 'y' }]).size, 0);
});

test('two briskets: every step of each starts with its label, and each pull step names its food', () => {
  const plan = buildPlan(rules, input([brisket('a', 11.5), brisket('b', 6), tritip]));
  for (const [id, label] of [
    ['a', '11.5 lb brisket'],
    ['b', '6 lb brisket'],
  ]) {
    const mine = plan.events.filter(e => e.itemId === id);
    assert.ok(mine.length >= 4);
    for (const e of mine) assert.ok(e.label.startsWith(`${label}: `), e.label);
    const pull = mine.find(e => e.kind === 'pull')!;
    assert.equal(pull.label, `${label}: Check tenderness: pull at 200-205F when the probe slides in like butter.`);
    assert.equal(plan.items.find(i => i.input.id === id)!.label, label);
  }
  // The same step of the two briskets no longer reads the same.
  const text = (id: string, kind: string) => plan.events.find(e => e.itemId === id && e.kind === kind)!.label;
  assert.notEqual(text('a', 'slice'), text('b', 'slice'));
  // The only tri-tip reads as before, and so do steps that belong to no food.
  for (const e of plan.events.filter(x => x.itemId === 't' || !x.itemId))
    assert.ok(!/^\d.* lb /.test(e.label), e.label);
  assert.equal(plan.items.find(i => i.input.id === 't')!.label, undefined);
});

test('one brisket reads as today', () => {
  const plan = buildPlan(rules, input([brisket('a', 11.5), tritip]));
  const labels = plan.events.filter(e => e.itemId === 'a').map(e => e.label);
  assert.ok(labels.includes('Check tenderness: pull at 200-205F when the probe slides in like butter.'));
  assert.ok(labels.includes('Slice or plate the brisket.'));
  assert.ok(labels.every(l => !l.includes('11.5 lb')));
});

test('the label is in kg when the weight unit is kg', () => {
  const plan = buildPlan(rules, input([brisket('a', 11.5), brisket('b', 6)]));
  const pull = plan.events.find(e => e.itemId === 'a' && e.kind === 'pull')!;
  assert.ok(localizeText(pull.label, 'F', 'kg').startsWith('5.2 kg brisket: '));
});

test('warnings name the labelled brisket', () => {
  const fixed: ItemInput = { ...brisket('a', 11.5), timingModel: 'totalHours', totalHours: 6, totalHoursAtF: 225 };
  const plan = buildPlan(rules, input([fixed, brisket('b', 6)]));
  const w = plan.warnings.find(x => x.code === 'TOTAL_HOURS_FIXED')!;
  assert.equal(w.message, '11.5 lb brisket: total hours fixed. Temp change does not adjust it.');
});

test('alarms carry the label, and step keys do not change with it', () => {
  const two = buildPlan(rules, input([brisket('a', 11.5), brisket('b', 6)]));
  const one = buildPlan(rules, input([brisket('a', 11.5)]));
  const keys = (p: typeof two) =>
    keyedEvents(p)
      .filter(k => k.event.itemId === 'a')
      .map(k => k.key);
  assert.deepEqual(keys(two), keys(one));
  // The alarm's title is the label too (Jason, 2026-11-14), in the user's units; one brisket keeps "Brisket".
  const titles = (p: typeof two, kg = false) =>
    alarmsFromPlan(p, 0, undefined, kg ? { text: t => localizeText(t, 'F', 'kg') } : {}).map(a => a.title);
  assert.ok(titles(two).includes('6 lb brisket'));
  assert.ok(titles(two).every(t => !/\bBrisket\b/.test(t)));
  assert.ok(titles(two, true).includes('2.7 kg brisket'));
  assert.ok(titles(one).includes('Brisket'));
  const bodies = alarmsFromPlan(two, 0).map(a => a.body);
  assert.ok(bodies.some(b => b.includes('6 lb brisket: Check tenderness')));
});

test('the label survives a live change (derive runs again)', () => {
  const plan = buildPlan(rules, input([brisket('a', 11.5), brisket('b', 6)]));
  const wrap = plan.events.find(e => e.itemId === 'b' && e.phaseId === 'wrap')!;
  const inp = input([brisket('a', 11.5), brisket('b', 6)]);
  const next = markStepDone(rules, inp, plan, 'b', 'wrap', wrap.at + 10 * 60_000, false).plan;
  assert.ok(next.events.filter(e => e.itemId === 'a').every(e => e.label.startsWith('11.5 lb brisket: ')));
});

// T-069 (Jason, 2026-11-16): "Long hold: ..." with no verb, on Plan and on the Live cook banner.
test('long hold, one food: the hold, then ", limit" with its unit', () => {
  assert.equal(
    longHold([{ name: 'brisket', holdMin: 370, limitMin: 240 }]),
    'Long hold: brisket 6 hr 10 min, limit 4 hr.',
  );
  assert.equal(
    longHold([{ name: 'chicken wings', holdMin: 35, limitMin: 30 }]),
    'Long hold: chicken wings 35 min, limit 30 min.',
  );
});

test('long hold, several foods: one line, each limit in brackets', () => {
  // Both written in min: the limit drops its unit.
  assert.equal(
    longHold([
      { name: 'chicken wings', holdMin: 35, limitMin: 30 },
      { name: 'chicken breasts', holdMin: 25, limitMin: 20 },
    ]),
    'Long hold: chicken wings 35 min (limit 30), chicken breasts 25 min (limit 20).',
  );
  // Both written in whole hours: the same.
  assert.equal(
    longHold([
      { name: 'brisket', holdMin: 300, limitMin: 240 },
      { name: 'pork butt', holdMin: 360, limitMin: 240 },
    ]),
    'Long hold: brisket 5 hr (limit 4), pork butt 6 hr (limit 4).',
  );
});

test('long hold, several foods: the limit keeps its unit when the hold is not written in that one unit', () => {
  assert.equal(
    longHold([
      { name: 'brisket', holdMin: 370, limitMin: 240 },
      { name: 'chicken wings', holdMin: 65, limitMin: 30 },
      { name: 'whole turkey', holdMin: 45, limitMin: 60 },
      { name: 'St. Louis ribs', holdMin: 120, limitMin: 90 },
    ]),
    'Long hold: brisket 6 hr 10 min (limit 4 hr), chicken wings 1 hr 5 min (limit 30 min), whole turkey 45 min (limit 1 hr), St. Louis ribs 2 hr (limit 1 hr 30 min).',
  );
});
