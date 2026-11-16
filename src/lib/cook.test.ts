// syncAlarms talks to the AlarmService interface (no native plugin), so it runs against a recording fake.
import { keyedEvents, type AlarmSpec } from '../../engine/alarms.ts';
import { buildPlan } from '../../engine/plan.ts';
import { saturday } from './fixtures/saturday.ts';
import type { AlarmService } from '../platform/types.ts';
import { rules } from './rules.ts';
import {
  applyActions,
  doneStep,
  newCook,
  normalize,
  pending,
  postpone,
  quiet,
  serveUndoable,
  shift,
  steps,
  syncAlarms,
  undoStep,
  undoable,
  PIT_RECOVERY_MIN,
} from './cook.ts';

function fakeAlarms() {
  const calls: { replaced: AlarmSpec[][]; acked: string[][] } = { replaced: [], acked: [] };
  const svc: AlarmService = {
    replaceAll: async a => {
      calls.replaced.push(a);
      return { scheduled: a.length, exact: true };
    },
    cancelAll: async () => {},
    acknowledge: async k => {
      calls.acked.push(k);
    },
    setQuiet: async () => {},
    testAlarm: async () => ({ at: 0, exact: true }),
    scheduled: async () => ({ alarms: [], nags: [] }),
    drainActions: async () => [],
    onFired: () => () => {},
    onAction: () => () => {},
  };
  return { svc, calls };
}

const F = { temp: 'F', weight: 'lb' } as const;
const C = { temp: 'C', weight: 'kg' } as const;
const plan = buildPlan(rules, saturday);
const start = plan.fireAt! - 60 * 60_000;
const fireKey = keyedEvents(plan).find(k => k.event.kind === 'fire')!.key;

test('syncAlarms replaces the whole set from the plan and acknowledges nothing on a fresh cook', async () => {
  const { svc, calls } = fakeAlarms();
  await syncAlarms(newCook(saturday, plan, start), start, svc, F);
  expect(calls.acked).toEqual([]);
  expect(calls.replaced).toHaveLength(1);
  const fire = calls.replaced[0].find(a => a.at === plan.fireAt);
  expect(fire?.keys).toContain(fireKey);
  expect(fire?.body).toMatch(/225F/);
});

test('syncAlarms writes alert text in the chosen units', async () => {
  const { svc, calls } = fakeAlarms();
  await syncAlarms(newCook(saturday, plan, start), start, svc, C);
  const fire = calls.replaced[0].find(a => a.at === plan.fireAt);
  expect(fire?.body).toMatch(/\d+C/);
  expect(fire?.body).not.toMatch(/225F/);
});

test('syncAlarms acknowledges done steps and, with the pit out, schedules only the pit check', async () => {
  const { svc, calls } = fakeAlarms();
  const cook = { ...newCook(saturday, plan, start), done: { [fireKey]: plan.fireAt! }, pitDownAt: plan.fireAt! };
  await syncAlarms(cook, plan.fireAt!, svc, F);
  expect(calls.acked).toEqual([[fireKey]]);
  expect(calls.replaced[0]).toHaveLength(1);
  expect(calls.replaced[0][0]).toMatchObject({ id: 'pitcheck', at: plan.fireAt! + PIT_RECOVERY_MIN * 60_000 });
});

