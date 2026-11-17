import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from '@/components/kit';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Repos } from '@/db/repos';
import { defaultGriddle, defaultOven, smokerFromCatalog } from '@/lib/gear';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { Setup, type AlertsStep } from './Setup';
import { SetupGate } from './SetupGate';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

async function show(props: Parameters<typeof Setup>[0] = {}, repos: Repos = testRepos().repos) {
  await render(
    <SetupGate done={<Text>The tabs</Text>}>
      <Setup {...props} />
    </SetupGate>,
    { wrapper: storeWrapper(repos) },
  );
  return repos;
}
const button = (name: string) => screen.getByRole('button', { name });
const press = (name: string) => fireEvent.press(button(name));
const box = (name: string) => screen.getByRole('checkbox', { name });
const toCookers = async () => {
  await press('Continue');
  expect(screen.getByRole('heading', { name: 'What do you cook on?' })).toBeOnTheScreen();
};
/** Open the picker from the empty smoker card and choose a row. */
const pickSmoker = async (name: string, card = 'Smoker') => {
  await fireEvent.press(box(card));
  await fireEvent.press(screen.getByRole('option', { name }));
};

describe('Setup step 1: welcome and units', () => {
  test('greets, shows step 1 of 3 and has no Back', async () => {
    await show();
    expect(screen.getByRole('heading', { name: 'Welcome to Pit Planner' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 3')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(screen.getByLabelText('Temperature unit')).getByRole('radio', { name: 'Fahrenheit' })).toBeChecked();
    expect(within(screen.getByLabelText('Weight unit')).getByRole('radio', { name: 'Pounds' })).toBeChecked();
  });

  test('the units chosen here show on the next step and are saved at the end, not before', async () => {
    const repos = await show();
    await fireEvent.press(screen.getByRole('radio', { name: 'Celsius' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Kilograms' }));
    expect(repos.settings.units()).toEqual({ temp: 'F', weight: 'lb' });
    await toCookers();
    expect(within(box('Oven for holding')).getByText(/Lowest setting\s76C/)).toBeOnTheScreen();
    await pickSmoker('Pit Boss Sportsman 850');
    await settle();
    expect(screen.getByLabelText('Hopper (kg)').props.value).toBe('9.5');
    await press('Continue');
    expect(repos.settings.units()).toEqual({ temp: 'C', weight: 'kg' });
    expect(repos.cookers.load().smoker?.hopperLb).toBe(21); // stored in lb, untouched by the display unit
  });
});

describe('Setup step 2: cookers (mockup 01)', () => {
  test('starts with no smoker, the griddle off and the oven on; Continue waits for a smoker or a griddle', async () => {
    await show();
    await toCookers();
    expect(screen.getByLabelText('Step 2 of 3')).toBeOnTheScreen();
    expect(box('Smoker')).not.toBeChecked();
    expect(within(box('Smoker')).getByText('Pick your model')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Model')).toBeNull();
    expect(box('Griddle')).not.toBeChecked();
    expect(box('Oven for holding')).toBeChecked();
    expect(within(box('Oven for holding')).getByText(/Lowest setting\s170F/)).toBeOnTheScreen();
    expect(button('Continue')).toBeDisabled();
    // Jason, 2026-11-15: say why Continue is off.
    expect(screen.getByText('Add a smoker or a griddle to continue')).toBeOnTheScreen();
    await fireEvent.press(box('Griddle'));
    expect(button('Continue')).toBeEnabled();
    expect(screen.queryByText('Add a smoker or a griddle to continue')).toBeNull();
  });

  test('Back returns to the welcome step with the units kept', async () => {
    await show();
    await fireEvent.press(screen.getByRole('radio', { name: 'Celsius' }));
    await toCookers();
    await press('Back');
    expect(screen.getByRole('heading', { name: 'Welcome to Pit Planner' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Celsius' })).toBeChecked();
  });

  test('a verified model fills the card: type, model, hopper and grate from the catalog', async () => {
    await show();
    await toCookers();
    await pickSmoker('Pit Boss Sportsman 850');
    await settle();
    expect(screen.queryByLabelText('Pick your smoker')).toBeNull();
    expect(box('Pellet smoker')).toBeChecked();
    expect(screen.getByText('Hopper and grate filled from the model')).toBeOnTheScreen();
    expect(within(button('Model')).getByText('Pit Boss Sportsman 850')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hopper (lb)').props.value).toBe('21');
    expect(screen.getByLabelText('Main grate (sq in)').props.value).toBe('593');
    expect(button('Continue')).toBeEnabled();
  });

  test('an unverified model leaves hopper and grate blank on the card unless the user typed them', async () => {
    const repos = await show();
    await toCookers();
    await pickSmoker('Traeger Pro 780');
    await fireEvent.changeText(screen.getByLabelText('Lowest temp (F)'), '165');
    await fireEvent.changeText(screen.getByLabelText('Highest temp (F)'), '500');
    await fireEvent.changeText(screen.getByLabelText('Temp step (F)'), '5');
    await press('Save smoker');
    await settle();
    expect(box('Pellet smoker')).toBeChecked();
    expect(screen.getByText('Specs entered by you')).toBeOnTheScreen();
    expect(within(button('Model')).getByText('Traeger Pro 780')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hopper (lb)').props.value).toBe('');
    expect(screen.getByLabelText('Main grate (sq in)').props.value).toBe('');
    await press('Continue');
    expect(repos.cookers.load().smoker).toMatchObject({
      id: 'traeger-pro-780',
      minTempF: 165,
      maxTempF: 500,
      tempStepF: 5,
      hopperLb: null,
      mainGrateSqIn: null,
      upperRackSqIn: null,
    });
  });

  // Jason, 2026-11-17: the 820's temp setting depends on its controller, so the catalog has no checked specs
  // for it. Picking it opens the form like any unverified model and no 5F step is saved unless typed.
  test('the Pit Boss 820 fills nothing from the model and saves only what the user typed', async () => {
    const repos = await show();
    await toCookers();
    await pickSmoker('Pit Boss 820');
    expect(
      screen.getByText('No checked specs for this model yet. Copy them from the manual or the label on the grill.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Temp step (F)').props.value).toBe('');
    await fireEvent.changeText(screen.getByLabelText('Lowest temp (F)'), '200');
    await fireEvent.changeText(screen.getByLabelText('Highest temp (F)'), '475');
    await fireEvent.changeText(screen.getByLabelText('Dial settings (F)'), '200, 225, 250, 300, 350, 400, 450, 475');
    await press('Save smoker');
    await settle();
    expect(screen.getByText('Specs entered by you')).toBeOnTheScreen();
    expect(screen.queryByText('Hopper and grate filled from the model')).toBeNull();
    expect(screen.getByLabelText('Hopper (lb)').props.value).toBe('');
    expect(screen.getByLabelText('Main grate (sq in)').props.value).toBe('');
    await press('Continue');
    expect(repos.cookers.load().smoker).toMatchObject({
      id: 'pitboss-820',
      name: 'Pit Boss 820',
      minTempF: 200,
      maxTempF: 475,
      tempStepF: null,
      tempPresetsF: [200, 225, 250, 300, 350, 400, 450, 475],
      hopperLb: null,
      mainGrateSqIn: null,
    });
  });

  test('hopper and grate on the card can be edited and are what is saved', async () => {
    const repos = await show();
    await toCookers();
    await pickSmoker('Pit Boss Sportsman 850');
    await settle();
    await fireEvent.changeText(screen.getByLabelText('Hopper (lb)'), '19,5');
    await fireEvent.changeText(screen.getByLabelText('Main grate (sq in)'), '');
    await press('Continue');
    expect(repos.cookers.load().smoker).toMatchObject({
      id: 'pitboss-sportsman-850',
      hopperLb: 19.5,
      mainGrateSqIn: null,
    });
  });

  test('the Model field opens the picker again with the smoker marked; a new pick replaces the fields', async () => {
    await show();
    await toCookers();
    await pickSmoker('Pit Boss Sportsman 850');
    await settle();
    await fireEvent.changeText(screen.getByLabelText('Hopper (lb)'), '5');
    await press('Model');
    expect(screen.getByRole('option', { name: 'Pit Boss Sportsman 850' })).toBeSelected();
    await fireEvent.press(screen.getByRole('option', { name: 'Pit Boss Sportsman 850' }));
    await settle();
    expect(within(button('Model')).getByText('Pit Boss Sportsman 850')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hopper (lb)').props.value).toBe('21');
  });

  test('turning the smoker off keeps its fields in place and leaves it out of what is saved', async () => {
    const repos = await show();
    await toCookers();
    await pickSmoker('Pit Boss Sportsman 850');
    await settle();
    await fireEvent.press(box('Pellet smoker'));
    expect(box('Pellet smoker')).not.toBeChecked();
    expect(screen.getByLabelText('Hopper (lb)')).toBeOnTheScreen();
    expect(button('Continue')).toBeDisabled(); // no smoker and no griddle
    await fireEvent.press(box('Griddle'));
    await press('Continue');
    const saved = repos.cookers.load();
    expect(saved.smoker).toBeUndefined();
    expect(saved.griddle).toEqual(defaultGriddle());
    expect(saved.oven).toEqual(defaultOven());
  });

  test('Add another cooker offers what is not on yet; Griddle turns the griddle on', async () => {
    await show();
    await toCookers();
    await press('Add another cooker');
    const sheet = screen.getByLabelText('Add a cooker');
    expect(within(sheet).queryByRole('button', { name: 'Oven' })).toBeNull(); // already on
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Griddle' }));
    await settle();
    expect(screen.queryByLabelText('Add a cooker')).toBeNull();
    expect(box('Griddle')).toBeChecked();
  });

  test('Add another cooker, Smoker opens the picker', async () => {
    await show();
    await toCookers();
    await press('Add another cooker');
    await fireEvent.press(within(screen.getByLabelText('Add a cooker')).getByRole('button', { name: 'Smoker' }));
    await settle();
    expect(screen.getByLabelText('Pick your smoker')).toBeOnTheScreen();
  });
});

describe('Finishing Setup', () => {
  test('Continue on the cookers step saves the gear and Setup gives way (the alerts step is T-025)', async () => {
    const repos = await show();
    await toCookers();
    await pickSmoker('Pit Boss Sportsman 850');
    await settle();
    expect(repos.cookers.count()).toBe(0); // nothing saved before the end
    await press('Continue');
    expect(repos.cookers.load()).toEqual({ smoker: smokerFromCatalog('pitboss-sportsman-850'), oven: defaultOven() });
    expect(screen.getByText('The tabs')).toBeOnTheScreen();
    expect(screen.queryByRole('heading', { name: 'What do you cook on?' })).toBeNull();
  });

  test('with an alerts step, Continue opens it; its Back returns and its Finish saves', async () => {
    const alertsStep: AlertsStep = ({ onBack, onFinish }) => (
      <>
        <Text onPress={onBack}>alerts back</Text>
        <Text onPress={onFinish}>alerts finish</Text>
      </>
    );
    const repos = await show({ alertsStep });
    await toCookers();
    await fireEvent.press(box('Griddle'));
    await press('Continue');
    expect(repos.cookers.count()).toBe(0);
    await fireEvent.press(screen.getByText('alerts back'));
    expect(box('Griddle')).toBeChecked(); // the cookers step, as it was left
    await press('Continue');
    await fireEvent.press(screen.getByText('alerts finish'));
    expect(repos.cookers.load()).toEqual({ griddle: defaultGriddle(), oven: defaultOven() });
    expect(screen.getByText('The tabs')).toBeOnTheScreen();
  });

  test('the phone back button goes back a step, and is left to the system on the first step', async () => {
    let handler: (() => boolean) | null = null;
    const off = jest.fn(() => {
      handler = null;
    });
    const onBackPress = jest.fn((h: () => boolean) => {
      handler = h;
      return off;
    });
    await show({ onBackPress });
    expect(handler).toBeNull();
    await toCookers();
    expect(handler).not.toBeNull();
    let used = false;
    await act(() => {
      used = handler!();
    });
    expect(used).toBe(true);
    expect(screen.getByRole('heading', { name: 'Welcome to Pit Planner' })).toBeOnTheScreen();
    expect(off).toHaveBeenCalled();
    expect(handler).toBeNull();
  });
});

describe('Setup shows only on a first run', () => {
  test('not once cookers are saved (a restart after Setup, or after a 0.2.0 import)', async () => {
    const { repos } = testRepos();
    repos.cookers.save({ smoker: smokerFromCatalog('pitboss-sportsman-850')! }, NOW);
    await show({}, repos);
    expect(screen.getByText('The tabs')).toBeOnTheScreen();
    expect(screen.queryByRole('heading', { name: 'Welcome to Pit Planner' })).toBeNull();
  });

  test('shows while none are saved', async () => {
    await show();
    expect(screen.queryByText('The tabs')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome to Pit Planner' })).toBeOnTheScreen();
  });
});

// T-082 (Jason, 2026-11-17; proposal docs/proposals/2026-11-17-temp-step, pictures 01 to 01d).
describe('the temp step question on the smoker card', () => {
  const QUESTION = 'What steps does your smoker set in?';
  const group = () => screen.getByLabelText(QUESTION);
  const nameOf = (r: { props: Record<string, unknown> }) =>
    (r.props.accessibilityLabel ?? r.props['aria-label']) as string;
  const choices = () => within(group()).getAllByRole('radio').map(nameOf);
  const selected = () =>
    within(group())
      .getAllByRole('radio')
      .filter(r => r.props.accessibilityState?.checked ?? r.props['aria-checked'])
      .map(nameOf);
  const choose = (name: string) => fireEvent.press(within(group()).getByRole('radio', { name }));
  /** The sheet by its title (the card's Model field carries the same name). */
  const dialogs = (title: string) => screen.queryAllByLabelText(title).filter(e => e.props.role === 'dialog');
  const sheet = (title: string) => within(dialogs(title)[0]!);
  const MODEL = 'Pit Boss Sportsman 850';
  const celsius = () => fireEvent.press(screen.getByRole('radio', { name: 'Celsius' }));
  const toCard = async (unit: 'F' | 'C' = 'F') => {
    const repos = await show();
    if (unit === 'C') await celsius();
    await toCookers();
    await pickSmoker(MODEL);
    await settle();
    return repos;
  };

  test('sits under the model with 5F / 10F / 15F / 25F / Other; a catalog pick shows its step', async () => {
    await toCard();
    expect(choices()).toEqual(['5F', '10F', '15F', '25F', 'Other']);
    expect(selected()).toEqual(['5F']);
    expect(screen.getByText(QUESTION)).toBeOnTheScreen();
    expect(screen.queryByText(/^Sets in|^Has fixed settings/)).toBeNull();
  });

  test.each([
    ['F', '5F', 5],
    ['F', '10F', 10],
    ['F', '15F', 15],
    ['F', '25F', 25],
    ['C', '5C', 9],
    ['C', '10C', 18],
    ['C', '15C', 27],
    ['C', '25C', 45],
  ] as const)('in %s, %s is saved as a %iF step; the rest of the smoker is the model', async (unit, choice, stepF) => {
    const repos = await toCard(unit);
    await choose(choice);
    expect(selected()).toEqual([choice]);
    expect(screen.getByText('Hopper and grate filled from the model')).toBeOnTheScreen();
    await press('Continue');
    expect(repos.cookers.load().smoker).toEqual({ ...smokerFromCatalog('pitboss-sportsman-850')!, tempStepF: stepF });
  });

  test('in Celsius no F shows and the 5F catalog step selects nothing; Continue keeps the 5F step (3A)', async () => {
    const repos = await toCard('C');
    expect(choices()).toEqual(['5C', '10C', '15C', '25C', 'Other']);
    expect(selected()).toEqual([]);
    expect(screen.queryByText(/^Sets in|^Has fixed settings/)).toBeNull();
    expect(screen.queryByText(/\dF\b/)).toBeNull();
    await press('Continue');
    expect(repos.cookers.load().smoker!.tempStepF).toBe(5);
  });

  test('Other opens a two-field sheet titled with the model; a step saved there changes only the step', async () => {
    const repos = await toCard();
    await choose('Other');
    const other = sheet(MODEL);
    expect(selected()).toEqual(['Other']);
    expect(other.getByLabelText('Temp step (F)').props.value).toBe('');
    expect(
      other.getByText('How far one press moves the setting. Leave blank if the dial has fixed settings.'),
    ).toBeOnTheScreen();
    expect(other.getByLabelText('Dial settings (F)').props.placeholder).toBe('180, 225, 250, 300');
    expect(other.queryByLabelText('Lowest temp (F)')).toBeNull();
    expect(other.queryByLabelText('Name')).toBeNull();
    expect(other.getByRole('button', { name: 'Save smoker' })).toBeDisabled();
    await fireEvent.changeText(other.getByLabelText('Temp step (F)'), '20');
    await fireEvent.press(other.getByRole('button', { name: 'Save smoker' }));
    await settle();
    expect(dialogs(MODEL)).toEqual([]);
    expect(selected()).toEqual(['Other']);
    expect(screen.getByText('Sets in 20F steps.')).toBeOnTheScreen();
    expect(screen.getByText('Hopper and grate filled from the model')).toBeOnTheScreen();
    expect(within(button('Model')).getByText(MODEL)).toBeOnTheScreen();
    expect(screen.getByLabelText('Hopper (lb)').props.value).toBe('21');
    await press('Continue');
    expect(repos.cookers.load().smoker).toEqual({ ...smokerFromCatalog('pitboss-sportsman-850')!, tempStepF: 20 });
  });

  test('Other with dial settings: two are needed; saved with no step and listed under the question', async () => {
    const repos = await toCard();
    await choose('Other');
    const other = sheet(MODEL);
    await fireEvent.changeText(other.getByLabelText('Dial settings (F)'), '250');
    expect(other.getByRole('button', { name: 'Save smoker' })).toBeDisabled();
    await fireEvent.changeText(other.getByLabelText('Dial settings (F)'), '250, 180 225');
    await fireEvent.press(other.getByRole('button', { name: 'Save smoker' }));
    await settle();
    expect(selected()).toEqual(['Other']);
    expect(screen.getByText('Has fixed settings: 180, 225, 250F.')).toBeOnTheScreen();
    await press('Continue');
    const saved = repos.cookers.load().smoker!;
    expect(saved).toMatchObject({ id: 'pitboss-sportsman-850', tempStepF: null, tempPresetsF: [180, 225, 250] });
    expect(saved.hopperLb).toBe(21);
  });

  test('closing the Other sheet without saving puts the choice back (2A)', async () => {
    const repos = await toCard();
    await choose('25F');
    await choose('Other');
    await fireEvent.changeText(sheet(MODEL).getByLabelText('Temp step (F)'), '20');
    await fireEvent.press(sheet(MODEL).getByRole('button', { name: 'Close' }));
    await settle();
    expect(dialogs(MODEL)).toEqual([]);
    expect(selected()).toEqual(['25F']);
    expect(screen.queryByText(/^Sets in/)).toBeNull();
    await press('Continue');
    expect(repos.cookers.load().smoker!.tempStepF).toBe(25);
  });

  // Jason, 2026-11-17: the display unit decides. In Celsius only 5C to 25C (9, 18, 27, 45F) are C steps; any
  // other step typed there is stored as whole F and read as an F step, like the 5F catalog step: none selected.
  test('in Celsius the Other sheet takes C: 5C selects 5C, 20C selects none, dial settings read in C', async () => {
    const repos = await toCard('C');
    await choose('Other');
    await fireEvent.changeText(sheet(MODEL).getByLabelText('Temp step (C)'), '5');
    await fireEvent.press(sheet(MODEL).getByRole('button', { name: 'Save smoker' }));
    await settle();
    expect(selected()).toEqual(['5C']);
    await choose('Other');
    await fireEvent.changeText(sheet(MODEL).getByLabelText('Temp step (C)'), '20');
    await fireEvent.press(sheet(MODEL).getByRole('button', { name: 'Save smoker' }));
    await settle();
    expect(selected()).toEqual([]);
    expect(screen.queryByText(/^Sets in/)).toBeNull();
    await choose('Other');
    expect(sheet(MODEL).getByLabelText('Dial settings (C)').props.placeholder).toBe('80, 105, 120, 150');
    await fireEvent.changeText(sheet(MODEL).getByLabelText('Dial settings (C)'), '80, 105, 120');
    await fireEvent.press(sheet(MODEL).getByRole('button', { name: 'Save smoker' }));
    await settle();
    // Jason, 2026-11-17: dial settings are real dial marks, so they read as typed, to the whole degree, not
    // with the 2C set point rounding (221F is 105C, which that rounding showed as 106C).
    expect(screen.getByText('Has fixed settings: 80, 105, 120C.')).toBeOnTheScreen();
    await press('Continue');
    expect(repos.cookers.load().smoker).toMatchObject({ tempStepF: null, tempPresetsF: [176, 221, 248] });
  });

  test('shows for a model that is not verified, from what the user typed (5A)', async () => {
    const repos = await show();
    await toCookers();
    await pickSmoker('Traeger Pro 780');
    await fireEvent.changeText(screen.getByLabelText('Lowest temp (F)'), '165');
    await fireEvent.changeText(screen.getByLabelText('Highest temp (F)'), '500');
    await fireEvent.changeText(screen.getByLabelText('Temp step (F)'), '5');
    await press('Save smoker');
    await settle();
    expect(screen.getByText('Specs entered by you')).toBeOnTheScreen();
    expect(selected()).toEqual(['5F']);
    await choose('10F');
    await press('Continue');
    expect(repos.cookers.load().smoker).toMatchObject({ id: 'traeger-pro-780', minTempF: 165, tempStepF: 10 });
  });

  test.each([
    ['Big Green Egg', 'Kamado'],
    ['Weber Smokey Mountain', 'Drum smoker'],
    ["Oklahoma Joe's Highland", 'Offset smoker'],
  ])('is not asked for the %s: a %s has no steps (6A)', async (model, title) => {
    await show();
    await toCookers();
    await pickSmoker(model);
    await fireEvent.changeText(screen.getByLabelText('Lowest temp (F)'), '200');
    await fireEvent.changeText(screen.getByLabelText('Highest temp (F)'), '600');
    await fireEvent.changeText(screen.getByLabelText('Temp step (F)'), '25');
    await press('Save smoker');
    await settle();
    expect(box(title)).toBeChecked();
    expect(screen.queryByLabelText(QUESTION)).toBeNull();
    expect(screen.queryByText(QUESTION)).toBeNull();
  });
});
