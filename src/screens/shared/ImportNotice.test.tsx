import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { importNotice, type ImportReport } from '@/db/legacyImport';
import { ImportNotice } from './ImportNotice';

jest.useFakeTimers();

test('shows the title and the sentence; OK closes it once', async () => {
  const onClose = jest.fn();
  await render(
    <ImportNotice
      title="Pit Planner has a new look"
      body="Your cookers came along. Your plan could not be moved."
      onClose={onClose}
    />,
  );
  expect(screen.getByText('Pit Planner has a new look')).toBeOnTheScreen();
  expect(screen.getByText('Your cookers came along. Your plan could not be moved.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
  await act(() => jest.runAllTimers());
  expect(onClose).toHaveBeenCalledTimes(1);
});

// T-077 (parity T18): the oven line is there only when the import raised the hold.
describe('the oven hold line', () => {
  const report = (ovenRaised: boolean): ImportReport => ({
    status: 'done',
    at: 0,
    cookers: 3,
    rates: 2,
    cooks: 2,
    plan: true,
    runningCook: false,
    lost: [],
    ovenRaised,
    noticeSeen: false,
  });
  const show = async (ovenRaised: boolean, temp: 'F' | 'C' = 'F') => {
    const notice = importNotice(report(ovenRaised), { temp, weight: 'lb' })!;
    await render(<ImportNotice title={notice.title} body={notice.body} onClose={() => {}} />);
  };

  test('raised: the notice says so after its sentence', async () => {
    await show(true);
    expect(screen.getByText(/Your smokers, cook rates, plan and history came over\./)).toBeOnTheScreen();
    expect(screen.getByText(/Oven hold raised to 140F, the safe minimum\./)).toBeOnTheScreen();
  });

  test('raised, in Celsius: the temp is in C', async () => {
    await show(true, 'C');
    expect(screen.getByText(/Oven hold raised to 60C, the safe minimum\./)).toBeOnTheScreen();
  });

  test('not raised: no oven line', async () => {
    await show(false);
    expect(screen.getByText('Your smokers, cook rates, plan and history came over.')).toBeOnTheScreen();
    expect(screen.queryByText(/Oven hold/)).toBeNull();
  });
});
