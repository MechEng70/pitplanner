// Food details (T-019): the nine 0.2.0 Timing cases (legacy/src/screens/plan/FoodEdit.test.tsx), the result
// bar, and the regression test for the 0.2.0 scroll bug (a value change scrolled the screen to the result).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, ScrollView, TextInput, View } from 'react-native';
import { NO_GRIDDLE_PICK_METHOD } from '../../../engine/plan';
import type { ItemInput, PlanInput } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultOptions, foods } from '@/lib/rules';
import { defaultGriddle } from '@/lib/gear';
import type { Units } from '@/lib/format';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { FoodEdit, SMOKER_NEEDS } from './FoodEdit';

const units = { temp: 'F', weight: 'lb' } as const;
const base = (over: Partial<PlanInput> = {}): PlanInput => ({ ...saturday, rateOverrides: {}, items: [], ...over });
const saved = { rateOverrides: { brisket: 0.75 } };
const brisket: ItemInput = saturday.items[0]!;
const ribs: ItemInput = { id: 'r', foodId: 'stlribs', methodId: '321', quantity: 2 };

type Measure = (...cb: ((...r: number[]) => void)[]) => void;
const proto = View.prototype as unknown as { measureInWindow: Measure; measureLayout: Measure };
let scrollTo: jest.SpyInstance;
let scrollToEnd: jest.SpyInstance;
let a11yFocus: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  // The host views have no layout in Jest. They report a result card far below the visible part of the
  // scroll view, so anything that asks to reveal it does reach scrollTo.
  jest.spyOn(proto, 'measureLayout').mockImplementation((_rel, cb) => cb!(0, 900, 328, 120));
  jest.spyOn(proto, 'measureInWindow').mockImplementation(cb => cb(0, 900, 328, 500));
  const sv = ScrollView.prototype as unknown as { measureInWindow: Measure; getInnerViewRef: () => unknown };
  jest.spyOn(sv, 'measureInWindow').mockImplementation(cb => cb(0, 100, 328, 500));
  jest.spyOn(sv, 'getInnerViewRef').mockReturnValue({});
  scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd').mockImplementation(() => {});
  a11yFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
  // The jest preset's own mocks keep their calls across tests.
  for (const spy of [scrollTo, scrollToEnd, a11yFocus]) spy.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
const frames = () => act(() => jest.advanceTimersByTime(100));

