import type { DeviceFacts } from '../platform/types';
import {
  buildDebugReport,
  debugReportFileName,
  debugReportText,
  DEVELOPER_EMAIL,
  isSecretName,
  REPORT_HOLDS,
  REPORT_HOLDS_NOT,
  reportData,
  type ReportData,
  type ReportInput,
} from './debugReport';
import { EVENT_LOG_KEY } from './eventLog';

const NOW = Date.UTC(2026, 10, 15, 22, 5);
const device: DeviceFacts = {
  appVersion: '0.3.0',
  build: 300,
  androidVersion: '16',
  apiLevel: 36,
  model: 'Pixel 8',
  fontScale: 1.15,
  timeZone: 'America/Chicago',
};
const kv = (key: string, value: unknown) => ({ key, value: JSON.stringify(value), updated_at: NOW });
const log = [
  { at: NOW - 2000, kind: 'alarms', text: 'set 7, exact' },
  { at: NOW - 1000, kind: 'fired', text: 'wrap:b:p1' },
];
const data = (): ReportData => ({
  schemaVersion: 1,
  tables: {
    active_cook: [{ id: 1, data: '{"startedAt":1}', started_at: 1, updated_at: 2 }],
    cook_history: [{ id: 'c1', served_at: 5, pit_temp_f: 225, late_min: 0, ended_early: 0, notes: '', created_at: 5 }],
    cook_history_items: [],
    cookers: [{ id: 'pb820', kind: 'smoker', profile: '{"name":"Pit Boss"}', position: 0, updated_at: 1 }],
    kv: [kv('units', { temp: 'F', weight: 'lb' }), kv('flags', { supportShown: true }), kv(EVENT_LOG_KEY, log)],
    rate_overrides: [{ food_id: 'brisket', hr_per_lb: 1.2, total_hours: null, locked: 0, updated_at: 1 }],
  },
  errors: {},
});
const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  now: NOW,
  device,
  permissions: { notifications: true, exactAlarms: false, batteryUnrestricted: true, fullScreen: true },
  scheduled: {
    alarms: [{ id: 'a', at: NOW + 60_000, title: 'Brisket', body: 'Wrap.', critical: true, keys: ['wrap:b:p1'] }],
    nags: [{ alarmId: 'f', keys: ['fire::'], title: 'Fire the smoker', body: 'To 225F.', count: 2, nextAt: NOW }],
  },
  data: data(),
  problems: [],
  ...over,
});

test('the file holds what SPEC lists: app, phone, permissions, alarms and repeats, data, log', () => {
  const r = buildDebugReport(input());
  expect(r.format).toBe('pitplanner-debug');
  expect(r.createdAt).toBe(NOW);
  expect(r.app).toEqual({ version: '0.3.0', build: 300 });
  expect(r.phone).toEqual({
    androidVersion: '16',
    apiLevel: 36,
    model: 'Pixel 8',
    fontScale: 1.15,
    timeZone: 'America/Chicago',
  });
  expect(r.permissions).toEqual(input().permissions);
  expect(r.alarms).toEqual({ alarms: input().scheduled!.alarms, repeats: input().scheduled!.nags });
  expect(Object.keys(r.data!.tables).sort()).toEqual([
    'active_cook',
    'cook_history',
    'cook_history_items',
    'cookers',
    'kv',
    'rate_overrides',
  ]);
  expect(r.data!.tables.cookers).toEqual(data().tables.cookers);
  expect(r.log).toEqual(log);
  expect(r.leftOut).toEqual([]);
  expect(r.problems).toEqual([]);
});

test('the event log is in the file once: under log, not again in the kv rows', () => {
  const r = buildDebugReport(input());
  expect(r.data!.tables.kv!.map(row => row.key)).toEqual(['units', 'flags']);
});

test('nothing outside the list: the top level and each part have exactly these fields', () => {
  const r = buildDebugReport(input());
  expect(Object.keys(r).sort()).toEqual(
    [
      'alarms',
      'app',
      'createdAt',
      'data',
      'format',
      'formatVersion',
      'leftOut',
      'log',
      'permissions',
      'phone',
      'problems',
    ].sort(),
  );
  expect(Object.keys(r.app).sort()).toEqual(['build', 'version']);
  expect(Object.keys(r.phone).sort()).toEqual(['androidVersion', 'apiLevel', 'fontScale', 'model', 'timeZone']);
  expect(Object.keys(r.permissions!).sort()).toEqual([
    'batteryUnrestricted',
    'exactAlarms',
    'fullScreen',
    'notifications',
  ]);
  expect(Object.keys(r.data!).sort()).toEqual(['errors', 'schemaVersion', 'tables']);
});

