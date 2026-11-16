// T-034 parity review, docs/parity.md section 1b rows T11 and T12: Setup's alerts step, Allow notifications
// and the battery line (parity D13: a plain line, no link).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { fakeAlarms, fakeResume, type FakeAlarms } from '@/platform/fakes';
import { AlertsStep } from './AlertsStep';

const OFF = { notifications: false, exactAlarms: false, batteryUnrestricted: false, fullScreen: true };
const flush = () => act(async () => {});

async function show(alarms: FakeAlarms) {
  await render(
    <AlertsStep
      permissions={alarms}
      alarms={alarms}
      onResume={fakeResume().onResume}
      onBack={jest.fn()}
      onFinish={jest.fn()}
    />,
  );
  await flush();
}

describe('Setup alerts: Allow notifications (T11)', () => {
  // Catches: Allow notifications going straight to Settings (Android's own question never shown), or the
  // row not being read again after the answer (it would keep its Allow button with notifications on).
  test('asks Android first; when the user says yes, Settings does not open and the row reads On', async () => {
    const alarms = fakeAlarms();
    alarms.granted = { ...OFF };
    alarms.requestNotifications = async () => {
      alarms.calls.push('requestNotifications');
      alarms.granted = { ...alarms.granted, notifications: true };
      return alarms.granted;
    };
    await show(alarms);
    expect(screen.queryByText('On')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications' }));
    await flush();
    expect(alarms.calls).toEqual(['requestNotifications']);
    expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull();
    expect(screen.getAllByText('On')).toHaveLength(1);
  });

  // Catches: a refused (or no longer asked) question leaving the user with nothing: Settings must open.
  test('when Android does not grant it, Settings opens at notifications and the Allow button stays', async () => {
    const alarms = fakeAlarms();
    alarms.granted = { ...OFF };
    await show(alarms);
    await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications' }));
    await flush();
    expect(alarms.calls).toEqual(['requestNotifications', 'openSettings notifications']);
    expect(screen.getByRole('button', { name: 'Allow notifications' })).toBeOnTheScreen();
  });
});

describe('Setup alerts: the battery line (T12, parity D13)', () => {
  const LINE = "Alerts late or missing? Check the battery settings for Pit Planner in your phone's settings.";

  // Catches: the line turned into (or wrapped in) a link or a button, or dropped from the step.
  test('the line is there, as plain text: no link, no button, nothing to tap', async () => {
    const alarms = fakeAlarms();
    alarms.granted = { ...OFF };
    await show(alarms);
    const line = screen.getByText(LINE);
    for (let n: typeof line | null = line; n; n = n.parent) {
      // Neither the line nor anything around it takes a tap or reads as a link or button.
      expect(n.props.onPress).toBeUndefined();
      expect(n.props.onClick).toBeUndefined();
      expect(['link', 'button']).not.toContain(n.props.role ?? n.props.accessibilityRole);
    }
    expect(within(line).queryByRole('link')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    // The only buttons on the step: three Allow rows, the test alert, Back and Finish setup.
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });
});
