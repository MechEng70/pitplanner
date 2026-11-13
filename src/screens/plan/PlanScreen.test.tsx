import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { Cookers, ItemInput } from '../../../engine/types';
import type { Draft } from '@/lib/draft';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import type { CookRecord } from '@/lib/history';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { DRAFT_LOST } from './PlanEmpty';
import { PlanScreen, UNKNOWN_ITEM, type PlanScreenProps } from './PlanScreen';

const gear: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle(), oven: defaultOven() };
const brisket = saturday.items[0]!;
const wings: ItemInput = {
  id: 'w',
  foodId: 'wings',
  methodId: 'smokeCrisp',
  quantity: 2,
  options: { drybrine: 'yes' },
  restMin: 5,
};
const breasts: ItemInput = {
  id: 'c',
  foodId: 'breasts',
  methodId: 'griddle',
  quantity: 4,
  options: { thickness: 'pounded', brine: 'none' },
  restMin: 8,
};
const record: CookRecord = {
  id: 'cook-1',
  date: NOW,
  notes: '',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 550,
      log: {
        foodId: 'brisket',
        methodId: 'smoked',
        smokerId: 'pb820',
        quantity: 12,
        pitTempF: 225,
        minutesOnHeat: 550,
      },
    },
  ],
};

/** Plan over a real database holding the Saturday setup (brisket at 0.75 hr/lb) with `items` on the menu. */
async function show(items: ItemInput[], opts: { cookers?: Cookers; history?: boolean } = {}) {
  const r = testRepos();
  r.repos.cookers.save(opts.cookers ?? gear, NOW);
  r.repos.rates.setRate('brisket', 0.75, NOW);
  const draft: Draft = { mode: 'readyBy', at: saturday.at, pitTempF: 225, items };
  r.repos.settings.setDraft(draft, NOW);
  if (opts.history) r.repos.history.save(record, NOW);
  const props = {
    pickDateTime: jest.fn(async (): Promise<number | null> => null),
    onAddFood: jest.fn(),
    onEditItem: jest.fn(),
    onOpenTemp: jest.fn(),
    onOpenIssues: jest.fn(),
    onStartCook: jest.fn(),
    onShare: jest.fn(),
    onCookAgain: jest.fn(),
  } satisfies PlanScreenProps;
  await render(<PlanScreen {...props} />, { wrapper: storeWrapper(r.repos) });
  return { ...r, props };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** Icons are hidden from screen readers (the card's label names the food), so tests ask for them by id. */
const hidden = { includeHiddenElements: true };

describe('empty (mockup 04)', () => {
  test('the serve time, the empty state and its two actions; no Start cook, no share, no smoker temp', async () => {
    const { props } = await show([]);
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeOnTheScreen();
    expect(screen.getByText('Sat, Nov 14 at 5:00 PM')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'What are we cooking?' })).toBeOnTheScreen();
    expect(
      screen.getByText('Add each food and Pit Planner works back from serve time to tell you when to fire the smoker.'),
    ).toBeOnTheScreen();
    await fireEvent.press(button('Add food'));
    expect(props.onAddFood).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Start cook' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Smoker temp' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pick date and time' })).toBeNull();
  });

  test('Cook a past plan again is off until there is a past cook', async () => {
    const { props } = await show([]);
    expect(button('Cook a past plan again')).toBeDisabled();
    await fireEvent.press(button('Cook a past plan again'));
    expect(props.onCookAgain).not.toHaveBeenCalled();
  });

  test('with a past cook it opens the history', async () => {
    const { props } = await show([], { history: true });
    expect(button('Cook a past plan again')).toBeEnabled();
    await fireEvent.press(button('Cook a past plan again'));
    expect(props.onCookAgain).toHaveBeenCalledTimes(1);
  });
});

