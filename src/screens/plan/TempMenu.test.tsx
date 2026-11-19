import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { buildPlan } from '../../../engine/plan';
import { settableTemps } from '../../../engine/temps';
import type { PlanInput } from '../../../engine/types';
import { saturday } from '@/lib/fixtures/saturday';
import type { Units } from '@/lib/format';
import { rules } from '@/lib/rules';
import { TempMenu } from './TempMenu';

const F: Units = { temp: 'F', weight: 'lb' };
const C: Units = { temp: 'C', weight: 'kg' };
const smoker = saturday.cookers.smoker!;
const anchor = { x: 16, y: 150, width: 328, height: 60 };

async function show(input: PlanInput = saturday, units: Units = F) {
  const onPick = jest.fn();
  const onClose = jest.fn();
  const plan = input.items.length ? buildPlan(rules, input) : null;
  await render(
    <TempMenu
      smoker={input.cookers.smoker ?? smoker}
      input={input}
      plan={plan}
      anchor={anchor}
      units={units}
      onPick={onPick}
      onClose={onClose}
    />,
  );
  return { onPick, onClose };
}
const rows = () => screen.getAllByRole('option');
/** The temp each row offers, as shown. */
const labels = () => rows().map(r => String(within(r).getByText(/^\d+[FC]$/).props.children));
const row = (temp: string) => screen.getByRole('option', { name: new RegExp(`^${temp}`) });

