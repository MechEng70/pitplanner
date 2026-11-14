import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';
import type { Cookers, ItemInput } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Draft } from '@/lib/draft';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import { defaultOptions, method } from '@/lib/rules';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { PlanTab } from './PlanTab';

const gear: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() };
const brisket = saturday.items[0]!;
const wings = (id: string, methodId: string): ItemInput => ({
  id,
  foodId: 'wings',
  methodId,
  quantity: 2,
  options: defaultOptions(method('wings', methodId)),
  restMin: 5,
});

beforeEach(() => {
  jest.useFakeTimers();
  // The host view has no layout in Jest: the smoker temp field reports where the device would put it.
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: (cb: (...r: number[]) => void) => void }, 'measureInWindow')
    .mockImplementation(cb => cb(16, 150, 328, 60));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

async function show(items: ItemInput[]) {
  const r = testRepos();
  r.repos.cookers.save(gear, NOW);
  r.repos.rates.setRate('brisket', 0.75, NOW);
  const draft: Draft = { mode: 'readyBy', at: saturday.at, pitTempF: 225, items };
  r.repos.settings.setDraft(draft, NOW);
  await render(<PlanTab pickDateTime={jest.fn(async () => null)} now={() => NOW} />, {
    wrapper: storeWrapper(r.repos),
  });
  return r.repos;
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const saved = (repos: Awaited<ReturnType<typeof show>>) => repos.settings.draft()!;

describe('smoker temp', () => {
  test('the field opens the menu under it; a choice sets the temp, closes the menu and re-times the plan', async () => {
    const repos = await show([brisket]);
    expect(screen.queryByRole('option')).toBeNull();
    await fireEvent.press(button('Smoker temp'));
    expect(screen.getByTestId('menu-anchor')).toHaveStyle({ top: 150, left: 16, width: 328 });
    await fireEvent.press(screen.getByRole('option', { name: /^250F/ }));
    expect(screen.queryByRole('option')).toBeNull();
    const field = button('Smoker temp');
    expect(within(field).getByText('250F')).toBeOnTheScreen();
    expect(within(field).queryByText('Fire 6:20 AM')).toBeNull();
    expect(saved(repos).pitTempF).toBe(250);
  });

  test('closing the menu changes nothing', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Smoker temp'));
    await fireEvent.press(screen.getByLabelText('Close menu'));
    expect(screen.queryByRole('option')).toBeNull();
    expect(saved(repos).pitTempF).toBe(225);
  });
});

describe('Add food', () => {
  test('choosing a food puts it on the menu with the rules defaults', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Add food'));
    expect(screen.getByRole('heading', { name: 'Add food' })).toBeOnTheScreen();
    await fireEvent.press(button(/^Chicken wings/));
    await settle();
    expect(screen.queryByRole('heading', { name: 'Add food' })).toBeNull();
    expect(button('Chicken wings, edit')).toBeOnTheScreen();
    const items = saved(repos).items;
    expect(items.map(i => i.foodId)).toEqual(['brisket', 'wings']);
    expect(items[1]!.id).not.toBe(items[0]!.id);
    expect(items[1]!.methodId).toBe('smokeCrisp');
  });

  test('from the empty plan too; the same food twice gets two ids', async () => {
    const repos = await show([]);
    for (let i = 0; i < 2; i++) {
      await fireEvent.press(button('Add food'));
      // The sheet's row is the last match: on the second pass the card behind it is named Brisket too.
      await fireEvent.press(screen.getAllByRole('button', { name: /^Brisket/ }).at(-1)!);
      await settle();
    }
    const ids = saved(repos).items.map(i => i.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('Conflicts', () => {
  const clash = [wings('w1', 'smokeCrisp'), wings('w2', 'hot')];

  test('the tile opens the sheet; Move to the griddle changes the plan and the conflict goes', async () => {
    const repos = await show(clash);
    await fireEvent.press(button('Conflicts 1'));
    expect(screen.getByRole('heading', { name: 'Conflicts' })).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Move chicken wings to the griddle' })[0]!);
    const moved = saved(repos).items.filter(i => i.methodId === 'griddle');
    expect(moved).toHaveLength(1);
    expect(moved[0]!.restMin).toBe(method('wings', 'griddle').restMin.default);
    expect(screen.getByText('Nothing to fix. The plan fits your cookers.')).toBeOnTheScreen();
    await fireEvent.press(button('Close'));
    await settle();
    expect(button('Conflicts None')).toBeOnTheScreen();
  });

  test('Change smoker temp closes the sheet and opens the temp menu', async () => {
    await show(clash);
    await fireEvent.press(button('Conflicts 1'));
    await fireEvent.press(button('Change smoker temp'));
    await settle();
    expect(screen.queryByRole('heading', { name: 'Conflicts' })).toBeNull();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });
});
