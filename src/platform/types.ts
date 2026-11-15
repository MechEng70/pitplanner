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
  /** What the phone holds to fire. `test` marks a test alarm, which is not part of the cook's set. */
  scheduled(): Promise<{ alarms: (AlarmSpec & { test?: boolean })[]; nags: StoredNag[] }>;
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

/** The 0.2.0 (Capacitor) app's saved preferences: one JSON string per key (T-011, imported in T-012). */
export interface LegacyStore {
  /** Empty when the app was never the Capacitor one, or after `retireCapacitorPrefs`. Changes nothing. */
  readCapacitorPrefs(): Record<string, string>;
  /** Only after the import has committed: keeps a copy and empties the original. True if there was data. */
  retireCapacitorPrefs(): boolean;
  /** The 0.2.0 cook history file (`files/history.json`) as text, or null when there is none. */
  readHistoryFile(): string | null;
  /** Only after the import has committed: renames the file to `history.json.imported`. */
  retireHistoryFile(): void;
}

/**
 * The system's date picker, then its time picker, starting from `initial` (epoch ms). Resolves the chosen
 * instant on the minute, or null when either dialog is dismissed.
 */
export type PickDateTime = (initial: number) => Promise<number | null>;

/** A .pitplan handed to the app: its text (and file name when known), or why it could not be read. */
export interface OpenedPlanFile {
  text?: string;
  name?: string;
  error?: string;
}

export interface ShareService {
  sharePlanFile(name: string, text: string): Promise<void>;
  /** Each opened file is handed over once; one that opened the app from cold goes to the first listener. */
  onPlanOpened(fn: (file: OpenedPlanFile) => void): Unsubscribe;
}

export interface AppLinks {
  openExternal(url: string): Promise<void>;
  openAuthSession(url: string, redirect: string): Promise<string | null>;
  onResume(fn: () => void): Unsubscribe;
}

/**
 * An anonymous GET that reads JSON (the update check): no cookies or credentials, only the headers given.
 * Rejects when there is no answer (offline, timeout); `json` is null when the answer is not ok.
 */
export type GetJson = (url: string, headers: Record<string, string>) => Promise<{ ok: boolean; json: unknown }>;

/** What "Send to developer" says about the app and the phone (T-065). Nothing that names the person. */
export interface DeviceFacts {
  appVersion: string;
  /** Android versionCode; null when the build does not say. */
  build: number | null;
  /** Android release, e.g. "16". */
  androidVersion: string;
  apiLevel: number | null;
  model: string;
  /** The system font size as a scale: 1 is the default, 1.3 is 130%. */
  fontScale: number;
  /** IANA name, e.g. "America/Chicago". */
  timeZone: string;
}
export type ReadDeviceFacts = () => DeviceFacts;

/**
 * Open the share sheet with one text file for the developer. `recipient` is the address offered when the
 * tester picks an email app (Android: `modules/pit-share` sendFile); an implementation that cannot pass it
 * on still shows it in the sheet's title.
 */
export type ShareReport = (name: string, text: string, recipient: string) => Promise<void>;

/** Put plain text on the phone's clipboard (T-065: the developer's address). Rejects when it was not copied. */
export type CopyText = (text: string) => Promise<void>;

/** Errors nothing caught (the app is about to show its crash). The handler that was there still runs. */
export type OnUncaughtError = (fn: (error: unknown, fatal: boolean) => void) => Unsubscribe;

/** Everything Start cook needs. Missing items block it until fixed or acknowledged (failure mode 9). */
export const allGranted = (s: AlarmStatus) => s.notifications && s.exactAlarms && s.batteryUnrestricted;
