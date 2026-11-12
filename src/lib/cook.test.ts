// syncAlarms talks to the AlarmService interface (no native plugin), so it runs against a recording fake.
import { keyedEvents, type AlarmSpec } from '../../engine/alarms.ts';
import { buildPlan } from '../../engine/plan.ts';
import { saturday } from '../screens/plan/PlanPlaceholder';
import type { AlarmService } from '../platform/types.ts';
import { rules } from './rules.ts';
import { newCook, syncAlarms, PIT_RECOVERY_MIN } from './cook.ts';

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
