// src/lib/cookView.ts: Cook tab wording and lane chart, derived from a plan and the clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan } from './plan.ts';
import type { PlanInput, SmokerProfile } from './types.ts';
import { cookStatus, countdown, overline, holdImpact, lanes, laneTicks, laneWindow, overlapNote, shiftImpact } from '../src/lib/cookView.ts';
import { shiftRemaining } from './live.ts';
import { onHeatSpan } from './plan.ts';
import { summarize, toRecord } from '../src/lib/finish.ts';
import type { ActiveCook } from '../src/lib/cook.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const SERVE = new Date(2026, 10, 14, 17, 0).getTime();
const MIN = 60_000;
const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m).getTime();
const units = { temp: 'F', weight: 'lb' } as const;
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
const plan = buildPlan(rules, input);

test('status: overdue or 5+ min late is Behind, 5+ early is Ahead', () => {
  assert.equal(cookStatus(at(12), 0, at(11)).label, 'On plan');
  assert.equal(cookStatus(at(12), 4, at(11)).label, 'On plan');
  assert.equal(cookStatus(at(12), 5, at(11)).label, 'Behind');
  assert.equal(cookStatus(at(12), -5, at(11)).label, 'Ahead');
  assert.equal(cookStatus(at(11), 0, at(11, 1)).label, 'Behind');
  assert.equal(cookStatus(null, 0, at(11)).label, 'On plan');
});

test('countdown: whole minutes, overdue counts up', () => {
  assert.equal(countdown(at(11, 35), at(10, 23)), 'in 1 hr 12 min');
  assert.equal(countdown(at(11, 35), at(11, 34, ) + 30_000), 'in 1 min');
  assert.equal(countdown(at(11, 35), at(11, 35)), 'now');
  assert.equal(countdown(at(11, 35), at(11, 47)), '12 min overdue');
  assert.match(overline(at(11, 35), true, at(10)), /^Check at 11:35.AM$/);
  assert.match(overline(at(11, 35), false, at(10)), /^At 11:35.AM$/);
  assert.match(overline(at(11, 35), true, at(11, 50)), /^Overdue since 11:35.AM$/);
});

test('lanes: phases by cooker, hot phase labelled with temp, rest dashed', () => {
  const ls = lanes(plan, units, k => k);
  const b = ls.find(l => l.id === 'b')!, w = ls.find(l => l.id === 'w')!, c = ls.find(l => l.id === 'c')!;
  assert.deepEqual(b.segments.map(s => [s.tone, s.label]), [['smoke', 'smoke'], ['smoke2', 'wrapped'], ['hold', 'rest']]);
  assert.equal(w.segments.at(-1)!.tone, 'hot');
  assert.equal(w.segments.at(-1)!.label, '400F');
  assert.equal(lanes(plan, { temp: 'C', weight: 'kg' }, k => k).find(l => l.id === 'w')!.segments.at(-1)!.label, '204C');
  assert.equal(c.segments[0].tone, 'griddle');
  assert.equal(c.subtitle, 'griddle');
  assert.deepEqual(ls.map(l => l.title), ['Brisket', 'Wings', 'Breasts']);
});

test('lane window and ticks: from the hour of the first step (fire 6:20 AM) to serve, at most five hour ticks plus serve', () => {
  // Same window two days early, mid-cook and after serve: the whole cook always shows.
  for (const now of [at(10, 23) - 2 * 24 * 60 * MIN, at(10, 23), at(18)]) assert.deepEqual(laneWindow(plan, now), { from: at(6), to: SERVE });
  assert.deepEqual(laneTicks(at(6), SERVE).map(t => t.label), ['6a', '9a', '12p', '3p', '5p']);
  assert.deepEqual(laneTicks(at(10), SERVE).map(t => t.label), ['10a', '12p', '2p', '4p', '5p']);
  assert.ok(laneTicks(at(0), SERVE).length <= 6);
  assert.deepEqual(laneTicks(at(15), at(16, 30)).map(t => t.label), ['3p', '4:30p']);
  // 13 hr chart: the 1a tick an hour before a 2a serve is dropped.
  assert.deepEqual(laneTicks(at(13), at(26)).map(t => t.label), ['1p', '5p', '9p', '2a']);
});

