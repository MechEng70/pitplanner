// T-034 parity review, docs/parity.md section 1b row T17: SPEC failure mode 7, a daylight saving change during
// an overnight cook ("alarms an hour off"). The engine works in epoch ms with no clock or time zone, so its
// DST test (engine/plan.test.ts, Nov 1, 2026) cannot fail because of DST. What can go an hour off is the app
// layer, where wall-clock time meets instants: the times it shows, the alarm instants it hands the phone, and
// the serve times it makes from a local day and hour. These run in America/New_York (jest.global-setup.js);
// US clocks fall back from 2:00 AM EDT to 1:00 AM EST on Sunday Nov 1, 2026 (06:00 UTC).
import type { AlarmSpec } from '../../engine/alarms';
import { buildPlan } from '../../engine/plan';
import type { AlarmService } from '../platform/types';
import { newCook, syncAlarms } from './cook';
import { saturday } from './fixtures/saturday';
import { fmtDay, fmtTime } from './format';
import { rules } from './rules';
import { suggestServe } from './sharedPlan';
import { defaultServe } from './store';

const MIN = 60_000;
const FALL_BACK = Date.UTC(2026, 10, 1, 6, 0);

/** The phone's alarm service, recording each set it is given (src/lib may only use the interface). */
function phoneAlarms() {
  const sets: AlarmSpec[][] = [];
  const svc: AlarmService = {
    replaceAll: async a => {
      sets.push(a);
      return { scheduled: a.length, exact: true };
    },
    cancelAll: async () => {},
    acknowledge: async () => {},
    setQuiet: async () => {},
    testAlarm: async () => ({ at: 0, exact: true }),
    scheduled: async () => ({ alarms: [], nags: [] }),
    onFired: () => () => {},
    onAction: () => () => {},
  };
  return { svc, sets };
}

// Without this the rest of the file could pass in a zone with no DST and prove nothing.
test('the tests run in a zone that falls back on Nov 1, 2026', () => {
  expect(new Date(FALL_BACK - MIN).getTimezoneOffset()).toBe(240); // 1:59 AM EDT
  expect(new Date(FALL_BACK).getTimezoneOffset()).toBe(300); // 1:00 AM EST
});

describe('an overnight brisket across the fall-back (failure mode 7)', () => {
  // Serve at noon EST. 16 lb at 0.75 hr/lb: 12 hr on heat, then 1 hr rest and 20 min to slice. On at 03:40 UTC
  // (11:40 PM EDT, Saturday), wrapped at 10:15 UTC (5:15 AM EST), off at 15:40 UTC (10:40 AM EST): 12 real hours
  // that the wall clock reads as 11. The smoker is fired 20 min before the brisket goes on.
  const serve = Date.UTC(2026, 10, 1, 17, 0);
  const input = {
    ...saturday,
    at: serve,
    items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 16, options: { wrap: 'paper' }, restMin: 60 }],
  };
  const plan = buildPlan(rules, input);

  // Catches: times shown with a fixed offset (the one at plan time, or at serve), which reads the steps
  // before 2:00 AM an hour off.
  test('steps on each side of the change read in their own offset', () => {
    const b = plan.items[0]!;
    expect(b.finish - b.phases[0]!.start).toBe(12 * 60 * MIN);
    expect([fmtDay(plan.fireAt!), fmtTime(plan.fireAt!)]).toEqual(['Sat, Oct 31', '11:20 PM']);
    expect(fmtTime(b.phases[0]!.start)).toBe('11:40 PM');
    expect([fmtDay(b.phases[1]!.start), fmtTime(b.phases[1]!.start)]).toEqual(['Sun, Nov 1', '5:15 AM']);
    expect(fmtTime(b.finish)).toBe('10:40 AM');
    expect(fmtTime(plan.serveAt)).toBe('12:00 PM');
  });

  // Catches: the app rebuilding alarm times from wall-clock text or local hours, so an alarm after the change
  // rings an hour early or late.
  test('the alarms the phone gets are the plan instants, and read the same wall times', async () => {
    const before = Date.UTC(2026, 10, 1, 3, 0); // 11:00 PM EDT, Sat Oct 31
    const phone = phoneAlarms();
    await syncAlarms(newCook(input, plan, before), before, phone.svc, { temp: 'F', weight: 'lb' });
    const set = phone.sets.at(-1)!;
    const steps = plan.events.filter(e => e.alarm && e.at > before);
    expect(set.map(a => a.at).sort((x, y) => x - y)).toEqual([...new Set(steps.map(e => e.at))].sort((x, y) => x - y));
    const fire = set.find(a => a.keys.some(k => k.startsWith('fire:')))!;
    expect(fire.at).toBe(plan.fireAt);
    expect(fmtTime(fire.at)).toBe('11:20 PM');
    // A step after the change: the wrap, at 5:15 AM EST.
    const wrap = set.find(a => a.at === plan.items[0]!.phases[1]!.start)!;
    expect(fmtTime(wrap.at)).toBe('5:15 AM');
    const last = set.at(-1)!;
    expect(last.at).toBe(serve);
    expect(fmtTime(last.at)).toBe('12:00 PM');
  });
});

describe('serve times made from a local day and hour keep their hour across the change', () => {
  // Catches: defaultServe stepping days as 24 hours of ms, which lands the Saturday after the change at 4:00 PM.
  test('the default serve, Saturday 5:00 PM, is 5:00 PM the week after the change', () => {
    const now = Date.UTC(2026, 10, 1, 0, 0); // 8:00 PM EDT, Sat Oct 31: that Saturday's 5:00 PM has passed
    const at = defaultServe(now);
    expect(at).toBe(Date.UTC(2026, 10, 7, 22, 0));
    expect([fmtDay(at), fmtTime(at)]).toEqual(['Sat, Nov 7', '5:00 PM']);
  });

  // Catches: suggestServe adding 7 * 24 hours of ms to a shared serve time from before the change.
  test('a shared plan served Sat Oct 31 at 5:00 PM is offered for Sat Nov 7 at 5:00 PM', () => {
    const shared = Date.UTC(2026, 9, 31, 21, 0); // 5:00 PM EDT
    const at = suggestServe(shared, Date.UTC(2026, 10, 2, 15, 0));
    expect(at).toBe(Date.UTC(2026, 10, 7, 22, 0));
    expect([fmtDay(at), fmtTime(at)]).toEqual(['Sat, Nov 7', '5:00 PM']);
  });
});
