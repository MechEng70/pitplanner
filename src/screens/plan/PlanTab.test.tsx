import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';
import type { Cookers, ItemInput } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Draft } from '@/lib/draft';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import { defaultOptions, method, rules } from '@/lib/rules';
import { parsePitPlan } from '@/lib/sharedPlan';
import { fakeAlarms, fakeResume, fakeShare, type FakeShare } from '@/platform/fakes';
import { toPitPlan } from '@/lib/pitPlanFile';
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
/** What the route gives the tab: nothing here starts a cook (StartCook.test.tsx does). */
const tabProps = () => ({
  pickDateTime: jest.fn(async () => null),
  permissions: fakeAlarms(),
  onResume: fakeResume().onResume,
  onCookStarted: jest.fn(),
  now: () => NOW,
});
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

async function show(items: ItemInput[], share?: FakeShare) {
  const r = testRepos();
  r.repos.cookers.save(gear, NOW);
  r.repos.rates.setRate('brisket', 0.75, NOW);
  const draft: Draft = { mode: 'readyBy', at: saturday.at, pitTempF: 225, items };
  r.repos.settings.setDraft(draft, NOW);
  await render(<PlanTab {...tabProps()} sharePlanFile={share?.sharePlanFile} />, { wrapper: storeWrapper(r.repos) });
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
  test('choosing a food opens its details; it goes on the menu on Add to plan, not before', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Add food'));
    expect(screen.getByRole('heading', { name: 'Add food' })).toBeOnTheScreen();
    await fireEvent.press(button(/^Chicken wings/));
    await settle();
    expect(screen.queryByRole('heading', { name: 'Add food' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Chicken wings' })).toBeOnTheScreen();
    expect(saved(repos).items.map(i => i.foodId)).toEqual(['brisket']);
    await fireEvent.press(button('Add to plan'));
    await settle();
    expect(screen.queryByRole('heading', { name: 'Chicken wings' })).toBeNull();
    expect(button('Chicken wings, edit')).toBeOnTheScreen();
    const items = saved(repos).items;
    expect(items.map(i => i.foodId)).toEqual(['brisket', 'wings']);
    expect(items[1]!.id).not.toBe(items[0]!.id);
    expect(items[1]!.methodId).toBe('smokeCrisp');
  });

  test('closing food details without Add to plan adds nothing', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Add food'));
    await fireEvent.press(button(/^Chicken wings/));
    await settle();
    await fireEvent.press(button('Close'));
    await settle();
    expect(saved(repos).items.map(i => i.foodId)).toEqual(['brisket']);
  });

  test('from the empty plan too; the same food twice gets two ids', async () => {
    const repos = await show([]);
    for (let i = 0; i < 2; i++) {
      await fireEvent.press(button('Add food'));
      // The sheet's row is the last match: on the second pass the card behind it is named Brisket too.
      await fireEvent.press(screen.getAllByRole('button', { name: /^Brisket/ }).at(-1)!);
      await settle();
      await fireEvent.press(button('Add to plan'));
      await settle();
    }
    const ids = saved(repos).items.map(i => i.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('Food details', () => {
  test('a food card opens it; Save writes the change to the plan', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Brisket, edit'));
    expect(screen.getByRole('heading', { name: 'Brisket' })).toBeOnTheScreen();
    await fireEvent.press(button('More trimmed weight'));
    expect(saved(repos).items[0]!.quantity).toBe(12);
    await fireEvent.press(button('Save'));
    await settle();
    expect(saved(repos).items).toEqual([{ ...brisket, quantity: 12.5 }]);
  });

  test('Remove takes the food off the menu', async () => {
    const repos = await show([brisket, wings('w1', 'smokeCrisp')]);
    await fireEvent.press(button('Brisket, edit'));
    await fireEvent.press(button('Remove'));
    await settle();
    expect(saved(repos).items.map(i => i.id)).toEqual(['w1']);
  });

  test('the dev seed link opens it for an item, or for a new food', async () => {
    const r = testRepos();
    r.repos.cookers.save(gear, NOW);
    r.repos.settings.setDraft({ mode: 'readyBy', at: saturday.at, pitTempF: 225, items: [brisket] }, NOW);
    const first = await render(<PlanTab {...tabProps()} open={{ edit: 'b' }} />, {
      wrapper: storeWrapper(r.repos),
    });
    expect(button('Save')).toBeOnTheScreen();
    await first.unmount();
    await render(<PlanTab {...tabProps()} open={{ add: 'stlribs' }} />, {
      wrapper: storeWrapper(r.repos),
    });
    expect(screen.getByRole('heading', { name: 'St. Louis ribs' })).toBeOnTheScreen();
    expect(button('Add to plan')).toBeOnTheScreen();
  });
});

describe('Conflicts', () => {
  const clash = [wings('w1', 'smokeCrisp'), wings('w2', 'hot')];

  test('the tile opens the sheet; Move to the griddle changes the plan and the conflict goes', async () => {
    const repos = await show(clash);
    await fireEvent.press(button('Conflicts 1'));
    expect(screen.getByRole('heading', { name: 'Conflicts' })).toBeOnTheScreen();
    await fireEvent.press(button('Move 2 lb chicken wings 1 to the griddle'));
    const moved = saved(repos).items.filter(i => i.methodId === 'griddle');
    expect(moved).toHaveLength(1);
    expect(moved[0]!.restMin).toBe(method('wings', 'griddle').restMin.default);
    expect(screen.getByText('Nothing to fix. The plan fits your cookers.')).toBeOnTheScreen();
    await fireEvent.press(button('Close'));
    await settle();
    expect(button('Conflicts None')).toBeOnTheScreen();
  });

  test('Edit opens that food after the sheet closes', async () => {
    await show(clash);
    await fireEvent.press(button('Conflicts 1'));
    await fireEvent.press(button('Edit 2 lb chicken wings 1'));
    await settle();
    expect(screen.queryByRole('heading', { name: 'Conflicts' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Chicken wings' })).toBeOnTheScreen();
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

// T-058: Android may kill the app in the background or recreate its activity. Food details comes back as
// it was left, unsaved changes included.
describe('after the app was killed', () => {
  const again = (repos: Awaited<ReturnType<typeof show>>) =>
    render(<PlanTab {...tabProps()} />, { wrapper: storeWrapper(repos) });

  test('food details reopens with the unsaved change and Use for future; Save then writes it', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Brisket, edit'));
    await fireEvent.press(button('More trimmed weight'));
    await fireEvent.press(screen.getByRole('checkbox', { name: /Use for future/ }));
    await screen.unmount();
    expect(saved(repos).items[0]!.quantity).toBe(12);

    await again(repos);
    expect(screen.getByRole('heading', { name: 'Brisket' })).toBeOnTheScreen();
    expect(screen.getByText('12.5')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: /Use for future/ })).toBeChecked();
    await fireEvent.press(button('Save'));
    await settle();
    expect(saved(repos).items[0]!.quantity).toBe(12.5);
  });

  test('a new food that was not added yet reopens with Add to plan', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Add food'));
    await fireEvent.press(button(/^Chicken wings/));
    await settle();
    await screen.unmount();
    await again(repos);
    expect(screen.getByRole('heading', { name: 'Chicken wings' })).toBeOnTheScreen();
    expect(button('Add to plan')).toBeOnTheScreen();
    expect(saved(repos).items).toHaveLength(1);
  });

  test('closed food details stays closed', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Brisket, edit'));
    await fireEvent.press(button('Close'));
    await settle();
    await screen.unmount();
    await again(repos);
    expect(screen.queryByRole('heading', { name: 'Brisket' })).toBeNull();
  });

  test('saved food details stays closed too', async () => {
    const repos = await show([brisket]);
    await fireEvent.press(button('Brisket, edit'));
    await fireEvent.press(button('Save'));
    await settle();
    await screen.unmount();
    await again(repos);
    expect(screen.queryByRole('heading', { name: 'Brisket' })).toBeNull();
  });

  test('an edit of a food that is no longer on the menu is dropped', async () => {
    const repos = await show([brisket, wings('w1', 'smokeCrisp')]);
    await fireEvent.press(button('Brisket, edit'));
    await screen.unmount();
    repos.settings.setDraft({ ...saved(repos), items: [wings('w1', 'smokeCrisp')] }, NOW);
    await again(repos);
    expect(screen.queryByRole('heading', { name: 'Brisket' })).toBeNull();
    expect(button('Chicken wings, edit')).toBeOnTheScreen();
  });
});

describe('Share plan (T-029)', () => {
  // This cook's own timing, set in food details: it stays on the sender's phone.
  const tuned: ItemInput = { ...brisket, timingModel: 'totalHours', totalHours: 9, totalHoursAtF: 225, hrPerLb: 0.7 };
  const menu = [tuned, wings('w1', 'smokeCrisp')];

  test('the share icon hands over cook.pitplan, built by toPitPlan from the plan', async () => {
    const share = fakeShare();
    await show(menu, share);
    await fireEvent.press(button('Share plan'));
    expect(share.shared).toHaveLength(1);
    const { name, text } = share.shared[0]!;
    expect(name).toBe('cook.pitplan');
    expect(text).toBe(JSON.stringify(toPitPlan(saturday.at, 225, menu), null, 2));
    // The receiving side reads it back whole.
    const opened = parsePitPlan(rules, text, i => `n${i}`);
    expect(opened).toMatchObject({ serveAt: saturday.at, pitTempF: 225, dropped: 0 });
    expect('items' in opened && opened.items.map(i => i.foodId)).toEqual(['brisket', 'wings']);
  });

  test("the sender's rates and total hours are not in the file, the saved rate included", async () => {
    const share = fakeShare();
    await show(menu, share);
    await fireEvent.press(button('Share plan'));
    const text = share.shared[0]!.text;
    for (const key of ['hrPerLb', 'totalHours', 'totalHoursAtF', 'timingModel', 'rateOverrides', 'history', 'cookers'])
      expect(text).not.toContain(key);
    const file = JSON.parse(text) as { items: ItemInput[] };
    expect(Object.keys(file).sort()).toEqual(['app', 'items', 'pitTempF', 'serveAt', 'version']);
    expect(file.items[0]).toEqual(brisket);
  });

  test('each tap shares once', async () => {
    const share = fakeShare();
    await show([brisket], share);
    await fireEvent.press(button('Share plan'));
    expect(share.shared).toHaveLength(1);
    await fireEvent.press(button('Share plan'));
    expect(share.shared).toHaveLength(2);
  });

  test('a share that fails does not throw and changes nothing on the screen', async () => {
    const share = fakeShare();
    share.failNext = new Error('no share sheet');
    const repos = await show([brisket], share);
    const before = screen.toJSON();
    await fireEvent.press(button('Share plan'));
    await act(async () => {});
    expect(share.shared).toHaveLength(1);
    expect(share.failNext).toBeNull();
    expect(screen.toJSON()).toEqual(before);
    expect(saved(repos).items).toEqual([brisket]);
    // The next tap shares again.
    await fireEvent.press(button('Share plan'));
    expect(share.shared).toHaveLength(2);
  });

  test('a share service that throws at once does not throw either', async () => {
    const share = fakeShare();
    share.sharePlanFile = jest.fn(() => {
      throw new Error('no module');
    });
    await show([brisket], share);
    await fireEvent.press(button('Share plan'));
    expect(share.sharePlanFile).toHaveBeenCalledTimes(1);
  });
});
