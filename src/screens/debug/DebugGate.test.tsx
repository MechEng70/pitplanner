import { render, screen } from '@testing-library/react-native';
import { Text } from '@/components/kit';
import { grantDebugPass, takeDebugPass } from '@/lib/debugPass';
import { DebugGate } from './DebugGate';

const open = (dev: boolean) =>
  render(
    <DebugGate dev={dev} denied={<Text>Plan</Text>}>
      <Text>Alarm tests</Text>
    </DebugGate>,
  );

afterEach(() => void takeDebugPass(false)); // no pass left over for the next test

test('release build: a pitplanner://debug link does not open the debug screen', async () => {
  await open(false);
  expect(screen.queryByText('Alarm tests')).toBeNull();
  expect(screen.getByText('Plan')).toBeOnTheScreen();
});

test('release build: the 5 taps on Gear open it, and it stays open while it is on screen', async () => {
  grantDebugPass();
  const view = await open(false);
  expect(screen.getByText('Alarm tests')).toBeOnTheScreen();
  await view.rerender(
    <DebugGate dev={false} denied={<Text>Plan</Text>}>
      <Text>Alarm tests</Text>
    </DebugGate>,
  );
  expect(screen.getByText('Alarm tests')).toBeOnTheScreen();
});

test('release build: the pass is used up, so a link after the taps is still refused', async () => {
  grantDebugPass();
  const first = await open(false);
  expect(screen.getByText('Alarm tests')).toBeOnTheScreen();
  await first.unmount();
  await open(false);
  expect(screen.queryByText('Alarm tests')).toBeNull();
  expect(screen.getByText('Plan')).toBeOnTheScreen();
});

test('dev build: the link opens it (the device tests use it)', async () => {
  await open(true);
  expect(screen.getByText('Alarm tests')).toBeOnTheScreen();
});
