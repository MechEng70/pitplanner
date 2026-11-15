import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { Cookers } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Db } from '@/db/db';
import type { Repos } from '@/db/repos';
import type { Units } from '@/lib/format';
import { logsOf, type CookRecord } from '@/lib/history';
import { rateRows } from '@/lib/historyView';
import { rules } from '@/lib/rules';
import { defaultServe } from '@/lib/store';
import { rateText } from '@/lib/timing';
import { cookGear } from '@/test/cook';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { applyEdit, EDIT_TITLE, HistoryScreen } from './HistoryScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

const SAT = Date.UTC(2026, 10, 14, 22, 0); // Sat Nov 14, 2026, 5:00 PM Eastern
const WEEK = 7 * 24 * 3_600_000;
const LB: Units = { temp: 'F', weight: 'lb' };

/** The cook of mockup 20: brisket 25 min ahead of plan, served on time. */
const saturday = (): CookRecord => ({
  id: 'sat',
  date: SAT,
  notes: 'Wrapped at 165.',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 515,
      log: {
        foodId: 'brisket',
        methodId: 'smoked',
        smokerId: 'pb820',
        quantity: 12,
        pitTempF: 225,
        minutesOnHeat: 515,
        options: { wrap: 'paper' },
      },
    },
    {
      name: 'Wings',
      plannedMin: 90,
      actualMin: 90,
      log: {
        foodId: 'wings',
        methodId: 'smokeCrisp',
        smokerId: 'pb820',
        quantity: 2,
        pitTempF: 225,
        minutesOnHeat: 90,
        options: { drybrine: 'yes' },
      },
    },
    {
      name: 'Chicken breasts',
      plannedMin: 20,
      actualMin: 20,
      log: { foodId: 'breasts', methodId: 'griddle', smokerId: 'pb820', quantity: 4, pitTempF: 225, minutesOnHeat: 20 },
    },
  ],
});
/** The week before: a 10 lb brisket, 20 min behind, served late. */
const earlier = (): CookRecord => ({
  id: 'before',
  date: SAT - WEEK,
  notes: '',
  pitTempF: 250,
  lateMin: 20,
  items: [
    {
      name: 'Brisket',
      plannedMin: 450,
      actualMin: 470,
      log: {
        foodId: 'brisket',
        methodId: 'smoked',
        smokerId: 'pb820',
        quantity: 10,
        pitTempF: 250,
        minutesOnHeat: 470,
        options: { wrap: 'paper' },
      },
    },
  ],
});

async function show({
  records = [earlier(), saturday()],
  gear = cookGear,
  seed,
}: { records?: CookRecord[]; gear?: Cookers; seed?: (r: Repos) => void } = {}) {
  const { db, repos } = testRepos();
  repos.cookers.save(gear, NOW);
  records.forEach((r, i) => repos.history.save(r, NOW + i));
  seed?.(repos);
  const onBack = jest.fn();
  const onCookAgain = jest.fn();
  let back: (() => boolean) | null = null;
  const onBackPress = (handler: () => boolean) => {
    back = handler;
    return () => {
      back = null;
    };
  };
  await render(<HistoryScreen onBack={onBack} onCookAgain={onCookAgain} onBackPress={onBackPress} now={() => NOW} />, {
    wrapper: storeWrapper(repos, () => NOW),
  });
  return { db, repos, onBack, onCookAgain, pressBack: () => back?.() };
}

/** Exact text, with the no-break spaces a Num puts inside a value. */
const text = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s')}$`);
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const press = (name: string | RegExp, inside = screen as Pick<typeof screen, 'getByRole'>) =>
  fireEvent.press(inside.getByRole('button', { name }));
/** A sheet by its title (a rate card and its sheet share the food's name). */
const dialog = (title: string) => screen.getAllByLabelText(title).find(n => n.props.role === 'dialog')!;
/** A stepper by its label: the group around its two buttons and its value. */
const stepper = (inside: ReturnType<typeof within>, name: string) =>
  within(inside.getAllByLabelText(name).find(n => n.props.role === 'group')!);
