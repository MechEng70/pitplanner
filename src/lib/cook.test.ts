// syncAlarms talks to the AlarmService interface (no native plugin), so it runs against a recording fake.
import { keyedEvents, type AlarmSpec } from '../../engine/alarms.ts';
import { buildPlan } from '../../engine/plan.ts';
import { holdsCover } from '../../engine/live.ts';
import { saturday } from './fixtures/saturday.ts';
import type { AlarmService } from '../platform/types.ts';
import { rules } from './rules.ts';
import { liveWarnings } from './cookView.ts';
import { AT_1023, cookAt } from '../test/cook.ts';
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

describe('warnings made during the cook (T-069)', () => {
  const MIN = 60_000;
  const F_UNITS = { temp: 'F', weight: 'lb' } as const;
  // Mockup 12's cook: brisket off at 3:40 PM, wings on at 3:15 PM, the smoker goes to 400F for them later.
  const fresh = cookAt(AT_1023);
  const wrap = 'phase:b:wrap';
  const CONFLICT = 'Smoker conflict: brisket at 225F and chicken wings at 400F at the same time.';

  test('a new cook has hidden no warning, and a cook saved before T-069 loads the same way', () => {
    expect(fresh.warningsSeen).toEqual([]);
    const { warningsSeen: _w, ...old } = fresh;
    const loaded = normalize(JSON.parse(JSON.stringify(old)))!;
    expect(loaded.warningsSeen).toEqual([]);
    expect(liveWarnings(loaded.plan, loaded.original, loaded.warningsSeen, AT_1023, F_UNITS)).toBeNull();
  });

  test('a cook saved before T-069 keeps quiet about a conflict it started with', () => {
    // The conflict was on the plan at Start cook (and on Plan's Conflicts tile), with the old sentence.
    const late = postpone(fresh, wrap, AT_1023, 60, true);
    const started = {
      ...late.plan,
      warnings: late.plan.warnings.map(w => ({ ...w, message: w.message.replace('Smoker conflict', 'Old words') })),
    };
    const { warningsSeen: _w, ...old } = { ...late, original: started, plan: started };
    const loaded = normalize(JSON.parse(JSON.stringify(old)))!;
    expect(loaded.plan.warnings.some(w => w.code === 'PIT_CONFLICT')).toBe(true);
    expect(liveWarnings(loaded.plan, loaded.original, loaded.warningsSeen, AT_1023, F_UNITS)).toBeNull();
  });

  test('+15 min tapped on the lock screen can make a conflict: it is on the plan, and nothing rings for it', async () => {
    // The brisket's pull check at 3:40 PM, put off four times from the alert with the app closed.
    const pull = pending(fresh).find(k => k.event.kind === 'pull' && k.event.itemId === 'b')!;
    const at = pull.event.at;
    const actions = [0, 1, 2, 3].map(i => ({
      type: 'snooze15' as const,
      alarmId: pull.key,
      keys: [pull.key],
      at: at + i * 15 * MIN,
    }));
    const before = { ...fresh, done: { ...fresh.done, [wrap]: at - 60 * MIN } };
    const after = applyActions(before, actions);
    expect(after.plan.warnings.filter(w => w.code === 'PIT_CONFLICT').map(w => w.message)).toEqual([CONFLICT]);
    // Serve moved with the brisket on taps 3 and 4, and the wings and the breasts moved with it (T-076), so
    // the conflict is the only new warning. Before T-076 they stayed put and held 35 and 38 min.
    expect(liveWarnings(after.plan, after.original, after.warningsSeen, at + 46 * MIN, F_UNITS)?.text).toBe(CONFLICT);
    // Silent for 0.3.0: the notice says what the alert did and no more, and the alarm set has only steps.
    expect(after.notice).not.toMatch(/conflict/i);
    const { svc, calls } = fakeAlarms();
    await syncAlarms(after, at + 46 * MIN, svc, F_UNITS);
    const stepKeys = new Set(steps(after).map(k => k.key));
    for (const a of calls.replaced[0]) {
      expect(`${a.title} ${a.body}`).not.toMatch(/conflict/i);
      expect(a.keys.every(k => stepKeys.has(k))).toBe(true);
    }
  });
});