describe('smoker temp menu (mockup 06)', () => {
  test('offers only the temps the smoker can be set to, 200-300F to start with (failure mode 12)', async () => {
    await show();
    expect(labels()).toEqual(settableTemps(smoker, [200, 300]).map(t => `${t}F`));
    expect(labels()).toContain('225F');
    expect(labels()).not.toContain('227F');
    expect(labels()).not.toContain('195F');
  });

  test('a smoker with fixed settings offers exactly those', async () => {
    const dial = { ...smoker, name: 'Dial smoker', tempStepF: null, tempPresetsF: [200, 225, 250, 300, 350] };
    await show({ ...saturday, cookers: { smoker: dial } });
    expect(labels()).toEqual(['200F', '225F', '250F', '300F']);
    expect(screen.getByText(/^Dial smoker has fixed settings\./)).toBeOnTheScreen();
  });

  // Jason, 2026-11-17: a dial's settings are real marks, so in Celsius they read to the whole degree, as on the
  // Setup card and in Gear (105C, not the 2C rounding's 106C).
  test('a dial at 80, 105, 120C reads those marks in Celsius, rows and field', async () => {
    const dial = { ...smoker, name: 'Dial smoker', minTempF: 176, tempStepF: null, tempPresetsF: [176, 221, 248] };
    await show({ ...saturday, pitTempF: 221, cookers: { smoker: dial } }, C);
    expect(labels()).toEqual(['105C', '120C']);
    expect(row('105C')).toBeSelected();
    expect(within(screen.getByRole('button', { name: 'Smoker temp' })).getByText('105C')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Show 80-120C' }));
    expect(labels()).toEqual(['80C', '105C', '120C']);
  });

  test('each row says when to fire at that temp; the current temp is selected', async () => {
    await show();
    expect(row('225F')).toBeSelected();
    expect(within(row('225F')).getByText('fire 6:20 AM')).toBeOnTheScreen();
    expect(row('250F')).not.toBeSelected();
    const at250 = buildPlan(rules, { ...saturday, pitTempF: 250 }).fireAt!;
    expect(at250).toBeGreaterThan(buildPlan(rules, saturday).fireAt!);
    expect(within(row('250F')).getByText(/^fire \d+:\d\d AM$/)).toBeOnTheScreen();
  });

  test('in Start at mode each row says when the food is ready', async () => {
    await show({ ...saturday, mode: 'startAt', at: Date.UTC(2026, 10, 14, 11, 20) });
    expect(within(row('225F')).getByText(/^ready \d+:\d\d PM$/)).toBeOnTheScreen();
  });

  test('the intro names the smoker, its steps and the food the times are for', async () => {
    await show();
    expect(screen.getByText('Pit Boss Sportsman 850 sets in 5F steps. Times for 12 lb brisket.')).toBeOnTheScreen();
  });

  test('the opened field shows the current temp and closes the menu', async () => {
    const { onClose } = await show();
    const field = screen.getByRole('button', { name: 'Smoker temp' });
    expect(within(field).getByText('225F')).toBeOnTheScreen();
    expect(field).toBeExpanded();
    await fireEvent.press(field);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('choosing a row reports its temp in F', async () => {
    const { onPick } = await show();
    await fireEvent.press(row('230F'));
    expect(onPick).toHaveBeenCalledWith(230);
  });

  test('Show 180-500F lists the whole range and warns that times outside 200-300F are rough', async () => {
    await show();
    expect(screen.queryByText(/rough guess/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show 180-500F' }));
    expect(labels()).toEqual(settableTemps(smoker).map(t => `${t}F`));
    expect(screen.getByText('Times outside 200-300F are a rough guess.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Show 180-500F' })).toBeNull();
    expect(within(row('350F')).getByText(/\(rough\)$/)).toBeOnTheScreen();
    expect(within(row('225F')).queryByText(/rough/)).toBeNull();
  });

  test('a temp outside 200-300F opens with the whole range', async () => {
    await show({ ...saturday, pitTempF: 325 });
    expect(row('325F')).toBeSelected();
    expect(screen.getByText('Times outside 200-300F are a rough guess.')).toBeOnTheScreen();
  });

  test('in Celsius the rows and the step are in C, and the choice is still reported in F', async () => {
    const { onPick } = await show(saturday, C);
    // Set points show in 2C increments (Jason, 2026-11-14): every 5F step is its own row (220F and 225F
    // both read 105C before).
    expect(row('108C')).toBeSelected();
    expect(labels().slice(0, 6)).toEqual(['94C', '96C', '98C', '102C', '104C', '108C']);
    expect(new Set(labels()).size).toBe(labels().length);
    expect(screen.getByText(/sets in 2\.8C steps/)).toBeOnTheScreen();
    await fireEvent.press(rows()[0]!);
    expect(onPick).toHaveBeenCalledWith(200);
  });

  // T-082: the saved step drives the menu; the rows are the multiples of the step at or above the lowest temp.
  describe('the saved step (T-082)', () => {
    const withStep = (tempStepF: number, pitTempF = 225): PlanInput => ({
      ...saturday,
      pitTempF,
      cookers: { ...saturday.cookers, smoker: { ...smoker, tempStepF } },
    });

    test('10F: 200 to 300 in 10s', async () => {
      await show(withStep(10, 230));
      expect(labels()).toEqual([
        '200F',
        '210F',
        '220F',
        '230F',
        '240F',
        '250F',
        '260F',
        '270F',
        '280F',
        '290F',
        '300F',
      ]);
      expect(screen.getByText(/sets in 10F steps\./)).toBeOnTheScreen();
    });

    test('25F from 180F: 200, 225, 250 (not 205, 230)', async () => {
      await show(withStep(25));
      expect(labels()).toEqual(['200F', '225F', '250F', '275F', '300F']);
      await fireEvent.press(screen.getByRole('button', { name: 'Show 200-500F' }));
      expect(labels()[0]).toBe('200F');
    });

    test('5C (9F) in Celsius: exact C from 85C, and the intro says 5C', async () => {
      const { onPick } = await show(withStep(9, 185), C);
      expect(row('85C')).toBeSelected();
      expect(screen.getByText(/^Pit Boss Sportsman 850 sets in 5C steps\./)).toBeOnTheScreen();
      expect(within(screen.getByRole('button', { name: 'Smoker temp' })).getByText('85C')).toBeOnTheScreen();
      expect(labels().slice(0, 5)).toEqual(['85C', '90C', '95C', '100C', '105C']);
      expect(screen.queryByText(/\dF\b/)).toBeNull();
      await fireEvent.press(row('90C'));
      expect(onPick).toHaveBeenCalledWith(194);
    });

    test('the same 9F step in Fahrenheit is an F step from 180F', async () => {
      await show(withStep(9, 225));
      expect(labels().slice(0, 3)).toEqual(['207F', '216F', '225F']);
      expect(screen.getByText(/sets in 9F steps\./)).toBeOnTheScreen();
    });
  });

  test('with nothing on the menu the rows carry no times', async () => {
    await show({ ...saturday, items: [] });
    expect(screen.queryByText(/fire /)).toBeNull();
    expect(screen.getByText('Pit Boss Sportsman 850 sets in 5F steps.')).toBeOnTheScreen();
  });
});
