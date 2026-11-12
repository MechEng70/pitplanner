// Step alarms: the native PitAlarms plugin (android/.../alarms/), setAlarmClock-based (SPEC section 6).
// After any plan change call rescheduleFromPlan(): it replaces the whole set. Never patch alarms one by one.

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { alarmsFromPlan, type AlarmSpec } from '../../engine/alarms.ts';
import type { Plan } from '../../engine/types.ts';

export interface AlarmStatus {
  notifications: boolean;
  exactAlarms: boolean;
  batteryUnrestricted: boolean;
  fullScreen: boolean;
}
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

interface PitAlarmsPlugin {
  setAlarms(o: { alarms: AlarmSpec[] }): Promise<{ scheduled: number; exact: boolean }>;
  cancelAll(): Promise<void>;
  acknowledge(o: { keys: string[] }): Promise<void>;
  testAlarm(o: { seconds: number; title?: string; body?: string }): Promise<{ at: number; exact: boolean }>;
  getScheduled(): Promise<{ alarms: (AlarmSpec & { test: boolean })[]; nags: StoredNag[] }>;
  drainActions(): Promise<{ actions: NotificationAction[] }>;
  status(): Promise<AlarmStatus>;
  requestNotifications(): Promise<AlarmStatus>;
  openExactAlarmSettings(): Promise<void>;
  requestBatteryExemption(): Promise<void>;
  openFullScreenSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  addListener(
    event: 'alarmFired' | 'alarmAction',
    fn: (e: { alarmId: string; keys: string[]; action?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

/** Browser dev fallback: no alarms, all permissions reported missing so the UI shows its warnings. */
const web: PitAlarmsPlugin = {
  async setAlarms(o) {
    console.info('[alarms:web] would schedule', o.alarms);
    return { scheduled: 0, exact: false };
  },
  async cancelAll() {},
  async acknowledge() {},
  async testAlarm() {
    return { at: Date.now() + 10_000, exact: false };
  },
  async getScheduled() {
    return { alarms: [], nags: [] };
  },
  async drainActions() {
    return { actions: [] };
  },
  async status() {
    return { notifications: false, exactAlarms: false, batteryUnrestricted: false, fullScreen: false };
  },
  async requestNotifications() {
    return this.status();
  },
  async openExactAlarmSettings() {},
  async requestBatteryExemption() {},
  async openFullScreenSettings() {},
  async openNotificationSettings() {},
  async addListener() {
    return { remove: async () => {} };
  },
};

export const PitAlarms: PitAlarmsPlugin = Capacitor.isNativePlatform()
  ? registerPlugin<PitAlarmsPlugin>('PitAlarms')
  : web;
export const alarmsAreNative = Capacitor.isNativePlatform();

/** Cancel every scheduled alarm and schedule the plan's future steps. */
export function rescheduleFromPlan(plan: Plan, now: number) {
  return PitAlarms.setAlarms({ alarms: alarmsFromPlan(plan, now) });
}

/** Everything Start cook needs. Missing items block it until fixed or acknowledged (failure mode 9). */
export const allGranted = (s: AlarmStatus) => s.notifications && s.exactAlarms && s.batteryUnrestricted;