// T-076: serve moves for one food, the others follow; the lock screen and the app give the same plan.
describe('serve moves for one food: the others follow (T-076)', () => {
  const MIN = 60_000;
  const fresh = cookAt(AT_1023);
  const wrap = 'phase:b:wrap';
  const WRAP_AT = Date.UTC(2026, 10, 14, 16, 35); // 11:35 AM
  const at = (h: number, m: number) => Date.UTC(2026, 10, 14, h + 5, m);
  const item = (c: { plan: typeof plan }, id: string) => c.plan.items.find(i => i.input.id === id)!;
  const startOf = (c: { plan: typeof plan }, id: string, phase: string) =>
    item(c, id).phases.find(p => p.id === phase)!.start;
  const hold = (c: { plan: typeof plan }, id: string) =>
    (c.plan.serveAt - item(c, id).sliceMin * MIN - item(c, id).finish) / MIN;

  test('four +15 taps on the brisket pull: serve 5:30 PM and the wings and breasts keep holds of 5 and 8', () => {
    const pull = pending(fresh).find(k => k.event.kind === 'pull' && k.event.itemId === 'b')!;
    const taps = [0, 1, 2, 3].map(i => ({
      type: 'snooze15' as const,
      alarmId: pull.key,
      keys: [pull.key],
      at: pull.event.at + i * 15 * MIN,
    }));
    const after = applyActions({ ...fresh, done: { ...fresh.done, [wrap]: WRAP_AT } }, taps);
    expect(after.plan.serveAt).toBe(at(17, 30));
    expect(hold(after, 'b')).toBe(30);
    expect(hold(after, 'w')).toBe(5);
    expect(hold(after, 'c')).toBe(8);
    expect(startOf(after, 'w', 'crisp')).toBe(at(16, 50));
    expect(after.plan.griddleOnAt).toBe(at(16, 55));
    expect(startOf(after, 'c', 'cook')).toBe(at(17, 10));
    expect(item(after, 'c').finish).toBe(at(17, 22));
    expect(item(after, 'w').finish).toBe(at(17, 25));
    expect(after.plan.warnings.some(w => w.code === 'HOLD_TOO_LONG')).toBe(false);
  });

  test('the notice says serve moved and that the other foods moved with it', () => {
    const late = applyActions(fresh, [{ type: 'done', alarmId: wrap, keys: [wrap], at: WRAP_AT + 40 * MIN }]);
    expect(late.notice).toBe(
      'Check the brisket: done at 12:15 PM from the alert. Serve moved to 5:40 PM. The other foods moved with it.',
    );
    // One food on the cook: there are no other foods to speak of.
    const alone = newCook(saturday, plan, start);
    const key = keyedEvents(plan).find(k => k.event.kind === 'phase' && k.event.phaseId === 'wrap')!;
    const one = applyActions(alone, [{ type: 'done', alarmId: key.key, keys: [key.key], at: key.event.at + 40 * MIN }]);
    expect(one.notice).toMatch(/ Serve moved to 5:40 PM\.$/);
    expect(one.notice).not.toMatch(/other foods/);
  });

  test('lock screen and app agree (T9): Done from the alert gives the plan of Done in the app with the choice the sheet preselects', () => {
    for (const [doneAt, serve] of [
      [AT_1023, at(17, 0)],
      [WRAP_AT + 40 * MIN, at(17, 40)],
    ] as const) {
      const lock = applyActions(fresh, [{ type: 'done', alarmId: wrap, keys: [wrap], at: doneAt }]);
      const r = doneStep(fresh, wrap, doneAt);
      const keep = r.ask!.keepServe;
      const app = holdsCover(keep.plan) ? keep : r.ask!.moveServe;
      expect(lock.plan).toEqual(app.plan);
      expect(lock.plan.serveAt).toBe(serve);
    }
  });

  test('the lock screen never moves serve earlier, even for a food already short of its minimum rest (Jason)', () => {
    // Not yet on the wrap check, an hour, with serve kept: the brisket comes off at 4:40 PM with no rest. Then
    // the wrap is done from the alert at 12:15 PM, 20 min early: Keep serve still leaves it 20 min, under its 30.
    const behind = postpone(fresh, wrap, AT_1023, 60, true);
    expect(hold(behind, 'b')).toBe(0);
    const doneAt = at(12, 15);
    const lock = applyActions(behind, [{ type: 'done', alarmId: wrap, keys: [wrap], at: doneAt }]);
    expect(lock.plan.serveAt).toBe(at(17, 0));
    expect(hold(lock, 'b')).toBe(20);
    // Serve kept and the other foods not re-planned: the same plan as Done with Keep serve in the app.
    expect(lock.plan).toEqual(doneStep(behind, wrap, doneAt, true).cook.plan);
    expect(lock.notice).not.toMatch(/Serve moved/);
    // The one case where the lock screen and the app's preselected choice differ: Keep serve does not cover
    // the brisket, so the sheet preselects Move serve, and Move serve brings serve 5 min earlier.
    const r = doneStep(behind, wrap, doneAt);
    expect(holdsCover(r.ask!.keepServe.plan)).toBe(false);
    expect(r.ask!.moveServe.plan.serveAt).toBe(at(16, 55));
  });

  test('Done 72 min early on the wrap, Move serve: serve 3:50 PM and the wings and breasts move 70 min earlier', () => {
    const r = doneStep(fresh, wrap, AT_1023);
    const move = r.ask!.moveServe;
    expect(move.plan.serveAt).toBe(at(15, 50));
    expect(startOf(move, 'w', 'smoke')).toBe(startOf(fresh, 'w', 'smoke') - 70 * MIN);
    expect(startOf(move, 'c', 'cook')).toBe(startOf(fresh, 'c', 'cook') - 70 * MIN);
    for (const id of ['b', 'w', 'c']) expect(hold(move, id)).toBe(hold(fresh, id));
  });

  test('Done early when no food could be ready sooner: no Keep or Move question, serve is kept', () => {
    // The brisket's pull put off 30 min (Keep serve): it comes off at 4:10 and rests its minimum 30 min.
    const pull = 'pull:b:';
    const waiting = postpone({ ...fresh, done: { ...fresh.done, [wrap]: WRAP_AT } }, pull, at(15, 40), 30, true);
    expect(hold(waiting, 'b')).toBe(30);
    // The wings' climb to 400F done 15 min early: serve could not come sooner for the brisket.
    const r = doneStep(waiting, 'phase:w:ramp', at(15, 50));
    expect(r.ask).toBeUndefined();
    expect(r.cook.plan.serveAt).toBe(at(17, 0));
    expect(r.cook.plan).toEqual(doneStep(waiting, 'phase:w:ramp', at(15, 50), true).cook.plan);
  });

  test('Done early in Quiet time: the other foods never move into it', () => {
    // 3:50 PM, every step before it done on time (the brisket came off at 3:40). The wings' climb to 400F is
    // done 15 min early: the breasts could start 15 min sooner and serve moves to 4:45 PM (T3).
    const now = at(15, 50);
    const done = Object.fromEntries(
      steps(fresh)
        .filter(k => k.event.at < now)
        .map(k => [k.key, k.event.at]),
    );
    const c = { ...fresh, done };
    expect(doneStep(c, 'phase:w:ramp', now).ask!.moveServe.plan.serveAt).toBe(at(16, 45));
    // With Quiet on until 4:20 PM the breasts' prep at 4:10 is inside it and cannot come sooner, so neither can
    // the breasts or serve: no question.
    const r = doneStep(quiet(c, now), 'phase:w:ramp', now);
    expect(r.ask).toBeUndefined();
    expect(r.cook.plan.serveAt).toBe(at(17, 0));
  });
});
