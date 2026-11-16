// data/foods.json against the schema in engine/rules.ts: every field the planner reads without a fallback
// must be present, so a rules edit fails here instead of planning NaN minutes on the phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMethod, type RuleFood, type Rules } from './rules.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8')) as Rules;
const KINDS = ['perWeight', 'perWeightMinutes', 'fixedScaled', 'byOption', 'byOptionScaled', 'phases'];

test('rules: every method resolves with the fields the planner needs', () => {
  for (const food of rules.foods) {
    for (const raw of food.methods) {
      const m = resolveMethod(food, raw);
      const where = `${food.id}/${m.id}`;
      assert.ok(KINDS.includes(m.timing?.kind), `${where}: timing.kind`);
      assert.ok(m.phases?.length, `${where}: phases`);
      assert.ok(m.pull?.label, `${where}: pull.label`);
      assert.equal(typeof m.holdLimitMin, 'number', `${where}: holdLimitMin`);
      assert.ok(m.restMin && m.restMin.min <= m.restMin.default, `${where}: restMin`);
      // A hold note has its inline form for the several-foods line: "(limit 4 hr, keep above 140F)".
      if (m.holdNote != null) {
        assert.equal(typeof m.holdNoteInline, 'string', `${where}: holdNoteInline`);
        assert.match(m.holdNoteInline ?? '', /^[a-z].*[^.]$/, `${where}: holdNoteInline lower case, no full stop`);
      }
      if (m.timing.kind === 'perWeight') assert.equal(typeof m.timing.hrPerLbAt225, 'number', `${where}: hrPerLbAt225`);
      if (m.timing.kind === 'perWeightMinutes')
        assert.ok(m.timing.minMinutes != null && m.timing.minPerLbAt225 != null, `${where}: perWeightMinutes`);
      if (m.timing.kind === 'byOption' || m.timing.kind === 'byOptionScaled') {
        const opt = m.options[m.timing.option ?? ''];
        assert.ok(opt, `${where}: timing.option`);
        for (const [id, c] of Object.entries(opt.choices))
          assert.equal(typeof c.minutes?.[m.cooker], 'number', `${where}: ${id}.minutes.${m.cooker}`);
      }
      for (const p of m.phases) {
        const timed = p.fraction != null || m.timing.kind === 'byOption' || m.timing.kind === 'byOptionScaled';
        assert.ok(timed || typeof p.fixedMin === 'number', `${where}/${p.id}: fraction or fixedMin`);
        assert.ok(p.temp === 'pit' || typeof p.temp === 'number', `${where}/${p.id}: temp`);
      }
      for (const [key, opt] of Object.entries(m.options)) {
        assert.ok(opt.choices[opt.default], `${where}: ${key} default is a choice`);
        if (key === 'wrap')
          for (const c of Object.values(opt.choices)) assert.equal(typeof c.timeFactor, 'number', `${where}: wrap`);
        if (key === 'thickness')
          for (const c of Object.values(opt.choices)) assert.equal(c.pullF?.length, 2, `${where}: thickness pullF`);
      }
    }
  }
});

test('rules: shared fields fill in a method, the method wins, options merge by key', () => {
  const food = {
    id: 'f',
    name: 'F',
    group: 'G',
    quantity: { kind: 'weight' as const, unit: 'lb', default: 1, min: 1, max: 2, step: 1 },
    shared: {
      holdLimitMin: 60,
      sliceMin: 5,
      options: { a: { label: 'A', default: 'x', choices: { x: { label: 'X' } } } },
    },
    methods: [
      {
        id: 'm',
        label: 'M',
        cooker: 'smoker' as const,
        sliceMin: 10,
        options: { b: { label: 'B', default: 'y', choices: { y: { label: 'Y' } } } },
      },
    ],
  };
  const m = resolveMethod(food, food.methods[0]);
  assert.equal(m.holdLimitMin, 60);
  assert.equal(m.sliceMin, 10);
  assert.deepEqual(Object.keys(m.options).sort(), ['a', 'b']);
});

