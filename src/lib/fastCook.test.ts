import { buildPlan, derive } from '../../engine/plan';
import { keyedEvents } from '../../engine/alarms';
import type { PlanInput } from '../../engine/types';
import { doneStep, newCook, pending, steps } from './cook';
import { FAST_FACTOR, squeezeCook } from './fastCook';
import { MOCKUP_MENU } from './fixtures/finishedCook';
import { saturday } from './fixtures/saturday';
import { defaultGriddle, defaultOven } from './gear';
import { rules } from './rules';

const MIN = 60_000;
const input: PlanInput = {
  ...saturday,
  cookers: { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() },
  items: MOCKUP_MENU,
};
const plan = buildPlan(rules, input);
const START = Date.UTC(2026, 10, 15, 22, 30, 15);
const first = Math.min(...plan.events.map(e => e.at));
const fast = squeezeCook(input, plan, START);
const times = (p: typeof plan) => Object.fromEntries(keyedEvents(p).map(k => [k.key, k.event.at]));

describe('squeezeCook (the fast test cook, T-067)', () => {
  it('runs 60 times faster: an hour becomes a minute', () => {
    expect(FAST_FACTOR).toBe(60);
    const real = plan.serveAt - first;
    expect(fast.plan.serveAt - START).toBe(real / 60);
    expect(fast.input.at).toBe(fast.plan.serveAt);
  });

  it('keeps every step, in the same order, each at its squeezed time', () => {
    const was = keyedEvents(plan);
    const now = keyedEvents(fast.plan);
    expect(now.map(k => k.key)).toEqual(was.map(k => k.key));
    expect(now.map(k => k.event.label)).toEqual(was.map(k => k.event.label));
    now.forEach((k, i) => expect(k.event.at - START).toBe((was[i]!.event.at - first) / 60));
    expect(now[0]!.event.at).toBe(START);
  });

  it('puts every step on a whole second, 5 minutes apart becoming 5 seconds apart', () => {
    for (const e of fast.plan.events) expect((e.at - START) % 1000).toBe(0);
    const wrap = times(fast.plan)['phase:b:wrap']! - times(fast.plan)['phase:b:smoke']!;
    expect(wrap).toBe((times(plan)['phase:b:wrap']! - times(plan)['phase:b:smoke']!) / 60);
    expect(wrap % 5000).toBe(0);
  });

  it('squeezes the phases and the lengths the engine reads again', () => {
    const b = plan.items.find(i => i.input.id === 'b')!;
    const f = fast.plan.items.find(i => i.input.id === 'b')!;
    expect(f.finish - START).toBe((b.finish - first) / 60);
    expect(f.restMin).toBe(b.restMin / 60);
    expect(f.sliceMin).toBe(b.sliceMin / 60);
    expect(f.phases.map(p => p.end - p.start)).toEqual(b.phases.map(p => (p.end - p.start) / 60));
    expect(fast.input.cookers.smoker!.preheatMin).toBe(saturday.cookers.smoker!.preheatMin / 60);
  });

  it('changes neither the plan nor the input it was given', () => {
    const again = buildPlan(rules, input);
    expect(plan).toEqual(again);
    expect(input.cookers.smoker!.preheatMin).toBe(20);
  });

  it('survives a re-derive: only the steps tied to engine constants move or go', () => {
    const re = derive(rules, fast.input, structuredClone(fast.plan.items), fast.plan.serveAt);
    const a = times(fast.plan);
    const b = times(re);
    const changed = Object.keys(a).filter(k => a[k] !== b[k]);
    expect(Object.keys(b).filter(k => !(k in a))).toEqual([]);
    expect(changed.map(k => k.split(':')[0]).filter(kind => !['ovenOn', 'setPit', 'refill'].includes(kind))).toEqual(
      [],
    );
    expect(re.serveAt).toBe(fast.plan.serveAt);
  });

  it('Done on a pull at its time leaves the steps still to do where they were', () => {
    let cook = newCook(fast.input, fast.plan, START);
    const pull = steps(cook).find(k => k.event.kind === 'pull' && k.event.itemId === 'b')!;
    // Everything due before the pull was done on time.
    for (const k of steps(cook).filter(s => s.event.at < pull.event.at))
      cook = doneStep(cook, k.key, k.event.at, true).cook;
    const before = Object.fromEntries(pending(cook).map(k => [k.key, k.event.at]));
    cook = doneStep(cook, pull.key, pull.event.at + 2000).cook;
    const after = Object.fromEntries(pending(cook).map(k => [k.key, k.event.at]));
    delete before[pull.key];
    expect(after).toEqual(before);
    expect(cook.plan.serveAt).toBe(fast.plan.serveAt);
  });

  it('a Done within two minutes of a step does not re-time the food', () => {
    const cook = newCook(fast.input, fast.plan, START);
    const on = steps(cook).find(k => k.event.kind === 'phase')!;
    const r = doneStep(cook, on.key, on.event.at + 2 * MIN);
    expect(r.ask).toBeUndefined();
    expect(r.cook.plan).toBe(cook.plan);
  });
});
