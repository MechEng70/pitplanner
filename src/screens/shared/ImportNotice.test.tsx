import { act, fireEvent, render, screen } from '@testing-library/react-native';
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