test('overlap note: brisket and wings share the pit, brisket off before it climbs', () => {
  const n = overlapNote(plan, at(10), units)!;
  assert.deepEqual(n.band.laneIds, ['b', 'w']);
  assert.match(n.lead, /^\d+:\d\d to \d+:\d\d.PM: brisket and wings share the smoker at 225F\.$/);
  assert.equal(n.rest, 'Brisket comes off before the pit climbs to 400F.');
  assert.equal(overlapNote(plan, SERVE, units), null);
});

test('hold impact: keep serve changes the hold, move serve says the new time', () => {
  const now = at(10);
  const keep = shiftRemaining(rules, input, plan, now, 20, true);
  const move = shiftRemaining(rules, input, plan, now, 20, false);
  assert.match(holdImpact(plan, keep, 'b'), /^Brisket holds .* instead of .*\.$/);
  assert.match(holdImpact(plan, move, 'b'), /^Serve 5:20.PM, later by 20 min\.$/);
});

test('shift impact: keep serve names the hold change, move serve names the new time', () => {
  const keep = shiftImpact(plan, shiftRemaining(rules, input, plan, at(10), 30, true))!;
  assert.match(keep.text, /^Brisket hold drops from 1 hr to 30 min\. (Still OK\.|Under its .* minimum rest\.)$/);
  const move = shiftImpact(plan, shiftRemaining(rules, input, plan, at(10), 30, false))!;
  assert.match(move.text, /^Serve moves to 5:30.PM\./);
  assert.equal(shiftImpact(plan, plan), null);
});

test('finish: planned vs actual per food, record logs only foods that came off, rate moves', () => {
  const c: ActiveCook = { input, original: plan, plan, startedAt: at(5), done: {}, reminders: {}, onAt: {}, offAt: {}, pitDownAt: null, quietUntil: null, notice: null };
  const b = plan.items.find(i => i.input.id === 'b')!;
  const span = onHeatSpan(b);
  const ended = { ...c, onAt: { b: span.start }, offAt: { b: span.end - 25 * MIN }, done: { 'serve::': SERVE } };
  const s = summarize(rules, ended, SERVE);
  const row = s.rows.find(r => r.itemId === 'b')!;
  assert.equal(row.actualMin, row.plannedMin - 25);
  assert.deepEqual(row.verdict, { tone: 'ok', text: '25 min ahead' });
  assert.match(s.served, /^Served at 5:00.PM, on time\.$/);
  assert.equal(row.log.discarded, undefined);
  const w = s.rows.find(r => r.itemId === 'w')!;
  assert.equal(w.log.discarded, true);
  assert.deepEqual(w.verdict, { tone: 'secondary', text: 'Not logged' });
  // Saved 0.75 hr/lb holds until 3 logged cooks; with no saved rate the learned rate moves.
  assert.equal(s.rates.length, 1);
  assert.deepEqual([s.rates[0].kind, s.rates[0].after, s.rates[0].cooksLogged], ['waiting', 0.75, 1]);
  const free = summarize(rules, { ...ended, input: { ...input, rateOverrides: {} } }, SERVE).rates[0];
  assert.equal(free.kind, 'learned');
  assert.ok(free.after < free.before);
  const locked = summarize(rules, { ...ended, input: { ...input, rateLocks: { brisket: true } } }, SERVE);
  assert.equal(locked.rates.length, 0);
  assert.match(summarize(rules, c, at(12)).served, /^Ended at 12:00.PM, before serve\.$/);
  const rec = toRecord(s, ended, '  windy ', 'x');
  assert.equal(rec.notes, 'windy');
  assert.equal(rec.items.length, 3);
  assert.equal(rec.lateMin, 0);
  assert.equal(summarize(rules, c, at(12)).lateMin, null);
});

test('hold impact: a food that would come off after serve says so', () => {
  const late = shiftRemaining(rules, input, plan, at(10), 30, true, 'w');
  assert.match(holdImpact(plan, late, 'w'), /^Chicken wings: off heat \d+ min after serve\.$/);
});
