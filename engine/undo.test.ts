// T-063: a step marked Done by mistake is taken back. Done then undone equals never done.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan } from './plan.ts';
import { markPullDone, markStepDone, shiftRemaining } from './live.ts';
import { alarmsFromPlan, keyedEvents } from './alarms.ts';
import { RING_AGAIN_MIN, rememberDone, ringTimes, undoDone, type Progress } from './undo.ts';
import type { PlanInput, SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const MIN = 60_000;
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
const plan = buildPlan(rules, input);
const keyed = keyedEvents(plan);
const pull = keyed.find(k => k.event.kind === 'pull' && k.event.itemId === 'b')!;
/** The brisket's second phase step (wrap): a Done here re-times the brisket's later steps. */
const wrap = keyed.filter(k => k.event.kind === 'phase' && k.event.itemId === 'b')[1]!;
const fire = keyed.find(k => k.event.kind === 'fire')!;

const fresh = (): Progress => ({
  plan,
  done: { [fire.key]: fire.event.at },
  reminders: {},
  ringAgain: {},
  onAt: {},
  offAt: {},
  notice: null,
});
const alarms = (p: Progress, now: number) =>
  alarmsFromPlan(p.plan, now, undefined, { done: Object.keys(p.done), reminders: ringTimes(p.reminders, p.ringAgain) });

test('done then undone equals never done: a pull tapped early', () => {
  const before = fresh();
  const at = pull.event.at - 90 * MIN;
  const undo = rememberDone(before, pull.key);
  const after: Progress = {
    ...before,
    plan: markPullDone(rules, input, plan, 'b', at),
    done: { ...before.done, [pull.key]: at },
    offAt: { b: at },
  };
  assert.notDeepEqual(after.plan, plan);
  const back = undoDone(after, undo, at + MIN);
  assert.deepEqual(back, before);
  assert.deepEqual(alarms(back, at + MIN), alarms(before, at + MIN));
  assert.ok(alarms(back, at + MIN).some(a => a.keys.includes(pull.key)));
});

test('done then undone equals never done: a Done that moved the later steps and serve', () => {
  const before = fresh();
  const at = wrap.event.at - 40 * MIN;
  const undo = rememberDone(before, wrap.key);
  const moved = markStepDone(rules, input, plan, 'b', wrap.event.phaseId!, at, false).plan;
  assert.equal(moved.serveAt, plan.serveAt - 40 * MIN);
  const after: Progress = { ...before, plan: moved, done: { ...before.done, [wrap.key]: at } };
  const back = undoDone(after, undo, at + MIN);
  assert.deepEqual(back, before);
  assert.equal(back.plan.serveAt, plan.serveAt);
  assert.deepEqual(alarms(back, at + MIN), alarms(before, at + MIN));
});

test('only the remembered step comes back: steps done before it stay done', () => {
  const before = fresh();
  const undo = rememberDone(before, wrap.key);
  const after: Progress = { ...before, done: { ...before.done, [wrap.key]: wrap.event.at } };
  const back = undoDone(after, undo, wrap.event.at - MIN);
  assert.deepEqual(Object.keys(back.done), [fire.key]);
});

test('the reminder the step had before the tap comes back with it', () => {
  const before: Progress = { ...fresh(), reminders: { [wrap.key]: wrap.event.at + 15 * MIN } };
  const undo = rememberDone(before, wrap.key);
  const after: Progress = { ...before, reminders: {}, done: { ...before.done, [wrap.key]: wrap.event.at + MIN } };
  assert.deepEqual(undoDone(after, undo, wrap.event.at + 2 * MIN).reminders, before.reminders);
});

test('a step that was already overdue rings again 10 min after the undo and still reads overdue', () => {
  const before = fresh();
  const at = wrap.event.at + 3 * MIN;
  const undo = rememberDone(before, wrap.key);
  const after: Progress = { ...before, done: { ...before.done, [wrap.key]: at } };
  const now = at + MIN;
  const back = undoDone(after, undo, now);
  assert.equal(RING_AGAIN_MIN, 10);
  assert.deepEqual(back.ringAgain, { [wrap.key]: now + 10 * MIN });
  // The step's own time is untouched (Next up still says how late it is)...
  assert.deepEqual(back.plan, plan);
  assert.deepEqual(back.reminders, {});
  // ...and the alarm set has it again.
  const again = alarms(back, now).find(a => a.keys.includes(wrap.key));
  assert.equal(again?.at, now + 10 * MIN);
});

test('a step still ahead gets no extra ring: its own alarm is back', () => {
  const before = fresh();
  const undo = rememberDone(before, wrap.key);
  const after: Progress = { ...before, done: { ...before.done, [wrap.key]: wrap.event.at - 30 * MIN } };
  const back = undoDone(after, undo, wrap.event.at - 29 * MIN);
  assert.deepEqual(back.ringAgain, {});
  assert.equal(alarms(back, wrap.event.at - 29 * MIN).find(a => a.keys.includes(wrap.key))?.at, wrap.event.at);
});

test('changes made after the tap are taken back too: the plan is the one from before the tap', () => {
  const before = fresh();
  const at = wrap.event.at;
  const undo = rememberDone(before, wrap.key);
  const shifted = shiftRemaining(rules, input, plan, at, 30, false);
  const after: Progress = { ...before, plan: shifted, done: { ...before.done, [wrap.key]: at } };
  assert.deepEqual(undoDone(after, undo, at - MIN).plan, plan);
});

test('a notice is put back as it was, unless it was dismissed since', () => {
  const before: Progress = { ...fresh(), notice: 'Serve moves to 5:15 PM.' };
  const undo = rememberDone(before, wrap.key);
  const done = { ...before.done, [wrap.key]: wrap.event.at };
  const said: Progress = { ...before, done, notice: 'Serve moves to 5:15 PM. Wrap: done at 11:35 AM from the alert.' };
  assert.equal(undoDone(said, undo, wrap.event.at - MIN).notice, before.notice);
  assert.equal(undoDone({ ...said, notice: null }, undo, wrap.event.at - MIN).notice, null);
});

test('ringTimes: the later of a reminder and a ring-again wins per step', () => {
  assert.deepEqual(ringTimes({ a: 10, b: 30 }, { b: 20, c: 5 }), { a: 10, b: 30, c: 5 });
  assert.deepEqual(ringTimes({ b: 10 }, { b: 20 }), { b: 20 });
});