/** As the Plan tab opens it: an existing item is already in the plan, a new one is not. */
async function open(item: ItemInput, opts: { isNew?: boolean; base?: PlanInput; units?: Units } = {}) {
  const onSave = jest.fn();
  const onRemove = jest.fn();
  const onClose = jest.fn();
  const b = opts.base ?? base();
  const r = testRepos();
  await render(
    <FoodEdit
      initial={item}
      isNew={opts.isNew ?? false}
      base={opts.isNew ? b : { ...b, items: [...b.items, item] }}
      units={opts.units ?? units}
      onSave={onSave}
      onRemove={onRemove}
      onClose={onClose}
    />,
    { wrapper: storeWrapper(r.repos) },
  );
  return { onSave, onRemove, onClose, repos: r.repos, timing: within(screen.getByLabelText('Timing')) };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const labels = (group: ReturnType<typeof within>) => group.getAllByRole('radio').map(r => r.props.accessibilityLabel);
// A timing chip and its stepper share a name ("Hours per pound"): the stepper is the group.
const stepper = (name: string) => within(screen.getAllByLabelText(name).find(n => n.props.role === 'group')!);
const check = (name: RegExp) => screen.getByRole('checkbox', { name });

describe('Timing', () => {
  test('three models for brisket', async () => {
    const { timing } = await open(brisket);
    expect(labels(timing)).toEqual(['Hours per pound', 'Total hours', 'Size-adjusted']);
  });

  test('Standard and Total hours for a food that is not by weight', async () => {
    const { timing } = await open(ribs);
    expect(labels(timing)).toEqual(['Standard', 'Total hours']);
  });

  test('hours per pound shows the rate, its source and Use for future on the smoker', async () => {
    await open(brisket);
    expect(stepper('Hours per pound').getByText('1.25')).toBeOnTheScreen();
    expect(screen.getByText('At 225F: published estimate.')).toBeOnTheScreen();
    expect(check(/Use for future brisket on Pit Boss Sportsman 850/)).toBeOnTheScreen();
  });

  test('a saved 0.75 hr/lb plans 9 hr, fires at 6:20 AM for a 5:00 PM serve, and the card names the rate', async () => {
    await open(brisket, { base: base(saved) });
    expect(screen.getByText('At 225F: your setting.')).toBeOnTheScreen();
    expect(screen.getByText(/^For serve at 5:00\sPM$/)).toBeOnTheScreen();
    expect(screen.getByText(/^On 6:40\sAM, off 3:40\sPM$/)).toBeOnTheScreen();
    expect(
      screen.getByText(/^9\shr on heat, your rate 0\.75\shr\/lb\. Fire the smoker at 6:20\sAM\.$/),
    ).toBeOnTheScreen();
  });

  test('stepping the rate changes this cook only until Use for future is checked', async () => {
    const { onSave, repos } = await open(brisket, { base: base(saved) });
    await fireEvent.press(button('More hours per pound'));
    expect(stepper('Hours per pound').getByText('0.80')).toBeOnTheScreen();
    expect(repos.rates.load().rates.brisket).toBeUndefined();
    await fireEvent.press(check(/Use for future/));
    await fireEvent.press(button('Save'));
    await settle();
    expect(repos.rates.load().rates.brisket).toBe(0.8);
    expect(onSave.mock.calls[0][0].hrPerLb).toBeUndefined();
  });

  test('total hours are used as-is and can be saved for future cooks', async () => {
    const { timing, repos } = await open(brisket, { base: base(saved) });
    await fireEvent.press(timing.getByRole('radio', { name: 'Total hours' }));
    expect(screen.getByText('Used as-is. Smoker temp and wrap do not change it.')).toBeOnTheScreen();
    expect(stepper('Total hours').getByText('9')).toBeOnTheScreen();
    expect(screen.getByText(/your total hours/)).toBeOnTheScreen();
    await fireEvent.press(check(/Use for future/));
    await fireEvent.press(button('Save'));
    await settle();
    expect(repos.rates.load().totalHours.brisket).toBe(9);
  });

  test('size-adjusted is open with no history and says it is an estimate', async () => {
    const { timing } = await open(brisket);
    await fireEvent.press(timing.getByRole('radio', { name: 'Size-adjusted' }));
    expect(screen.getByText(/^Estimate\. Gets better after a few logged cooks\..* at 12 lb\.$/)).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: /Use for future/ })).toBeNull();
  });

  test('shows the published-rate hint once, for a new by-weight food', async () => {
    const { repos, onSave } = await open(brisket, { isNew: true });
    expect(
      screen.getByText('Published estimate. Most pellet smokers run faster. Set your own rate or total hours.'),
    ).toBeOnTheScreen();
    await fireEvent.press(button('Add to plan'));
    await settle();
    expect(repos.settings.flags()).toEqual({ rateHintShown: true });
    expect(onSave).toHaveBeenCalledWith(brisket);
  });

  test('does not show the hint once it has been seen', async () => {
    const r = testRepos();
    r.repos.settings.setFlags({ rateHintShown: true }, NOW);
    await render(
      <FoodEdit
        initial={brisket}
        isNew
        base={base()}
        units={units}
        onSave={jest.fn()}
        onRemove={jest.fn()}
        onClose={jest.fn()}
      />,
      { wrapper: storeWrapper(r.repos) },
    );
    expect(screen.queryByText(/Most pellet smokers run faster/)).toBeNull();
  });
});