// T-059: a food-safety number never ships without its source. A food is checked when it has a `sources`
// list or a smoker temp floor; turkey must be one of them.
const FSIS = 'USDA FSIS (fsis.usda.gov), read by Jason 2026-11-15';

/** The food-safety numbers a food carries that no source covers. */
function unsourced(food: RuleFood): string[] {
  const needs = new Set<string>();
  for (const raw of food.methods) {
    const m = resolveMethod(food, raw);
    if (m.pull?.tempF) needs.add('doneTemp');
    if (m.minPitTempF != null) needs.add('minPitTemp');
    if (m.sizeNote) needs.add('size');
    if (m.timing?.hrPerLbAt225 != null || m.timing?.minPerLbAt225 != null) needs.add('rate');
  }
  const covered = new Set<string>(
    (food.sources ?? []).filter(s => s.cite?.trim() && s.says?.trim()).flatMap(s => s.covers ?? []),
  );
  return [...needs].filter(n => !covered.has(n)).sort();
}

test('rules: the turkey size note (over 16 lb) has its own source, and fails the check without one', () => {
  const turkey = rules.foods.find(f => f.id === 'turkey')!;
  const m = resolveMethod(turkey, turkey.methods[0]);
  assert.deepEqual(m.sizeNote, { aboveLb: 16, text: 'USDA recommends 16 lb or less for safe smoking.' });
  const src = turkey.sources!.find(s => s.covers.includes('size'))!;
  assert.match(src.cite, /USDA FSIS/);
  assert.equal(src.says, 'Turkeys 16 pounds or less are the recommended size for safe smoking.');
  assert.deepEqual(unsourced(turkey), []);
  const without = turkey.sources!.filter(s => !s.covers.includes('size'));
  assert.deepEqual(unsourced({ ...turkey, sources: without }), ['size']);
});

test('rules: turkey cites a source for its done temp, smoker temp floor and rate', () => {
  const checked = rules.foods.filter(f => f.sources || f.methods.some(m => resolveMethod(f, m).minPitTempF != null));
  assert.ok(
    checked.some(f => f.id === 'turkey'),
    'turkey is in the rules and is checked',
  );
  for (const f of checked) assert.deepEqual(unsourced(f), [], `${f.id}: food-safety numbers with no source`);

  const turkey = rules.foods.find(f => f.id === 'turkey')!;
  const m = resolveMethod(turkey, turkey.methods[0]);
  assert.deepEqual(m.pull.tempF, [165, 165]);
  assert.equal(m.minPitTempF, 225);
  assert.equal(m.timing.hrPerLbAt225, 0.5);
  assert.deepEqual(m.timing.rangeAt225, [0.33, 0.5]);
  assert.deepEqual(m.restMin, { default: 30, min: 20 });
  const fsis = turkey.sources!.find(s => s.cite === FSIS);
  assert.ok(fsis, 'the FSIS source is cited exactly');
  for (const n of ['doneTemp', 'minPitTemp', 'rate'] as const) assert.ok(fsis.covers.includes(n), `FSIS covers ${n}`);
  assert.ok(
    turkey.sources!.some(s => s.cite === 'Jason, 2026-11-15' && s.covers.includes('rest')),
    "Jason's numbers are cited",
  );
  assert.equal(turkey.methods.length, 1, 'one method: no stuffed or spatchcock choice');
  assert.deepEqual(m.options, {}, 'no options');
});

test('rules: the sources check fails when a number loses its source', () => {
  const turkey = rules.foods.find(f => f.id === 'turkey')!;
  const all = ['doneTemp', 'minPitTemp', 'rate', 'size'];
  assert.deepEqual(unsourced({ ...turkey, sources: [] }), all);
  assert.deepEqual(unsourced({ ...turkey, sources: turkey.sources!.map(s => ({ ...s, cite: ' ' })) }), all);
  const noFloor = turkey.sources!.map(s => ({ ...s, covers: s.covers.filter(c => c !== 'minPitTemp') }));
  assert.deepEqual(unsourced({ ...turkey, sources: noFloor }), ['minPitTemp']);
});
