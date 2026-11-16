// "Send to developer" (T-065, SPEC section 6): the one file a tester sends from the hidden debug screen.
// Pure builders: the time, the phone's facts, the alert permissions, the stored alarms and the app's data
// are passed in. The file holds what SPEC lists and nothing else:
//   app version and build, Android version, phone model, font size, time zone; the alert permissions as the
//   phone reports them; the alarms the app has stored and their repeats; the app's data (cookers, plan,
//   running cook, cook history, rates, settings and flags); the app's own log of recent events.
// No location, no accounts, no contacts, nothing from other apps.

import type { AlarmStatus, DeviceFacts, StoredNag } from '../platform/types.ts';
import { EVENT_LOG_KEY, parseEventLog, type LogEvent } from './eventLog.ts';

/** Where the tester sends the file. Shown on the debug screen and handed to the share sheet. */
export const DEVELOPER_EMAIL = 'pitplanapp@gmail.com';

type Cell = string | number | null | Uint8Array;
type Row = Record<string, Cell>;

/** The app's tables as "Export my data" reads them (src/db/export.ts `ExportDump` fits). */
export interface ReportData {
  schemaVersion: number;
  tables: Record<string, Row[]>;
  errors: Record<string, string>;
}

/** An alarm as the phone holds it. */
export interface ReportAlarm {
  id: string;
  at: number;
  title: string;
  body: string;
  critical: boolean;
  keys: string[];
  test?: boolean;
}

export interface ReportInput {
  now: number;
  device: DeviceFacts;
  /** Null when the phone could not be asked (the reason goes in `problems`). */
  permissions: AlarmStatus | null;
  scheduled: { alarms: ReportAlarm[]; nags: StoredNag[] } | null;
  data: ReportData | null;
  /** What could not be read while gathering, in plain words. */
  problems: string[];
}

export interface DebugReport {
  format: 'pitplanner-debug';
  formatVersion: 1;
  createdAt: number;
  app: { version: string; build: number | null };
  phone: {
    androidVersion: string;
    apiLevel: number | null;
    model: string;
    fontScale: number;
    timeZone: string;
  };
  permissions: AlarmStatus | null;
  alarms: { alarms: ReportAlarm[]; repeats: StoredNag[] } | null;
  data: ReportData | null;
  log: LogEvent[];
  /** Tables, kv rows and fields that were kept out of the file, by name only. */
  leftOut: string[];
  problems: string[];
}

/** The tables the file may hold: the app's data named in SPEC. Any other table is left out by name. */
export const REPORT_TABLES: readonly string[] = [
  'active_cook',
  'cook_history',
  'cook_history_items',
  'cookers',
  'kv',
  'rate_overrides',
];

/** A name that says the value is a secret. The app stores none today; if one is ever added it stays out. */
const SECRET_NAME = /token|secret|password|passwd|credential|api_?key|authorization/i;
export const isSecretName = (name: string): boolean => SECRET_NAME.test(name);

/** JSON with every secret-named field removed. `found` gets the names removed. */
function scrubJson(value: unknown, path: string, found: string[]): unknown {
  if (Array.isArray(value)) return value.map(v => scrubJson(v, path, found));
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (isSecretName(k)) found.push(`${path}.${k}`);
    else out[k] = scrubJson(v, `${path}.${k}`, found);
  }
  return out;
}

