import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan } from './plan.ts';
import { markPullDone, markStepDone, extendCook, pitOutage, postponeStep, smokerOverlaps, holdsCover } from './live.ts';
import { alarmsFromPlan, keyedEvents } from './alarms.ts';
import type { PlanInput, SmokerProfile } from './types.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const MIN = 60_000;
const SERVE = Date.UTC(2026, 10, 14, 22, 0);
const local = (h: number, m: number) => Date.UTC(2026, 10, 14, h + 5, m);

const pitBoss: SmokerProfile = { id: 'pb820', name: 'Pit Boss 820', type: 'pellet', tempStepF: 5, minTempF: 180, maxTempF: 500,
  hopperLb: 21, mainGrateSqIn: 593, upperRackSqIn: 256, pelletLbPerHrLow: 1.5, pelletLbPerHrHigh: 3, preheatMin: 20 };
const input: PlanInput = {
  mode: 'readyBy', at: SERVE, pitTempF: 225, rateOverrides: { brisket: 0.75 },
  cookers: { smoker: pitBoss, griddle: { id: 'g', name: 'Griddle', sizeIn: 36, burners: 4, hasDome: true, preheatMin: 15 }, oven: { id: 'o', lowestTempF: 170, holdIn: 'oven' } },
  items: [
    { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
    { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
    { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
  ],
};
const plan = () => buildPlan(rules, input);
const item = (p: ReturnType<typeof plan>, id: string) => p.items.find(i => i.input.id === id)!;
const hold = (p: ReturnType<typeof plan>, id: string) => (p.serveAt - item(p, id).sliceMin * MIN - item(p, id).finish) / MIN;

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
  const now = local(15, 50);                     // brisket pull was 3:40
  const q = extendCook(rules, input, p, 'b', now, 30, true);
  assert.equal(item(q, 'b').finish, now + 30 * MIN);
  assert.equal(item(q, 'b').phases.at(-1)!.end, now + 30 * MIN);
  assert.equal(q.serveAt, p.serveAt);
  assert.ok(q.warnings.some(w => w.code === 'REST_SHORT' && w.itemIds?.includes('b')), 'rest now too short');
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
  const grid = (pl: any) => pl.items.every((it: any) => it.phases.every((ph: any) => ph.start % (5 * MIN) === 0));
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
  const wingsOn = keys.find(k => k.event.kind === 'phase' && k.event.itemId === 'w' && k.event.phaseId === 'smoke')!.key;
  const a = alarmsFromPlan(p, now, undefined, { done: [wingsOn], reminders: { [wrapKey]: now + 15 * MIN, [fireKey]: now - MIN } });
  const all = a.flatMap(x => x.keys);
  assert.ok(!all.includes(wingsOn), 'done step not scheduled');
  assert.ok(all.includes(wrapKey), 'overdue step with a reminder is scheduled');
  assert.equal(a.find(x => x.keys.includes(wrapKey))!.at, now + 15 * MIN);
  assert.ok(!all.includes(fireKey), 'past reminder ignored');
});

test('quiet alerts hold steps inside the window and ring once at the end with all of them', () => {
  const p = plan();
  const now = local(15, 0);
  const quietUntil = now + 30 * MIN;               // 3:00-3:30: wings on at 3:15 falls inside
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
  assert.equal(postponeStep(rules, input, p, fire.key, fire.event.at - 5 * MIN, 15, true).reminderAt, fire.event.at + 10 * MIN);
  assert.equal(postponeStep(rules, input, p, fire.key, fire.event.at - 30 * MIN, 15, true).reminderAt, null);
});