// T-063: take back a step marked Done by mistake.
describe('undo the most recent Done', () => {
  const MIN = 60_000;
  const fresh = newCook(saturday, plan, start);
  const [first, second] = pending(fresh);

  test('a new cook, and a cook saved before T-063, have nothing to take back', () => {
    expect(undoable(fresh)).toBeNull();
    expect(undoStep(fresh, start)).toBe(fresh);
    const { undo: _u, ringAgain: _r, ...old } = fresh;
    const loaded = normalize(old)!;
    expect(loaded.undo).toBeNull();
    expect(loaded.ringAgain).toEqual({});
    expect(undoable(loaded)).toBeNull();
  });

  test('done then undone is the cook as it was, and Next up is the same step again', () => {
    const at = first.event.at - 2 * MIN;
    const done = doneStep(fresh, first.key, at).cook;
    expect(pending(done)[0].key).toBe(second.key);
    expect(undoable(done)).toEqual({ key: first.key, label: first.event.label, doneAt: at, changed: false });
    const back = undoStep(done, at + MIN);
    expect(back).toEqual(fresh);
    expect(pending(back)[0].key).toBe(first.key);
    expect(undoable(back)).toBeNull();
  });

  test('a Done that moved the later steps and serve: all of it comes back', () => {
    const wrap = steps(fresh).filter(k => k.event.kind === 'phase')[1];
    const at = wrap.event.at + 40 * MIN;
    const r = doneStep(fresh, wrap.key, at);
    const moved = r.ask!.moveServe;
    expect(moved.plan.serveAt).toBe(plan.serveAt + 40 * MIN);
    expect(undoable(moved)?.key).toBe(wrap.key);
    const back = undoStep(moved, at - 41 * MIN);
    expect(back).toEqual(fresh);
  });

  test('only the most recent Done: the next Done replaces it, and the earlier one cannot come back', () => {
    const one = doneStep(fresh, first.key, first.event.at).cook;
    const two = doneStep(one, second.key, second.event.at, true).cook;
    expect(undoable(two)?.key).toBe(second.key);
    const back = undoStep(two, first.event.at);
    expect(Object.keys(back.done)).toEqual([first.key]);
    expect(undoable(back)).toBeNull();
    expect(undoStep(back, first.event.at)).toBe(back);
  });

  test('serveUndoable: only while Serve is the most recent Done and the cook before it is kept', () => {
    let cur = fresh;
    for (const k of steps(fresh).filter(s => s.event.kind !== 'serve'))
      cur = doneStep(cur, k.key, k.event.at, true).cook;
    const serve = pending(cur)[0];
    expect(serve.event.kind).toBe('serve');
    expect(serveUndoable(fresh)).toBe(false);
    expect(serveUndoable(cur)).toBe(false);
    const served = doneStep(cur, serve.key, serve.event.at).cook;
    expect(serveUndoable(served)).toBe(true);
    expect(serveUndoable({ ...served, undo: null })).toBe(false);
    const back = undoStep(served, serve.event.at);
    expect(serveUndoable(back)).toBe(false);
    expect(pending(back)[0].key).toBe(serve.key);
  });

  test('a change made after the tap is flagged and taken back with the Done', () => {
    const done = doneStep(fresh, first.key, first.event.at).cook;
    const late = shift(done, first.event.at + MIN, 30, false);
    expect(undoable(late)?.changed).toBe(true);
    expect(undoStep(late, first.event.at - MIN)).toEqual(fresh);
  });

  test('Done from the alert with the app closed can be taken back the same way', () => {
    const at = first.event.at + MIN;
    const done = applyActions(fresh, [{ type: 'done', alarmId: first.key, keys: [first.key], at }]);
    expect(done.notice).toMatch(/from the alert/);
    expect(undoable(done)?.key).toBe(first.key);
    const back = undoStep(done, first.event.at - MIN);
    expect(back).toEqual(fresh);
  });

  test('an overdue step taken back rings again in 10 min; its own time does not move', async () => {
    const at = first.event.at + 3 * MIN;
    const now = at + MIN;
    const back = undoStep(doneStep(fresh, first.key, at).cook, now);
    expect(back.ringAgain).toEqual({ [first.key]: now + 10 * MIN });
    expect(back.plan).toBe(plan);
    expect(back.reminders).toEqual({});
    const { svc, calls } = fakeAlarms();
    await syncAlarms(back, now, svc, F);
    expect(calls.acked).toEqual([]);
    expect(calls.replaced[0].find(a => a.keys.includes(first.key))?.at).toBe(now + 10 * MIN);
    // Done for real this time: no ring is left behind.
    expect(doneStep(back, first.key, now + MIN).cook.ringAgain).toEqual({});
  });
});

// T-034 parity review: rules that were built with no test at this level.
describe('parity (T-034)', () => {
  const MIN = 60_000;
  const fresh = newCook(saturday, plan, start);

  test('Quiet alerts: a step inside the 30 min is held and reaches the phone as one summary at the end', async () => {
    const { svc, calls } = fakeAlarms();
    const now = plan.fireAt! - 10 * MIN;
    const cook = quiet(fresh, now);
    await syncAlarms(cook, now, svc, F);
    const set = calls.replaced[0];
    expect(set.some(a => a.at === plan.fireAt)).toBe(false);
    const summary = set.find(a => a.title === 'Quiet time is over');
    expect(summary).toMatchObject({ at: now + 30 * MIN, critical: true });
    expect(summary?.keys).toContain(fireKey);
    expect(summary?.body).toMatch(/Fire the smoker to 225F/);
    // Steps after the 30 min ring as planned.
    expect(set.filter(a => a !== summary).every(a => a.at >= now + 30 * MIN)).toBe(true);
  });

  test('Done on a step asks keep or move serve from 5 min off, not at 4', () => {
    const k = keyedEvents(plan).find(x => x.event.kind === 'phase')!;
    const near = doneStep(fresh, k.key, k.event.at + 4 * MIN);
    expect(near.ask).toBeUndefined();
    const late = doneStep(fresh, k.key, k.event.at + 5 * MIN);
    expect(late.ask?.deltaMin).toBe(5);
    const early = doneStep(fresh, k.key, k.event.at - 5 * MIN);
    expect(early.ask?.deltaMin).toBe(-5);
  });

  test('Done on a pull never asks, however late: the food is off when it came off (Jason, 2026-11-15)', () => {
    const k = keyedEvents(plan).find(x => x.event.kind === 'pull')!;
    const at = k.event.at + 47 * MIN;
    const r = doneStep(fresh, k.key, at);
    expect(r.ask).toBeUndefined();
    expect(r.cook.offAt[k.event.itemId!]).toBe(at);
    expect(r.cook.plan.serveAt).toBe(plan.serveAt);
  });

  test('Not yet at a pull: that food comes off 30 min later, the others stay', () => {
    const k = keyedEvents(plan).find(x => x.event.kind === 'pull')!;
    const id = k.event.itemId!;
    const finish = (p: typeof plan) => Object.fromEntries(p.items.map(i => [i.input.id, i.finish]));
    const before = finish(plan);
    const after = finish(postpone(fresh, k.key, k.event.at, 30, true).plan);
    expect(after[id]).toBe(before[id] + 30 * MIN);
    for (const other of Object.keys(before).filter(x => x !== id)) expect(after[other]).toBe(before[other]);
  });
});