describe('a saved plan that could not be loaded', () => {
  async function lost() {
    const { db, repos } = testRepos();
    db.run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', ['draft', '{"mode":"readyBy","items":', NOW]);
    await render(<PlanScreen pickDateTime={async () => null} />, { wrapper: storeWrapper(repos) });
  }

  test('is announced, not silently replaced by an empty plan', async () => {
    await lost();
    expect(screen.getByRole('alert')).toHaveTextContent(DRAFT_LOST);
    expect(screen.getByRole('heading', { name: 'What are we cooking?' })).toBeOnTheScreen();
  });

  test('the notice goes away when the plan is changed, and its space stays so nothing moves', async () => {
    await lost();
    await fireEvent.press(screen.getByRole('radio', { name: 'Start at' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(DRAFT_LOST)).toBeNull();
    // Still laid out, unseen: the empty state below it keeps its place (T-017 PR-3).
    expect(screen.getByText(DRAFT_LOST, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  test('no notice when no plan was ever saved', async () => {
    await render(<PlanScreen pickDateTime={async () => null} />, { wrapper: storeWrapper() });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(DRAFT_LOST, { includeHiddenElements: true })).toBeNull();
  });
});

describe('plan (mockup 05)', () => {
  test('each card shows the cooker, the food, its summary, its start time and time on heat from the plan', async () => {
    await show([brisket, wings, breasts]);
    expect(screen.getByRole('heading', { name: 'On the menu' })).toBeOnTheScreen();
    expect(screen.getByText('3 items')).toBeOnTheScreen();
    const card = (name: string) => within(button(`${name}, edit`));
    expect(card('Brisket').getByText('12 lb, smoker, paper wrap')).toBeOnTheScreen();
    expect(card('Brisket').getByText('6:40 AM')).toBeOnTheScreen();
    expect(card('Brisket').getByText('9 hr on heat')).toBeOnTheScreen();
    expect(card('Chicken wings').getByText('2 lb, smoke then 400F crisp')).toBeOnTheScreen();
    expect(card('Chicken wings').getByText('3:15 PM')).toBeOnTheScreen();
    expect(card('Chicken wings').getByText('1 hr 40 min')).toBeOnTheScreen();
    expect(card('Chicken breasts').getByText('4, griddle, pounded')).toBeOnTheScreen();
    expect(card('Chicken breasts').getByText('4:40 PM')).toBeOnTheScreen();
    expect(card('Chicken breasts').getByText('12 min')).toBeOnTheScreen();
    // PR-2: the cooker icon is in every card (flame for the smoker, the griddle for the griddle).
    expect(card('Brisket').getByTestId('cooker-icon-smoker', hidden)).toBeOnTheScreen();
    expect(card('Chicken wings').getByTestId('cooker-icon-smoker', hidden)).toBeOnTheScreen();
    expect(card('Chicken breasts').getByTestId('cooker-icon-griddle', hidden)).toBeOnTheScreen();
  });

  test('one item reads "1 item"', async () => {
    await show([brisket]);
    expect(screen.getByText('1 item')).toBeOnTheScreen();
  });

  test('the tiles: fire time, pellets and conflicts', async () => {
    await show([brisket, wings, breasts]);
    expect(screen.getByLabelText('Fire smoker 6:20 AM')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Pellets ~\d+ lb$/)).toBeOnTheScreen();
    expect(button('Conflicts None')).toBeOnTheScreen();
  });

  test('the smoker temp is one field with the fire time, and there are no preset temp buttons (PR-1)', async () => {
    const { props } = await show([brisket]);
    const field = button('Smoker temp');
    expect(within(field).getByText('225F')).toBeOnTheScreen();
    expect(within(field).getByText('Fire 6:20 AM')).toBeOnTheScreen();
    await fireEvent.press(field);
    expect(props.onOpenTemp).toHaveBeenCalledTimes(1);
    // The only radios on Plan are the mode toggle.
    expect(screen.getAllByRole('radio').map(r => r.props.accessibilityLabel)).toEqual(['Ready by', 'Start at']);
    expect(screen.queryByText(/^(200|225|250|275|300)F$/, { exact: true })).toBe(within(field).getByText('225F'));
  });

  test('every control hands over to its handler', async () => {
    const { props } = await show([brisket]);
    await fireEvent.press(button('Brisket, edit'));
    expect(props.onEditItem).toHaveBeenCalledWith('b');
    await fireEvent.press(button('Add food'));
    expect(props.onAddFood).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('Conflicts None'));
    expect(props.onOpenIssues).toHaveBeenCalledTimes(1);
    await fireEvent.press(button('Start cook'));
    expect(props.onStartCook).toHaveBeenCalledTimes(1);
    expect(props.onStartCook.mock.calls[0]![0]).toMatchObject({ serveAt: saturday.at, pitTempF: 225 });
    await fireEvent.press(button('Share plan'));
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });

  test('Start at keeps the schedule: the time shown becomes the fire time and the cards do not change', async () => {
    const { repos } = await show([brisket]);
    await fireEvent.press(screen.getByRole('radio', { name: 'Start at' }));
    expect(screen.getByText('Sat, Nov 14 at 6:20 AM')).toBeOnTheScreen();
    expect(within(button('Brisket, edit')).getByText('6:40 AM')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fire smoker 6:20 AM')).toBeOnTheScreen();
    expect(repos.settings.draft()).toMatchObject({ mode: 'startAt' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Ready by' }));
    expect(screen.getByText('Sat, Nov 14 at 5:00 PM')).toBeOnTheScreen();
    expect(repos.settings.draft()).toMatchObject({ mode: 'readyBy', at: saturday.at });
  });

  test('the date and time open the system pickers from the saved time; the choice is saved and re-plans', async () => {
    const { props, repos } = await show([brisket]);
    const sunday = saturday.at + 24 * 3_600_000 + 3_600_000; // Sun Nov 15, 6:00 PM
    props.pickDateTime.mockResolvedValueOnce(sunday);
    await fireEvent.press(button('Change date and time'));
    await act(async () => {});
    expect(props.pickDateTime).toHaveBeenCalledWith(saturday.at);
    expect(screen.getByText('Sun, Nov 15 at 6:00 PM')).toBeOnTheScreen();
    expect(within(button('Brisket, edit')).getByText('7:40 AM')).toBeOnTheScreen();
    expect(repos.settings.draft()).toMatchObject({ at: sunday });
    // The calendar button opens the same pickers; a dismissed dialog changes nothing.
    await fireEvent.press(button('Pick date and time'));
    await act(async () => {});
    expect(props.pickDateTime).toHaveBeenLastCalledWith(sunday);
    expect(screen.getByText('Sun, Nov 15 at 6:00 PM')).toBeOnTheScreen();
  });

  test('without a smoker there is no smoker temp field, and a griddle-only plan fires the griddle', async () => {
    await show([breasts], { cookers: { griddle: defaultGriddle() } });
    expect(screen.queryByRole('button', { name: 'Smoker temp' })).toBeNull();
    expect(screen.getByLabelText(/^Fire griddle \d+:\d\d (AM|PM)$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Serve 5:00 PM')).toBeOnTheScreen();
    expect(button('Start cook')).toBeEnabled();
  });

  test('a smoker food with no smoker: the conflicts say so, and Start at keeps the time (no first step to take)', async () => {
    const { repos } = await show([brisket], { cookers: { griddle: defaultGriddle() } });
    expect(button(/^Conflicts \d+$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Serve 5:00 PM')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Start at' }));
    expect(screen.getByText('Sat, Nov 14 at 5:00 PM')).toBeOnTheScreen();
    expect(repos.settings.draft()).toMatchObject({ mode: 'startAt', at: saturday.at });
  });

  test('a saved item the rules do not know does not break Plan: its card opens, Start cook is off, the reason shows', async () => {
    const stale: ItemInput = { ...brisket, id: 'x', methodId: 'sousVide' };
    const gone: ItemInput = { id: 'y', foodId: 'goat', methodId: 'smoked', quantity: 3 };
    const { props } = await show([wings, stale, gone]);
    expect(screen.getByText('3 items')).toBeOnTheScreen();
    expect(within(button('Chicken wings, edit')).getByText('2 lb, smoke then 400F crisp')).toBeOnTheScreen();
    expect(within(button('brisket, edit')).getByText(UNKNOWN_ITEM)).toBeOnTheScreen();
    expect(within(button('goat, edit')).getByText(UNKNOWN_ITEM)).toBeOnTheScreen();
    expect(screen.getByText(/^Could not build the plan: /)).toBeOnTheScreen();
    // No plan: nothing to start or share, and no tiles or times that would be wrong.
    expect(button('Start cook')).toBeDisabled();
    await fireEvent.press(button('Start cook'));
    expect(props.onStartCook).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Share plan' })).toBeNull();
    expect(screen.queryByLabelText(/^Fire smoker/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Conflicts/ })).toBeNull();
    // The item can still be opened (to remove it).
    await fireEvent.press(button('goat, edit'));
    expect(props.onEditItem).toHaveBeenCalledWith('y');
  });
});
