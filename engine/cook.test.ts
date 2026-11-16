import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan } from './plan.ts';
import { markPullDone, markStepDone, extendCook, pitOutage, postponeStep, smokerOverlaps, holdsCover } from './live.ts';
import { alarmsFromPlan, keyedEvents } from './alarms.ts';
import type { Plan, PlanInput, SmokerProfile } from './types.ts';

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
    oven: { id: 'o', lowestTempF: 170, holdIn: 'oven' },
  },
  items: [
    { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
    { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
    { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
  ],
};
const plan = () => buildPlan(rules, input);
const item = (p: ReturnType<typeof plan>, id: string) => p.items.find(i => i.input.id === id)!;
const hold = (p: ReturnType<typeof plan>, id: string) =>
  (p.serveAt - item(p, id).sliceMin * MIN - item(p, id).finish) / MIN;

test('markPullDone early: off heat when pulled, hold grows, serve stays', () => {
  const p = plan();
  const before = hold(p, 'b');
  const q = markPullDone(rules, input, p, 'b', local(15, 15));
  assert.equal(item(q, 'b').finish, local(15, 15));
  assert.equal(item(q, 'b').phases.at(-1)!.end, local(15, 15));
  assert.equal(q.serveAt, p.serveAt);
  assert.equal(hold(q, 'b'), before + 25);
  assert.equal(q.events.find(e => e.kind === 'pull' && e.itemId === 'b')!.at, local(15, 15));
});

test('extendCook: an overdue pull ("not yet") moves off-heat past now; keepServe takes it from the hold', () => {
  const p = plan();
  const now = local(15, 50); // brisket pull was 3:40
  const q = extendCook(rules, input, p, 'b', now, 30, true);
  assert.equal(item(q, 'b').finish, now + 30 * MIN);
  assert.equal(item(q, 'b').phases.at(-1)!.end, now + 30 * MIN);
  assert.equal(q.serveAt, p.serveAt);
  assert.ok(
    q.warnings.some(w => w.code === 'REST_SHORT' && w.itemIds?.includes('b')),
    'rest now too short',
  );
  const moved = extendCook(rules, input, p, 'b', now, 30, false);
  assert.equal(moved.serveAt, p.serveAt + 40 * MIN, 'serve moves by how far off-heat moved');
});

test('postponeStep on an overdue check step starts that phase later and moves the rest of that food', () => {
  const p = plan();
  const wrap = p.events.find(e => e.kind === 'phase' && e.itemId === 'b' && e.phaseId === 'wrap')!;
  const now = wrap.at + 5 * MIN;
  const key = keyedEvents(p).find(k => k.event === wrap)!.key;
  const r = postponeStep(rules, input, p, key, now, 15, true);
  assert.equal(r.reminderAt, null);
  const w = item(r.plan, 'b').phases.find(x => x.id === 'wrap')!;
  assert.equal(w.start, now + 15 * MIN);
  assert.equal(item(r.plan, 'b').finish, item(p, 'b').finish + 20 * MIN);
  assert.equal(r.plan.serveAt, p.serveAt);
  assert.equal(item(r.plan, 'w').finish, item(p, 'w').finish, 'other foods untouched');
});

test('postponeStep on a fixed step (fire the smoker) only sets a reminder', () => {
  const p = plan();
  const fire = keyedEvents(p).find(k => k.event.kind === 'fire')!;
  const now = fire.event.at + 2 * MIN;
  const r = postponeStep(rules, input, p, fire.key, now, 15, true);
  // +15 at fire + 2 min reminds at fire + 15 (on the 5-minute grid), not fire + 17.
  assert.equal(r.reminderAt, fire.event.at + 15 * MIN);
  assert.equal(r.plan, p);
});

test('live changes keep every scheduled time on the 5-minute grid', () => {
  const p = plan();
  const grid = (pl: Plan) => pl.items.every(it => it.phases.every(ph => ph.start % (5 * MIN) === 0));
  const b = p.items.find(i => i.input.id === 'b')!;
  const wrap = b.phases.find(x => x.id === 'wrap')!;
  // Wrap done 19 min early (6:41 for a 7:00 check): the rest of the brisket moves 20 min, onto the grid.
  const early = markStepDone(rules, input, p, 'b', 'wrap', wrap.start - 19 * MIN, true);
  assert.equal(early.deltaMin, -20);
  assert.ok(grid(early.plan));
  // Not yet at the pull check, tapped at an odd minute: the new off time is on the grid.
  const late = extendCook(rules, input, p, 'b', b.finish + 7 * MIN, 30, true);
  assert.equal(late.items.find(i => i.input.id === 'b')!.finish % (5 * MIN), 0);
  // Pit out 23 min + 15 recovery = 38 -> 40 min.
  const out = pitOutage(rules, input, p, wrap.start - 60 * MIN, wrap.start - 37 * MIN, 15, false);
  assert.equal(out.serveAt - p.serveAt, 40 * MIN);
});

test('smokerOverlaps finds brisket and wings sharing the pit 3:15-3:40', () => {
  const o = smokerOverlaps(plan());
  assert.equal(o.length, 1);
  assert.equal(o[0].start, local(15, 15));
  assert.equal(o[0].end, local(15, 40));
  assert.deepEqual([...o[0].itemIds].sort(), ['b', 'w']);
});

test('alarms skip steps already done and add reminders for overdue ones', () => {
  const p = plan();
  const now = local(11, 40);
  const keys = keyedEvents(p);
  const wrapKey = keys.find(k => k.event.kind === 'phase' && k.event.phaseId === 'wrap' && k.event.itemId === 'b')!.key;
  const fireKey = keys.find(k => k.event.kind === 'fire')!.key;
  const wingsOn = keys.find(
    k => k.event.kind === 'phase' && k.event.itemId === 'w' && k.event.phaseId === 'smoke',
  )!.key;
  const a = alarmsFromPlan(p, now, undefined, {
    done: [wingsOn],
    reminders: { [wrapKey]: now + 15 * MIN, [fireKey]: now - MIN },
  });
  const all = a.flatMap(x => x.keys);
  assert.ok(!all.includes(wingsOn), 'done step not scheduled');
  assert.ok(all.includes(wrapKey), 'overdue step with a reminder is scheduled');
  assert.equal(a.find(x => x.keys.includes(wrapKey))!.at, now + 15 * MIN);
  assert.ok(!all.includes(fireKey), 'past reminder ignored');
});

test('quiet alerts hold steps inside the window and ring once at the end with all of them', () => {
  const p = plan();
  const now = local(15, 0);
  const quietUntil = now + 30 * MIN; // 3:00-3:30: wings on at 3:15 falls inside
  const a = alarmsFromPlan(p, now, undefined, { quietUntil });
  assert.ok(!a.some(x => x.at > now && x.at < quietUntil));
  const summary = a.find(x => x.at === quietUntil)!;
  assert.equal(summary.title, 'Quiet time is over');
  assert.ok(summary.body.includes('Wings on the smoker'));
  assert.equal(summary.critical, true);
});

test('holdsCover: keep serve is fine while every food keeps its minimum rest', () => {
  const p = plan();
  assert.equal(holdsCover(p), true);
  // Wings have no spare hold: 15 min late with keep serve leaves them short of rest.
  const late = postponeStep(rules, input, p, 'phase:w:smoke', item(p, 'w').phases[0].start, 15, true).plan;
  assert.equal(holdsCover(late), false);
  const moved = postponeStep(rules, input, p, 'phase:w:smoke', item(p, 'w').phases[0].start, 15, false).plan;
  assert.equal(holdsCover(moved), true);
});

test('postponeStep on a fixed step that is still ahead: reminds from now, or not at all if its alarm is later', () => {
  const p = plan();
  const fire = keyedEvents(p).find(k => k.event.kind === 'fire')!;
  assert.equal(
    postponeStep(rules, input, p, fire.key, fire.event.at - 5 * MIN, 15, true).reminderAt,
    fire.event.at + 10 * MIN,
  );
  assert.equal(postponeStep(rules, input, p, fire.key, fire.event.at - 30 * MIN, 15, true).reminderAt, null);
});

// T-076: serve moves for one food, and the other foods follow (Jason, 2026-11-16).
const at = (p: Plan, id: string, phaseId: string) => item(p, id).phases.find(x => x.id === phaseId)!.start;
/** Every step due before `now` done on time, except the keys in `skip`. */
const doneBefore = (p: Plan, now: number, skip: string[] = []) =>
  keyedEvents(p)
    .filter(k => k.event.alarm && k.event.at < now && !skip.includes(k.key))
    .map(k => k.key);
const noLongHold = (p: Plan) => !p.warnings.some(w => w.code === 'HOLD_TOO_LONG');

test('serve moved for one late food (Not yet at the pull): the other foods move with it and keep their holds', () => {
  const p = plan();
  const now = local(15, 50); // brisket pull was 3:40; the wings are on, the breasts are not
  const q = extendCook(rules, input, p, 'b', now, 30, false);
  assert.equal(q.serveAt, p.serveAt + 40 * MIN);
  assert.equal(hold(q, 'b'), hold(p, 'b'));
  for (const id of ['w', 'c']) {
    assert.equal(item(q, id).finish, item(p, id).finish + 40 * MIN, id);
    assert.equal(hold(q, id), hold(p, id), id);
  }
  // The wings were on: the phase they are in runs 40 min longer, the next ones move whole.
  assert.equal(item(q, 'w').phases[0].start, item(p, 'w').phases[0].start);
  assert.equal(item(q, 'w').phases[0].end, item(p, 'w').phases[0].end + 40 * MIN);
  assert.equal(at(q, 'w', 'crisp'), at(p, 'w', 'crisp') + 40 * MIN);
  assert.equal(at(q, 'c', 'cook'), at(p, 'c', 'cook') + 40 * MIN);
  assert.ok(noLongHold(q));
  // Keep serve is as before: only the brisket moves.
  const kept = extendCook(rules, input, p, 'b', now, 30, true);
  assert.equal(item(kept, 'w').finish, item(p, 'w').finish);
});

test('serve moved for one late food (Done 40 min late on the wrap): the other foods move with it and keep their holds', () => {
  const p = plan();
  const late = at(p, 'b', 'wrap') + 40 * MIN;
  const r = markStepDone(rules, input, p, 'b', 'wrap', late, false);
  assert.equal(r.deltaMin, 40);
  assert.equal(r.plan.serveAt, p.serveAt + 40 * MIN);
  for (const id of ['b', 'w', 'c']) assert.equal(hold(r.plan, id), hold(p, id), id);
  assert.equal(at(r.plan, 'w', 'smoke'), at(p, 'w', 'smoke') + 40 * MIN);
  assert.equal(at(r.plan, 'c', 'cook'), at(p, 'c', 'cook') + 40 * MIN);
  assert.ok(noLongHold(r.plan));
  // +15 on the wrap alert: the others move from the time of the tap, not from 15 min later.
  const tap = at(p, 'b', 'wrap') + 50 * MIN;
  const snoozed = postponeStep(rules, input, p, 'phase:b:wrap', tap, 15, false).plan;
  assert.equal(snoozed.serveAt, p.serveAt + 65 * MIN);
  for (const id of ['w', 'c']) assert.equal(hold(snoozed, id), hold(p, id), id);
});

test('a food already off the heat cannot follow a later serve: its hold grows', () => {
  const p = plan();
  const off = markPullDone(rules, input, p, 'b', local(15, 40));
  // Not yet on the wings at 4:30 PM: they come off at 5:10, not 4:55.
  const q = extendCook(rules, input, off, 'w', local(16, 30), 15, false);
  assert.equal(q.serveAt, p.serveAt + 15 * MIN);
  assert.equal(item(q, 'b').finish, local(15, 40));
  assert.equal(hold(q, 'b'), hold(p, 'b') + 15);
  assert.equal(hold(q, 'c'), hold(p, 'c'));
});

test('Back up to temp with Move serve: the griddle food moves with serve too', () => {
  const p = plan();
  const o = pitOutage(rules, input, p, local(9, 0), local(9, 20), 10, false);
  assert.equal(o.serveAt, p.serveAt + 30 * MIN);
  assert.equal(at(o, 'c', 'cook'), at(p, 'c', 'cook') + 30 * MIN);
  for (const id of ['b', 'w', 'c']) assert.equal(hold(o, id), hold(p, id), id);
  assert.equal(o.griddleOnAt, p.griddleOnAt! + 30 * MIN);
  // Keep serve: the griddle food stays put, as before.
  const kept = pitOutage(rules, input, p, local(9, 0), local(9, 20), 10, true);
  assert.equal(at(kept, 'c', 'cook'), at(p, 'c', 'cook'));
});

// Done early with Move serve (T-076 rule, choices 1A, 2A, 3A, 4A). Times are Eastern on the 3F cook; 4F adds
// St. Louis ribs 3-2-1 (on 10:05 AM, wrap 1:05, unwrap 3:05, off 4:05 PM, hold 45, minimum 10).
const input4: PlanInput = {
  ...input,
  items: [...input.items, { id: 'r', foodId: 'stlribs', methodId: '321', quantity: 2 }],
};
const plan4 = () => buildPlan(rules, input4);
/** Done early on `itemId`'s `phaseId` at `now`, Move serve, with the steps before `now` done. */
function early(
  inp: PlanInput,
  p: Plan,
  itemId: string,
  phaseId: string,
  now: number,
  o: { skip?: string[]; notBefore?: number } = {},
) {
  const done = doneBefore(p, now, o.skip);
  return markStepDone(rules, inp, p, itemId, phaseId, now, false, { now, done, notBefore: o.notBefore }).plan;
}

test('Done early, Move (T1): wrap 20 min early, every other food can start sooner, so serve moves 20 min', () => {
  const p = plan();
  const q = early(input, p, 'b', 'wrap', local(11, 15));
  assert.equal(q.serveAt, local(16, 40));
  assert.equal(item(q, 'b').finish, local(15, 20));
  assert.equal(hold(q, 'b'), 60);
  assert.equal(at(q, 'w', 'smoke'), local(14, 55));
  assert.equal(at(q, 'w', 'ramp'), local(15, 45));
  assert.equal(item(q, 'w').finish, local(16, 35));
  assert.equal(hold(q, 'w'), 5);
  assert.equal(q.griddleOnAt, local(16, 5));
  assert.equal(at(q, 'c', 'cook'), local(16, 20));
  assert.equal(item(q, 'c').finish, local(16, 32));
  assert.equal(hold(q, 'c'), 8);
});

test('Done early, Move (T2): one food, serve moves by the full amount, as before', () => {
  const one: PlanInput = { ...input, items: [input.items[0]] };
  const p = buildPlan(rules, one);
  const q = early(one, p, 'b', 'wrap', local(11, 15));
  assert.equal(q.serveAt, local(16, 40));
  assert.equal(item(q, 'b').finish, local(15, 20));
  assert.equal(hold(q, 'b'), 60);
  // Without the options (now is the time of the Done) it is the same.
  assert.deepEqual(markStepDone(rules, one, p, 'b', 'wrap', local(11, 15), false).plan, q);
});

test('Done early, Move (T3): the brisket is already off, so serve moves only as far as its minimum rest allows', () => {
  const p = plan();
  const q = early(input, p, 'w', 'ramp', local(15, 50));
  assert.equal(q.serveAt, local(16, 45));
  assert.equal(hold(q, 'b'), 45);
  assert.equal(item(q, 'w').finish, local(16, 40));
  assert.equal(hold(q, 'w'), 5);
  assert.equal(q.griddleOnAt, local(16, 10));
  assert.equal(at(q, 'c', 'cook'), local(16, 25));
  assert.equal(item(q, 'c').finish, local(16, 37));
  assert.equal(hold(q, 'c'), 8);
});

test('Done early, Move (T4): wrap 3 hr early, the others follow all the way', () => {
  const p = plan();
  const q = early(input, p, 'b', 'wrap', local(8, 35));
  assert.equal(q.serveAt, local(14, 0));
  assert.equal(item(q, 'b').finish, local(12, 40));
  assert.equal(hold(q, 'b'), 60);
  assert.equal(at(q, 'w', 'smoke'), local(12, 15));
  assert.equal(item(q, 'w').finish, local(13, 55));
  assert.equal(hold(q, 'w'), 5);
  assert.equal(at(q, 'c', 'cook'), local(13, 40));
  assert.equal(item(q, 'c').finish, local(13, 52));
  assert.equal(hold(q, 'c'), 8);
});

test('Done early, Move (T5): ribs 20 min early, the brisket on the heat gives from its hold', () => {
  const p = plan4();
  const q = early(input4, p, 'r', 'unwrap', local(14, 45));
  assert.equal(q.serveAt, local(16, 40));
  assert.equal(item(q, 'b').finish, item(p, 'b').finish, 'a food on the heat never cooks shorter');
  assert.equal(hold(q, 'b'), 40);
  assert.equal(at(q, 'w', 'smoke'), local(14, 55));
  assert.equal(at(q, 'w', 'ramp'), local(15, 45));
  assert.equal(at(q, 'c', 'cook'), local(16, 20));
  assert.equal(item(q, 'c').finish, local(16, 32));
  assert.equal(hold(q, 'r'), hold(p, 'r'));
});

test('Done early, Move (T6): 40 min early, the brisket to its minimum rest, the wings stop short of the brisket', () => {
  const p = plan4();
  const q = early(input4, p, 'r', 'unwrap', local(14, 25));
  assert.equal(q.serveAt, local(16, 30));
  assert.equal(hold(q, 'b'), 30);
  // 25 min, not 30: the climb to 400F starts as the brisket comes off at 3:40.
  assert.equal(at(q, 'w', 'ramp'), local(15, 40));
  assert.equal(hold(q, 'w'), 0);
  assert.equal(at(q, 'c', 'cook'), local(16, 10));
  assert.equal(item(q, 'c').finish, local(16, 22));
  assert.equal(hold(q, 'r'), 55);
  assert.ok(!q.warnings.some(w => w.code === 'PIT_CONFLICT'));
  assert.ok(!q.warnings.some(w => w.code === 'REST_SHORT'));
});

test('Done early, Move (T7): ribs never put on, so they cannot be ready sooner: serve is kept', () => {
  const p = plan4();
  const now = local(11, 15);
  const q = early(input4, p, 'b', 'wrap', now, { skip: ['phase:r:smoke'] });
  const keep = markStepDone(rules, input4, p, 'b', 'wrap', now, true).plan;
  assert.equal(q.serveAt, p.serveAt);
  assert.deepEqual(q, keep);
});

test('Done early, Move (T7b): ribs on, but on at 225F until 4:05, so the wings cannot climb sooner', () => {
  const p = plan4();
  const q = early(input4, p, 'b', 'wrap', local(11, 15));
  assert.equal(q.serveAt, local(16, 55));
  assert.equal(at(q, 'w', 'smoke'), at(p, 'w', 'smoke'));
  assert.equal(hold(q, 'w'), 0);
  assert.equal(at(q, 'c', 'cook'), at(p, 'c', 'cook') - 5 * MIN);
  assert.ok(!q.warnings.some(w => w.code === 'PIT_CONFLICT'));
});

test('Done early, Move (T8): a step in Quiet time never moves into it', () => {
  const p = plan4();
  const q = early(input4, p, 'r', 'unwrap', local(14, 50), { notBefore: local(15, 20) });
  assert.equal(q.serveAt, local(16, 55));
  assert.equal(at(q, 'w', 'smoke'), local(15, 15));
  assert.equal(hold(q, 'w'), 0);
  assert.equal(at(q, 'c', 'cook'), at(p, 'c', 'cook') - 5 * MIN);
  // Without Quiet time the wings go on 15 min sooner and serve moves 15.
  const free = early(input4, p, 'r', 'unwrap', local(14, 50));
  assert.equal(free.serveAt, local(16, 45));
  assert.equal(at(free, 'w', 'smoke'), local(15, 0));
});

/** Minutes each pair of foods is on the smoker at temps too far apart to share it ("b|w" -> 25). */
function clashMin(p: Plan): Map<string, number> {
  const sm = p.items.flatMap(it =>
    it.phases.filter(x => x.cooker === 'smoker').map(x => ({ ...x, food: it.input.id })),
  );
  const out = new Map<string, number>();
  for (const a of sm)
    for (const b of sm) {
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (a.food < b.food && overlap > 0 && Math.abs(a.tempF - b.tempF) > 25)
        out.set(`${a.food}|${b.food}`, (out.get(`${a.food}|${b.food}`) ?? 0) + overlap / MIN);
    }
  return out;
}

test('Done early, Move: the result never has a smoker conflict, or a longer one, that Keep serve does not (3A)', () => {
  // Two foods not on yet at temps too far apart, both starting sooner: wings hot at 350F (on 3:55 PM) and
  // breasts on the smoker at 225F (3:15 to 3:37 PM in the Keep plan). Wrap done 20 min early. On their own the
  // wings can come 15 min sooner (20 would put them on with the breasts), the breasts 20; together the breasts
  // are off at 3:17 and the wings on at 3:40, with no clash.
  const twoMove: PlanInput = {
    ...input,
    items: [
      input.items[0],
      { id: 'h', foodId: 'wings', methodId: 'hot', quantity: 2 },
      { id: 's', foodId: 'breasts', methodId: 'smoker', quantity: 4 },
    ],
  };
  const p2 = buildPlan(rules, twoMove);
  const now = local(11, 15);
  const keep2 = markStepDone(rules, twoMove, p2, 'b', 'wrap', now, true).plan;
  const two = early(twoMove, p2, 'b', 'wrap', now);
  assert.equal(at(two, 'h', 'cook') - at(keep2, 'h', 'cook'), -15 * MIN);
  assert.equal(at(two, 's', 'cook') - at(keep2, 's', 'cook'), -20 * MIN);
  assert.equal(two.serveAt, keep2.serveAt - 20 * MIN);
  const cases: [PlanInput, Plan, string, string, number, { skip?: string[]; notBefore?: number }?][] = [
    [input, plan(), 'b', 'wrap', local(11, 15)], // T1
    [input, plan(), 'w', 'ramp', local(15, 50)], // T3
    [input, plan(), 'b', 'wrap', local(8, 35)], // T4
    [input4, plan4(), 'r', 'unwrap', local(14, 45)], // T5
    [input4, plan4(), 'r', 'unwrap', local(14, 25)], // T6
    [input4, plan4(), 'b', 'wrap', local(11, 15), { skip: ['phase:r:smoke'] }], // T7
    [input4, plan4(), 'b', 'wrap', local(11, 15)], // T7b
    [input4, plan4(), 'r', 'unwrap', local(14, 50), { notBefore: local(15, 20) }], // T8
    [input4, plan4(), 'r', 'unwrap', local(14, 50)], // T8 without Quiet
    [twoMove, p2, 'b', 'wrap', now],
  ];
  for (const [inp, p, id, phase, t, o] of cases) {
    const keep = clashMin(markStepDone(rules, inp, p, id, phase, t, true).plan);
    for (const [pair, m] of clashMin(early(inp, p, id, phase, t, o)))
      assert.ok(m <= (keep.get(pair) ?? 0), `${id} ${phase}: ${pair} ${m} min, Keep ${keep.get(pair) ?? 0}`);
  }
});
