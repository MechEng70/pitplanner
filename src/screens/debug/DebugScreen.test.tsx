import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { alarmsFromPlan } from '../../../engine/alarms';
import { buildPlan } from '../../../engine/plan';
import { newCook } from '@/lib/cook';
import { saturday } from '@/lib/fixtures/saturday';
import { rules } from '@/lib/rules';
import { DEVELOPER_EMAIL, REPORT_HOLDS, REPORT_HOLDS_NOT, type DebugReport } from '@/lib/debugReport';
import { EVENT_LOG_KEY } from '@/lib/eventLog';
import { fakeAlarms, fakeClipboard, fakeDevice, fakeReportShare } from '@/platform/fakes';
import { reportSharer } from '@/platform/shareFile';
import type { ShareReport } from '@/platform/types';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { DebugScreen } from './DebugScreen';

/** expo-sharing under the real Send to developer fallback: counts each call, then opens or rejects. */
let mockShareFails: Error | null = null;
let mockShareCalls = 0;
jest.mock('expo-sharing', () => ({
  shareAsync: async () => {
    mockShareCalls++;
    if (mockShareFails) throw mockShareFails;
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'CACHE' },
  File: class {
    uri = 'file:///CACHE/pitplanner-debug.json';
    create() {}
    writeSync() {}
  },
}));
// The native module is not in Jest.
jest.mock('../../../modules/pit-share', () => ({ pitShare: {} }));

const plan = buildPlan(rules, saturday);

async function show(withCook: boolean, share?: ShareReport) {
  const r = testRepos();
  if (withCook) r.repos.activeCook.save(newCook(saturday, plan, NOW), NOW);
  const alarms = fakeAlarms();
  const onClose = jest.fn();
  const report = fakeReportShare();
  const clipboard = fakeClipboard();
  await render(
    <DebugScreen
      alarms={alarms}
      permissions={alarms}
      device={fakeDevice}
      share={share ?? report.share}
      copy={clipboard.copy}
      onClose={onClose}
      now={() => NOW}
    />,
    { wrapper: storeWrapper(r.repos, () => NOW) },
  );
  return { alarms, onClose, report, clipboard, repos: r.repos };
}

test('lists every step of the running cook and rings any of them in 10 seconds', async () => {
  const { alarms } = await show(true);
  const steps = alarmsFromPlan(plan, -Infinity);
  expect(screen.getByRole('heading', { name: 'Active cook steps' })).toBeOnTheScreen();
  expect(screen.getAllByText('10 sec')).toHaveLength(steps.length);
  const step = steps[1]!;
  await fireEvent.press(screen.getAllByRole('button', { name: `Ring ${step.title} in 10 sec` })[0]!);
  await waitFor(() => expect(alarms.calls).toContain(`testAlarm 10 ${step.title} ${step.body}`));
  expect(await screen.findByText(new RegExp(`^"${step.title}" fires at `))).toBeOnTheScreen();
});

test('with no cook and an empty plan there is nothing to ring but the test alert', async () => {
  const { alarms } = await show(false);
  expect(screen.getByRole('heading', { name: 'Draft plan steps' })).toBeOnTheScreen();
  expect(screen.getByText('No steps. Add food on Plan first.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Send a test alert in 10 sec' }));
  await waitFor(() => expect(alarms.calls).toContain('testAlarm 10'));
});

test('shows the alert status and what is stored on the phone: alarms and repeats', async () => {
  const r = testRepos();
  const alarms = fakeAlarms();
  alarms.granted = { notifications: true, exactAlarms: false, batteryUnrestricted: false, fullScreen: true };
  alarms.stored = {
    alarms: [
      { id: 'a', at: NOW + 60_000, title: 'Brisket', body: 'Wrap.', critical: true, keys: ['wrap:b:p1'] },
      {
        id: 'test:1',
        at: NOW + 10_000,
        title: 'Test alert',
        body: 'Alarms work.',
        critical: true,
        keys: [],
        test: true,
      },
    ],
    nags: [
      { alarmId: 'f', keys: ['fire::'], title: 'Fire the smoker', body: 'To 225F.', count: 2, nextAt: NOW + 300_000 },
    ],
  };
  await render(
    <DebugScreen
      alarms={alarms}
      permissions={alarms}
      device={fakeDevice}
      share={fakeReportShare().share}
      copy={fakeClipboard().copy}
      onClose={() => {}}
    />,
    { wrapper: storeWrapper(r.repos, () => NOW) },
  );
  expect(await screen.findByText('Exact alarms off')).toBeOnTheScreen();
  expect(screen.getByText('Notifications on')).toBeOnTheScreen();
  expect(screen.getByText('Battery unrestricted off')).toBeOnTheScreen();
  expect(screen.getByText(/Brisket \(critical\)$/)).toBeOnTheScreen();
  expect(screen.getByText(/Test alert \(test\) \(critical\)$/)).toBeOnTheScreen();
  expect(screen.getByText(/^Repeating Fire the smoker: 2 of 6, next /)).toBeOnTheScreen();
});

