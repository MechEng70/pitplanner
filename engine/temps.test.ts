import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settableTemps, isSettable } from './temps.ts';
import { buildPlan, onHeatSpan } from './plan.ts';
import type { SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const MIN = 60_000;

const pitBoss: SmokerProfile = { id: 'pb820', name: 'Pit Boss 820', type: 'pellet', tempStepF: 5, minTempF: 180, maxTempF: 500,
  hopperLb: 21, mainGrateSqIn: 593, upperRackSqIn: 256, pelletLbPerHrLow: 1.5, pelletLbPerHrHigh: 3, preheatMin: 20 };
const dial: SmokerProfile = { ...pitBoss, id: 'dial', tempStepF: null, tempPresetsF: [180, 200, 225, 250, 300, 350, 400, 450, 500] };

test('settableTemps: 5F steps inside the trusted range by default', () => {
  const t = settableTemps(pitBoss, [200, 300]);
  assert.equal(t[0], 200);
  assert.equal(t[t.length - 1], 300);
  assert.equal(t.length, 21);
  assert.ok(t.includes(225));
});

test('settableTemps: no range gives the full cooker range', () => {
  const t = settableTemps(pitBoss);
  assert.equal(t[0], 180);
  assert.equal(t[t.length - 1], 500);
});

test('settableTemps: steps count from the cooker minimum', () => {
  const odd: SmokerProfile = { ...pitBoss, minTempF: 172, tempStepF: 10 };
  assert.deepEqual(settableTemps(odd, [200, 230]), [202, 212, 222]);
});

test('settableTemps: preset cookers only offer their presets', () => {
  assert.deepEqual(settableTemps(dial, [200, 300]), [200, 225, 250, 300]);
});

test('isSettable agrees with TEMP_NOT_SETTABLE', () => {
  assert.equal(isSettable(pitBoss, 225), true);
  assert.equal(isSettable(pitBoss, 227), false);
  assert.equal(isSettable(pitBoss, 505), false);
  assert.equal(isSettable(dial, 275), false);
  assert.equal(isSettable(dial, 250), true);
});

test('onHeatSpan: first phase start to off-heat, matches the Plan cards', () => {
  const serve = Date.UTC(2026, 10, 14, 22, 0);
  const p = buildPlan(rules, {
    mode: 'readyBy', at: serve, pitTempF: 225, rateOverrides: { brisket: 0.75 },
    cookers: { smoker: pitBoss, griddle: { id: 'g', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 } },
    items: [
      { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
      { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
      { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
    ],
  });
  const b = onHeatSpan(p.items[0]);
  assert.equal(b.minutes, 9 * 60);
  assert.equal(b.end - b.start, 9 * 60 * MIN);
  assert.equal(onHeatSpan(p.items[1]).minutes, 100);
  assert.equal(onHeatSpan(p.items[2]).minutes, 12);
});
