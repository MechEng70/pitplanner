// Every row of the live-cook state table (TECH-DESIGN section 7): its condition, its allowed actions and
// its alarm effect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASK_SERVE_MIN,
  NAG_EVERY_MIN,
  can,
  cookState,
  doneOffBy,
  type CookAction,
  type CookFacts,
} from './cookState.ts';

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 14, 15, 0);
const cook = (over: Partial<CookFacts> = {}): CookFacts => ({
  pitDownAt: null,
  quietUntil: null,
  nextDueAt: NOW + 30 * MIN,
  finishing: false,
  ...over,
});
const ALL: CookAction[] = [
  'editPlan',
  'startCook',
  'done',
  'plus15',
  'notYet',
  'runningBehind',
  'runningAhead',
  'quiet',
  'pitWentOut',
  'startOver',
  'endCook',
  'backUpToTemp',
  'save',
  'discard',
];
const COOKING: CookAction[] = [
  'done',
  'plus15',
  'notYet',
  'runningBehind',
  'runningAhead',
  'quiet',
  'pitWentOut',
  'startOver',
  'endCook',
];
/** The state allows exactly these actions and no others. */
function allowsOnly(s: ReturnType<typeof cookState>, want: CookAction[]) {
  assert.deepEqual([...s.actions].sort(), [...want].sort());
  for (const a of ALL) assert.equal(can(s, a), want.includes(a), a);
}

test('Planning: no active cook; edit the plan or start; no alarms', () => {
  const s = cookState(null, NOW);
  assert.equal(s.phase, 'planning');
  allowsOnly(s, ['editPlan', 'startCook']);
  assert.equal(s.alarms, 'none');
  assert.equal(s.quiet, false);
  assert.equal(s.overdue, false);
  assert.equal(s.nagEveryMin, null);
  assert.equal(s.heldUntil, null);
});

test('Cooking: the pit is up; every cook action; the full alarm set', () => {
  const s = cookState(cook(), NOW);
  assert.equal(s.phase, 'cooking');
  allowsOnly(s, COOKING);
  assert.equal(s.alarms, 'full');
  assert.equal(s.quiet, false);
  assert.equal(s.overdue, false);
  assert.equal(s.heldUntil, null);
  assert.equal(s.nagEveryMin, null);
});

test('Cooking + Quiet: inside the window the same actions; alerts held to its end', () => {
  const until = NOW + 20 * MIN;
  const s = cookState(cook({ quietUntil: until }), NOW);
  assert.equal(s.phase, 'cooking');
  assert.equal(s.quiet, true);
  allowsOnly(s, COOKING);
  assert.equal(s.alarms, 'full');
  assert.equal(s.heldUntil, until);
});

test('Quiet ends with its window: at and after quietUntil it is plain Cooking', () => {
  for (const until of [NOW, NOW - MIN]) {
    const s = cookState(cook({ quietUntil: until }), NOW);
    assert.equal(s.quiet, false);
    assert.equal(s.heldUntil, null);
  }
});

test('Cooking + overdue: the next step is past due; Done is allowed; it nags every 10 minutes', () => {
  const s = cookState(cook({ nextDueAt: NOW - MIN }), NOW);
  assert.equal(s.phase, 'cooking');
  assert.equal(s.overdue, true);
  assert.equal(can(s, 'done'), true);
  allowsOnly(s, COOKING);
  assert.equal(s.nagEveryMin, NAG_EVERY_MIN);
  assert.equal(NAG_EVERY_MIN, 10);
});

test('not overdue at the due minute itself, or when every step is done', () => {
  assert.equal(cookState(cook({ nextDueAt: NOW }), NOW).overdue, false);
  const allDone = cookState(cook({ nextDueAt: null }), NOW);
  assert.equal(allDone.overdue, false);
  assert.equal(allDone.nagEveryMin, null);
});

test('overdue inside a quiet window: both, and the nags are held with the rest', () => {
  const until = NOW + 10 * MIN;
  const s = cookState(cook({ nextDueAt: NOW - 5 * MIN, quietUntil: until }), NOW);
  assert.equal(s.overdue, true);
  assert.equal(s.quiet, true);
  assert.equal(s.heldUntil, until);
});

test('Done asks keep or move serve when it is off by 5 minutes or more, early or late', () => {
  assert.equal(ASK_SERVE_MIN, 5);
  assert.deepEqual(doneOffBy(NOW, NOW + 4 * MIN), { deltaMin: 4, asksServe: false });
  assert.deepEqual(doneOffBy(NOW, NOW + 5 * MIN), { deltaMin: 5, asksServe: true });
  assert.deepEqual(doneOffBy(NOW, NOW - 5 * MIN), { deltaMin: -5, asksServe: true });
  assert.deepEqual(doneOffBy(NOW, NOW - 4 * MIN), { deltaMin: -4, asksServe: false });
  assert.deepEqual(doneOffBy(NOW, NOW), { deltaMin: 0, asksServe: false });
});

test('PitDown: Back up to temp or End cook only; step alerts wait behind one pit check', () => {
  const s = cookState(cook({ pitDownAt: NOW - 10 * MIN }), NOW);
  assert.equal(s.phase, 'pitDown');
  allowsOnly(s, ['backUpToTemp', 'endCook']);
  assert.equal(s.alarms, 'pitCheck');
});

test('PitDown stops the clock: a step past due is not overdue and does not nag', () => {
  const s = cookState(cook({ pitDownAt: NOW - 10 * MIN, nextDueAt: NOW - 5 * MIN }), NOW);
  assert.equal(s.overdue, false);
  assert.equal(s.nagEveryMin, null);
});

test('PitDown keeps a quiet window that is still open', () => {
  const until = NOW + 15 * MIN;
  const s = cookState(cook({ pitDownAt: NOW - MIN, quietUntil: until }), NOW);
  assert.equal(s.quiet, true);
  assert.equal(s.heldUntil, until);
});

test('Finishing: Save or Discard only; every alarm is cancelled', () => {
  const s = cookState(cook({ finishing: true }), NOW);
  assert.equal(s.phase, 'finishing');
  allowsOnly(s, ['save', 'discard']);
  assert.equal(s.alarms, 'cancelAll');
  assert.equal(s.nagEveryMin, null);
});

test('Finishing wins over a pit that is out, a quiet window and an overdue step', () => {
  const s = cookState(
    cook({ finishing: true, pitDownAt: NOW - MIN, quietUntil: NOW + MIN, nextDueAt: NOW - MIN }),
    NOW,
  );
  assert.equal(s.phase, 'finishing');
  assert.equal(s.quiet, false);
  assert.equal(s.overdue, false);
  assert.equal(s.heldUntil, null);
});