test('notification taps are read and cleared; Cancel all alarms clears the phone; Close closes', async () => {
  const { alarms, onClose } = await show(false);
  expect(await screen.findByText('Nothing scheduled.')).toBeOnTheScreen();
  alarms.queued = [{ type: 'done', alarmId: 'a', keys: ['wrap:b:p1'], at: NOW }];
  await fireEvent.press(screen.getByRole('button', { name: 'Read and clear' }));
  expect(await screen.findByText(/ done wrap:b:p1$/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Read and clear' }));
  expect(await screen.findByText('None since last read.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel all alarms' }));
  await waitFor(() => expect(alarms.calls).toContain('cancelAll'));
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Send to developer says where the file goes and what it holds, and sends nothing until Send', async () => {
  const { report } = await show(false);
  expect(screen.getByRole('heading', { name: 'Send to developer' })).toBeOnTheScreen();
  expect(screen.getByText('Tap Send and pick your email app. The file goes to')).toBeOnTheScreen();
  expect(screen.getByText(DEVELOPER_EMAIL)).toBeOnTheScreen();
  expect(screen.getByText('Tap the address to copy it.')).toBeOnTheScreen();
  expect(screen.getByText("If the address isn't filled in, type it.")).toBeOnTheScreen();
  for (const line of REPORT_HOLDS) expect(screen.getByText(line)).toBeOnTheScreen();
  expect(screen.getByText(REPORT_HOLDS_NOT)).toBeOnTheScreen();
  expect(report.sent).toEqual([]);
});

test('tapping the address copies it and the screen says so', async () => {
  const { clipboard, report } = await show(false);
  expect(screen.queryByText('Address copied.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: `Copy ${DEVELOPER_EMAIL}` }));
  expect(await screen.findByText('Address copied.')).toBeOnTheScreen();
  expect(clipboard.copied).toEqual([DEVELOPER_EMAIL]);
  expect(report.sent).toEqual([]);
});

test('the address is never cut short: no line limit, so it wraps at a large font size', async () => {
  await show(false);
  const address = screen.getByText(DEVELOPER_EMAIL);
  expect(address.props.numberOfLines).toBeUndefined();
  expect(address.props.ellipsizeMode).toBeUndefined();
});

test('a clipboard that fails does not crash the screen and says nothing was copied', async () => {
  const { clipboard } = await show(false);
  clipboard.failNext = new Error('no clipboard');
  await fireEvent.press(screen.getByRole('button', { name: `Copy ${DEVELOPER_EMAIL}` }));
  await waitFor(() => expect(clipboard.copied).toEqual([DEVELOPER_EMAIL]));
  expect(screen.queryByText('Address copied.')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Send to developer' })).toBeOnTheScreen();
  // The next tap works again.
  await fireEvent.press(screen.getByRole('button', { name: `Copy ${DEVELOPER_EMAIL}` }));
  expect(await screen.findByText('Address copied.')).toBeOnTheScreen();
  expect(clipboard.copied).toEqual([DEVELOPER_EMAIL, DEVELOPER_EMAIL]);
});

test('Send opens the share sheet once with one file for the address: phone, permissions, alarms, data, log', async () => {
  const { alarms, report, repos } = await show(true);
  alarms.granted = { notifications: true, exactAlarms: false, batteryUnrestricted: true, fullScreen: false };
  alarms.stored = {
    alarms: [{ id: 'a', at: NOW + 60_000, title: 'Brisket', body: 'Wrap.', critical: true, keys: ['wrap:b:p1'] }],
    nags: [{ alarmId: 'f', keys: ['fire::'], title: 'Fire the smoker', body: 'To 225F.', count: 2, nextAt: NOW }],
  };
  repos.kv.set(EVENT_LOG_KEY, [{ at: NOW - 1000, kind: 'fired', text: 'wrap:b:p1' }], NOW);
  alarms.ringLog = [
    {
      alarmId: 'a',
      keys: ['wrap:b:p1'],
      plannedAt: NOW - 60_000,
      actualAt: NOW - 58_000,
      elapsedRealtime: 9_000_000,
      repeat: 0,
      last: false,
      source: 'alarm',
      test: false,
      idle: true,
      interactive: false,
      posted: true,
    },
  ];
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(report.sent).toHaveLength(1));
  const sent = report.sent[0]!;
  expect(sent.name).toBe('pitplanner-debug-2026-11-12-1613.json');
  expect(sent.recipient).toBe(DEVELOPER_EMAIL);
  const file = JSON.parse(sent.text) as DebugReport;
  expect(file.createdAt).toBe(NOW);
  expect(file.app).toEqual({ version: '0.3.0', build: 300 });
  expect(file.phone).toEqual({
    androidVersion: '16',
    apiLevel: 36,
    model: 'Pixel 8',
    fontScale: 1.15,
    timeZone: 'America/Chicago',
  });
  expect(file.permissions).toEqual(alarms.granted);
  expect(file.alarms).toEqual({ alarms: alarms.stored.alarms, repeats: alarms.stored.nags });
  expect(file.data!.tables.active_cook).toHaveLength(1);
  expect(file.log).toEqual([{ at: NOW - 1000, kind: 'fired', text: 'wrap:b:p1' }]);
  expect(file.rings.error).toBeNull();
  expect(file.rings.records.map(r => [r.alarmId, r.plannedAt, r.actualAt, r.lateMs])).toEqual([
    ['a', NOW - 60_000, NOW - 58_000, 2_000],
  ]);
  expect(file.problems).toEqual([]);
});

test('a ring log the phone will not hand over is named in its section, and the file is still sent', async () => {
  const { alarms, report } = await show(false);
  alarms.failRings = new Error('no ring log');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(report.sent).toHaveLength(1));
  const file = JSON.parse(report.sent[0]!.text) as DebugReport;
  expect(file.rings).toEqual({ records: [], error: 'Error: no ring log' });
  expect(file.alarms).not.toBeNull();
  expect(file.data).not.toBeNull();
});

test('what the phone will not say is noted in the file, and the file is still sent', async () => {
  const { alarms, report } = await show(false);
  alarms.scheduled = async () => {
    throw new Error('module gone');
  };
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(report.sent).toHaveLength(1));
  const file = JSON.parse(report.sent[0]!.text) as DebugReport;
  expect(file.alarms).toBeNull();
  expect(file.problems).toEqual(['stored alarms not read: Error: module gone']);
  expect(file.data).not.toBeNull();
});

// After-readout checklist, "Share plan failed on the phone": the same second-tap rejection on Send to
// developer's fallback (the native sendFile failed, so the file goes through expo-sharing).
describe('Send through the real fallback (sendFile fails, expo-sharing faked)', () => {
  const fallback = reportSharer(async () => {
    throw new Error('no activity');
  });
  beforeEach(() => {
    mockShareCalls = 0;
  });
  afterEach(() => {
    mockShareFails = null;
  });

  test('the "another share request is being processed" rejection shows no note', async () => {
    mockShareFails = Object.assign(new Error('Another share request is being processed now.'), {
      code: 'ERR_SHARING_IN_PROGRESS',
    });
    await show(false, fallback);
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(mockShareCalls).toBe(1));
    await act(async () => {});
    expect(screen.queryByText(/Could not share the file/)).toBeNull();
  });

  test('any other error still says so', async () => {
    mockShareFails = new Error('No Activity found');
    await show(false, fallback);
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Could not share the file. Error: No Activity found')).toBeOnTheScreen();
  });
});

test('a share sheet that fails says so on the screen', async () => {
  const { report } = await show(false);
  report.failNext = new Error('no app to share with');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Could not share the file. Error: no app to share with')).toBeOnTheScreen();
});
