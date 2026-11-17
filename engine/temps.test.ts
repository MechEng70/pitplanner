import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settableTemps, isSettable } from './temps.ts';
import { fToC, isCelsiusStep, showSetPoint, showStep, showTemp } from './units.ts';
import { buildPlan, onHeatSpan } from './plan.ts';
import type { SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const MIN = 60_000;

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
const dial: SmokerProfile = {
  ...pitBoss,
  id: 'dial',
  tempStepF: null,
  tempPresetsF: [180, 200, 225, 250, 300, 350, 400, 450, 500],
};

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

// T-082 (Jason, 2026-11-17): the settable temps start at the first multiple of the step at or above the
// lowest temp, not at the lowest temp itself. This replaced "steps count from the cooker minimum"
// (172F with 10F steps gave 202, 212, 222).
test('settableTemps: a 25F step from 180F gives 200, 225, 250 (multiples of the step)', () => {
  const s: SmokerProfile = { ...pitBoss, tempStepF: 25 };
  assert.deepEqual(settableTemps(s).slice(0, 3), [200, 225, 250]);
  assert.deepEqual(settableTemps(s, [200, 300]), [200, 225, 250, 275, 300]);
  assert.equal(settableTemps(s).at(-1), 500);
});

test('settableTemps: 5F, 10F and 15F from 180F are unchanged (180 is a multiple of each)', () => {
  assert.deepEqual(settableTemps({ ...pitBoss, tempStepF: 5 }).slice(0, 4), [180, 185, 190, 195]);
  assert.deepEqual(settableTemps({ ...pitBoss, tempStepF: 10 }).slice(0, 4), [180, 190, 200, 210]);
  assert.deepEqual(settableTemps({ ...pitBoss, tempStepF: 15 }).slice(0, 4), [180, 195, 210, 225]);
});

test('settableTemps: a minimum off the step starts at the next multiple', () => {
  const odd: SmokerProfile = { ...pitBoss, minTempF: 172, tempStepF: 10 };
  assert.deepEqual(settableTemps(odd, [200, 230]), [200, 210, 220, 230]);
  assert.equal(settableTemps(odd)[0], 180);
});

test('settableTemps: a Celsius step counts its multiples in C (5C from 180F = 82.2C starts at 85C)', () => {
  const c5: SmokerProfile = { ...pitBoss, tempStepF: 9 }; // 5C
  const t = settableTemps(c5);
  assert.deepEqual(t.slice(0, 3), [185, 194, 203]); // 85C, 90C, 95C
  assert.deepEqual(
    t.slice(0, 3).map(f => fToC(f)),
    [85, 90, 95],
  );
  for (const f of t) assert.equal(fToC(f) % 5, 0);
  assert.equal(t.at(-1), 500); // 260C
  const c25: SmokerProfile = { ...pitBoss, tempStepF: 45 }; // 25C
  assert.deepEqual(
    settableTemps(c25).map(f => fToC(f)),
    [100, 125, 150, 175, 200, 225, 250],
  );
  const c10: SmokerProfile = { ...pitBoss, tempStepF: 18 }; // 10C
  assert.deepEqual(settableTemps(c10, [200, 300]), [212, 230, 248, 266, 284]); // 100C to 140C
});

test('isCelsiusStep: a stored F step that is a whole number of 5C (9F each)', () => {
  for (const f of [9, 18, 27, 36, 45, 90]) assert.equal(isCelsiusStep(f), true, `${f}F`);
  for (const f of [1, 2, 4, 5, 10, 15, 20, 25, 50]) assert.equal(isCelsiusStep(f), false, `${f}F`);
  assert.equal(isCelsiusStep(null), false);
  assert.equal(isCelsiusStep(0), false);
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

test('isSettable agrees with settableTemps for F and C steps and odd minimums', () => {
  const smokers: SmokerProfile[] = [
    pitBoss,
    { ...pitBoss, tempStepF: 10 },
    { ...pitBoss, tempStepF: 15 },
    { ...pitBoss, tempStepF: 25 },
    { ...pitBoss, tempStepF: 9 },
    { ...pitBoss, tempStepF: 18 },
    { ...pitBoss, tempStepF: 27 },
    { ...pitBoss, tempStepF: 45 },
    { ...pitBoss, minTempF: 172, tempStepF: 10 },
    { ...pitBoss, minTempF: 176, tempStepF: 9 },
    dial,
  ];
  for (const s of smokers) {
    const grid = new Set(settableTemps(s));
    for (let f = 150; f <= 520; f++) assert.equal(isSettable(s, f), grid.has(f), `${s.tempStepF}F step, ${f}F`);
  }
  // The grid of a 25F step from 180F: 180 and 205 are not settings any more.
  const s25: SmokerProfile = { ...pitBoss, tempStepF: 25 };
  assert.equal(isSettable(s25, 180), false);
  assert.equal(isSettable(s25, 205), false);
  assert.equal(isSettable(s25, 225), true);
});

// T-082 answer 9A: a step change keeps the plan's temp; one that is off the new grid gets the existing
// warning, no snapping.
test('a plan temp off the grid after a step change keeps its temp and warns TEMP_NOT_SETTABLE', () => {
  const at = Date.UTC(2026, 10, 14, 22, 0);
  const input = {
    mode: 'readyBy' as const,
    at,
    pitTempF: 225,
    cookers: { smoker: pitBoss },
    items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' } }],
  };
  const before = buildPlan(rules, input);
  assert.equal(
    before.warnings.some(w => w.code === 'TEMP_NOT_SETTABLE'),
    false,
  );
  for (const step of [10, 9]) {
    const p = buildPlan(rules, { ...input, cookers: { smoker: { ...pitBoss, tempStepF: step } } });
    assert.equal(p.pitTempF, 225, `${step}F step`);
    const w = p.warnings.filter(x => x.code === 'TEMP_NOT_SETTABLE');
    assert.equal(w.length, 1, `${step}F step`);
    assert.equal(w[0]!.message, 'Pit Boss 820 cannot be set to 225F.');
  }
});

test('onHeatSpan: first phase start to off-heat, matches the Plan cards', () => {
  const serve = Date.UTC(2026, 10, 14, 22, 0);
  const p = buildPlan(rules, {
    mode: 'readyBy',
    at: serve,
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
  });
  const b = onHeatSpan(p.items[0]);
  assert.equal(b.minutes, 9 * 60);
  assert.equal(b.end - b.start, 9 * 60 * MIN);
  assert.equal(onHeatSpan(p.items[1]).minutes, 100);
  assert.equal(onHeatSpan(p.items[2]).minutes, 12);
});

test('localizeText: F and lb inside rules and engine text follow the user units', async () => {
  const { localizeText } = await import('./units.ts');
  assert.equal(localizeText('Check tenderness: pull at 200-205F.', 'F', 'lb'), 'Check tenderness: pull at 200-205F.');
  assert.equal(localizeText('Check tenderness: pull at 200-205F.', 'C', 'lb'), 'Check tenderness: pull at 93-96C.');
  assert.equal(localizeText('Fire the smoker to 225F.', 'C', 'lb'), 'Fire the smoker to 108C.');
  assert.equal(localizeText('Confirm 165F in the thickest part.', 'C', 'lb'), 'Confirm 74C in the thickest part.');
  assert.equal(localizeText('400F', 'C', 'lb'), '204C');
  assert.equal(
    localizeText('About 26 lb of pellets, more than the 21 lb hopper. 0.75 hr/lb.', 'F', 'kg'),
    'About 11.8 kg of pellets, more than the 9.5 kg hopper. 0.75 hr/lb.',
  );
  assert.equal(localizeText('PB850SPW2 at 5 min', 'C', 'kg'), 'PB850SPW2 at 5 min');
});

// Jason, 2026-11-14: set points show in 2C increments (they were 5C, and the smoker's 5F steps are 2.8C
// apart, so 220F and 225F both read 105C and the temp menu had rows that looked the same).
test('Celsius set points show to the nearest 2C, so every 5F step reads differently', () => {
  assert.equal(showTemp(220, 'C', true), '104C');
  assert.equal(showTemp(225, 'C', true), '108C');
  assert.equal(showTemp(230, 'C', true), '110C');
  const shown: string[] = [];
  for (let f = 180; f <= 500; f += 5) shown.push(showTemp(f, 'C', true));
  assert.equal(new Set(shown).size, shown.length);
  for (const s of shown) assert.equal(Number(s.slice(0, -1)) % 2, 0);
  // Fahrenheit is unchanged, and so are temps that are not set points.
  assert.equal(showTemp(225, 'F', true), '225F');
  assert.equal(showTemp(165, 'C'), '74C');
});

// T-082 (Jason, 2026-11-17): with a Celsius step the set points read as the grid's exact C values; every
// other smoker keeps the 2C rounding of 2026-11-14.
test('showSetPoint: a Celsius step shows exact C; other steps keep the 2C rounding', () => {
  // 5C step: 185F, 194F, 203F are 85C, 90C, 95C (the 2C rule would read 86C, 90C, 94C).
  assert.deepEqual(
    [185, 194, 203].map(f => showSetPoint(f, 'C', 9)),
    ['85C', '90C', '95C'],
  );
  assert.equal(showSetPoint(212, 'C', 45), '100C');
  // A 5F smoker in Celsius: exactly showTemp(setPoint).
  for (let f = 180; f <= 500; f += 5) assert.equal(showSetPoint(f, 'C', 5), showTemp(f, 'C', true));
  assert.equal(showSetPoint(185, 'C', 5), '86C');
  // Fixed settings, no step: the 2C rule too.
  assert.equal(showSetPoint(185, 'C', null), '86C');
  // Fahrenheit is as stored whatever the step.
  assert.equal(showSetPoint(185, 'F', 9), '185F');
  assert.equal(showSetPoint(225, 'F', 25), '225F');
  // Off the C grid (a plan kept after a step change) it reads to the whole degree.
  assert.equal(showSetPoint(225, 'C', 9), '107C');
});

test('showStep: a step in the display unit', () => {
  assert.equal(showStep(5, 'F'), '5F');
  assert.equal(showStep(25, 'F'), '25F');
  assert.equal(showStep(9, 'C'), '5C');
  assert.equal(showStep(45, 'C'), '25C');
  assert.equal(showStep(5, 'C'), '2.8C');
  assert.equal(showStep(20, 'C'), '11.1C');
  assert.equal(showStep(9, 'F'), '9F');
});
