import {
  appendEvent,
  describeCookChange,
  errorText,
  EVENT_LOG_MAX,
  EVENT_TEXT_MAX,
  parseEventLog,
  type LogEvent,
  type LoggedCook,
} from './eventLog';

const T = Date.UTC(2026, 10, 15, 22, 5);
const cook = (over: Partial<LoggedCook> = {}): LoggedCook => ({
  plan: { serveAt: T + 3_600_000, events: [1, 2, 3] },
  done: {},
  reminders: {},
  pitDownAt: null,
  quietUntil: null,
  ...over,
});

test('the log keeps the newest events and drops the oldest past the cap', () => {
  let log: LogEvent[] = [];
  for (let i = 0; i < EVENT_LOG_MAX + 5; i++) log = appendEvent(log, { at: i, kind: 'cook', text: `e${i}` });
  expect(log).toHaveLength(EVENT_LOG_MAX);
  expect(log[0]!.text).toBe('e5');
  expect(log.at(-1)!.text).toBe(`e${EVENT_LOG_MAX + 4}`);
});

test('one long text is cut, so a single error cannot fill the row', () => {
  const [e] = appendEvent([], { at: 1, kind: 'error', text: 'x'.repeat(EVENT_TEXT_MAX + 50) });
  expect(e!.text).toHaveLength(EVENT_TEXT_MAX + 3);
  expect(e!.text.endsWith('...')).toBe(true);
});

test('append copies only the three fields of an event', () => {
  const extra = { at: 1, kind: 'cook', text: 'a', account: 'someone' } as LogEvent;
  expect(appendEvent([], extra)).toEqual([{ at: 1, kind: 'cook', text: 'a' }]);
});

test('a stored log that is not a list reads as null; entries that are not events are dropped', () => {
  expect(parseEventLog({})).toBeNull();
  expect(parseEventLog('x')).toBeNull();
  expect(
    parseEventLog([
      { at: 1, kind: 'fired', text: 'wrap:b:p1', extra: 1 },
      { at: 'x', kind: 'fired', text: '' },
      { at: 2, kind: 'other', text: '' },
      null,
    ]),
  ).toEqual([{ at: 1, kind: 'fired', text: 'wrap:b:p1' }]);
});

test('an error is logged as its name and message', () => {
  expect(errorText(new TypeError('no alarm module'))).toBe('TypeError: no alarm module');
  expect(errorText('plain')).toBe('plain');
});

test('cook changes in a line: started, ended, done, undone, reminder, pit, quiet, plan', () => {
  expect(describeCookChange(null, null)).toBe('');
  expect(describeCookChange(null, cook())).toBe('cook started: 3 events, serve 2026-11-15T23:05:00.000Z');
  expect(describeCookChange(cook(), null)).toBe('cook ended');
  const a = cook({ done: { 'fire::': T }, reminders: { 'wrap:b:p1': T } });
  expect(describeCookChange(a, a)).toBe('');
  expect(describeCookChange(a, { ...a, done: { ...a.done, 'wrap:b:p1': T + 60_000 }, reminders: {} })).toBe(
    'done wrap:b:p1 at 2026-11-15T22:06:00.000Z; reminder wrap:b:p1 cleared',
  );
  expect(describeCookChange(a, { ...a, done: {} })).toBe('not done fire::');
  expect(describeCookChange(a, { ...a, reminders: { 'wrap:b:p1': T + 900_000 } })).toBe(
    'reminder wrap:b:p1 at 2026-11-15T22:20:00.000Z',
  );
  expect(describeCookChange(a, { ...a, pitDownAt: T })).toBe('pit out at 2026-11-15T22:05:00.000Z');
  expect(describeCookChange({ ...a, pitDownAt: T }, a)).toBe('pit back up');
  expect(describeCookChange(a, { ...a, quietUntil: T })).toBe('quiet until 2026-11-15T22:05:00.000Z');
  expect(describeCookChange({ ...a, quietUntil: T }, a)).toBe('quiet ended');
  expect(describeCookChange(a, { ...a, plan: { serveAt: a.plan.serveAt + 900_000, events: [1, 2] } })).toBe(
    'plan changed: 2 events; serve 2026-11-15T23:05:00.000Z -> 2026-11-15T23:20:00.000Z',
  );
});
