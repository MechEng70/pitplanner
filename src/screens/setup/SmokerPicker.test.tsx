import { act, fireEvent, render, screen } from '@testing-library/react-native';
import cookers from '../../../data/cookers.json';
import { settableTemps } from '../../../engine/temps';
import type { SmokerProfile } from '../../../engine/types';
import { fToC } from '../../../engine/units';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Units } from '@/lib/format';
import { SmokerPicker } from './SmokerPicker';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

const US: Units = { temp: 'F', weight: 'lb' };
const METRIC: Units = { temp: 'C', weight: 'kg' };
const types = Object.entries(cookers.smokerTypes);
const nameOf = (s: { brand: string; model: string }) => `${s.brand} ${s.model}`.trim();
const used = types.filter(([t]) => cookers.smokers.some(s => s.type === t));
const unverified = cookers.smokers.find(s => !s.verified)!;
const verified = cookers.smokers.find(s => s.verified)!;

async function show(units: Units = US, selectedId?: string) {
  const onPick = jest.fn<void, [SmokerProfile]>();
  const onClose = jest.fn();
  await render(<SmokerPicker units={units} selectedId={selectedId} onPick={onPick} onClose={onClose} />);
  return { onPick, onClose };
}
const search = () => screen.getByLabelText('Search brand or model');
const shown = () => screen.getAllByRole('option').map(o => o.props.accessibilityLabel ?? o.props['aria-label']);
const headings = () => used.filter(([, i]) => screen.queryByRole('heading', { name: i.group }) != null).map(([t]) => t);
const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, v: string) => fireEvent.changeText(field(label), v);
const save = () => screen.getByRole('button', { name: 'Save smoker' });

