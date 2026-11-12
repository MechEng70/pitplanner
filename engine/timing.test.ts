// Timing steppers (HA-INTEGRATION "Do first" 1a and 1b): 0.05 hr/lb steps, hard limits 0.3-2.5 hr/lb,
// soft warning outside 0.5-1.6, and total-hours steps. Limits come from data/foods.json `learning`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rateShown, rateUnusual, roundHours, stepHours, stepRate, HOURS_MAX, HOURS_MIN } from '../src/lib/timing.ts';
import type { Rules } from './rules.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8')) as Rules;
const { rateLimits, rateHint } = rules.learning;
const lb = { temp: 'F', weight: 'lb' } as const;
const kg = { temp: 'C', weight: 'kg' } as const;

test('timing: the rules file holds the agreed limits', () => {
  assert.deepEqual(rateLimits, [0.3, 2.5]);
  assert.deepEqual(rateHint, [0.5, 1.6]);
});

test('timing: hr/lb steps by 0.05 and stops at the hard limits', () => {
  assert.equal(stepRate(0.75, 1, lb, rateLimits), 0.8);
  assert.equal(stepRate(0.75, -1, lb, rateLimits), 0.7);
  assert.equal(stepRate(1.67, -1, lb, rateLimits), 1.65); // off-grid published rate snaps toward the tap
  assert.equal(stepRate(1.67, 1, lb, rateLimits), 1.7);
  assert.equal(stepRate(0.3, -1, lb, rateLimits), 0.3);
  assert.equal(stepRate(2.5, 1, lb, rateLimits), 2.5);
});

test('timing: in kg the shown hr/kg moves by 0.05 and is stored back as hr/lb', () => {
  const next = stepRate(0.75, 1, kg, rateLimits);
  assert.ok(Math.abs(rateShown(next, kg) - (rateShown(0.75, kg) + 0.05)) < 1e-9);
});

test('timing: outside 0.5-1.6 hr/lb warns, never blocks', () => {
  assert.equal(rateUnusual(0.5, rateHint), false);
  assert.equal(rateUnusual(1.6, rateHint), false);
  assert.equal(rateUnusual(0.45, rateHint), true);
  assert.equal(rateUnusual(1.65, rateHint), true);
  assert.equal(stepRate(0.5, -1, lb, rateLimits), 0.45); // the stepper still goes there
});

test('timing: total hours step by 0.25 within 0.25-36 and round from minutes', () => {
  assert.equal(stepHours(9, 1), 9.25);
  assert.equal(stepHours(HOURS_MIN, -1), HOURS_MIN);
  assert.equal(stepHours(HOURS_MAX, 1), HOURS_MAX);
  assert.equal(roundHours(540), 9);
  assert.equal(roundHours(547), 9.0);
  assert.equal(roundHours(553), 9.25);
});
