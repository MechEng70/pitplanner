// src/lib/cookView.ts: Cook tab wording and lane chart, derived from a plan and the clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan, onHeatSpan } from './plan.ts';
import type { PlanInput, SmokerProfile } from './types.ts';
import {
  cookStatus,
  countdown,
  overline,
  holdImpact,
  lanes,
  laneTicks,
  laneWindow,
  liveWarnings,
  overlapNote,
  shiftImpact,
} from '../src/lib/cookView.ts';
import { extendCook, markPullDone, shiftRemaining } from './live.ts';
import { summarize, toRecord } from '../src/lib/finish.ts';
import type { ActiveCook } from '../src/lib/cook.ts';

const rules = JSON.parse(readFileSync(new URL('../data/foods.json', import.meta.url), 'utf8'));
const SERVE = new Date(2026, 10, 14, 17, 0).getTime();
const MIN = 60_000;
const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m).getTime();
const units = { temp: 'F', weight: 'lb' } as const;
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
  assert.equal(countdown(at(11, 35), at(11, 34) + 30_000), 'in 1 min');
  assert.equal(countdown(at(11, 35), at(11, 35)), 'now');
  assert.equal(countdown(at(11, 35), at(11, 47)), '12 min overdue');
  assert.match(overline(at(11, 35), true, at(10)), /^Check at 11:35.AM$/);
  assert.match(overline(at(11, 35), false, at(10)), /^At 11:35.AM$/);
  assert.match(overline(at(11, 35), true, at(11, 50)), /^Overdue since 11:35.AM$/);
});

// Jason, 2026-11-15: "40 hours and 50 minutes" is hard to read. A day or more away reads in days and hours.
test('countdown: a day or more away reads in days and whole hours, no minutes', () => {
  const HR = 3_600_000;
  const now = at(10, 0);
  assert.equal(countdown(now + 23 * HR + 59 * 60_000, now), 'in 23 hr 59 min');
  assert.equal(countdown(now + 24 * HR, now), 'in 1 day');
  assert.equal(countdown(now + 45 * HR + 50 * 60_000, now), 'in 1 day 22 hr');
  assert.equal(countdown(now + 45 * HR + 20 * 60_000, now), 'in 1 day 21 hr');
  assert.equal(countdown(now + 72 * HR + 10 * 60_000, now), 'in 3 days');
  assert.equal(countdown(now + 71 * HR + 40 * 60_000, now), 'in 3 days');
});

test('lanes: phases by cooker, hot phase labelled with temp, rest dashed', () => {
  const ls = lanes(plan, units, k => k);
  const b = ls.find(l => l.id === 'b')!,
    w = ls.find(l => l.id === 'w')!,
    c = ls.find(l => l.id === 'c')!;
  assert.deepEqual(
    b.segments.map(s => [s.tone, s.label]),
    [
      ['smoke', 'smoke'],
      ['smoke2', 'wrapped'],
      ['hold', 'rest'],
    ],
  );
  assert.equal(w.segments.at(-1)!.tone, 'hot');
  assert.equal(w.segments.at(-1)!.label, '400F');
  assert.equal(
    lanes(plan, { temp: 'C', weight: 'kg' }, k => k)
      .find(l => l.id === 'w')!
      .segments.at(-1)!.label,
    '204C',
  );
  assert.equal(c.segments[0].tone, 'griddle');
  assert.equal(c.subtitle, 'griddle');
  assert.deepEqual(
    ls.map(l => l.title),
    ['Brisket', 'Wings', 'Breasts'],
  );
});