const card = (label: string) => screen.getByRole('button', { name: label });
/** The brisket rate the planner uses now, as the card shows it. */
function brisketRate(repos: Repos): { text: string; cooks: number; source: string | null } {
  const { rates, totalHours, rateLocks } = repos.rates.load();
  const row = rateRows(rules, logsOf(repos.history.list()), 'pb820', rates, totalHours, rateLocks).find(
    r => r.foodId === 'brisket',
  )!;
  return { text: rateText(row.hrPerLb!, LB), cooks: row.cooks, source: row.source };
}
/** Every stored cook row and item row, as they are on disk. */
const stored = (db: Db, where = '1 = 1') => ({
  cooks: db.all(`SELECT rowid AS n, * FROM cook_history WHERE ${where} ORDER BY rowid`),
  items: db.all(
    `SELECT * FROM cook_history_items WHERE cook_id IN (SELECT id FROM cook_history WHERE ${where}) ORDER BY id`,
  ),
});

const openCook = async (day = 'Sat, Nov 14', title = 'Saturday, Nov 14, 2026') => {
  await act(() => fireEvent.press(card(day)));
  return within(screen.getByLabelText(title));
};
const openEdit = async (day?: string, title?: string) => {
  const sheet = await openCook(day, title);
  await act(() => press('Edit', sheet));
  await settle();
  return within(screen.getByLabelText(EDIT_TITLE));
};
const save = async (sheet: ReturnType<typeof within>) => {
  await act(() => press('Save', sheet));
  await settle();
};