/** One stored cell: a secret-named column goes, JSON text loses its secret-named fields, bytes are not sent. */
function scrubCell(column: string, cell: Cell, path: string, found: string[]): Cell | undefined {
  if (isSecretName(column)) {
    found.push(path);
    return undefined;
  }
  if (cell instanceof Uint8Array) {
    found.push(path);
    return undefined;
  }
  if (typeof cell !== 'string' || !/^\s*[[{]/.test(cell)) return cell;
  let json: unknown;
  try {
    json = JSON.parse(cell);
  } catch {
    return cell;
  }
  const inner: string[] = [];
  const clean = scrubJson(json, path, inner);
  if (inner.length === 0) return cell;
  found.push(...inner);
  return JSON.stringify(clean);
}

/** The app's data for the file: listed tables only, the event log moved out, secrets left out. */
export function reportData(data: ReportData): { data: ReportData; log: LogEvent[]; leftOut: string[] } {
  const leftOut: string[] = [];
  let log: LogEvent[] = [];
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(data.tables)) {
    if (!REPORT_TABLES.includes(name)) {
      leftOut.push(`table ${name}`);
      continue;
    }
    const kept: Row[] = [];
    for (const row of rows) {
      const key = name === 'kv' && typeof row.key === 'string' ? row.key : null;
      if (key === EVENT_LOG_KEY) {
        try {
          log = parseEventLog(JSON.parse(String(row.value))) ?? [];
        } catch {
          log = [];
        }
        continue;
      }
      if (key !== null && isSecretName(key)) {
        leftOut.push(`kv ${key}`);
        continue;
      }
      const where = key !== null ? `kv ${key}` : name;
      const out: Row = {};
      for (const [column, cell] of Object.entries(row)) {
        const clean = scrubCell(column, cell, `${where}.${column}`, leftOut);
        if (clean !== undefined) out[column] = clean;
      }
      kept.push(out);
    }
    tables[name] = kept;
  }
  const errors: Record<string, string> = {};
  for (const [name, why] of Object.entries(data.errors)) if (REPORT_TABLES.includes(name)) errors[name] = why;
  return {
    data: { schemaVersion: data.schemaVersion, tables, errors },
    log,
    leftOut: [...new Set(leftOut)].sort(),
  };
}

const pickAlarm = (a: ReportAlarm): ReportAlarm => ({
  id: a.id,
  at: a.at,
  title: a.title,
  body: a.body,
  critical: a.critical,
  keys: [...a.keys],
  ...(a.test ? { test: true } : {}),
});
const pickNag = (n: StoredNag): StoredNag => ({
  alarmId: n.alarmId,
  keys: [...n.keys],
  title: n.title,
  body: n.body,
  count: n.count,
  nextAt: n.nextAt,
});

/** The file's contents. Every field is copied by name, so nothing extra a caller passes can ride along. */
export function buildDebugReport(input: ReportInput): DebugReport {
  const { device, permissions, scheduled } = input;
  const app = input.data ? reportData(input.data) : null;
  return {
    format: 'pitplanner-debug',
    formatVersion: 1,
    createdAt: input.now,
    app: { version: device.appVersion, build: device.build },
    phone: {
      androidVersion: device.androidVersion,
      apiLevel: device.apiLevel,
      model: device.model,
      fontScale: device.fontScale,
      timeZone: device.timeZone,
    },
    permissions: permissions && {
      notifications: permissions.notifications,
      exactAlarms: permissions.exactAlarms,
      batteryUnrestricted: permissions.batteryUnrestricted,
      fullScreen: permissions.fullScreen,
    },
    alarms: scheduled && { alarms: scheduled.alarms.map(pickAlarm), repeats: scheduled.nags.map(pickNag) },
    data: app ? app.data : null,
    log: app ? app.log : [],
    leftOut: app ? app.leftOut : [],
    problems: [...input.problems],
  };
}

export const debugReportText = (report: DebugReport): string => JSON.stringify(report, null, 1);

/** pitplanner-debug-2026-11-15-2205.json (UTC, so the name never depends on the phone's time zone). */
export function debugReportFileName(now: number): string {
  const [date, time] = new Date(now).toISOString().split('T') as [string, string];
  return `pitplanner-debug-${date}-${time.slice(0, 5).replace(':', '')}.json`;
}

/** What the file holds, in plain words, as the debug screen lists it (SPEC section 6). */
export const REPORT_HOLDS: readonly string[] = [
  'App version and build, Android version, phone model, font size and time zone',
  'Alert permissions as the phone reports them',
  'Alarms the app has stored and their repeats',
  'Your cookers, plan, running cook, cook history, rates and settings',
  "The app's log of recent events: alarms set and fired, changes to a cook, errors",
];
export const REPORT_HOLDS_NOT =
  'No location, accounts or contacts. Nothing from other apps. Nothing is sent until you tap Send.';
