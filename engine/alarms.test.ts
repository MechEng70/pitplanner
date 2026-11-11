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

const pitBoss: SmokerProfile = { id: 'pb820', name: 'Pit Boss 820', type: 'pellet', tempStepF: 5, minTempF: 180, maxTempF: 500,
  hopperLb: 21, mainGrateSqIn: 593, upperRackSqIn: 256, pelletLbPerHrLow: 1.5, pelletLbPerHrHigh: 3, preheatMin: 20 };
const input: PlanInput = {
  mode: 'readyBy', at: SERVE, pitTempF: 225, rateOverrides: { brisket: 0.75 },
  cookers: { smoker: pitBoss, griddle: { id: 'g', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 } },
  items: [
    { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
    { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
    { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
  ],
};

const ev = (over: Partial<PlanEvent>): PlanEvent => ({ id: 'x', at: 0, kind: 'phase', label: 'L', alarm: true, checkStep: false, critical: false, ...over });
const planWith = (events: PlanEvent[]): Plan => ({ serveAt: 0, pitTempF: 225, items: [], events, warnings: [], fireAt: null, pitOffAt: null, griddleOnAt: null, pelletsLb: 0, peakFootprintSqIn: 0 });

test('every alarm event in the future becomes an alarm; non-alarm and past events do not', () => {
  const p = buildPlan(rules, input);
  const now = local(6, 0);
  const alarms = alarmsFromPlan(p, now);
  const expected = p.events.filter(e => e.alarm && e.at > now);
  const covered = alarms.flatMap(a => a.keys);
  assert.equal(covered.length, expected.length);
  for (const e of expected) assert.ok(covered.includes(eventKey(e)), e.label);
  assert.ok(!alarms.some(a => a.at <= now));
  assert.ok(alarms.every((a, i) => i === 0 || alarms[i - 1].at < a.at), 'sorted, one alarm per minute');
});

test('two alarms in the same minute become one notification listing both', () => {
  const t = local(15, 40);
  const p = planWith([
    ev({ id: 'e1', at: t, kind: 'pull', itemId: 'b', label: 'Pull the brisket.', critical: true }),
    ev({ id: 'e2', at: t + 20_000, kind: 'phase', itemId: 'w', phaseId: 'smoke', label: 'Wings on.' }),
    ev({ id: 'e3', at: t + MIN, kind: 'serve', label: 'Serve.' }),
  ]);
  const a = alarmsFromPlan(p, 0, id => ({ b: 'Brisket', w: 'Chicken wings' } as Record<string, string>)[id]);
  assert.equal(a.length, 2);
  assert.equal(a[0].at, t);
  assert.equal(a[0].title, 'Brisket + Chicken wings');
  assert.equal(a[0].body, 'Pull the brisket.\nWings on.');
  assert.equal(a[0].critical, true);
  assert.deepEqual(a[0].keys, ['pull:b:', 'phase:w:smoke']);
  assert.equal(a[1].title, 'Serve');
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
