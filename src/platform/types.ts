// Platform service interfaces (TECH-DESIGN section 4). App logic in src/lib talks to these, never to
// expo-* packages or native modules directly. Android implementations: pit-alarms (T-013, T-015),
// expo-secure-store, expo-sharing, expo-linking. Test fakes record calls.

import type { AlarmSpec } from '../../engine/alarms.ts';

export type Unsubscribe = () => void;

export interface AlarmStatus {
  notifications: boolean;
  exactAlarms: boolean;
  batteryUnrestricted: boolean;
  fullScreen: boolean;
}

/** Done or +15 tapped on a step notification, queued natively until the app drains it. */
export interface NotificationAction {
  type: 'done' | 'snooze15' | 'open';
  alarmId: string;
  keys: string[];
  at: number;
}

export interface StoredNag {
  alarmId: string;
  keys: string[];
  title: string;
  body: string;
  count: number;
  nextAt: number;
}

export interface AlarmEvent {
  alarmId: string;
  keys: string[];
  action?: string;
}

export interface AlarmService {
  /** Cancel every scheduled alarm and schedule exactly this set. Never patch alarms one by one. */
  replaceAll(alarms: AlarmSpec[]): Promise<{ scheduled: number; exact: boolean }>;
  cancelAll(): Promise<void>;
  /** Stop nagging these step keys (the step is done). */
  acknowledge(keys: string[]): Promise<void>;
  setQuiet(until: number | null): Promise<void>;
  testAlarm(seconds: number, title?: string, body?: string): Promise<{ at: number; exact: boolean }>;
  scheduled(): Promise<{ alarms: AlarmSpec[]; nags: StoredNag[] }>;
  drainActions(): Promise<NotificationAction[]>;
  onFired(fn: (e: AlarmEvent) => void): Unsubscribe;
  onAction(fn: (e: AlarmEvent) => void): Unsubscribe;
}

export interface PermissionService {
  status(): Promise<AlarmStatus>;
  requestNotifications(): Promise<AlarmStatus>;
  openSettings(which: 'exactAlarm' | 'battery' | 'fullScreen' | 'notifications'): Promise<void>;
}

export type SecretKey = 'haRefreshToken';

export interface SecretStore {
  get(k: SecretKey): Promise<string | null>;
  set(k: SecretKey, v: string): Promise<void>;
  remove(k: SecretKey): Promise<void>;
}

export interface ShareService {
  sharePlanFile(name: string, text: string): Promise<void>;
  onPlanOpened(fn: (file: { text?: string; name?: string; error?: string }) => void): Unsubscribe;
}

export interface AppLinks {
  openExternal(url: string): Promise<void>;
  openAuthSession(url: string, redirect: string): Promise<string | null>;
  onResume(fn: () => void): Unsubscribe;
}

/** Everything Start cook needs. Missing items block it until fixed or acknowledged (failure mode 9). */
export const allGranted = (s: AlarmStatus) => s.notifications && s.exactAlarms && s.batteryUnrestricted;
