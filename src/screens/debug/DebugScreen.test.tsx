import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { alarmsFromPlan } from '../../../engine/alarms';
import { buildPlan } from '../../../engine/plan';
import { newCook } from '@/lib/cook';
import { saturday } from '@/lib/fixtures/saturday';
import { rules } from '@/lib/rules';
import { fakeAlarms } from '@/platform/fakes';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { DebugScreen } from './DebugScreen';

const plan = buildPlan(rules, saturday);

async function show(withCook: boolean) {
  const r = testRepos();
  if (withCook) r.repos.activeCook.save(newCook(saturday, plan, NOW), NOW);
  const alarms = fakeAlarms();
  const onClose = jest.fn();
  await render(<DebugScreen alarms={alarms} permissions={alarms} onClose={onClose} />, {
    wrapper: storeWrapper(r.repos, () => NOW),
  });
  return { alarms, onClose };
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
  await render(<DebugScreen alarms={alarms} permissions={alarms} onClose={() => {}} />, {
    wrapper: storeWrapper(r.repos, () => NOW),
  });
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