describe('the rest of the form', () => {
  test('quantity steps by the rules step and stops at the limits', async () => {
    const { onSave } = await open(brisket, { base: base(saved) });
    expect(stepper('Trimmed weight').getByText('12.0')).toBeOnTheScreen();
    await fireEvent.press(button('More trimmed weight'));
    expect(stepper('Trimmed weight').getByText('12.5')).toBeOnTheScreen();
    await fireEvent.press(button('Save'));
    await settle();
    expect(onSave.mock.calls[0][0].quantity).toBe(12.5);
  });

  // T-074 (Jason, 2026-11-16): the quantity buttons were read "More quantity" / "Less quantity" for every
  // food without its own label. Weight foods say weight; count foods say their unit, as the screen shows it.
  test.each([
    ['brisket', 'trimmed weight'],
    ['tritip', 'weight'],
    ['stlribs', 'racks'],
    ['bbribs', 'racks'],
    ['butt', 'weight'],
    ['breasts', 'breasts'],
    ['wings', 'weight'],
    ['turkey', 'weight'],
  ])('the %s quantity buttons are More / Less %s', async (foodId, name) => {
    const f = foods.find(x => x.id === foodId)!;
    const m = f.methods[0]!;
    await open({ id: 'q', foodId, methodId: m.id, quantity: f.quantity.default, options: defaultOptions(m) });
    expect(button(`More ${name}`)).toBeOnTheScreen();
    expect(button(`Less ${name}`)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /quantity/i })).toBeNull();
  });

  test('every food in the rules has its quantity buttons named above', () => {
    expect(foods.map(f => f.id).sort()).toEqual(
      ['brisket', 'tritip', 'stlribs', 'bbribs', 'butt', 'breasts', 'wings', 'turkey'].sort(),
    );
  });

  test('a cooker the user does not have is offered but off, with Add in Gear', async () => {
    const breasts: ItemInput = { id: 'c', foodId: 'breasts', methodId: 'smoker', quantity: 4 };
    await open(breasts);
    const griddle = within(screen.getByLabelText('Cook on')).getByRole('radio', { name: 'Griddle' });
    expect(griddle).toBeDisabled();
    expect(within(griddle).getByText('Add in Gear')).toBeOnTheScreen();
  });

  test('choosing the griddle moves the food there with that method and its rest', async () => {
    const breasts: ItemInput = { id: 'c', foodId: 'breasts', methodId: 'smoker', quantity: 4 };
    const cookers = { ...saturday.cookers, griddle: defaultGriddle() };
    const { onSave } = await open(breasts, { base: base({ cookers }) });
    await fireEvent.press(within(screen.getByLabelText('Cook on')).getByRole('radio', { name: 'Griddle' }));
    await fireEvent.press(button('Save'));
    await settle();
    expect(onSave.mock.calls[0][0].methodId).toBe('griddle');
  });

  test('Remove shows for a food on the menu only, and removes after the sheet closes', async () => {
    const { onRemove, onClose } = await open(brisket);
    await fireEvent.press(button('Remove'));
    expect(onRemove).not.toHaveBeenCalled();
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('a new food has Add to plan and no Remove', async () => {
    await open(brisket, { isNew: true });
    expect(button('Add to plan')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});

// T-075 (Jason, 2026-11-16): a method whose steps need a cooker that is not set up is offered but off, with
// Add in Gear, the way the Cook on chips do it. The Saturday cookers have no griddle.
describe('tri-tip with and without a griddle (T-075)', () => {
  const tritip = (methodId: string): ItemInput => ({ id: 't', foodId: 'tritip', methodId, quantity: 2.5, restMin: 10 });
  const methods = () => within(screen.getByLabelText('Method'));

  test('no griddle: the griddle sear is off with Add in Gear; the smoker sear and brisket-style are on', async () => {
    await open(tritip('smokerSear'));
    expect(labels(methods())).toEqual([
      'Smoke, then griddle sear',
      'Smoke, then sear on the smoker',
      'Smoked brisket-style (200F)',
    ]);
    const griddle = methods().getByRole('radio', { name: 'Smoke, then griddle sear' });
    expect(griddle).toBeDisabled();
    expect(within(griddle).getByText('Add in Gear')).toBeOnTheScreen();
    for (const name of ['Smoke, then sear on the smoker', 'Smoked brisket-style (200F)']) {
      const chip = methods().getByRole('radio', { name });
      expect(chip).toBeEnabled();
      expect(within(chip).queryByText('Add in Gear')).toBeNull();
    }
    expect(methods().getByRole('radio', { name: 'Smoke, then sear on the smoker' })).toBeChecked();
  });

  test('with a griddle every method is on', async () => {
    await open(tritip('reverse'), { base: base({ cookers: { ...saturday.cookers, griddle: defaultGriddle() } }) });
    for (const r of methods().getAllByRole('radio')) expect(r).toBeEnabled();
    expect(screen.queryByText('Add in Gear')).toBeNull();
  });

  test('a griddle sear already on the menu with no griddle says which method to pick', async () => {
    await open(tritip('reverse'));
    const line = NO_GRIDDLE_PICK_METHOD.replace('{food}', 'Tri-tip')
      .replace('{step}', 'sear')
      .replace('{method}', 'Smoke, then sear on the smoker');
    expect(screen.getByText(line)).toBeOnTheScreen();
    await fireEvent.press(methods().getByRole('radio', { name: 'Smoke, then sear on the smoker' }));
    expect(screen.queryByText(line)).toBeNull();
  });

  // Jason, 2026-11-16: the smoker sear is offered only on a smoker that reaches its sear temp, 500F or the
  // 450F fallback. Below that its chip is off, with the temp it needs where Add in Gear shows.
  const smoker = (maxTempF: number) => ({ smoker: { ...saturday.cookers.smoker!, maxTempF } });
  const sear = () => methods().getByRole('radio', { name: 'Smoke, then sear on the smoker' });

  test('smoker max 425F: the smoker sear is off, "Needs 450F" in the Add in Gear place', async () => {
    await open(tritip('brisketStyle'), { base: base({ cookers: smoker(425) }) });
    expect(sear()).toBeDisabled();
    expect(within(sear()).getByText(SMOKER_NEEDS.replace('{temp}', '450F'))).toBeOnTheScreen();
    expect(within(sear()).getByText('Needs 450F')).toBeOnTheScreen();
    expect(within(sear()).queryByText('Add in Gear')).toBeNull();
    // The griddle sear is off for the griddle, with its own note.
    const griddle = methods().getByRole('radio', { name: 'Smoke, then griddle sear' });
    expect(within(griddle).getByText('Add in Gear')).toBeOnTheScreen();
    expect(methods().getByRole('radio', { name: 'Smoked brisket-style (200F)' })).toBeEnabled();
  });

  test('smoker max 425F in Celsius: the note is in C', async () => {
    await open(tritip('brisketStyle'), { base: base({ cookers: smoker(425) }), units: { temp: 'C', weight: 'kg' } });
    expect(within(sear()).getByText('Needs 232C')).toBeOnTheScreen();
  });

  test.each([450, 500, 550])('smoker max %iF: the smoker sear is on, with no note', async max => {
    await open(tritip('smokerSear'), { base: base({ cookers: smoker(max) }) });
    expect(sear()).toBeEnabled();
    expect(within(sear()).queryByText(/^Needs/)).toBeNull();
  });

  test('no smoker: the smoker sear needs a smoker (Add in Gear), not a temp', async () => {
    await open(tritip('smokerSear'), { base: base({ cookers: {} }) });
    expect(sear()).toBeDisabled();
    expect(within(sear()).getByText('Add in Gear')).toBeOnTheScreen();
    expect(screen.queryByText(/^Needs/)).toBeNull();
  });
});

// Regression (T-075): with no smoker in Gear, brisket's result card said "needs a smoker" once per smoker
// step and React reported two children with the same key. A food that conflicts with two others has two
// warnings with one code: their keys must differ too.
describe('regression: one line per warning and no duplicate React keys', () => {
  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = jest.spyOn(console, 'error');
  });
  const keyErrors = () => errors.mock.calls.filter((c: unknown[]) => c.some(a => /same key/.test(String(a))));

  test('no smoker: brisket says it needs one once', async () => {
    await open(brisket, { base: base({ cookers: {} }) });
    expect(keyErrors()).toEqual([]);
    expect(screen.getAllByText('Brisket needs a smoker. Add one in Gear.')).toHaveLength(1);
  });

  test('two smoker conflicts for one food show as two lines', async () => {
    const wings = (id: string, methodId: string): ItemInput => ({ id, foodId: 'wings', methodId, quantity: 2 });
    const tri: ItemInput = { id: 't', foodId: 'tritip', methodId: 'smokerSear', quantity: 2.5, restMin: 10 };
    await open(tri, { base: base({ items: [wings('w1', 'smokeCrisp'), wings('w2', 'hot')] }) });
    expect(screen.getAllByText(/^Smoker conflict: tri-tip at /)).toHaveLength(2);
    expect(keyErrors()).toEqual([]);
  });
});

describe('result bar', () => {
  test('pinned in the footer with fire, off heat and serve; it follows the rate', async () => {
    await open(brisket, { base: base(saved) });
    const footer = within(screen.getByTestId('footer'));
    expect(footer.getByRole('button', { name: 'Fire 6:20 AM, Off heat 3:40 PM, Serve 5:00 PM' })).toBeOnTheScreen();
    await fireEvent.press(button('More hours per pound'));
    expect(footer.getByRole('button', { name: /^Fire 5:4\d AM, Off heat 3:40 PM, Serve 5:00 PM$/ })).toBeOnTheScreen();
  });

  test('a griddle food shows when the griddle goes on', async () => {
    const breasts: ItemInput = { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4 };
    await open(breasts, { base: base({ cookers: { ...saturday.cookers, griddle: defaultGriddle() } }) });
    expect(button(/^Fire \d+:\d\d PM, Off heat \d+:\d\d PM, Serve 5:00 PM$/)).toBeOnTheScreen();
  });

  test('tapping the bar scrolls the full result card into view', async () => {
    await open(brisket, { base: base(saved) });
    await fireEvent.press(screen.getByTestId('result-bar'));
    await frames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

// 0.2.0 bug (Jason, 2026-11-14, on his phone during a cook): the result card was wrapped in KeepVisible, so
// every change to the item scrolled the screen to it and the stepper left the finger. Nothing on Food
// details may scroll or take focus because a value changed.
describe('regression: a value change never scrolls the screen or moves focus', () => {
  const quiet = () => {
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollToEnd).not.toHaveBeenCalled();
    expect(a11yFocus).not.toHaveBeenCalled();
    expect(TextInput.State.currentlyFocusedInput()).toBeNull();
  };

  test('weight + and -', async () => {
    await open(brisket, { base: base(saved) });
    for (const name of ['More trimmed weight', 'More trimmed weight', 'Less trimmed weight']) {
      await fireEvent.press(button(name));
      await frames();
    }
    expect(stepper('Trimmed weight').getByText('12.5')).toBeOnTheScreen();
    quiet();
  });

  test('every other stepper and chip', async () => {
    const { timing } = await open(brisket, { base: base(saved) });
    for (const name of ['More rest', 'Less rest', 'More hours per pound', 'Less hours per pound']) {
      await fireEvent.press(button(name));
      await frames();
    }
    await fireEvent.press(within(screen.getByLabelText('Wrap at the stall')).getByRole('radio', { name: 'Foil' }));
    await fireEvent.press(timing.getByRole('radio', { name: 'Total hours' }));
    await frames();
    await fireEvent.press(button('More total hours'));
    await fireEvent.press(check(/Use for future/));
    await frames();
    quiet();
  });
});