test('lane window and ticks: from the hour of the first step (fire 6:20 AM) to serve, at most five hour ticks plus serve', () => {
  // Same window two days early, mid-cook and after serve: the whole cook always shows.
  for (const now of [at(10, 23) - 2 * 24 * 60 * MIN, at(10, 23), at(18)])
    assert.deepEqual(laneWindow(plan, now), { from: at(6), to: SERVE });
  assert.deepEqual(
    laneTicks(at(6), SERVE).map(t => t.label),
    ['6a', '9a', '12p', '3p', '5p'],
  );
  assert.deepEqual(
    laneTicks(at(10), SERVE).map(t => t.label),
    ['10a', '12p', '2p', '4p', '5p'],
  );
  assert.ok(laneTicks(at(0), SERVE).length <= 6);
  assert.deepEqual(
    laneTicks(at(15), at(16, 30)).map(t => t.label),
    ['3p', '4:30p'],
  );
  // 13 hr chart: the 1a tick an hour before a 2a serve is dropped.
  assert.deepEqual(
    laneTicks(at(13), at(26)).map(t => t.label),
    ['1p', '5p', '9p', '2a'],
  );
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
  const c: ActiveCook = {
    input,
    original: plan,
    plan,
    startedAt: at(5),
    done: {},
    reminders: {},
    onAt: {},
    offAt: {},
    pitDownAt: null,
    quietUntil: null,
    notice: null,
    ringAgain: {},
    undo: null,
    warningsSeen: [],
  };
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

/* ---------- T-069: the lane chart note and the banner for a warning made during the cook ---------- */

// The brisket 30 min behind: off at 4:10 PM. The wings went on at 3:15 PM and the smoker goes to 400F at 4:05 PM.
const behind = shiftRemaining(rules, input, plan, at(10), 30, true, 'b');
// The brisket off at 11:30 AM instead of 3:40 PM: it holds 5 hr 10 min until it is sliced at 4:40 PM.
const pulledEarly = markPullDone(rules, input, plan, 'b', at(11, 30));
const CONFLICT = 'Smoker conflict: brisket at 225F and chicken wings at 400F at the same time.';
const HOLD = 'Brisket holds 5 hr 10 min, past its 4 hr limit. Keep it above 140F.';
const metric = { temp: 'C', weight: 'kg' } as const;

test('overlap note: a stretch that is a conflict says so, with its own times and each food at its temp', () => {
  const n = overlapNote(behind, at(10), units)!;
  assert.equal(n.lead, '4:05 to 4:10 PM: smoker conflict, brisket at 225F and wings at 400F.');
  assert.equal(n.rest, '');
  assert.deepEqual(n.band, { start: at(16, 5), end: at(16, 10), laneIds: ['b', 'w'] });
  // In Celsius the temps are the cooker's set points.
  assert.match(
    overlapNote(behind, at(10), metric)!.lead,
    /^4:05 to 4:10 PM: smoker conflict, brisket at \d+C and wings at \d+C\.$/,
  );
  // Once the conflict is over nothing shares the smoker any more.
  assert.equal(overlapNote(behind, at(16, 10), units), null);
});

test('overlap note: a stretch that is not a conflict reads as before', () => {
  const n = overlapNote(shiftRemaining(rules, input, plan, at(10), 20, true, 'b'), at(10), units)!;
  assert.equal(n.lead, '3:15 to 4:00 PM: brisket and wings share the smoker at 225F.');
});

test('live warnings: nothing for a plan that is as it started', () => {
  assert.equal(liveWarnings(plan, plan, [], at(10), units), null);
});

test('live warnings: a smoker conflict made during the cook reads as the engine says it', () => {
  const w = liveWarnings(behind, plan, [], at(10), units)!;
  assert.equal(w.text, CONFLICT);
  assert.deepEqual(w.keys, ['PIT_CONFLICT:b|w']);
  assert.match(
    liveWarnings(behind, plan, [], at(10), metric)!.text,
    /^Smoker conflict: brisket at \d+C and chicken wings at \d+C at the same time\.$/,
  );
});

test('live warnings: a hold that grew past its limit reads in hours, with the hold note', () => {
  const w = liveWarnings(pulledEarly, plan, [], at(12), units)!;
  assert.equal(w.text, HOLD);
  assert.deepEqual(w.keys, ['HOLD_TOO_LONG:b']);
  assert.equal(
    liveWarnings(pulledEarly, plan, [], at(12), metric)!.text,
    'Brisket holds 5 hr 10 min, past its 4 hr limit. Keep it above 60C.',
  );
});

test('live warnings: a food with no hold note stops at the limit, and never says to move it or start later', () => {
  // Breasts on the smoker come off before the 400F crisp and hold: Plan says to move them or start later.
  const smoked: PlanInput = {
    ...input,
    items: [input.items[1], { id: 'c', foodId: 'breasts', methodId: 'smoker', quantity: 4 }],
  };
  const started = buildPlan(rules, smoked);
  const held = started.warnings.find(x => x.code === 'HOLD_TOO_LONG')!;
  assert.match(held.message, /Move it to the griddle or start it later\.$/);
  // Had the cook started without it, the banner would say only this.
  const before = { ...started, warnings: [] };
  const w = liveWarnings(started, before, [], started.serveAt - 3 * 60 * MIN, units)!;
  assert.match(w.text, /^Chicken breasts holds (\d+ hr ?)?(\d+ min)?, past its 20 min limit\.$/);
  // It was there at Start cook, so there is no banner for it.
  assert.equal(liveWarnings(started, started, [], started.serveAt - 3 * 60 * MIN, units), null);
});

test('live warnings: both at once are one text, conflicts first', () => {
  // One plan with both: the brisket's phases as they are 30 min behind, and the hold warning of the early pull.
  const both = { ...behind, warnings: [...pulledEarly.warnings, ...behind.warnings] };
  const w = liveWarnings(both, plan, [], at(10), units)!;
  assert.match(w.text, /^Smoker conflict: brisket at 225F and chicken wings at 400F at the same time\. Brisket holds /);
  assert.match(w.text, / limit\. Keep it above 140F\.$/);
  assert.deepEqual(w.keys, ['PIT_CONFLICT:b|w', 'HOLD_TOO_LONG:b']);
});

test('live warnings: OK hides that warning for good; a different one still shows', () => {
  assert.equal(liveWarnings(behind, plan, ['PIT_CONFLICT:b|w'], at(10), units), null);
  assert.equal(liveWarnings(pulledEarly, plan, ['PIT_CONFLICT:b|w'], at(12), units)!.text, HOLD);
});

test('live warnings: gone when a later change removes the warning, and when the conflict is in the past', () => {
  const back = shiftRemaining(rules, input, behind, at(10, 30), -30, true, 'b');
  assert.equal(liveWarnings(back, plan, [], at(10, 30), units), null);
  assert.equal(liveWarnings(behind, plan, [], at(16, 9), units)!.text, CONFLICT);
  assert.equal(liveWarnings(behind, plan, [], at(16, 10), units), null);
});

test('live warnings: Not yet at the pull check makes the same banner text', () => {
  const notYet = extendCook(rules, input, plan, 'b', at(15, 40), 30, true);
  assert.equal(liveWarnings(notYet, plan, [], at(15, 40), units)!.text, CONFLICT);
});

test('live warnings: a warning the plan had at Start cook never shows, whatever its wording was then', () => {
  // A cook started before the sentence changed: same code and foods, the old message.
  const old = {
    ...behind,
    warnings: behind.warnings.map(x =>
      x.code === 'PIT_CONFLICT'
        ? { ...x, message: 'Brisket needs 225F while Chicken wings needs 400F at the same time.' }
        : x,
    ),
  };
  assert.equal(liveWarnings(behind, old, [], at(10), units), null);
  // A save with no warnings list, or no list of hidden warnings, does not crash.
  const bare = { ...plan, warnings: undefined } as unknown as typeof plan;
  assert.equal(liveWarnings(bare, bare, [], at(10), units), null);
  assert.equal(liveWarnings(behind, bare, undefined as unknown as string[], at(10), units)!.text, CONFLICT);
});
