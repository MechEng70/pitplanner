import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { foodBlurb, foods, groups } from '@/lib/rules';
import { FoodPick } from './FoodPick';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

async function show() {
  const onPick = jest.fn();
  const onClose = jest.fn();
  await render(<FoodPick onPick={onPick} onClose={onClose} />);
  return { onPick, onClose };
}
const search = () => screen.getByLabelText('Search foods');
const shownFoods = () =>
  screen.getAllByRole('button').flatMap(b => foods.filter(f => within(b).queryByText(f.name)).map(f => f.name));
const headings = () => groups().filter(g => screen.queryByRole('heading', { name: g }) != null);

describe('Add food (mockup 07)', () => {
  test('lists every food under its group, in the order of the rules file, with its blurb', async () => {
    await show();
    expect(screen.getByRole('heading', { name: 'Add food' })).toBeOnTheScreen();
    expect(headings()).toEqual(['Beef', 'Pork', 'Chicken']);
    expect(shownFoods()).toEqual(foods.map(f => f.name));
    for (const f of foods) {
      const row = screen.getByRole('button', { name: new RegExp(`^${f.name}`) });
      expect(within(row).getByText(foodBlurb(f))).toBeOnTheScreen();
    }
    expect(within(screen.getByRole('button', { name: /^Brisket/ })).getByText('Smoker, by weight')).toBeOnTheScreen();
  });

  test('search filters by food name, ignoring case and spaces around it', async () => {
    await show();
    await fireEvent.changeText(search(), '  RIB ');
    expect(shownFoods()).toEqual(['St. Louis ribs', 'Baby back ribs']);
    expect(headings()).toEqual(['Pork']);
  });

  test('search also matches a group name', async () => {
    await show();
    await fireEvent.changeText(search(), 'chick');
    expect(shownFoods()).toEqual(['Chicken breasts', 'Chicken wings']);
    await fireEvent.changeText(search(), 'beef');
    expect(shownFoods()).toEqual(['Brisket', 'Tri-tip']);
  });

  test('says so when nothing matches, and clearing the search brings the list back', async () => {
    await show();
    await fireEvent.changeText(search(), 'salmon');
    expect(shownFoods()).toEqual([]);
    expect(screen.getByText('No foods match "salmon".')).toBeOnTheScreen();
    await fireEvent.changeText(search(), '');
    expect(screen.queryByText(/No foods match/)).toBeNull();
    expect(shownFoods()).toHaveLength(foods.length);
  });

  test('choosing a food closes the sheet, then reports its id', async () => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('button', { name: /^Tri-tip/ }));
    expect(onPick).not.toHaveBeenCalled();
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('tritip');
  });

  test('Close closes without choosing', async () => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});