describe('the screen (mockup 20)', () => {
  test('title with a back arrow, a rate card per by-weight food, then the cooks, newest first', async () => {
    const { repos, onBack } = await show();
    expect(screen.getByRole('heading', { name: 'Cook history' })).toBeOnTheScreen();
    await act(() => press('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);

    const rate = brisketRate(repos);
    expect(rate).toMatchObject({ cooks: 2, source: 'learned' });
    const brisket = within(card('Brisket'));
    expect(brisket.getByText('Brisket on Pit Boss 820')).toBeOnTheScreen();
    expect(brisket.getByLabelText(`hr/lb ${rate.text} learned`)).toBeOnTheScreen();
    expect(brisket.getByLabelText('Cooks 2 logged')).toBeOnTheScreen();
    expect(brisket.getByLabelText('Total None not set')).toBeOnTheScreen();
    // A food never cooked and with no saved rate has no card (Jason, 2026-11-15).
    expect(screen.queryByRole('button', { name: 'Pork butt' })).toBeNull();

    expect(screen.getByRole('heading', { name: 'Cooks' })).toBeOnTheScreen();
    const sat = within(card('Sat, Nov 14'));
    expect(sat.getByText('On time')).toBeOnTheScreen();
    expect(sat.getByText(text('Brisket 12 lb, chicken wings 2 lb, 4 chicken breasts'))).toBeOnTheScreen();
    expect(sat.getByText(text('Brisket 25 min ahead of plan'))).toBeOnTheScreen();
    const before = within(card('Sat, Nov 7'));
    expect(before.getByText(text('20 min late'))).toBeOnTheScreen();
    expect(before.getByText(text('Brisket 20 min behind plan'))).toBeOnTheScreen();
    const days = screen.getAllByRole('button', { name: /^Sat, Nov/ }).map(b => b.props.accessibilityLabel as string);
    expect(days).toEqual(['Sat, Nov 14', 'Sat, Nov 7']);
    expect(screen.getByText(/^Tap a cook to see planned vs actual times/)).toBeOnTheScreen();
  });

  test('a food with a saved rate has a card before it has ever been cooked', async () => {
    await show({ records: [], seed: r => r.rates.setRate('butt', 1.5, NOW) });
    expect(within(card('Pork butt')).getByLabelText('hr/lb 1.50 yours')).toBeOnTheScreen();
    expect(within(card('Pork butt')).getByLabelText('Cooks 0 logged')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Brisket' })).toBeNull();
    expect(screen.getByText(/^Rates are hours per lb at 225F\./)).toBeOnTheScreen();
  });

  test('no cooks and no saved rates: no rate cards, no line about them, and the list says so', async () => {
    await show({ records: [] });
    expect(screen.queryByRole('button', { name: 'Brisket' })).toBeNull();
    expect(screen.queryByText(/^Rates are hours per/)).toBeNull();
    expect(screen.getByText(/^No cooks saved yet\./)).toBeOnTheScreen();
    expect(screen.queryByText(/^Tap a cook/)).toBeNull();
  });

  test("the phone's back button goes back", async () => {
    const { onBack, pressBack } = await show();
    expect(pressBack()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('kilograms: rates per kg and weights in kg', async () => {
    await show({ seed: r => r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW) });
    expect(within(card('Brisket')).getByLabelText(/^hr\/kg \d\.\d\d learned$/)).toBeOnTheScreen();
    expect(within(card('Sat, Nov 14')).getByText(/^Brisket\s5\.44\skg, chicken wings/)).toBeOnTheScreen();
  });
});

describe('a rate card opens the saved rate and total hours', () => {
  test('stepping the rate saves it as your setting; Keep my rate exactly locks it', async () => {
    const { repos } = await show();
    const before = brisketRate(repos).text;
    await act(() => fireEvent.press(card('Brisket')));
    const sheet = within(dialog('Brisket'));
    expect(sheet.getByText(/^Using the learned from 2 cooks rate\./)).toBeOnTheScreen();
    // Nothing of your own yet: no lock to set, nothing to clear.
    expect(sheet.queryByRole('checkbox', { name: 'Keep my rate exactly' })).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Clear my rate' })).toBeNull();

    await act(() => press('More hours per pound', sheet));
    expect(sheet.getByText('Your setting. Plans use it as-is.')).toBeOnTheScreen();
    await act(() => fireEvent.press(sheet.getByRole('checkbox', { name: 'Keep my rate exactly' })));
    expect(sheet.getByText('Logged cooks never change it.')).toBeOnTheScreen();
    await save(sheet);

    const saved = repos.rates.load();
    expect(saved.rates.brisket).toBeGreaterThan(Number(before));
    expect(saved.rateLocks).toEqual({ brisket: true });
    expect(
      within(card('Brisket')).getByLabelText(`hr/lb ${rateText(saved.rates.brisket!, LB)} yours`),
    ).toBeOnTheScreen();
  });

  test('Clear my rate goes back to the learned rate and drops the lock', async () => {
    const { repos } = await show({
      seed: r => {
        r.rates.setRate('brisket', 0.75, NOW);
        r.rates.setLock('brisket', true, NOW);
      },
    });
    expect(within(card('Brisket')).getByLabelText('hr/lb 0.75 yours')).toBeOnTheScreen();
    await act(() => fireEvent.press(card('Brisket')));
    const sheet = within(dialog('Brisket'));
    await act(() => press('Clear my rate', sheet));
    await save(sheet);
    expect(repos.rates.load()).toMatchObject({ rates: {}, rateLocks: {} });
    expect(within(card('Brisket')).getByLabelText(`hr/lb ${brisketRate(repos).text} learned`)).toBeOnTheScreen();
  });

  test('Set total hours starts from the rate at the usual size; Clear total hours removes it', async () => {
    // A saved rate (the published 1.25) so the card shows with no cooks.
    const { repos } = await show({ records: [], seed: r => r.rates.setRate('brisket', 1.25, NOW) });
    await act(() => fireEvent.press(card('Brisket')));
    let sheet = within(dialog('Brisket'));
    await act(() => press('Set total hours', sheet));
    expect(stepper(sheet, 'Total hours').getByText(text('15 hr'))).toBeOnTheScreen();
    await act(() => press('Less total hours', sheet));
    await save(sheet);
    expect(repos.rates.load().totalHours).toEqual({ brisket: 14.75 });
    expect(within(card('Brisket')).getByLabelText('Total 14.75 hr yours')).toBeOnTheScreen();

    await act(() => fireEvent.press(card('Brisket')));
    sheet = within(dialog('Brisket'));
    await act(() => press('Clear total hours', sheet));
    await save(sheet);
    expect(repos.rates.load().totalHours).toEqual({});
  });
});

describe('a cook opens its sheet', () => {
  test('planned vs actual per food, the pit temp, how serve went, and the notes', async () => {
    await show();
    const sheet = await openCook();
    expect(sheet.getByText(text('Pit at 225F. On time.'))).toBeOnTheScreen();
    expect(sheet.getByText(text('Planned 9 hr, took 8 hr 35 min'))).toBeOnTheScreen();
    expect(sheet.getByText(text('25 min ahead'))).toBeOnTheScreen();
    expect(sheet.getByText(text('Planned 1 hr 30 min, took 1 hr 30 min'))).toBeOnTheScreen();
    expect(sheet.getAllByText('On plan')).toHaveLength(2);
    expect(sheet.getByText('Wrapped at 165.')).toBeOnTheScreen();
  });

  test('Cook again puts that menu on the plan at its pit temp and opens Plan; history is untouched', async () => {
    const { db, repos, onCookAgain } = await show({
      seed: r => r.settings.setDraft({ mode: 'startAt', at: NOW, pitTempF: 275, items: [] }, NOW),
    });
    const before = stored(db);
    const sheet = await openCook();
    await act(() => press('Cook again', sheet));
    await settle();
    expect(onCookAgain).toHaveBeenCalledTimes(1);
    const draft = repos.settings.readDraft().value!;
    expect(draft).toMatchObject({ mode: 'readyBy', at: defaultServe(NOW), pitTempF: 225 });
    expect(draft.items.map(i => [i.foodId, i.methodId, i.quantity, i.options])).toEqual([
      ['brisket', 'smoked', 12, { wrap: 'paper' }],
      ['wings', 'smokeCrisp', 2, { drybrine: 'yes' }],
      ['breasts', 'griddle', 4, {}],
    ]);
    expect(new Set(draft.items.map(i => i.id)).size).toBe(3);
    expect(stored(db)).toEqual(before);
  });

  test('Cook again asks first when the plan has food on it: the first tap only says so', async () => {
    const { repos, onCookAgain } = await show({
      seed: r =>
        r.settings.setDraft(
          {
            mode: 'readyBy',
            at: NOW,
            pitTempF: 275,
            items: [{ id: 'x', foodId: 'stlribs', methodId: '221', quantity: 2 }],
          },
          NOW,
        ),
    });
    const sheet = await openCook();
    expect(sheet.queryByText(/replaces the plan you have now/)).toBeNull();
    await act(() => press('Cook again', sheet));
    await settle();
    expect(onCookAgain).not.toHaveBeenCalled();
    expect(repos.settings.readDraft().value!.items.map(i => i.foodId)).toEqual(['stlribs']);
    expect(sheet.getByText('This replaces the plan you have now. Tap Cook again to go on.')).toBeOnTheScreen();
    await act(() => press('Cook again', sheet));
    await settle();
    expect(onCookAgain).toHaveBeenCalledTimes(1);
    expect(repos.settings.readDraft().value!.items.map(i => i.foodId)).toEqual(['brisket', 'wings', 'breasts']);
  });

  test('Cook again keeps a serve time that is still ahead', async () => {
    const at = NOW + 5 * 3_600_000;
    const { repos } = await show({
      seed: r => r.settings.setDraft({ mode: 'readyBy', at, pitTempF: 275, items: [] }, NOW),
    });
    const sheet = await openCook();
    await act(() => press('Cook again', sheet));
    await settle();
    expect(repos.settings.readDraft().value).toMatchObject({ at, pitTempF: 225 });
  });

  test('Remove from history asks with a second tap, then removes that cook and no other', async () => {
    const { db, repos } = await show();
    const other = stored(db, "id = 'before'");
    const sheet = await openCook();
    await act(() => press('Remove from history', sheet));
    expect(repos.history.list()).toHaveLength(2);
    await act(() => press('Tap again to remove from history', sheet));
    await settle();
    expect(repos.history.list().map(r => r.id)).toEqual(['before']);
    expect(stored(db, "id = 'before'")).toEqual(other);
    expect(screen.queryByRole('button', { name: 'Sat, Nov 14' })).toBeNull();
    expect(within(card('Brisket')).getByLabelText('Cooks 1 logged')).toBeOnTheScreen();
  });
});

describe('editing a cook (failure mode 14)', () => {
  test('a corrected time on heat changes the blended rate shown', async () => {
    const { repos } = await show();
    const before = brisketRate(repos);
    const sheet = await openEdit();
    expect(stepper(sheet, 'Brisket hours').getByText(text('8 hr on heat'))).toBeOnTheScreen();
    expect(stepper(sheet, 'Brisket minutes').getByText(text('35 min'))).toBeOnTheScreen();
    for (let i = 0; i < 3; i++) await act(() => press('More brisket hours', sheet));
    await act(() => press('More brisket minutes', sheet));
    expect(stepper(sheet, 'Brisket hours').getByText(text('11 hr on heat'))).toBeOnTheScreen();
    expect(stepper(sheet, 'Brisket minutes').getByText(text('40 min'))).toBeOnTheScreen();
    await save(sheet);

    const edited = repos.history.list().find(r => r.id === 'sat')!;
    expect(edited.items[0]).toMatchObject({ actualMin: 700, plannedMin: 540, log: { minutesOnHeat: 700 } });
    const after = brisketRate(repos);
    expect(after.cooks).toBe(2);
    expect(Number(after.text)).toBeGreaterThan(Number(before.text));
    expect(within(card('Brisket')).getByLabelText(`hr/lb ${after.text} learned`)).toBeOnTheScreen();
    expect(within(card('Sat, Nov 14')).getByText(text('Brisket 2 hr 40 min behind plan'))).toBeOnTheScreen();
  });

  test('a cook left out of rates does not count; putting it back counts again', async () => {
    const { repos } = await show({ records: [saturday()] });
    expect(within(card('Brisket')).getByLabelText('Cooks 1 logged')).toBeOnTheScreen();
    let sheet = await openEdit();
    // Only a food with a rate to learn has the row.
    expect(sheet.queryByRole('checkbox', { name: /chicken breasts/ })).toBeNull();
    await act(() => fireEvent.press(sheet.getByRole('checkbox', { name: 'Leave brisket out of rates' })));
    expect(sheet.getByText('Rates do not learn from it.')).toBeOnTheScreen();
    await save(sheet);

    expect(repos.history.list()[0]!.items.map(i => !!i.log.discarded)).toEqual([true, false, false]);
    expect(repos.history.logs().map(l => l.foodId)).toEqual(['wings', 'breasts']);
    expect(within(card('Brisket')).getByLabelText('hr/lb 1.25 published')).toBeOnTheScreen();
    expect(within(card('Brisket')).getByLabelText('Cooks 0 logged')).toBeOnTheScreen();
    expect((await openCook()).getByText('Not logged')).toBeOnTheScreen();
    await act(() => press('Close', within(screen.getByLabelText('Saturday, Nov 14, 2026'))));
    await settle();

    sheet = await openEdit();
    expect(sheet.getByRole('checkbox', { name: 'Leave brisket out of rates' })).toBeChecked();
    await act(() => fireEvent.press(sheet.getByRole('checkbox', { name: 'Leave brisket out of rates' })));
    await save(sheet);
    expect(repos.history.list()).toEqual([saturday()]);
    expect(within(card('Brisket')).getByLabelText('Cooks 1 logged')).toBeOnTheScreen();
  });

  test('weight, count, smoker temp and notes are saved; the date, lateness and plan stay', async () => {
    const { repos } = await show();
    const sheet = await openEdit();
    await act(() => press('More brisket weight', sheet));
    expect(stepper(sheet, 'Brisket weight').getByText(text('12.5 lb'))).toBeOnTheScreen();
    await act(() => press('Less chicken breasts count', sheet));
    await act(() => press('More smoker temp', sheet));
    expect(stepper(sheet, 'Smoker temp').getByText('230F')).toBeOnTheScreen();
    await act(() => fireEvent.changeText(sheet.getByLabelText('Notes'), 'Ran hot.'));
    await save(sheet);

    const want = saturday();
    want.notes = 'Ran hot.';
    want.pitTempF = 230;
    want.items.forEach(i => (i.log.pitTempF = 230));
    want.items[0]!.log.quantity = 12.5;
    want.items[2]!.log.quantity = 3;
    expect(repos.history.list()).toEqual([earlier(), want]);
    expect(
      within(card('Sat, Nov 14')).getByText(text('Brisket 12.5 lb, chicken wings 2 lb, 3 chicken breasts')),
    ).toBeOnTheScreen();
  });

  test('closing the edit sheet without Save changes nothing', async () => {
    const { db } = await show();
    const before = stored(db);
    const sheet = await openEdit();
    await act(() => press('More brisket hours', sheet));
    await act(() => press('Close', sheet));
    await settle();
    expect(stored(db)).toEqual(before);
  });

  test('kilograms: the weight steps by 0.25 kg and is stored in lb', async () => {
    const { repos } = await show({
      records: [saturday()],
      seed: r => r.settings.setUnits({ temp: 'C', weight: 'kg' }, NOW),
    });
    const sheet = await openEdit();
    expect(stepper(sheet, 'Brisket weight').getByText(text('5.44 kg'))).toBeOnTheScreen();
    await act(() => press('More brisket weight', sheet));
    expect(stepper(sheet, 'Brisket weight').getByText(text('5.69 kg'))).toBeOnTheScreen();
    await save(sheet);
    expect(repos.history.list()[0]!.items[0]!.log.quantity).toBeCloseTo(12 + 0.25 / 0.45359237, 3);
  });

  test('applyEdit: an unchanged smoker temp leaves each food its own logged temp', () => {
    const r = saturday();
    r.items[1]!.log.pitTempF = 250;
    const items = r.items.map(i => ({ quantity: i.log.quantity, minutes: i.actualMin, out: false }));
    expect(applyEdit(r, 225, r.notes, items)).toEqual(r);
    expect(applyEdit(r, 240, r.notes, items).items.map(i => i.log.pitTempF)).toEqual([240, 240, 240]);
  });
});

// T-064: Jason's saved cook was gone from 0.2.0's history. Looking at history must never write to it, and a
// change to one cook must leave every other cook's rows as they were.
describe('regression (T-064): history rows are never dropped', () => {
  test('opening and closing every sheet writes nothing to cook history', async () => {
    const { db } = await show();
    const before = stored(db);
    await act(() => fireEvent.press(card('Brisket')));
    await act(() => press('Close', within(dialog('Brisket'))));
    await settle();
    const edit = await openEdit();
    await act(() => press('Close', edit));
    await settle();
    const cook = await openCook('Sat, Nov 7', 'Saturday, Nov 7, 2026');
    await act(() => press('Remove from history', cook)); // the first tap only asks
    await act(() => press('Close', cook));
    await settle();
    expect(stored(db)).toEqual(before);
    expect(button('Sat, Nov 14')).toBeOnTheScreen();
    expect(button('Sat, Nov 7')).toBeOnTheScreen();
  });

  test('editing one cook leaves the other cooks byte for byte, in the same order', async () => {
    const third: CookRecord = { ...earlier(), id: 'oldest', date: SAT - 2 * WEEK };
    const { db, repos } = await show({ records: [third, earlier(), saturday()] });
    const others = stored(db, "id <> 'before'");
    const sheet = await openEdit('Sat, Nov 7', 'Saturday, Nov 7, 2026');
    await act(() => press('Less brisket hours', sheet));
    await save(sheet);
    expect(repos.history.list().map(r => r.id)).toEqual(['oldest', 'before', 'sat']);
    expect(repos.history.list()[1]!.items[0]!.actualMin).toBe(410);
    expect(stored(db, "id <> 'before'")).toEqual(others);
  });
});
