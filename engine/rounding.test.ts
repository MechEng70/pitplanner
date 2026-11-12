import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan } from './plan.ts';
import type { PlanInput, SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const MIN = 60_000;
const STEP = 5 * MIN;
const SERVE = Date.UTC(2026, 10, 14, 22, 0);

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

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  mode: 'readyBy',
  at: SERVE,
  pitTempF: 235,
  cookers: {
    smoker: pitBoss,
    griddle: { id: 'g', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 },
  },
  rateOverrides: { brisket: 0.75 },
  items: [
    { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12.5, options: { wrap: 'paper' }, restMin: 60 },
    { id: 'r', foodId: 'stlribs', methodId: '321', quantity: 2 },
    { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
    { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'whole' } },
  ],
  ...over,
});

const onGrid = (t: number) => t % STEP === 0;

test('starts land on 5-minute steps; off-heat stays serve minus slice minus rest', () => {
  const p = buildPlan(rules, input());
  for (const it of p.items) {
    for (const ph of it.phases)
      assert.ok(onGrid(ph.start), `${it.input.id}/${ph.id} start ${new Date(ph.start).toISOString()}`);
    // Mockup 10: breasts with an 8 min rest are "off 4:52 PM", not rounded.
    assert.equal(it.finish, SERVE - (it.sliceMin + it.restMin) * MIN - it.extraHoldMin * MIN);
  }
  assert.ok(onGrid(p.fireAt!));
  assert.ok(onGrid(p.griddleOnAt!));
  for (const e of p.events.filter(e => ['fire', 'setPit', 'griddleOn', 'phase', 'refill'].includes(e.kind)))
    assert.ok(onGrid(e.at), `${e.kind} ${e.label}`);
});

test('rounding never shortens a cook and moves each boundary by under 5 min', () => {
  const tol = 1 / 60; // 1 second of float noise, in minutes
  const p = buildPlan(rules, input());
  for (const it of p.items) {
    const planned = it.phases.reduce((a, ph) => a + ph.minutes, 0);
    const actual = (it.phases[it.phases.length - 1].end - it.phases[0].start) / MIN;
    assert.ok(actual >= planned - tol, `${it.input.id} shortened: ${actual} < ${planned}`);
    assert.ok(actual < planned + 5, `${it.input.id} stretched: ${actual} vs ${planned}`);
    // Each boundary sits at most 5 min before where the exact plan would put it.
    let exact = it.phases[it.phases.length - 1].end;
    for (let i = it.phases.length - 1; i >= 0; i--) {
      exact -= it.phases[i].minutes * MIN;
      const drift = (exact - it.phases[i].start) / MIN;
      assert.ok(drift > -tol && drift < 5, `${it.input.id}/${it.phases[i].id} drift ${drift}`);
    }
  }
});

test('an off-grid serve time keeps the serve time and still puts phase starts on the grid', () => {
  const serve = SERVE + 3 * MIN; // 5:03 PM
  const p = buildPlan(rules, input({ at: serve }));
  assert.equal(p.serveAt, serve);
  for (const it of p.items) for (const ph of it.phases) assert.ok(onGrid(ph.start), `${it.input.id}/${ph.id}`);
  assert.ok(onGrid(p.fireAt!));
});

test('start-at mode lands the first action on the chosen time and keeps the grid', () => {
  const start = Date.UTC(2026, 10, 14, 11, 0);
  const p = buildPlan(rules, input({ mode: 'startAt', at: start }));
  assert.equal(p.fireAt, start);
  for (const it of p.items) for (const ph of it.phases) assert.ok(onGrid(ph.start), `${it.input.id}/${ph.id}`);
});
