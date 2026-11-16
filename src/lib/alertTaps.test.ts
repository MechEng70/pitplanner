// T-079: the ids of notification taps applied to the running cook, so a tap read twice is applied once.
import { buildPlan } from '../../engine/plan';
import type { QueuedAction } from '../platform/types';
import { APPLIED_TAPS_MAX, appliedTaps, noteApplied, unapplied } from './alertTaps';
import { doneStep, newCook, normalize, pending } from './cook';
import { saturday } from './fixtures/saturday';
import { rules } from './rules';

const NOW = Date.UTC(2026, 10, 14, 14, 0);
const cook = () => newCook(saturday, buildPlan(rules, saturday), NOW);
const tap = (id: string): QueuedAction => ({ id, type: 'done', alarmId: 'a1', keys: ['fire::'], at: NOW });

test('a cook saved before T-079 has no applied taps, and every tap read is new to it', () => {
  const c = cook();
  expect(appliedTaps(c)).toEqual([]);
  expect(unapplied(c, [tap('a'), tap('b')]).map(t => t.id)).toEqual(['a', 'b']);
  expect(unapplied(null, [tap('a')]).map(t => t.id)).toEqual(['a']);
});

test('a tap whose id the cook has is skipped; the rest keep their order', () => {
  const c = noteApplied(cook(), ['a', 'c']);
  expect(unapplied(c, [tap('a'), tap('b'), tap('c'), tap('d')]).map(t => t.id)).toEqual(['b', 'd']);
});

test('the same id twice in one read is applied once', () => {
  expect(unapplied(cook(), [tap('a'), tap('a')]).map(t => t.id)).toEqual(['a']);
});

test('noting ids keeps the older ones, newest last, without repeats', () => {
  const c = noteApplied(noteApplied(cook(), ['a', 'b']), ['b', 'c']);
  expect(appliedTaps(c)).toEqual(['a', 'b', 'c']);
});

test('the list is bounded to the newest ids, but never drops an id of the read just applied', () => {
  const old = Array.from({ length: APPLIED_TAPS_MAX }, (_, i) => `old${i}`);
  const c = noteApplied(noteApplied(cook(), old), ['new']);
  expect(appliedTaps(c)).toHaveLength(APPLIED_TAPS_MAX);
  expect(appliedTaps(c).at(-1)).toBe('new');
  expect(appliedTaps(c)).not.toContain('old0');
  const big = Array.from({ length: APPLIED_TAPS_MAX + 5 }, (_, i) => `big${i}`);
  expect(appliedTaps(noteApplied(c, big))).toEqual(big);
});

test('the ids ride along with the cook: through JSON, normalize and a cook change', () => {
  const c = noteApplied(cook(), ['a']);
  const stored = normalize(JSON.parse(JSON.stringify(c)));
  expect(appliedTaps(stored!)).toEqual(['a']);
  const done = doneStep(stored!, pending(stored!)[0]!.key, NOW, true).cook;
  expect(appliedTaps(done)).toEqual(['a']);
});

test('ids that are not text are ignored rather than trusted', () => {
  const c = { ...cook(), appliedTaps: ['a', 7, null] } as unknown as ReturnType<typeof cook>;
  expect(appliedTaps(c)).toEqual(['a']);
  const odd = { ...cook(), appliedTaps: 'a' } as unknown as ReturnType<typeof cook>;
  expect(appliedTaps(odd)).toEqual([]);
});
