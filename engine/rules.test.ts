// data/foods.json against the schema in engine/rules.ts: every field the planner reads without a fallback
// must be present, so a rules edit fails here instead of planning NaN minutes on the phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  firstDoableMethod,
  methodCookers,
  missingCookers,
  resolveMethod,
  smokerReachF,
  smokerTooCool,
  type RuleFood,
  type RuleSource,
  type Rules,
  type SourceTopic,
} from './rules.ts';
import type { Cookers } from './types.ts';

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

/** A source backs the methods it names, or every method of its food when it names none (T-075). */
const backs = (s: RuleSource, methodId: string) => !s.methods || s.methods.includes(methodId);

/**
 * The food-safety and cooking numbers a food carries that no source covers. A method is checked when a source
 * backs it or it has a smoker temp floor; each of its numbers needs a source that backs that method.
 */
function unsourced(food: RuleFood): string[] {
  const sources = (food.sources ?? []).filter(s => s.cite?.trim() && s.says?.trim());
  const missing = new Set<string>();
  for (const raw of food.methods) {
    const m = resolveMethod(food, raw);
    if (!(food.sources ?? []).some(s => backs(s, m.id)) && m.minPitTempF == null) continue;
    const needs = new Set<SourceTopic>();
    if (m.pull?.tempF) needs.add('doneTemp');
    if (m.minPitTempF != null) needs.add('minPitTemp');
    if (m.sizeNote) needs.add('size');
    if (m.timing?.hrPerLbAt225 != null || m.timing?.minPerLbAt225 != null) needs.add('rate');
    if (m.phases.some(p => p.setsPit)) needs.add('preheat');
    if (m.phases.some(p => typeof p.temp === 'number')) needs.add('highHeat');
    const covered = new Set(sources.filter(s => backs(s, m.id)).flatMap(s => s.covers ?? []));
    for (const n of needs) if (!covered.has(n)) missing.add(n);
  }
  return [...missing].sort();
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

// T-075 (Jason, 2026-11-16): tri-tip's third method, smoke then sear on the smoker. Its numbers each cite what
// Jason gave; the sources back that method only, so the other two tri-tip methods are not claimed by them.
const GIVEN = 'given by Jason, 2026-11-16';
const LOUISIANA = `Louisiana Grills, reverse-seared tri-tip (https://louisiana-grills.com/blogs/pork/reverse-seared-tri-tip), ${GIVEN}`;
const TRAEGER_ZA = `Traeger, smoked tri-tip (https://www.traeger.com/za/en/recipes/smoked-tri-tip), ${GIVEN}`;
const TRAEGER_AU = `Traeger, smoked tri-tip (https://traeger.com/au/en/recipes/smoked-tri-tip), ${GIVEN}`;
// No URL was given for this one (Jason, 2026-11-16): none is made up.
const USDA = `USDA FSIS, ${GIVEN}`;

test('rules: tri-tip smoke then sear on the smoker: smoke as the reverse method, climb to 500F (450F), sear 8 min', () => {
  const tritip = rules.foods.find(f => f.id === 'tritip')!;
  assert.deepEqual(
    tritip.methods.map(m => m.id),
    ['reverse', 'smokerSear', 'brisketStyle'],
    'second, so the first method a smoker alone can do is this one',
  );
  const m = resolveMethod(tritip, tritip.methods[1]);
  const reverse = resolveMethod(tritip, tritip.methods[0]);
  assert.equal(m.label, 'Smoke, then sear on the smoker');
  assert.equal(m.cooker, 'smoker');
  // Numbers Jason did not give are the reverse method's: the smoke time model, pull, slice, hold, prep, space.
  assert.deepEqual(m.timing, reverse.timing);
  assert.deepEqual(m.pull, reverse.pull);
  for (const k of ['sliceMin', 'holdLimitMin', 'prep', 'footprintSqInPerUnit'] as const)
    assert.deepEqual(m[k], reverse[k], k);
  assert.deepEqual(m.phases[0], reverse.phases[0], "the smoke step is the reverse method's, to about 120F");
  const [, ramp, sear] = m.phases;
  assert.deepEqual(
    [ramp.id, ramp.fixedMin, ramp.temp, ramp.fallbackTemp, ramp.setsPit, ramp.offHeat, ramp.cooker],
    ['ramp', 15, 500, 450, true, true, undefined],
  );
  assert.deepEqual(
    [sear.id, sear.fixedMin, sear.temp, sear.fallbackTemp, sear.cooker],
    ['sear', 8, 500, 450, undefined],
  );
  assert.match(sear.label, /4 min per side to 130-135F/);
  assert.deepEqual(m.restMin, { default: 10, min: 10 });
});

test('rules: the smoker sear cites Louisiana Grills, two Traeger pages and USDA FSIS, and each one is needed', () => {
  const tritip = rules.foods.find(f => f.id === 'tritip')!;
  const cites = (tritip.sources ?? []).map(s => [s.cite, s.methods, [...s.covers].sort()]);
  assert.deepEqual(cites, [
    [LOUISIANA, ['smokerSear'], ['rate']],
    [TRAEGER_ZA, ['smokerSear'], ['highHeat', 'preheat']],
    [TRAEGER_AU, ['smokerSear'], ['doneTemp', 'highHeat', 'rest']],
    [USDA, ['smokerSear'], ['doneTemp']],
  ]);
  // The card's pull range, 130-145F: 145F is USDA's minimum for whole cuts of beef; 130-135F is the target.
  assert.equal(
    tritip.sources!.find(s => s.cite === USDA)!.says,
    '145F is the minimum for whole cuts of beef, with a 3 min rest.',
  );
  assert.deepEqual(resolveMethod(tritip, tritip.methods[1]).pull.tempF, [130, 145]);
  assert.deepEqual(unsourced(tritip), []);
  const without = (cite: string) => unsourced({ ...tritip, sources: tritip.sources!.filter(s => s.cite !== cite) });
  assert.deepEqual(without(LOUISIANA), ['rate']);
  assert.deepEqual(without(TRAEGER_ZA), ['preheat']);
  assert.deepEqual(without(TRAEGER_AU), [], 'USDA still backs the done temp');
  const noDone = tritip.sources!.filter(s => s.cite !== TRAEGER_AU && s.cite !== USDA);
  assert.deepEqual(unsourced({ ...tritip, sources: noDone }), ['doneTemp']);
  assert.deepEqual(unsourced({ ...tritip, sources: [] }), [], 'with no sources the method is not checked, as before');
  // A source naming no method would back all three, and then the other two would need theirs too.
  const forAll = tritip.sources!.map(({ methods: _m, ...s }) => s);
  assert.deepEqual(unsourced({ ...tritip, sources: forAll }), []);
  assert.deepEqual(unsourced({ ...tritip, sources: [{ ...forAll[0], covers: ['rate'] }] }), [
    'doneTemp',
    'highHeat',
    'preheat',
  ]);
});

test('rules: a fallback temp is a fixed temp below the step temp, and {temp} is only in a step with a fixed temp', () => {
  for (const food of rules.foods)
    for (const raw of food.methods)
      for (const p of resolveMethod(food, raw).phases) {
        const where = `${food.id}/${raw.id}/${p.id}`;
        if (p.fallbackTemp != null) {
          assert.equal(typeof p.temp, 'number', where);
          assert.ok(p.fallbackTemp < (p.temp as number), where);
        }
        if (p.label.includes('{temp}')) assert.equal(typeof p.temp, 'number', where);
      }
});

test("rules: the cookers a method needs are every step's, and the first method the cookers can fully do", () => {
  const food = (id: string) => rules.foods.find(f => f.id === id)!;
  const tritip = food('tritip');
  const smoker = { id: 's' } as Cookers['smoker'];
  const griddle = { id: 'g' } as Cookers['griddle'];
  assert.deepEqual(methodCookers(tritip, tritip.methods[0]), ['smoker', 'griddle']);
  assert.deepEqual(methodCookers(tritip, tritip.methods[1]), ['smoker']);
  assert.deepEqual(missingCookers(tritip, tritip.methods[0], { smoker }), ['griddle']);
  assert.deepEqual(missingCookers(tritip, tritip.methods[0], {}), ['smoker', 'griddle']);
  assert.equal(firstDoableMethod(tritip, { smoker, griddle })?.id, 'reverse');
  assert.equal(firstDoableMethod(tritip, { smoker })?.id, 'smokerSear');
  assert.equal(firstDoableMethod(tritip, { griddle }), undefined);
  assert.equal(firstDoableMethod(food('breasts'), { smoker })?.id, 'smoker');
  assert.equal(firstDoableMethod(food('wings'), { griddle })?.id, 'griddle');
});

// T-075 (Jason, 2026-11-16): the smoker sear needs a smoker that reaches its lowest sear temp, 450F (500F, or
// 450F on one that tops out lower). Below that the method is one the cookers cannot fully do.
test("rules: a smoker that tops out below a step's fallback temp cannot do the method", () => {
  const food = (id: string) => rules.foods.find(f => f.id === id)!;
  const tritip = food('tritip');
  const [reverse, sear, brisketStyle] = tritip.methods;
  const smoker = (maxTempF: number) => ({ id: 's', maxTempF }) as Cookers['smoker'];
  const griddle = { id: 'g' } as Cookers['griddle'];
  assert.equal(smokerReachF(tritip, sear), 450, 'from the data: the fallback temp');
  assert.equal(smokerReachF(tritip, reverse), null);
  assert.equal(smokerReachF(tritip, brisketStyle), null);
  assert.equal(smokerTooCool(tritip, sear, { smoker: smoker(425) }), true);
  assert.equal(smokerTooCool(tritip, sear, { smoker: smoker(449) }), true);
  for (const max of [450, 475, 500, 550]) assert.equal(smokerTooCool(tritip, sear, { smoker: smoker(max) }), false);
  assert.equal(smokerTooCool(tritip, sear, {}), false, 'no smoker: a missing cooker, not a cool one');
  assert.equal(firstDoableMethod(tritip, { smoker: smoker(425) })?.id, 'brisketStyle');
  assert.equal(firstDoableMethod(tritip, { smoker: smoker(425), griddle })?.id, 'reverse');
  assert.equal(firstDoableMethod(tritip, { smoker: smoker(450) })?.id, 'smokerSear');
  assert.equal(firstDoableMethod(tritip, { smoker: smoker(500) })?.id, 'smokerSear');
  // A step with no fallback temp sets no reach: wings at 400F stay as they are on a cooler smoker.
  assert.equal(firstDoableMethod(food('wings'), { smoker: smoker(350) })?.id, 'smokeCrisp');
});
