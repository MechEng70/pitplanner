import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from '@/components/kit';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import { fmtTime } from '@/lib/format';
import { fakeAlarms, fakeResume, type FakeAlarms } from '@/platform/fakes';
import { storeWrapper, testRepos } from '@/test/store';
import { AlertsStep } from './AlertsStep';
import { Setup, type AlertsStep as AlertsStepSlot } from './Setup';
import { SetupGate } from './SetupGate';

const OFF = { notifications: false, exactAlarms: false, batteryUnrestricted: false, fullScreen: false };
const button = (name: string) => screen.getByRole('button', { name });
const flush = () => act(async () => {});

async function show(alarms: FakeAlarms = fakeAlarms()) {
  const app = fakeResume();
  const onBack = jest.fn();
  const onFinish = jest.fn();
  await render(
    <AlertsStep permissions={alarms} alarms={alarms} onResume={app.onResume} onBack={onBack} onFinish={onFinish} />,
  );
  await flush();
  return { alarms, app, onBack, onFinish };
}

describe('Setup step 3: alerts (mockup 03)', () => {
  test('shows the title, the intro, step 3 of 3, Back and Finish setup', async () => {
    const { onBack, onFinish } = await show();
    expect(screen.getByRole('heading', { name: 'Make sure alerts get through' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'A 6 AM "wrap the brisket" alert has to ring even with the phone asleep. Android needs a few permissions for that.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 3 of 3')).toBeOnTheScreen();
    await fireEvent.press(button('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('Finish setup'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test('a permission that is off has an Allow button; one that is on shows On', async () => {
    const alarms = fakeAlarms();
    alarms.granted = { notifications: true, exactAlarms: false, batteryUnrestricted: false, fullScreen: true };
    await show(alarms);
    expect(screen.getByText('Notifications')).toBeOnTheScreen();
    expect(screen.getByText('Alarms and reminders')).toBeOnTheScreen();
    expect(screen.getByText('No battery limits')).toBeOnTheScreen();
    expect(screen.queryByText('Full-screen alerts')).toBeNull();
    expect(screen.getAllByText('On')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull();
    await fireEvent.press(button('Allow alarms and reminders'));
    await flush();
    await fireEvent.press(button('Allow no battery limits'));
    await flush();
    expect(alarms.calls).toEqual(['openSettings exactAlarm', 'openSettings battery']);
  });

  // T-102 (Google Play): Allow opens Pit Planner's App info, no longer Android's one-tap question, so the row
  // says where to go from there. Jason's words, 2026-11-20, after his OnePlus showed other names than the
  // Android 15 and 16 emulators (SPEC section 3 has both paths).
  test('No battery limits says where to go while it is off, and what it is for once it is on', async () => {
    const steps =
      "Tap Allow, open the app's battery setting and pick no restrictions (Unrestricted or Allow background activity, depending on your phone)";
    const why = 'Keeps overnight alerts from being delayed';
    const alarms = fakeAlarms();
    alarms.granted = { notifications: true, exactAlarms: true, batteryUnrestricted: false, fullScreen: true };
    const { app } = await show(alarms);
    expect(screen.getByText(steps)).toBeOnTheScreen();
    expect(screen.queryByText(why)).toBeNull();
    await fireEvent.press(button('Allow no battery limits'));
    await flush();
    expect(alarms.calls).toEqual(['openSettings battery']);

    alarms.granted = { ...alarms.granted, batteryUnrestricted: true };
    await act(async () => app.resume());
    expect(screen.getByText(why)).toBeOnTheScreen();
    expect(screen.queryByText(steps)).toBeNull();
  });

  test('the rows are read again when the app comes back from Settings', async () => {
    const alarms = fakeAlarms();
    alarms.granted = { ...OFF };
    const { app } = await show(alarms);
    expect(screen.queryByText('On')).toBeNull();
    expect(button('Allow alarms and reminders')).toBeOnTheScreen();
    expect(screen.getByText('Full-screen alerts')).toBeOnTheScreen();

    alarms.granted = { notifications: true, exactAlarms: true, batteryUnrestricted: true, fullScreen: true };
    await act(async () => app.resume());
    expect(screen.getAllByText('On')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^Allow/ })).toBeNull();
    expect(screen.queryByText('Full-screen alerts')).toBeNull();
  });

  test('stops listening for resume when it leaves the screen', async () => {
    const { app } = await show();
    expect(app.listeners()).toBe(1);
    await screen.unmount();
    expect(app.listeners()).toBe(0);
  });

  test('the test alert goes through testAlarm with 10 seconds, once, and says when it rings', async () => {
    const { alarms } = await show();
    expect(screen.queryByText(/Test alert set for/)).toBeNull();
    await fireEvent.press(button('Send a test alert in 10 sec'));
    await flush();
    expect(alarms.calls).toEqual(['testAlarm 10']);
    const line = screen.getByText(/^Test alert set for .*\. Lock the phone to check it rings\.$/);
    expect(line).toHaveTextContent(
      `Test alert set for ${fmtTime(10_000).replace(/ /g, ' ')}. Lock the phone to check it rings.`,
    );
  });

  test('a test alert the phone refuses shows no line', async () => {
    const alarms = fakeAlarms();
    alarms.testAlarm = () => Promise.reject(new Error('no'));
    await show(alarms);
    await fireEvent.press(button('Send a test alert in 10 sec'));
    await flush();
    expect(screen.queryByText(/Test alert set for/)).toBeNull();
  });

  test('Finish setup saves the cookers with every permission off', async () => {
    const alarms = fakeAlarms();
    alarms.granted = { ...OFF };
    const app = fakeResume();
    const alertsStep: AlertsStepSlot = p => (
      <AlertsStep permissions={alarms} alarms={alarms} onResume={app.onResume} {...p} />
    );
    const { repos } = testRepos();
    await render(
      <SetupGate done={<Text>The tabs</Text>}>
        <Setup alertsStep={alertsStep} />
      </SetupGate>,
      { wrapper: storeWrapper(repos) },
    );
    await fireEvent.press(button('Continue'));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Griddle' }));
    await fireEvent.press(button('Continue'));
    await flush();
    expect(button('Allow notifications')).toBeOnTheScreen();
    expect(repos.cookers.count()).toBe(0);
    await fireEvent.press(button('Finish setup'));
    expect(repos.cookers.load()).toEqual({ griddle: defaultGriddle(), oven: defaultOven() });
    expect(screen.getByText('The tabs')).toBeOnTheScreen();
    expect(alarms.calls).toEqual([]);
  });
});