test('anything extra a caller passes does not ride along: device, permissions, alarms, repeats', () => {
  const extra = { location: '41.8,-87.6', account: 'someone@example.com', contacts: ['x'], serial: 'ABC123' };
  const base = input();
  const r = buildDebugReport({
    ...base,
    ...extra,
    device: { ...device, ...extra },
    permissions: { ...base.permissions!, ...extra },
    scheduled: {
      alarms: base.scheduled!.alarms.map(a => ({ ...a, ...extra })),
      nags: base.scheduled!.nags.map(n => ({ ...n, ...extra })),
    },
  } as ReportInput);
  const text = debugReportText(r);
  for (const word of ['41.8', 'someone@example.com', 'contacts', 'ABC123', 'location', 'account', 'serial'])
    expect(text).not.toContain(word);
});

test('a table that is not the app data named in SPEC is left out, by name', () => {
  const d = data();
  d.tables.accounts = [{ email: 'someone@example.com' }];
  d.errors.accounts = 'no such column';
  d.errors.cookers = 'malformed';
  const r = buildDebugReport(input({ data: d }));
  expect(r.data!.tables.accounts).toBeUndefined();
  expect(r.data!.errors).toEqual({ cookers: 'malformed' });
  expect(r.leftOut).toEqual(['table accounts']);
  expect(debugReportText(r)).not.toContain('someone@example.com');
});

test('secrets and tokens are never in the file: kv rows, columns and JSON fields with such names', () => {
  const d = data();
  d.tables.kv!.push(
    kv('haRefreshToken', 'tok-kv-row'),
    kv('ha', { url: 'http://ha.local', accessToken: 'tok-nested', deep: [{ password: 'pw-deep' }] }),
  );
  d.tables.cookers!.push({
    id: 'x',
    kind: 'smoker',
    profile: '{"name":"Y","apiKey":"key-in-profile"}',
    position: 1,
    updated_at: 1,
    secret: 'col-secret',
  });
  const r = buildDebugReport(input({ data: d }));
  const text = debugReportText(r);
  for (const s of ['tok-kv-row', 'tok-nested', 'pw-deep', 'key-in-profile', 'col-secret'])
    expect(text).not.toContain(s);
  // What was kept out is named, never shown; the rest of each row stays.
  expect(r.leftOut).toEqual([
    'cookers.profile.apiKey',
    'cookers.secret',
    'kv ha.value.accessToken',
    'kv ha.value.deep.password',
    'kv haRefreshToken',
  ]);
  expect(text).toContain('http://ha.local');
  expect(r.data!.tables.cookers![1]!.profile).toBe('{"name":"Y"}');
});

test('the app stores no secret today: the real keys and columns are not taken for one', () => {
  for (const name of ['units', 'flags', 'update', 'draft', 'ui', EVENT_LOG_KEY, 'quarantine:kv:draft:1', 'key', 'data'])
    expect(isSecretName(name)).toBe(false);
  for (const name of ['haRefreshToken', 'access_token', 'clientSecret', 'Password', 'apiKey', 'api_key'])
    expect(isSecretName(name)).toBe(true);
});

test('bytes are not sent; text that only looks like JSON is kept as it is', () => {
  const d = data();
  d.tables.cookers = [{ id: 'b', kind: 'oven', profile: '{broken', position: 0, blob: new Uint8Array([1, 2]) }];
  const r = reportData(d);
  expect(r.data.tables.cookers).toEqual([{ id: 'b', kind: 'oven', profile: '{broken', position: 0 }]);
  expect(r.leftOut).toEqual(['cookers.blob']);
});

test('what could not be read is said, and the rest of the file is still built', () => {
  const r = buildDebugReport(
    input({ permissions: null, scheduled: null, data: null, problems: ['stored alarms not read: Error: x'] }),
  );
  expect(r.permissions).toBeNull();
  expect(r.alarms).toBeNull();
  expect(r.data).toBeNull();
  expect(r.log).toEqual([]);
  expect(r.problems).toEqual(['stored alarms not read: Error: x']);
  expect(r.phone.model).toBe('Pixel 8');
});

test('a log row that cannot be read gives an empty log, not a failure', () => {
  const d = data();
  d.tables.kv = [{ key: EVENT_LOG_KEY, value: '{not json', updated_at: NOW }];
  expect(buildDebugReport(input({ data: d })).log).toEqual([]);
});

test('the file is JSON with a dated name; the address is one constant', () => {
  expect(debugReportFileName(NOW)).toBe('pitplanner-debug-2026-11-15-2205.json');
  expect(JSON.parse(debugReportText(buildDebugReport(input()))).format).toBe('pitplanner-debug');
  expect(DEVELOPER_EMAIL).toMatch(/^[^@\s]+@[^@\s]+$/);
});

test('the words on the screen: plain, straight apostrophes, no dashes or exclamation marks', () => {
  for (const line of [...REPORT_HOLDS, REPORT_HOLDS_NOT]) expect(line).not.toMatch(/[!—–‘’]/);
  expect(REPORT_HOLDS).toHaveLength(5);
});
