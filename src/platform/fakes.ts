// Test fakes for the platform services (TECH-DESIGN section 4): they record calls and are scripted by the
// test. No native imports, so Jest can load them.
import type { AlarmSpec } from '../../engine/alarms.ts';
import type {
  AlarmEvent,
  AlarmStatus,
  AppLinks,
  CopyText,
  DeviceFacts,
  GetJson,
  NotificationAction,
  PermissionService,
  PhoneAlarms,
  QueuedAction,
  ShareReport,
  ShareService,
  StoredNag,
} from './types';

export interface FakeAlarms extends PhoneAlarms, PermissionService {
  /** Every call in order, e.g. `acknowledge fire::`, `setQuiet off`, `replaceAll 7`, `cancelAll`. */
  calls: string[];
  /** The set given to each `replaceAll`. */
  sets: AlarmSpec[][];
  /** What `scheduled()` answers. */
  stored: { alarms: (AlarmSpec & { test?: boolean })[]; nags: StoredNag[] };
  /**
   * Notification taps waiting on the phone, oldest first. `peekActions` leaves them; `ackActions` removes the
   * ids given (T-079). A tap put here without an id gets one at its first read and keeps it, as the native
   * queue does for a tap queued by a build before ids.
   */
  queued: (NotificationAction & { id?: string })[];
  /** Set to make the next `ackActions` reject (the call is still recorded, nothing is removed). */
  failAck: Error | null;
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
  let taps = 0;
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
    failAck: null,
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
    async peekActions() {
      f.calls.push('peekActions');
      const read: QueuedAction[] = f.queued.map(a => ({ ...a, id: a.id ?? `tap${(taps += 1)}` }));
      f.queued = read;
      return read.map(a => ({ ...a }));
    },
    async ackActions(ids) {
      f.calls.push(`ackActions ${ids.join(',')}`);
      if (f.failAck) {
        const e = f.failAck;
        f.failAck = null;
        throw e;
      }
      f.queued = f.queued.filter(a => a.id === undefined || !ids.includes(a.id));
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

type OpenedPlan = Parameters<Parameters<ShareService['onPlanOpened']>[0]>[0];

export interface FakeShare extends ShareService {
  /** Every file handed to the share sheet, in order. */
  shared: { name: string; text: string }[];
  /** Set to make the next `sharePlanFile` reject (the call is still recorded). */
  failNext: Error | null;
  /** Deliver an opened file as the platform would (T-030). */
  open(file: OpenedPlan): void;
}

export function fakeShare(): FakeShare {
  const fns = new Set<(file: OpenedPlan) => void>();
  const f: FakeShare = {
    shared: [],
    failNext: null,
    async sharePlanFile(name, text) {
      f.shared.push({ name, text });
      if (f.failNext) {
        const e = f.failNext;
        f.failNext = null;
        throw e;
      }
    },
    onPlanOpened: fn => {
      fns.add(fn);
      return () => void fns.delete(fn);
    },
    open: file => fns.forEach(fn => fn(file)),
  };
  return f;
}

export interface FakeHttp {
  get: GetJson;
  /** Every request made, in order. */
  requests: { url: string; headers: Record<string, string> }[];
  /** What each request gets: an answer, or an Error for no network. */
  answer: { ok: boolean; json: unknown } | Error;
}

export function fakeHttp(answer: FakeHttp['answer'] = { ok: true, json: [] }): FakeHttp {
  const f: FakeHttp = {
    requests: [],
    answer,
    async get(url, headers) {
      f.requests.push({ url, headers });
      if (f.answer instanceof Error) throw f.answer;
      return f.answer;
    },
  };
  return f;
}

/** A phone for "Send to developer" tests. */
export const fakeDevice = (over: Partial<DeviceFacts> = {}): DeviceFacts => ({
  appVersion: '0.3.0',
  build: 300,
  androidVersion: '16',
  apiLevel: 36,
  model: 'Pixel 8',
  fontScale: 1.15,
  timeZone: 'America/Chicago',
  ...over,
});

export interface FakeReportShare {
  share: ShareReport;
  /** Every file handed to the share sheet, in order. */
  sent: { name: string; text: string; recipient: string }[];
  /** Set to make the next share reject (the call is still recorded). */
  failNext: Error | null;
}

export function fakeReportShare(): FakeReportShare {
  const f: FakeReportShare = {
    sent: [],
    failNext: null,
    async share(name, text, recipient) {
      f.sent.push({ name, text, recipient });
      if (f.failNext) {
        const e = f.failNext;
        f.failNext = null;
        throw e;
      }
    },
  };
  return f;
}

export interface FakeClipboard {
  copy: CopyText;
  /** Every text handed to the clipboard, in order. */
  copied: string[];
  /** Set to make the next copy reject (the call is still recorded). */
  failNext: Error | null;
}

export function fakeClipboard(): FakeClipboard {
  const f: FakeClipboard = {
    copied: [],
    failNext: null,
    async copy(text) {
      f.copied.push(text);
      if (f.failNext) {
        const e = f.failNext;
        f.failNext = null;
        throw e;
      }
    },
  };
  return f;
}