describe('Smoker picker (mockup 02)', () => {
  test('lists every catalog smoker under its type group, in the order of data/cookers.json, with the group note', async () => {
    await show();
    expect(screen.getByLabelText('Pick your smoker')).toBeOnTheScreen();
    expect(headings()).toEqual(used.map(([t]) => t));
    expect(shown()).toEqual(used.flatMap(([t]) => cookers.smokers.filter(s => s.type === t).map(nameOf)));
    for (const [, info] of used) expect(screen.getAllByText(info.note).length).toBeGreaterThan(0);
  });

  test('type chips: All and one per type that has a smoker; a chip keeps only its group', async () => {
    await show();
    const chips = screen.getAllByRole('radio').map(c => c.props.accessibilityLabel ?? c.props['aria-label']);
    expect(chips).toEqual(['All', ...used.map(([, i]) => i.chip)]);
    await fireEvent.press(screen.getByRole('radio', { name: 'Kamado' }));
    expect(headings()).toEqual(['kamado']);
    expect(shown()).toEqual(cookers.smokers.filter(s => s.type === 'kamado').map(nameOf));
    await fireEvent.press(screen.getByRole('radio', { name: 'All' }));
    expect(shown()).toHaveLength(cookers.smokers.length);
  });

  test('search filters by brand or model, ignoring case and spaces around it, within the chosen type', async () => {
    await show();
    await type('Search brand or model', '  TRAEGER ');
    expect(shown()).toEqual(cookers.smokers.filter(s => s.brand === 'Traeger').map(nameOf));
    await fireEvent.changeText(search(), 'masterbuilt');
    expect(shown()).toHaveLength(2);
    await fireEvent.press(screen.getByRole('radio', { name: 'Electric' }));
    expect(shown()).toEqual(['Masterbuilt Electric smoker']);
  });

  test('says so when nothing matches', async () => {
    await show();
    await fireEvent.changeText(search(), 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No smokers match "zzz". Enter it yourself below.')).toBeOnTheScreen();
  });

  test('marks the smoker already chosen', async () => {
    await show(US, verified.id);
    expect(screen.getByRole('option', { name: nameOf(verified) })).toBeSelected();
    expect(screen.getByRole('option', { name: nameOf(unverified) })).not.toBeSelected();
  });

  test('a verified model closes the sheet and comes back with its specs from the catalog', async () => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('option', { name: nameOf(verified) }));
    expect(onPick).not.toHaveBeenCalled();
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]![0]).toMatchObject({
      id: verified.id,
      name: nameOf(verified),
      type: verified.type,
      minTempF: verified.minTempF,
      maxTempF: verified.maxTempF,
      hopperLb: verified.hopperLb,
      mainGrateSqIn: verified.mainGrateSqIn,
    });
  });

  test('an unverified model opens the form with every spec blank and cannot be saved until they are typed', async () => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('option', { name: nameOf(unverified) }));
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(nameOf(unverified))).toBeOnTheScreen(); // the form sheet, titled with the model
    expect(
      screen.getByText('No checked specs for this model yet. Copy them from the manual or the label on the grill.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Name')).toBeNull();
    for (const label of [
      'Lowest temp (F)',
      'Highest temp (F)',
      'Temp step (F)',
      'Dial settings (F)',
      'Hopper (lb)',
      'Main grate (sq in)',
    ])
      expect(field(label).props.value).toBe('');
    expect(screen.getByRole('radio', { name: 'Pellet' })).toBeChecked();
    expect(save()).toBeDisabled();
    await fireEvent.press(save());
    await settle();
    expect(onPick).not.toHaveBeenCalled();
  });

  test('no unverified catalog entry carries specs into the form', async () => {
    for (const s of cookers.smokers.filter(e => !e.verified)) {
      const { unmount } = await render(<SmokerPicker units={US} onPick={jest.fn()} onClose={jest.fn()} />);
      await fireEvent.press(screen.getByRole('option', { name: nameOf(s) }));
      const inputs = [
        'Lowest temp (F)',
        'Highest temp (F)',
        'Temp step (F)',
        'Dial settings (F)',
        'Main grate (sq in)',
      ];
      for (const label of inputs) expect(field(label).props.value).toBe('');
      expect(screen.queryByLabelText('Hopper (lb)')?.props.value ?? '').toBe('');
      await unmount();
    }
  });

  test('an unverified model saves what the user typed, under the catalog id and name', async () => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('option', { name: nameOf(unverified) }));
    await type('Lowest temp (F)', '180');
    await type('Highest temp (F)', '500');
    expect(save()).toBeDisabled(); // no step and no dial settings yet
    await type('Temp step (F)', '5');
    expect(screen.queryByLabelText('Dial settings (F)')).toBeNull();
    await type('Hopper (lb)', '19');
    expect(save()).toBeEnabled();
    await fireEvent.press(save());
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]![0]).toMatchObject({
      id: unverified.id,
      name: nameOf(unverified),
      type: 'pellet',
      minTempF: 180,
      maxTempF: 500,
      tempStepF: 5,
      hopperLb: 19,
      mainGrateSqIn: null,
    });
  });

  test('Not listed? opens the form with a name field; dial settings stand in for a step', async () => {
    const { onPick } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Not listed? Enter it yourself' }));
    expect(screen.getByLabelText('Your smoker')).toBeOnTheScreen();
    expect(field('Name').props.value).toBe('');
    await type('Name', ' Backyard drum ');
    await fireEvent.press(screen.getByRole('radio', { name: 'Drum' }));
    expect(screen.queryByLabelText('Hopper (lb)')).toBeNull(); // a drum has no hopper
    await type('Lowest temp (F)', '200');
    await type('Highest temp (F)', '350');
    await type('Dial settings (F)', '300');
    expect(save()).toBeDisabled(); // one setting is not a dial
    await type('Dial settings (F)', '300, 225 250');
    await type('Main grate (sq in)', '380');
    await fireEvent.press(save());
    await settle();
    expect(onPick.mock.calls[0]![0]).toMatchObject({
      id: 'custom',
      name: 'Backyard drum',
      type: 'drum',
      minTempF: 200,
      maxTempF: 350,
      tempStepF: null,
      tempPresetsF: [225, 250, 300],
      hopperLb: null,
      mainGrateSqIn: 380,
    });
  });

  test('the range has to run from low to high', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Not listed? Enter it yourself' }));
    await type('Name', 'Mine');
    await type('Temp step (F)', '5');
    await type('Lowest temp (F)', '400');
    await type('Highest temp (F)', '300');
    expect(save()).toBeDisabled();
    await type('Highest temp (F)', '450');
    expect(save()).toBeEnabled();
  });

  test('metric: temps are typed in C and the hopper in kg, stored in F and lb', async () => {
    const { onPick } = await show(METRIC);
    await fireEvent.press(screen.getByRole('button', { name: 'Not listed? Enter it yourself' }));
    await type('Name', 'Mine');
    await type('Lowest temp (C)', '80');
    await type('Highest temp (C)', '260');
    await type('Temp step (C)', '5');
    await type('Hopper (kg)', '9');
    await fireEvent.press(save());
    await settle();
    const s = onPick.mock.calls[0]![0];
    expect(s).toMatchObject({ minTempF: 176, maxTempF: 500, tempStepF: 9 });
    expect(s.hopperLb).toBeCloseTo(19.84, 2);
  });

  // Known bug (found 2026-11-17, not fixed before 0.3.0-beta.1; T-082 decides how): the form stores a
  // Celsius step as a whole number of F (1C as 2F, 2C as 4F), so the temps the menu offers drift off the
  // smoker's Celsius grid. Only steps that are multiples of 5C (9F each) are stored exactly. These two tests
  // say what must hold and are marked failing until the engine can hold a Celsius step.
  test.failing.each([
    [1, [80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90]],
    [2, [80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100]],
  ])('metric: a %iC step offers every step on the Celsius grid', async (stepC, wantC) => {
    const { onPick } = await show(METRIC);
    await fireEvent.press(screen.getByRole('button', { name: 'Not listed? Enter it yourself' }));
    await type('Name', 'Mine');
    await type('Lowest temp (C)', '80');
    await type('Highest temp (C)', '260');
    await type('Temp step (C)', String(stepC));
    await fireEvent.press(save());
    await settle();
    const s = onPick.mock.calls[0]![0];
    const offeredC = settableTemps(s)
      .slice(0, wantC.length)
      .map(f => Math.round(fToC(f)));
    expect(offeredC).toEqual(wantC);
  });

  test('Close on the form ends the flow without a smoker', async () => {
    const { onPick, onClose } = await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Not listed? Enter it yourself' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });
});
