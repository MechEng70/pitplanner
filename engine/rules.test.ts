// data/foods.json against the schema in engine/rules.ts: every field the planner reads without a fallback
// must be present, so a rules edit fails here instead of planning NaN minutes on the phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMethod, type Rules } from './rules.ts';

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
