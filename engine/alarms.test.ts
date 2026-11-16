import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan } from './plan.ts';
import { shiftRemaining } from './live.ts';
import { alarmsFromPlan, eventKey } from './alarms.ts';
import type { Plan, PlanEvent, PlanInput, SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const MIN = 60_000;
const SERVE = Date.UTC(2026, 10, 14, 22, 0);
const local = (h: number, m: number) => Date.UTC(2026, 10, 14, h + 5, m);

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
const input: PlanInput = {
  mode: 'readyBy',
  at: SERVE,
  pitTempF: 225,
  rateOverrides: { brisket: 0.75 },
  cookers: {
    smoker: pitBoss,
    griddle: { id: 'g', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 },
  },
  items: [
    { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
    { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
    { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
  ],
};

const ev = (over: Partial<PlanEvent>): PlanEvent => ({
  id: 'x',
  at: 0,
  kind: 'phase',
  label: 'L',
  alarm: true,
  checkStep: false,
  critical: false,
  ...over,
});
const planWith = (events: PlanEvent[]): Plan => ({
  serveAt: 0,
  pitTempF: 225,
  items: [],
  events,
  warnings: [],
  fireAt: null,
  pitOffAt: null,
  griddleOnAt: null,
  pelletsLb: 0,
  peakFootprintSqIn: 0,
});

test('every alarm event in the future becomes an alarm; non-alarm and past events do not', () => {
  const p = buildPlan(rules, input);
  const now = local(6, 0);
  const alarms = alarmsFromPlan(p, now);
  const expected = p.events.filter(e => e.alarm && e.at > now);
  const covered = alarms.flatMap(a => a.keys);
  assert.equal(covered.length, expected.length);
  for (const e of expected) assert.ok(covered.includes(eventKey(e)), e.label);
  assert.ok(!alarms.some(a => a.at <= now));
  assert.ok(
    alarms.every((a, i) => i === 0 || alarms[i - 1].at < a.at),
    'sorted, one alarm per minute',
  );
});

test('two alarms in the same minute become one notification listing both', () => {
  const t = local(15, 40);
  const p = planWith([
    ev({ id: 'e1', at: t, kind: 'pull', itemId: 'b', label: 'Pull the brisket.', critical: true }),
    ev({ id: 'e2', at: t + 20_000, kind: 'phase', itemId: 'w', phaseId: 'smoke', label: 'Wings on.' }),
    ev({ id: 'e3', at: t + MIN, kind: 'serve', label: 'Serve.' }),
  ]);
  const a = alarmsFromPlan(p, 0, id => (({ b: 'Brisket', w: 'Chicken wings' }) as Record<string, string>)[id]);
  assert.equal(a.length, 2);
  assert.equal(a[0].at, t);
  assert.equal(a[0].title, 'Brisket + Chicken wings');
  assert.equal(a[0].body, 'Pull the brisket.\nWings on.');
  assert.equal(a[0].critical, true);
  assert.deepEqual(a[0].keys, ['pull:b:', 'phase:w:smoke']);
  assert.equal(a[1].title, 'Time to serve');
});

// T-074 (Jason, 2026-11-16): the Serve alert read "Serve" / "Serve." Title "Time to serve", text the menu
// with plain names, each once. The serve step's own label ("Serve.", read on Live cook) does not change.
const item = (id: string, foodId: string, quantity: number) => {
  const f = rules.foods.find((x: { id: string }) => x.id === foodId);
  return { id, foodId, methodId: f.methods[0].id, quantity };
};
const serveAlarm = (items: PlanInput['items']) => {
  const p = buildPlan(rules, { ...input, items });
  const serve = p.events.find(e => e.kind === 'serve')!;
  assert.equal(serve.label, 'Serve.');
  return alarmsFromPlan(p, 0).find(a => a.keys.includes(eventKey(serve)))!;
};

test('the Serve alert: title Time to serve, text the menu (one food)', () => {
  const a = serveAlarm([item('b', 'brisket', 12)]);
  assert.equal(a.title, 'Time to serve');
  assert.equal(a.body, 'Brisket.');
});

test('the Serve alert: two foods are joined with and', () => {
  const a = serveAlarm([item('b', 'brisket', 12), item('w', 'wings', 2)]);
  assert.equal(a.title, 'Time to serve');
  assert.equal(a.body, 'Brisket and chicken wings.');
});

test('the Serve alert: three foods in menu order, commas then and', () => {
  const a = serveAlarm([item('b', 'brisket', 12), item('w', 'wings', 2), item('c', 'breasts', 4)]);
  assert.equal(a.title, 'Time to serve');
  assert.equal(a.body, 'Brisket, chicken wings and chicken breasts.');
});

test('the Serve alert: two of the same food are named once, by the plain name, not the labels', () => {
  const a = serveAlarm([item('b1', 'brisket', 11.5), item('w', 'wings', 2), item('b2', 'brisket', 6)]);
  assert.equal(a.title, 'Time to serve');
  assert.equal(a.body, 'Brisket and chicken wings.');
  const b = serveAlarm([item('b1', 'brisket', 11.5), item('b2', 'brisket', 6)]);
  assert.equal(b.body, 'Brisket.');
});

test('the Serve alert: St. Louis ribs keep their capitals inside the sentence and first', () => {
  assert.equal(serveAlarm([item('b', 'brisket', 12), item('r', 'stlribs', 2)]).body, 'Brisket and St. Louis ribs.');
  assert.equal(serveAlarm([item('r', 'stlribs', 2), item('t', 'turkey', 12)]).body, 'St. Louis ribs and whole turkey.');
});

test('the Serve alert with no foods on the plan keeps the step text', () => {
  const [a] = alarmsFromPlan(planWith([ev({ at: 5 * MIN, kind: 'serve', label: 'Serve.' })]), 0);
  assert.equal(a.title, 'Time to serve');
  assert.equal(a.body, 'Serve.');
});

test('a single alarm uses the food name as title and the step as body', () => {
  const p = planWith([ev({ at: 5 * MIN, kind: 'fire', label: 'Fire the smoker to 225F.', critical: true })]);
  const [a] = alarmsFromPlan(p, 0);
  assert.equal(a.title, 'Smoker');
  assert.equal(a.body, 'Fire the smoker to 225F.');
});

test('step keys stay the same after a live shift, so an overdue nag survives a reschedule', () => {
  // Groups can regroup when steps move minutes; the native side tracks nags per step key.
  const p = buildPlan(rules, input);
  const now = local(6, 0);
  const before = alarmsFromPlan(p, now).flatMap(a => a.keys);
  const later = shiftRemaining(rules, input, p, now, 15, true);
  const after = alarmsFromPlan(later, now).flatMap(a => a.keys);
  assert.deepEqual(new Set(after), new Set(before));
});

test('repeated steps of the same kind (two hopper refills) get distinct keys', () => {
  const p = planWith([
    ev({ at: 10 * MIN, kind: 'refill', label: 'Top off the hopper.' }),
    ev({ at: 400 * MIN, kind: 'refill', label: 'Top off the hopper.' }),
  ]);
  const keys = alarmsFromPlan(p, 0).flatMap(a => a.keys);
  assert.deepEqual(keys, ['refill::', 'refill::#2']);
});
