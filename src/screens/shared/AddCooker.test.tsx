import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { AddCooker, type CookerKind } from './AddCooker';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

async function show(hide?: CookerKind[]) {
  const onPick = jest.fn();
  const onClose = jest.fn();
  await render(<AddCooker onPick={onPick} onClose={onClose} hide={hide} />);
  return { onPick, onClose };
}

describe('Add a cooker (mockup 17)', () => {
  test('asks what is being added and offers the smoker, the griddle and the oven', async () => {
    await show();
    expect(screen.getByLabelText('Add a cooker')).toBeOnTheScreen();
    expect(screen.getByText('What are you adding?')).toBeOnTheScreen();
    expect(screen.getByText('Pellet, kamado, offset, drum, gravity, electric')).toBeOnTheScreen();
    expect(screen.getByText('Searing, chicken, wings')).toBeOnTheScreen();
    expect(screen.getByText('Holding food warm until serve')).toBeOnTheScreen();
    for (const name of ['Smoker', 'Griddle', 'Oven']) expect(screen.getByRole('button', { name })).toBeOnTheScreen();
  });

  test.each([
    ['Smoker', 'smoker'],
    ['Griddle', 'griddle'],
    ['Oven', 'oven'],
  ])('choosing %s closes the sheet, then reports it', async (name, kind) => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(onPick).not.toHaveBeenCalled();
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(kind);
  });

  test('leaves out the kinds it is told to hide', async () => {
    await show(['griddle', 'oven']);
    expect(screen.getByRole('button', { name: 'Smoker' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Griddle' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Oven' })).toBeNull();
  });

  test('Close closes without choosing', async () => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});
