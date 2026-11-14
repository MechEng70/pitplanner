import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { buildPlan } from '../../../engine/plan';
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
    expect(screen.getAllByRole('button', { name: 'Move chicken wings to the griddle' })).toHaveLength(2);
    expect(button('Change smoker temp')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Edit chicken wings' })).toHaveLength(2);
  });

  test('a food with no griddle method is not offered the griddle', async () => {
    await show({}, F, [
      { code: 'REST_SHORT', level: 'warn', message: 'Brisket only gets 5 min of rest.', itemIds: ['b'] },
    ]);
    noButton(/to the griddle$/);
    noButton('Change smoker temp');
    expect(button('Edit brisket')).toBeOnTheScreen();
  });

  test('a food already on the griddle is not offered it again', async () => {
    const item = wings('w', 'griddle');
    await show({ items: [brisket, item] }, F, [
      { code: 'REST_SHORT', level: 'warn', message: 'Short rest.', itemIds: ['w'] },
    ]);
    noButton(/to the griddle$/);
  });

  test('Move to the griddle reports the food and its griddle method, and the sheet stays open', async () => {
    const { plan, props } = await show({ items: clash });
    const ids = plan.warnings.find(x => x.code === 'PIT_CONFLICT')!.itemIds!;
    await fireEvent.press(screen.getAllByRole('button', { name: 'Move chicken wings to the griddle' })[1]!);
    expect(props.onMoveToGriddle).toHaveBeenCalledWith(ids[1], 'griddle');
    await settle();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  test('without a griddle the move is not offered', async () => {
    await show({ items: clash, cookers: { smoker } });
    noButton(/to the griddle$/);
    expect(screen.getAllByRole('button', { name: 'Edit chicken wings' })).toHaveLength(2);
  });

  test('Change smoker temp closes the sheet, then opens the temp menu', async () => {
    const { plan, props } = await show({ pitTempF: 227 });
    expect(plan.warnings.map(w => w.code)).toEqual(['TEMP_NOT_SETTABLE']);
    expect(screen.getByText('Pit Boss 820 cannot be set to 227F.')).toBeOnTheScreen();
    await fireEvent.press(button('Change smoker temp'));
    expect(props.onChangeTemp).not.toHaveBeenCalled();
    await settle();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onChangeTemp).toHaveBeenCalledTimes(1);
  });

  test('Edit closes the sheet, then opens that food', async () => {
    const { plan, props } = await show({ items: clash });
    const ids = plan.warnings.find(x => x.code === 'PIT_CONFLICT')!.itemIds!;
    await fireEvent.press(screen.getAllByRole('button', { name: 'Edit chicken wings' })[0]!);
    expect(props.onEdit).not.toHaveBeenCalled();
    await settle();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith(ids[0]);
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
    expect(screen.getAllByRole('button', { name: 'Move chicken wings to the griddle' })).toHaveLength(2);
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

  test('messages read in the user units', async () => {
    await show({ pitTempF: 227 }, { temp: 'C', weight: 'kg' });
    expect(screen.queryByText(/227F/)).toBeNull();
    expect(screen.getByText(/^Pit Boss 820 cannot be set to \d+C\.$/)).toBeOnTheScreen();
  });
});
