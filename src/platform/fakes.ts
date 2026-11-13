// Test fakes for the platform services (TECH-DESIGN section 4): they record calls and are scripted by the
// test. No native imports, so Jest can load them.
import type { AlarmSpec } from '../../engine/alarms.ts';
import type {
  AlarmEvent,
  AlarmService,
  AlarmStatus,
  AppLinks,
  NotificationAction,
  PermissionService,
  StoredNag,
} from './types';

export interface FakeAlarms extends AlarmService, PermissionService {
  /** Every call in order, e.g. `acknowledge fire::`, `setQuiet off`, `replaceAll 7`, `cancelAll`. */
  calls: string[];
  /** The set given to each `replaceAll`. */
  sets: AlarmSpec[][];
  /** What `scheduled()` answers. */
  stored: { alarms: (AlarmSpec & { test?: boolean })[]; nags: StoredNag[] };
  /** Notification taps waiting for `drainActions` (emptied by it, like the native queue). */
  queued: NotificationAction[];
  granted: AlarmStatus;
  /** What `replaceAll` and `testAlarm` report. */
  exact: boolean;
  /** Set to make the next `replaceAll` reject. */
  failNext: Error | null;
  /** Deliver an event as the native module would. */
  emitFired(e: AlarmEvent): void;
  emitAction(e: AlarmEvent): void;
}

export function fakeAlarms(): FakeAlarms {
  const fired = new Set<(e: AlarmEvent) => void>();
  const acted = new Set<(e: AlarmEvent) => void>();
  const listen = (set: Set<(e: AlarmEvent) => void>, fn: (e: AlarmEvent) => void) => {
    set.add(fn);
    return () => void set.delete(fn);
  };
  const f: FakeAlarms = {
    calls: [],
    sets: [],
    stored: { alarms: [], nags: [] },
    queued: [],
    granted: { notifications: true, exactAlarms: true, batteryUnrestricted: true, fullScreen: true },
    exact: true,
    failNext: null,
    async replaceAll(alarms) {
      f.calls.push(`replaceAll ${alarms.length}`);
      if (f.failNext) {
        const e = f.failNext;
        f.failNext = null;
        throw e;
      }
      f.sets.push(alarms);
      f.stored = { ...f.stored, alarms };
      return { scheduled: alarms.length, exact: f.exact };
    },
    async cancelAll() {
      f.calls.push('cancelAll');
      f.stored = { alarms: [], nags: [] };
    },
    async acknowledge(keys) {
      f.calls.push(`acknowledge ${keys.join(',')}`);
    },
    async setQuiet(until) {
      f.calls.push(`setQuiet ${until ?? 'off'}`);
    },
    async testAlarm(seconds, title, body) {
      f.calls.push(`testAlarm ${seconds} ${title ?? ''} ${body ?? ''}`.trimEnd());
      return { at: seconds * 1000, exact: f.exact };
    },
    async scheduled() {
      return f.stored;
    },
    async drainActions() {
      f.calls.push('drainActions');
      const out = f.queued;
      f.queued = [];
      return out;
    },
    onFired: fn => listen(fired, fn),
    onAction: fn => listen(acted, fn),
    emitFired: e => fired.forEach(fn => fn(e)),
    emitAction: e => acted.forEach(fn => fn(e)),
    async status() {
      return f.granted;
    },
    async requestNotifications() {
      f.calls.push('requestNotifications');
      return f.granted;
    },
    async openSettings(which) {
      f.calls.push(`openSettings ${which}`);
    },
  };
  return f;
}

/** A scripted `onResume`: `resume()` is the app coming back to the front. */
export function fakeResume(): { onResume: AppLinks['onResume']; resume(): void; listeners(): number } {
  const fns = new Set<() => void>();
  return {
    onResume: fn => {
      fns.add(fn);
      return () => void fns.delete(fn);
    },
    resume: () => fns.forEach(fn => fn()),
    listeners: () => fns.size,
  };
}
