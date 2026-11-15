import { act, renderHook } from '@testing-library/react-native';
// The event log (T-065) as the store keeps it, over a real migrated database. Lives here, not beside the
// store: src/lib may not import React Native test tools (layer rule).
import { buildPlan } from '../../engine/plan';
import { newCook } from '@/lib/cook';
import { EVENT_LOG_KEY, EVENT_LOG_MAX, parseEventLog } from '@/lib/eventLog';
import { useEventLogWiring } from '@/lib/eventLogWiring';
import { saturday } from '@/lib/fixtures/saturday';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { fakeAlarms } from '@/platform/fakes';
import type { OnUncaughtError } from '@/platform/types';
import { NOW, storeWrapper, testRepos } from '@/test/store';

const plan = buildPlan(rules, saturday);
const settle = () => act(async () => void (await new Promise(r => setTimeout(r, 0))));

async function mount(alarms = fakeAlarms()) {
  const r = testRepos();
  const hook = await renderHook(() => useStore(), { wrapper: storeWrapper(r.repos, () => NOW, alarms) });
  const log = () => r.repos.kv.get(EVENT_LOG_KEY, parseEventLog) ?? [];
  return { ...r, alarms, store: () => hook.result.current, log, texts: () => log().map(e => `${e.kind}: ${e.text}`) };
}

test('a cook starting, changing and ending is logged with the alarm set given to the phone', async () => {
  const { store, texts, log } = await mount();
  expect(log()).toEqual([]);
  const cook = newCook(saturday, plan, NOW);
  await act(async () => store().setCook(cook));
  await settle();
  await act(async () => store().setCook({ ...cook, done: { 'fire::': NOW } }));
  await settle();
  await act(async () => store().setCook(null));
  await settle();
  const t = texts();
  expect(t[0]).toMatch(/^cook: cook started: \d+ events, serve /);
  expect(t[1]).toMatch(/^alarms: set \d+, exact$/);
  expect(t[2]).toBe(`cook: done fire:: at ${new Date(NOW).toISOString()}`);
  expect(t[3]).toMatch(/^alarms: set \d+, exact$/);
  expect(t.slice(4)).toEqual(['cook: cook ended', 'alarms: all cancelled: no cook running']);
  expect(log().every(e => e.at === NOW)).toBe(true);
});

test('an alarm set the phone refuses is logged as an error', async () => {
  const { store, alarms, texts } = await mount();
  alarms.failNext = new Error('no exact alarms');
  await act(async () => store().setCook(newCook(saturday, plan, NOW)));
  await settle();
  expect(texts()).toContain('error: alarm sync failed: Error: no exact alarms');
  expect(store().state.alarmSync).toBe('failed');
});

test('Done tapped on an alert is logged when it is applied', async () => {
  const { store, alarms, texts, repos } = await mount();
  repos.activeCook.save(newCook(saturday, plan, NOW), NOW);
  alarms.queued = [{ type: 'open', alarmId: 'a', keys: ['fire::'], at: NOW }];
  await act(async () => void (await store().drainAlerts()));
  expect(texts()).toContain(`tap: open fire:: at ${new Date(NOW).toISOString()}`);
});

test('the log is capped, and a log that cannot be written never stops a cook change', async () => {
  const { store, log, repos } = await mount();
  await act(async () => {
    for (let i = 0; i < EVENT_LOG_MAX + 10; i++) store().logEvent('error', `e${i}`);
    store().logEvent('cook', '');
  });
  expect(log()).toHaveLength(EVENT_LOG_MAX);
  expect(log()[0]!.text).toBe('e10');
  const set = repos.kv.set;
  repos.kv.set = () => {
    throw new Error('disk full');
  };
  const cook = newCook(saturday, plan, NOW);
  await act(async () => store().setCook(cook));
  repos.kv.set = set;
  expect(store().state.cook).toEqual(cook);
  expect(repos.activeCook.load()).not.toBeNull();
});

test('debugData is every stored row, the log among them', async () => {
  const { store } = await mount();
  await act(async () => store().logEvent('fired', 'wrap:b:p1'));
  const d = store().debugData();
  expect(Object.keys(d.tables)).toEqual(expect.arrayContaining(['active_cook', 'cook_history', 'cookers', 'kv']));
  expect(d.tables.kv!.map(r => r.key)).toContain(EVENT_LOG_KEY);
});

test('while the app is open, an alarm that rings and an uncaught error are logged; unmount stops both', async () => {
  const r = testRepos();
  const alarms = fakeAlarms();
  let uncaught: Parameters<OnUncaughtError>[0] | null = null;
  const onUncaught: OnUncaughtError = fn => {
    uncaught = fn;
    return () => void (uncaught = null);
  };
  const hook = await renderHook(() => useEventLogWiring(alarms, onUncaught), {
    wrapper: storeWrapper(r.repos, () => NOW, alarms),
  });
  await act(async () => {
    alarms.emitFired({ alarmId: 'a', keys: ['wrap:b:p1', 'spritz:b:p1'] });
    alarms.emitFired({ alarmId: 'test:1', keys: [] });
    uncaught!(new RangeError('bad time'), true);
    uncaught!('odd', false);
  });
  const texts = () => (r.repos.kv.get(EVENT_LOG_KEY, parseEventLog) ?? []).map(e => `${e.kind}: ${e.text}`);
  expect(texts()).toEqual([
    'fired: wrap:b:p1,spritz:b:p1',
    'fired: test:1',
    'error: fatal: RangeError: bad time',
    'error: uncaught: odd',
  ]);
  await hook.unmount();
  expect(uncaught).toBeNull();
  alarms.emitFired({ alarmId: 'b', keys: ['x'] });
  expect(texts()).toHaveLength(4);
});
