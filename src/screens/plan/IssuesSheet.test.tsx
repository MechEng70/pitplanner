import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { buildPlan, SMOKER_TOO_COOL_PICK_METHOD } from '../../../engine/plan';
import { smokerReachF } from '../../../engine/rules';
import type { Cookers, ItemInput, PlanInput, Warning } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { saturday } from '@/lib/fixtures/saturday';
import type { Units } from '@/lib/format';
import { defaultGriddle } from '@/lib/gear';
import { defaultOptions, method, rules } from '@/lib/rules';
import { IssuesSheet } from './IssuesSheet';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

const F: Units = { temp: 'F', weight: 'lb' };
const smoker = saturday.cookers.smoker!;
const withGriddle: Cookers = { smoker, griddle: defaultGriddle() };
const brisket = saturday.items[0]!;
const wings = (id: string, methodId: string): ItemInput => ({
  id,
  foodId: 'wings',
  methodId,
  quantity: 2,
  options: defaultOptions(method('wings', methodId)),
  restMin: 5,
});
/** Two batches of wings, one smoked at 225F and one hot and fast at 350F: a real smoker conflict. */
const clash = [wings('w1', 'smokeCrisp'), wings('w2', 'hot')];

async function show(over: Partial<PlanInput>, units: Units = F, warnings?: Warning[]) {
  const input: PlanInput = { ...saturday, cookers: withGriddle, ...over };
  const built = buildPlan(rules, input);
  const plan = warnings ? { ...built, warnings } : built;
  const props = {
    onMoveToGriddle: jest.fn(),
    onEdit: jest.fn(),
    onChangeTemp: jest.fn(),
    onClose: jest.fn(),
  };
  await render(<IssuesSheet plan={plan} items={input.items} cookers={input.cookers} units={units} {...props} />);
  return { plan, props };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const noButton = (name: string | RegExp) => expect(screen.queryByRole('button', { name })).toBeNull();

describe('Conflicts sheet', () => {
  test('a plan with no warnings says there is nothing to fix', async () => {
    const { plan } = await show({});
    expect(plan.warnings).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Conflicts' })).toBeOnTheScreen();
    expect(screen.getByText('Nothing to fix. The plan fits your cookers.')).toBeOnTheScreen();
  });

  test('a smoker conflict shows its message and offers the griddle, the temp and each food', async () => {
    const { plan } = await show({ items: clash });
    const w = plan.warnings.find(x => x.code === 'PIT_CONFLICT')!;
    expect([...w.itemIds!].sort()).toEqual(['w1', 'w2']);
    expect(screen.getByText(w.message)).toBeOnTheScreen();
    // T-061: two of the same food, so each button says which one it is for.
    expect(button('Move 2 lb chicken wings 1 to the griddle')).toBeOnTheScreen();
    expect(button('Move 2 lb chicken wings 2 to the griddle')).toBeOnTheScreen();
    expect(button('Change smoker temp')).toBeOnTheScreen();
    expect(button('Edit 2 lb chicken wings 1')).toBeOnTheScreen();
    expect(button('Edit 2 lb chicken wings 2')).toBeOnTheScreen();
  });

  test('a food with no griddle method is not offered the griddle', async () => {
    await show({}, F, [
      { code: 'REST_SHORT', level: 'warn', message: 'Brisket only gets 5 min of rest.', itemIds: ['b'] },
    ]);
    noButton(/to the griddle$/);
    noButton('Change smoker temp');
    expect(button('Edit brisket')).toBeOnTheScreen();
  });

  // Jason, 2026-11-17: "Edit st. louis ribs" lost the food's own capitals.
  test('a fix button names the food with its own capitals; brisket and wings are as before', async () => {
    const ribs = { id: 'r', foodId: 'stlribs', methodId: '221', quantity: 3 };
    await show({ items: [brisket, ribs, wings('w', 'smokeCrisp')] }, F, [
      { code: 'REST_SHORT', level: 'warn', message: 'Short rest.', itemIds: ['r', 'b', 'w'] },
    ]);
    expect(button('Edit St. Louis ribs')).toBeOnTheScreen();
    expect(button('Edit brisket')).toBeOnTheScreen();
    expect(button('Edit chicken wings')).toBeOnTheScreen();
    expect(button('Move chicken wings to the griddle')).toBeOnTheScreen();
  });

  test('a food already on the griddle is not offered it again', async () => {
    const item = wings('w', 'griddle');
    await show({ items: [brisket, item] }, F, [
      { code: 'REST_SHORT', level: 'warn', message: 'Short rest.', itemIds: ['w'] },
    ]);
    noButton(/to the griddle$/);
  });

  test('Move to the griddle reports the food and its griddle method, and the sheet stays open', async () => {
    const { props } = await show({ items: clash });
    await fireEvent.press(button('Move 2 lb chicken wings 2 to the griddle'));
    expect(props.onMoveToGriddle).toHaveBeenCalledWith('w2', 'griddle');
    await settle();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  test('without a griddle the move is not offered', async () => {
    await show({ items: clash, cookers: { smoker } });
    noButton(/to the griddle$/);
    expect(screen.getAllByRole('button', { name: /^Edit 2 lb chicken wings [12]$/ })).toHaveLength(2);
  });

  test('Change smoker temp closes the sheet, then opens the temp menu', async () => {
    const { plan, props } = await show({ pitTempF: 227 });
    expect(plan.warnings.map(w => w.code)).toEqual(['TEMP_NOT_SETTABLE']);
    expect(screen.getByText('Pit Boss Sportsman 850 cannot be set to 227F.')).toBeOnTheScreen();
    await fireEvent.press(button('Change smoker temp'));
    expect(props.onChangeTemp).not.toHaveBeenCalled();
    await settle();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onChangeTemp).toHaveBeenCalledTimes(1);
  });

  test('turkey below 225F shows its issue with Change smoker temp and Edit (T-059)', async () => {
    const turkey: ItemInput = { id: 't', foodId: 'turkey', methodId: 'smoked', quantity: 12, restMin: 30 };
    const { plan, props } = await show({ items: [turkey], pitTempF: 220 });
    expect(plan.warnings.map(w => w.code)).toEqual(['TEMP_BELOW_FOOD_MIN']);
    expect(screen.getByText('Whole turkey needs the smoker at 225F or hotter. It is set to 220F.')).toBeOnTheScreen();
    noButton(/to the griddle$/);
    expect(button('Edit whole turkey')).toBeOnTheScreen();
    await fireEvent.press(button('Change smoker temp'));
    await settle();
    expect(props.onChangeTemp).toHaveBeenCalledTimes(1);
  });

  test('the turkey issue reads in the chosen units', async () => {
    const turkey: ItemInput = { id: 't', foodId: 'turkey', methodId: 'smoked', quantity: 12, restMin: 30 };
    await show({ items: [turkey], pitTempF: 220 }, { temp: 'C', weight: 'kg' });
    expect(screen.getByTestId('issue-message')).toHaveTextContent(
      /^Whole turkey needs the smoker at \d+C or hotter\. It is set to \d+C\.$/,
    );
  });

  // T-075 follow-up (Jason, 2026-11-16): a smoker-sear tri-tip on a smoker changed to one under 450F keeps its
  // method; Conflicts lists the warning with Edit, as for a missing griddle.
  const tritip: ItemInput = { id: 't', foodId: 'tritip', methodId: 'smokerSear', quantity: 2.5, restMin: 10 };
  const coolSmoker = (maxTempF: number): Cookers => ({ ...withGriddle, smoker: { ...smoker, maxTempF } });
  const tooCool = (need: number, max: number) =>
    SMOKER_TOO_COOL_PICK_METHOD.replace('{food}', 'Tri-tip')
      .replace('{step}', 'sear')
      .replace('{need}', String(need))
      .replace('{max}', String(max));

  test('a smoker-sear tri-tip on a 425F smoker: the warning with Edit, and no temp or griddle fix', async () => {
    const { plan, props } = await show({ items: [tritip], cookers: coolSmoker(425) });
    expect(plan.warnings.map(w => [w.code, w.level, w.itemIds])).toEqual([['SMOKER_TOO_COOL', 'warn', ['t']]]);
    expect(plan.items[0]!.input.methodId).toBe('smokerSear');
    const need = smokerReachF(
      rules.foods.find(f => f.id === 'tritip')!,
      method('tritip', 'smokerSear'),
    )!;
    expect(screen.getByTestId('issue-message')).toHaveTextContent(tooCool(need, 425));
    expect(screen.getByTestId('issue-message')).toHaveTextContent(
      "Tri-tip's sear needs 450F and this smoker tops out at 425F. Pick another method in Food details.",
    );
    noButton('Change smoker temp');
    noButton(/to the griddle$/);
    await fireEvent.press(button('Edit tri-tip'));
    await settle();
    expect(props.onEdit).toHaveBeenCalledWith('t');
  });

  test('the too-cool smoker warning reads in Celsius', async () => {
    await show({ items: [tritip], cookers: coolSmoker(425) }, { temp: 'C', weight: 'kg' });
    expect(screen.getByTestId('issue-message')).toHaveTextContent(
      "Tri-tip's sear needs 232C and this smoker tops out at 218C. Pick another method in Food details.",
    );
  });

  test('a smoker at exactly 450F: nothing to fix', async () => {
    await show({ items: [tritip], cookers: coolSmoker(450) });
    expect(screen.getByText('Nothing to fix. The plan fits your cookers.')).toBeOnTheScreen();
  });

  test('Edit closes the sheet, then opens that food', async () => {
    const { props } = await show({ items: clash });
    await fireEvent.press(button('Edit 2 lb chicken wings 1'));
    expect(props.onEdit).not.toHaveBeenCalled();
    await settle();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith('w1');
  });

  test('without food details to open, no Edit buttons show', async () => {
    const input: PlanInput = { ...saturday, cookers: withGriddle, items: clash };
    await render(
      <IssuesSheet
        plan={buildPlan(rules, input)}
        items={input.items}
        cookers={input.cookers}
        units={F}
        onMoveToGriddle={jest.fn()}
        onChangeTemp={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    noButton(/^Edit /);
    expect(screen.getAllByRole('button', { name: /^Move 2 lb chicken wings [12] to the griddle$/ })).toHaveLength(2);
  });

  test('a warning that is not about the temp has no temp fix', async () => {
    const { plan } = await show({ cookers: { smoker: { ...smoker, hopperLb: 2 } } });
    expect(plan.warnings.map(w => w.code)).toEqual(['PELLETS_OVER_HOPPER']);
    noButton('Change smoker temp');
  });

  test('warnings come before notes', async () => {
    const { plan } = await show({ pitTempF: 227, cookers: { smoker: { ...smoker, hopperLb: 2 } } });
    const byLevel = (l: string) => plan.warnings.filter(w => w.level === l).map(w => w.message);
    expect(byLevel('warn').length).toBeGreaterThan(0);
    expect(byLevel('info').length).toBeGreaterThan(0);
    const shown = screen.getAllByTestId('issue-message').map(c => String(c.props.children));
    expect(shown).toEqual([...byLevel('warn'), ...byLevel('info')]);
  });

  test('one of a food keeps its plain name (T-061)', async () => {
    const lone: Warning = {
      code: 'REST_SHORT',
      level: 'warn',
      message: 'Chicken wings only gets 0 min of rest.',
      itemIds: ['w1'],
    };
    await show({ items: [wings('w1', 'smokeCrisp')] }, F, [lone]);
    expect(button('Edit chicken wings')).toBeOnTheScreen();
  });

  test('two of a food get labels in the user units (T-061)', async () => {
    await show(
      { items: [wings('w1', 'smokeCrisp'), { ...wings('w2', 'hot'), quantity: 3 }] },
      { temp: 'F', weight: 'kg' },
    );
    expect(button('Edit 0.9 kg chicken wings')).toBeOnTheScreen();
    expect(button('Edit 1.4 kg chicken wings')).toBeOnTheScreen();
    expect(
      screen.getByText(
        /^Smoker conflict: (0\.9|1\.4) kg chicken wings at \d+F and (0\.9|1\.4) kg chicken wings at \d+F at the same time\.$/,
      ),
    ).toBeOnTheScreen();
  });

  test('messages read in the user units', async () => {
    await show({ pitTempF: 227 }, { temp: 'C', weight: 'kg' });
    expect(screen.queryByText(/227F/)).toBeNull();
    expect(screen.getByText(/^Pit Boss Sportsman 850 cannot be set to \d+C\.$/)).toBeOnTheScreen();
  });
});
