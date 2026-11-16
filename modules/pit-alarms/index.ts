// pit-alarms: step alarms through AlarmManager.setAlarmClock, notifications with Done / +15 min, repeats
// until a step is handled, and restore after a reboot (TECH-DESIGN section 6). The 0.2.0 Capacitor plugin on
// the Expo Modules API, plus setQuiet and the ring log (T-068). App code reaches this through
// src/platform/alarms.ts, never directly. The shapes below match AlarmService, AlertTapQueue, RingLog and
// PermissionService in src/platform/types.ts (checked there).
import { NativeModule, requireNativeModule } from 'expo';

export interface PitAlarm {
  id: string;
  /** Epoch ms. */
  at: number;
  title: string;
  body: string;
  critical: boolean;
  /** Step keys, stable across replans: Done, +15 and repeats are tracked by these. */
  keys: string[];
}
export interface PitNag {
  alarmId: string;
  keys: string[];
  title: string;
  body: string;
  count: number;
  nextAt: number;
}
export interface PitAlarmAction {
  /** Unique, and the same at every read until acknowledged (T-079). */
  id: string;
  type: 'done' | 'snooze15' | 'open';
  alarmId: string;
  keys: string[];
  at: number;
}
export interface PitAlarmEvent {
  alarmId: string;
  keys: string[];
  action?: string;
}
export interface PitAlarmStatus {
  notifications: boolean;
  exactAlarms: boolean;
  batteryUnrestricted: boolean;
  fullScreen: boolean;
}
/**
 * One ring as the phone logged it (T-068), with the app dead too. Keys and times only. Instants are epoch ms;
 * `elapsedRealtime` is ms since boot. `repeat` is 0 for the first ring, 1 to 6 for "Still waiting", 7 for
 * the last "Cook needs you" (`last`). `idle` and `interactive` are null when the phone could not say.
 */
export interface PitRing {
  alarmId: string;
  keys: string[];
  plannedAt: number;
  actualAt: number;
  elapsedRealtime: number;
  repeat: number;
  last: boolean;
  source: 'alarm' | 'restore' | 'snooze';
  test: boolean;
  idle: boolean | null;
  interactive: boolean | null;
  posted: boolean;
}
export type PitSettingsScreen = 'exactAlarm' | 'battery' | 'fullScreen' | 'notifications';

type Events = {
  alarmFired(e: PitAlarmEvent): void;
  alarmAction(e: PitAlarmEvent): void;
};

declare class PitAlarmsNative extends NativeModule<Events> {
  setAlarms(alarms: PitAlarm[]): Promise<{ scheduled: number; exact: boolean }>;
  cancelAll(): Promise<void>;
  acknowledge(keys: string[]): Promise<void>;
  setQuiet(until: number | null): Promise<void>;
  testAlarm(seconds: number, title: string | null, body: string | null): Promise<{ at: number; exact: boolean }>;
  getScheduled(): Promise<{ alarms: (PitAlarm & { test: boolean })[]; nags: PitNag[] }>;
  peekActions(): Promise<PitAlarmAction[]>;
  ackActions(ids: string[]): Promise<void>;
  getRings(): Promise<PitRing[]>;
  clearRings(): Promise<void>;
  status(): Promise<PitAlarmStatus>;
  requestNotifications(): Promise<PitAlarmStatus>;
  openSettings(which: PitSettingsScreen): Promise<void>;
}

const native = requireNativeModule<PitAlarmsNative>('PitAlarms');

export const pitAlarms = {
  /** Cancel every scheduled alarm and schedule exactly this set. Never patch alarms one by one. */
  replaceAll: (alarms: PitAlarm[]) => native.setAlarms(alarms),
  /** End of a cook: nothing scheduled, nothing repeating, no notifications left. */
  cancelAll: () => native.cancelAll(),
  /** Stop repeating these step keys (the step is done). */
  acknowledge: (keys: string[]) => native.acknowledge(keys),
  /** Quiet alerts: no repeat rings before `until` (epoch ms); null ends it. */
  setQuiet: (until: number | null) => native.setQuiet(until),
  /** A real alarm in `seconds`, outside the cook's set. */
  testAlarm: (seconds: number, title?: string, body?: string) => native.testAlarm(seconds, title ?? null, body ?? null),
  /** What is stored to fire. */
  scheduled: () => native.getScheduled(),
  /** Done / +15 min taps on notifications that the app has not applied yet, oldest first. Removes nothing. */
  peekActions: () => native.peekActions(),
  /** Remove exactly these taps, once the cook with them applied is saved. A tap queued since stays. */
  ackActions: (ids: string[]) => native.ackActions(ids),
  /** Every ring the phone logged, oldest first (the newest 500 kept). */
  rings: () => native.getRings(),
  /** Empty the ring log. */
  clearRings: () => native.clearRings(),
  onFired(fn: (e: PitAlarmEvent) => void): () => void {
    const sub = native.addListener('alarmFired', fn);
    return () => sub.remove();
  },
  onAction(fn: (e: PitAlarmEvent) => void): () => void {
    const sub = native.addListener('alarmAction', fn);
    return () => sub.remove();
  },
  status: () => native.status(),
  requestNotifications: () => native.requestNotifications(),
  openSettings: (which: PitSettingsScreen) => native.openSettings(which),
};
