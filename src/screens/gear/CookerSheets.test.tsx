import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import cookers from '../../../data/cookers.json';
import { buildPlan } from '../../../engine/plan';
import type { Cookers, Plan } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Units } from '@/lib/format';
import { rules } from '@/lib/rules';
import { planInput, useStore } from '@/lib/store';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import type { CookerKind } from '@/screens/shared/AddCooker';
import { cookGear, cookInput } from '@/test/cook';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { CookerSheets } from './CookerSheets';
import { GearScreen } from './GearScreen';
import { TempMenu } from '@/screens/plan/TempMenu';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

const METRIC: Units = { temp: 'C', weight: 'kg' };
const unverified = cookers.smokers.find(s => !s.verified)!;
const verified = cookers.smokers.find(s => s.id === 'pitboss-sportsman-850')!;
const nameOf = (s: { brand: string; model: string }) => `${s.brand} ${s.model}`.trim();

/** The plan the store's gear gives for the Saturday menu (brisket, wings, breasts): what Plan would build. */
let plan: Plan;
function Probe() {
  const { state } = useStore();
  useEffect(() => {
    plan = buildPlan(rules, { ...planInput(state), at: cookInput.at, items: cookInput.items });
  }, [state]);
  return null;
}

/** The Gear tab as the route wires it (app/(tabs)/gear.tsx): a cooker row or Add a cooker opens CookerSheets. */
function GearTab({ alarms, resume }: { alarms: ReturnType<typeof fakeAlarms>; resume: ReturnType<typeof fakeResume> }) {
  const [cooker, setCooker] = useState<CookerKind | null>(null);
  return (
    <>
      <GearScreen
        version="0.3.0"
        permissions={alarms}
        alarms={alarms}
        onResume={resume.onResume}
        onDebug={jest.fn()}
        onCooker={setCooker}
      />
      {cooker ? <CookerSheets kind={cooker} onClose={() => setCooker(null)} /> : null}
      <Probe />
    </>
  );
}

async function show({ gear = cookGear, units }: { gear?: Cookers; units?: Units } = {}) {
  const { repos } = testRepos();
  repos.cookers.save(gear, NOW);
  if (units) repos.settings.setUnits(units, NOW);
  const alarms = fakeAlarms();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<GearTab alarms={alarms} resume={fakeResume()} />, { wrapper: storeWrapper(repos, () => NOW, alarms) });
  return { repos };
}

/** Exact text, with the no-break spaces a Num puts inside a value. */
const text = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s')}$`);
const row = (name: RegExp) => screen.getByRole('button', { name });
// The sheet by its title (a chip inside can carry the same label: "Oven" in Hold food in).
const sheet = (title: string) => within(screen.getAllByLabelText(title).find(e => e.props.role === 'dialog')!);
const noSheet = (title: string) =>
  expect(screen.queryAllByLabelText(title).filter(e => e.props.role === 'dialog')).toEqual([]);
const press = (title: string, role: 'radio' | 'button', name: string) =>
  fireEvent.press(sheet(title).getByRole(role, { name }));
const checked = (title: string, group: string) =>
  within(sheet(title).getByLabelText(group))
    .getAllByRole('radio')
    .filter(r => r.props.accessibilityState?.checked ?? r.props['aria-checked'])
    .map(r => r.props.accessibilityLabel ?? r.props['aria-label']);
const events = (kind: string) => plan.events.filter(e => e.kind === kind).map(e => e.label);

describe('Griddle (mockup 18)', () => {
  test('shows the saved griddle; a griddle still called Griddle has an empty name', async () => {
    await show();
    await fireEvent.press(row(/^Griddle/));
    expect(sheet('Griddle').getByLabelText('Name').props.value).toBe('');
    expect(sheet('Griddle').getByLabelText('Name').props.placeholder).toBe('Griddle');
    expect(checked('Griddle', 'Cooking surface')).toEqual(['36 in']);
    expect(checked('Griddle', 'Burners')).toEqual(['4']);
    expect(checked('Griddle', 'Dome or cover')).toEqual(['No']);
    expect(sheet('Griddle').getByText('Used to finish thick chicken and wings.')).toBeOnTheScreen();
    expect(
      within(sheet('Griddle').getByLabelText('Cooking surface'))
        .getAllByRole('radio')
        .map(r => r.props.accessibilityLabel ?? r.props['aria-label']),
    ).toEqual(['17 in', '22 in', '28 in', '36 in']);
  });

  test('edits are saved only on Save griddle, to the cookers table, and Gear shows them', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Griddle/));
    await fireEvent.changeText(sheet('Griddle').getByLabelText('Name'), '  Blackstone ');
    await press('Griddle', 'radio', '28 in');
    await press('Griddle', 'radio', '2');
    await press('Griddle', 'radio', 'Yes');
    expect(checked('Griddle', 'Cooking surface')).toEqual(['28 in']);
    expect(repos.cookers.load()).toEqual(cookGear); // nothing yet

    await press('Griddle', 'button', 'Save griddle');
    await settle();
    noSheet('Griddle');
    expect(repos.cookers.load()).toEqual({
      ...cookGear,
      griddle: { ...cookGear.griddle!, name: 'Blackstone', sizeIn: 28, burners: 2, hasDome: true },
    });
    expect(within(row(/^Griddle/)).getByText('Blackstone')).toBeOnTheScreen();

    // Clearing the name gives the default back.
    await fireEvent.press(row(/^Griddle/));
    expect(sheet('Griddle').getByLabelText('Name').props.value).toBe('Blackstone');
    await fireEvent.changeText(sheet('Griddle').getByLabelText('Name'), ' ');
    await press('Griddle', 'button', 'Save griddle');
    await settle();
    expect(repos.cookers.load().griddle!.name).toBe('Griddle');
    expect(within(row(/^Griddle/)).getByText(text('28 in, 2 burners'))).toBeOnTheScreen();
  });

  test('closing without Save changes nothing, and the sheet opens on the saved values again', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Griddle/));
    await fireEvent.changeText(sheet('Griddle').getByLabelText('Name'), 'Blackstone');
    await press('Griddle', 'radio', '17 in');
    await press('Griddle', 'button', 'Close');
    await settle();
    noSheet('Griddle');
    expect(repos.cookers.load()).toEqual(cookGear);

    await fireEvent.press(row(/^Griddle/));
    expect(sheet('Griddle').getByLabelText('Name').props.value).toBe('');
    expect(checked('Griddle', 'Cooking surface')).toEqual(['36 in']);
  });

  test('a size that is not one of the four keeps its chip', async () => {
    await show({ gear: { ...cookGear, griddle: { ...cookGear.griddle!, sizeIn: 30 } } });
    await fireEvent.press(row(/^Griddle/));
    expect(checked('Griddle', 'Cooking surface')).toEqual(['30 in']);
  });

  test('Remove griddle takes it out of cookers, and the plan then says a griddle is missing', async () => {
    const { repos } = await show();
    expect(plan.warnings.some(w => /needs a griddle/.test(w.message))).toBe(false);
    await fireEvent.press(row(/^Griddle/));
    await press('Griddle', 'button', 'Remove griddle');
    await settle();
    expect(repos.cookers.load()).toEqual({ smoker: cookGear.smoker, oven: cookGear.oven });
    expect(screen.queryByRole('button', { name: /^Griddle/ })).toBeNull();
    expect(row(/^Add a cooker$/)).toBeOnTheScreen();
    expect(plan.warnings.some(w => /needs a griddle/.test(w.message))).toBe(true);
  });

  test('no Remove when the griddle is the only cooker that can cook', async () => {
    await show({ gear: { griddle: cookGear.griddle, oven: cookGear.oven } });
    await fireEvent.press(row(/^Griddle/));
    expect(sheet('Griddle').getByRole('button', { name: 'Save griddle' })).toBeOnTheScreen();
    expect(sheet('Griddle').queryByRole('button', { name: 'Remove griddle' })).toBeNull();
  });

  test('from Add a cooker: nothing is added on close, the defaults on Save, and a new one has no Remove', async () => {
    const { repos } = await show({ gear: { smoker: cookGear.smoker } });
    await fireEvent.press(row(/^Add a cooker$/));
    await press('Add a cooker', 'button', 'Griddle');
    await settle();
    noSheet('Add a cooker');
    expect(checked('Griddle', 'Cooking surface')).toEqual(['36 in']);
    expect(sheet('Griddle').queryByRole('button', { name: 'Remove griddle' })).toBeNull();
    await press('Griddle', 'button', 'Close');
    await settle();
    expect(repos.cookers.load()).toEqual({ smoker: cookGear.smoker });

    await fireEvent.press(row(/^Add a cooker$/));
    await press('Add a cooker', 'button', 'Griddle');
    await settle();
    await press('Griddle', 'radio', '22 in');
    await press('Griddle', 'button', 'Save griddle');
    await settle();
    expect(repos.cookers.load().griddle).toEqual({ ...cookGear.griddle!, sizeIn: 22 });
    expect(within(row(/^Griddle/)).getByText(text('22 in, 4 burners'))).toBeOnTheScreen();
  });
});

describe('Oven (mockup 19)', () => {
  test('shows the saved oven', async () => {
    await show();
    await fireEvent.press(row(/^Oven/));
    expect(within(sheet('Oven').getByLabelText('Lowest oven setting')).getByText('170')).toBeOnTheScreen();
    expect(
      sheet('Oven').getByText(text('Holding needs at least 140F. Most ovens bottom out at 170F.')),
    ).toBeOnTheScreen();
    expect(checked('Oven', 'Hold food in')).toEqual(['Ask each time']);
    expect(checked('Oven', 'Warming drawer')).toEqual(['No']);
  });

  test('edits are saved only on Save oven, to the cookers table, and the plan uses them', async () => {
    const { repos } = await show();
    expect(events('ovenOn')).toEqual(['Oven to 170F for holding.']);
    await fireEvent.press(row(/^Oven/));
    await press('Oven', 'button', 'More lowest oven setting');
    await press('Oven', 'button', 'More lowest oven setting');
    await press('Oven', 'radio', 'Oven');
    await press('Oven', 'radio', 'Yes');
    expect(within(sheet('Oven').getByLabelText('Lowest oven setting')).getByText('180')).toBeOnTheScreen();
    expect(repos.cookers.load()).toEqual(cookGear);
    expect(events('ovenOn')).toEqual(['Oven to 170F for holding.']);

    await press('Oven', 'button', 'Save oven');
    await settle();
    noSheet('Oven');
    expect(repos.cookers.load()).toEqual({
      ...cookGear,
      oven: { id: 'oven', lowestTempF: 180, holdIn: 'oven', warmingDrawer: true },
    });
    expect(within(row(/^Oven/)).getByText(text('Holding at 180F'))).toBeOnTheScreen();
    expect(events('ovenOn')).toEqual(['Oven to 180F for holding.']);

    // Holding in a cooler: the plan no longer turns the oven on.
    await fireEvent.press(row(/^Oven/));
    await press('Oven', 'radio', 'Towel-lined cooler');
    await press('Oven', 'button', 'Save oven');
    await settle();
    expect(repos.cookers.load().oven!.holdIn).toBe('cooler');
    expect(within(row(/^Oven/)).getByText('Holding in a cooler')).toBeOnTheScreen();
    expect(events('ovenOn')).toEqual([]);
  });

  test('closing without Save changes nothing', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Oven/));
    await press('Oven', 'button', 'Less lowest oven setting');
    await press('Oven', 'radio', 'Towel-lined cooler');
    await fireEvent.press(screen.getByLabelText('Close sheet', { includeHiddenElements: true }));
    await settle();
    noSheet('Oven');
    expect(repos.cookers.load()).toEqual(cookGear);
    expect(within(row(/^Oven/)).getByText(text('Holding at 170F'))).toBeOnTheScreen();
  });

  test('the setting stops at 140F and at 250F', async () => {
    const { repos } = await show({ gear: { ...cookGear, oven: { ...cookGear.oven!, lowestTempF: 145 } } });
    await fireEvent.press(row(/^Oven/));
    const less = () => sheet('Oven').getByRole('button', { name: 'Less lowest oven setting' });
    const more = () => sheet('Oven').getByRole('button', { name: 'More lowest oven setting' });
    expect(less()).toBeEnabled();
    await fireEvent.press(less());
    expect(within(sheet('Oven').getByLabelText('Lowest oven setting')).getByText('140')).toBeOnTheScreen();
    expect(less()).toBeDisabled();
    for (let i = 0; i < 22; i++) await fireEvent.press(more());
    expect(within(sheet('Oven').getByLabelText('Lowest oven setting')).getByText('250')).toBeOnTheScreen();
    expect(more()).toBeDisabled();
    await press('Oven', 'button', 'Save oven');
    await settle();
    expect(repos.cookers.load().oven!.lowestTempF).toBe(250);
  });

  test('Celsius: shown and stepped in C, stored in F', async () => {
    const { repos } = await show({ units: METRIC });
    await fireEvent.press(row(/^Oven/));
    const group = () => within(sheet('Oven').getByLabelText('Lowest oven setting'));
    // 170F is 76.7C: on the 2C steps it reads 76, the same as the Gear row (Jason, 2026-11-15; it read 75).
    expect(group().getByText('76')).toBeOnTheScreen();
    expect(group().getByText(/C$/)).toBeOnTheScreen();
    expect(
      sheet('Oven').getByText(text('Holding needs at least 60C. Most ovens bottom out at 76C.')),
    ).toBeOnTheScreen();

    // Saving without a change keeps the stored 170F.
    await press('Oven', 'button', 'Save oven');
    await settle();
    expect(repos.cookers.load().oven!.lowestTempF).toBe(170);

    await fireEvent.press(row(/^Oven/));
    await press('Oven', 'button', 'More lowest oven setting');
    expect(group().getByText('78')).toBeOnTheScreen();
    await press('Oven', 'button', 'Save oven');
    await settle();
    expect(repos.cookers.load().oven!.lowestTempF).toBe(172); // 78C
    expect(events('ovenOn')).toEqual(['Oven to 172F for holding.']);

    // Down to the 60C (140F) floor.
    await fireEvent.press(row(/^Oven/));
    for (let i = 0; i < 9; i++) await press('Oven', 'button', 'Less lowest oven setting');
    expect(group().getByText('60')).toBeOnTheScreen();
    expect(sheet('Oven').getByRole('button', { name: 'Less lowest oven setting' })).toBeDisabled();
    await press('Oven', 'button', 'Save oven');
    await settle();
    expect(repos.cookers.load().oven!.lowestTempF).toBe(140);
  });

  test('Remove oven takes it out of cookers; none when it is the only cooker or not saved yet', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Oven/));
    await press('Oven', 'button', 'Remove oven');
    await settle();
    expect(repos.cookers.load()).toEqual({ smoker: cookGear.smoker, griddle: cookGear.griddle });
    expect(screen.queryByRole('button', { name: /^Oven/ })).toBeNull();
    expect(events('ovenOn')).toEqual([]);

    // Added again from Add a cooker: a new one has no Remove, and Save adds the defaults.
    await fireEvent.press(row(/^Add a cooker$/));
    await press('Add a cooker', 'button', 'Oven');
    await settle();
    expect(sheet('Oven').queryByRole('button', { name: 'Remove oven' })).toBeNull();
    await press('Oven', 'button', 'Save oven');
    await settle();
    expect(repos.cookers.load().oven).toEqual(cookGear.oven);
  });

  test('no Remove when the oven is the only cooker', async () => {
    await show({ gear: { oven: cookGear.oven } });
    await fireEvent.press(row(/^Oven/));
    expect(sheet('Oven').queryByRole('button', { name: 'Remove oven' })).toBeNull();
  });
});

// T-082 changed these three: the smoker row used to open the picker straight away and a pick was saved at
// once. Now the row opens the Smoker sheet, its Model field opens the picker, and only Save smoker saves.
describe('Smoker: the picker and manual form of Setup, from the Smoker sheet', () => {
  test('Model opens the picker with the saved model marked; a verified model replaces it on Save', async () => {
    // A smoker saved with the Pit Boss 820 (a catalog model, verified or not) keeps its stored profile.
    const { repos } = await show({
      gear: { ...cookGear, smoker: { ...cookGear.smoker!, id: 'pitboss-820', name: 'Pit Boss 820' } },
    });
    await fireEvent.press(row(/^Pit Boss 820/));
    await press('Smoker', 'button', 'Model');
    expect(sheet('Pick your smoker').getByRole('option', { name: 'Pit Boss 820' })).toBeSelected();
    await fireEvent.press(sheet('Pick your smoker').getByRole('option', { name: nameOf(verified) }));
    await settle();
    noSheet('Pick your smoker');
    expect(within(sheet('Smoker').getByRole('button', { name: 'Model' })).getByText(nameOf(verified))).toBeTruthy();
    expect(repos.cookers.load().smoker!.id).toBe('pitboss-820'); // nothing saved before Save smoker
    await press('Smoker', 'button', 'Save smoker');
    await settle();
    noSheet('Smoker');
    const saved = repos.cookers.load();
    expect(saved.smoker).toMatchObject({
      id: verified.id,
      name: nameOf(verified),
      minTempF: verified.minTempF,
      maxTempF: verified.maxTempF,
    });
    expect(saved.griddle).toEqual(cookGear.griddle);
    expect(saved.oven).toEqual(cookGear.oven);
    expect(row(new RegExp(`^${nameOf(verified)}`))).toBeOnTheScreen();
  });

  test('closing the picker keeps the smoker; closing the Smoker sheet after a pick saves nothing', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    await press('Smoker', 'button', 'Model');
    await press('Pick your smoker', 'button', 'Close');
    await settle();
    noSheet('Pick your smoker');
    expect(sheet('Smoker').getByRole('button', { name: 'Model' })).toBeTruthy();
    await press('Smoker', 'button', 'Model');
    await fireEvent.press(sheet('Pick your smoker').getByRole('option', { name: 'Big Green Egg' }));
    const form = sheet('Big Green Egg');
    await fireEvent.changeText(form.getByLabelText('Lowest temp (F)'), '200');
    await fireEvent.changeText(form.getByLabelText('Highest temp (F)'), '700');
    await fireEvent.changeText(form.getByLabelText('Temp step (F)'), '25');
    await press('Big Green Egg', 'button', 'Save smoker');
    await settle();
    expect(within(sheet('Smoker').getByRole('button', { name: 'Model' })).getByText('Big Green Egg')).toBeTruthy();
    await press('Smoker', 'button', 'Close');
    await settle();
    noSheet('Smoker');
    expect(repos.cookers.load()).toEqual(cookGear);
  });

  test('a model without checked specs opens the manual form blank and saves only what is typed', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    await press('Smoker', 'button', 'Model');
    await fireEvent.press(sheet('Pick your smoker').getByRole('option', { name: nameOf(unverified) }));
    const form = nameOf(unverified);
    for (const label of ['Lowest temp (F)', 'Highest temp (F)', 'Temp step (F)', 'Main grate (sq in)'])
      expect(sheet(form).getByLabelText(label).props.value).toBe('');
    expect(sheet(form).getByRole('button', { name: 'Save smoker' })).toBeDisabled();
    expect(repos.cookers.load()).toEqual(cookGear);

    await fireEvent.changeText(sheet(form).getByLabelText('Lowest temp (F)'), '150');
    await fireEvent.changeText(sheet(form).getByLabelText('Highest temp (F)'), '450');
    await fireEvent.changeText(sheet(form).getByLabelText('Temp step (F)'), '5');
    await press(form, 'button', 'Save smoker');
    await settle();
    expect(repos.cookers.load()).toEqual(cookGear);
    await press('Smoker', 'button', 'Save smoker');
    await settle();
    const s = repos.cookers.load().smoker!;
    expect(s).toMatchObject({ id: unverified.id, name: form, minTempF: 150, maxTempF: 450, tempStepF: 5 });
    expect(s.hopperLb).toBeNull();
    expect(s.mainGrateSqIn).toBeNull();
    expect(s.upperRackSqIn).toBeNull();
  });

  test('Add a cooker > Smoker > Not listed: typed in C and kg, stored in F and lb', async () => {
    const { repos } = await show({ gear: { griddle: cookGear.griddle }, units: METRIC });
    await fireEvent.press(row(/^Add a cooker$/));
    await press('Add a cooker', 'button', 'Smoker');
    await settle();
    await press('Pick your smoker', 'button', 'Not listed? Enter it yourself');
    const type = (label: string, v: string) => fireEvent.changeText(sheet('Your smoker').getByLabelText(label), v);
    await type('Name', 'Backyard pellet');
    await type('Lowest temp (C)', '80');
    await type('Highest temp (C)', '260');
    await type('Temp step (C)', '5');
    await type('Hopper (kg)', '9');
    expect(repos.cookers.load()).toEqual({ griddle: cookGear.griddle });
    await press('Your smoker', 'button', 'Save smoker');
    await settle();
    const s = repos.cookers.load().smoker!;
    expect(s).toMatchObject({ name: 'Backyard pellet', type: 'pellet', minTempF: 176, maxTempF: 500, tempStepF: 9 });
    expect(s.hopperLb).toBeCloseTo(19.84, 2);
    expect(repos.cookers.load().griddle).toEqual(cookGear.griddle);
    expect(within(row(/^Backyard pellet/)).getByText(text('Pellet smoker, 9 kg hopper'))).toBeOnTheScreen();
  });
});

// T-082 (Jason, 2026-11-17; proposal picture 16-gear-step): the smoker row opens a small Smoker sheet.
describe('Smoker sheet: the model and the temp step', () => {
  const QUESTION = 'What steps does your smoker set in?';
  const radios = () => within(sheet('Smoker').getByLabelText(QUESTION)).getAllByRole('radio');
  const label = (r: { props: Record<string, unknown> }) =>
    (r.props.accessibilityLabel ?? r.props['aria-label']) as string;
  const selected = () =>
    radios()
      .filter(r => r.props.accessibilityState?.checked ?? r.props['aria-checked'])
      .map(label);
  const choose = (name: string) =>
    fireEvent.press(within(sheet('Smoker').getByLabelText(QUESTION)).getByRole('radio', { name }));
  const withStep = (tempStepF: number | null, more = {}): Cookers => ({
    ...cookGear,
    smoker: { ...cookGear.smoker!, tempStepF, ...more },
  });

  test('the row opens it: Model, the question with the saved step, Save smoker; no hopper, grate or Remove', async () => {
    await show();
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    noSheet('Pick your smoker');
    expect(
      within(sheet('Smoker').getByRole('button', { name: 'Model' })).getByText('Pit Boss Sportsman 850'),
    ).toBeTruthy();
    expect(sheet('Smoker').getByText(QUESTION)).toBeOnTheScreen();
    expect(radios().map(label)).toEqual(['5F', '10F', '15F', '25F', 'Other']);
    expect(selected()).toEqual(['5F']);
    expect(sheet('Smoker').queryByLabelText('Hopper (lb)')).toBeNull();
    expect(sheet('Smoker').queryByLabelText('Main grate (sq in)')).toBeNull();
    expect(sheet('Smoker').queryByRole('button', { name: 'Remove smoker' })).toBeNull();
    expect(sheet('Smoker').getByRole('button', { name: 'Save smoker' })).toBeEnabled();
  });

  test('a new step is saved only on Save smoker; closing first changes nothing', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    await choose('25F');
    expect(selected()).toEqual(['25F']);
    await press('Smoker', 'button', 'Close');
    await settle();
    expect(repos.cookers.load()).toEqual(cookGear);
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    expect(selected()).toEqual(['5F']);
    await choose('25F');
    expect(repos.cookers.load()).toEqual(cookGear);
    await press('Smoker', 'button', 'Save smoker');
    await settle();
    noSheet('Smoker');
    expect(repos.cookers.load()).toEqual({ ...cookGear, smoker: { ...cookGear.smoker!, tempStepF: 25 } });
    expect(repos.cookers.load().griddle).toEqual(cookGear.griddle);
  });

  test('Other opens the two-field sheet over it; what is saved there is kept until Save smoker', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    await choose('Other');
    const other = sheet('Pit Boss Sportsman 850');
    await fireEvent.changeText(other.getByLabelText('Dial settings (F)'), '180, 225, 250');
    await fireEvent.press(other.getByRole('button', { name: 'Save smoker' }));
    await settle();
    noSheet('Pit Boss Sportsman 850');
    expect(selected()).toEqual(['Other']);
    expect(sheet('Smoker').getByText('Has fixed settings: 180, 225, 250F.')).toBeOnTheScreen();
    expect(repos.cookers.load()).toEqual(cookGear);
    await press('Smoker', 'button', 'Save smoker');
    await settle();
    expect(repos.cookers.load().smoker).toMatchObject({ tempStepF: null, tempPresetsF: [180, 225, 250] });
  });

  test('a saved step that is none of the four shows Other and says what is saved', async () => {
    await show({ gear: withStep(20) });
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    expect(selected()).toEqual(['Other']);
    expect(sheet('Smoker').getByText('Sets in 20F steps.')).toBeOnTheScreen();
  });

  test('Celsius: a stored 9F shows 5C', async () => {
    await show({ gear: withStep(9), units: METRIC });
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    expect(radios().map(label)).toEqual(['5C', '10C', '15C', '25C', 'Other']);
    expect(selected()).toEqual(['5C']);
  });

  test('Celsius: the 5F step shows none and stays unless a choice is made', async () => {
    const { repos } = await show({ units: METRIC });
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    expect(selected()).toEqual([]);
    expect(sheet('Smoker').queryByText(/^Sets in|^Has fixed/)).toBeNull();
    await press('Smoker', 'button', 'Save smoker');
    await settle();
    expect(repos.cookers.load()).toEqual(cookGear);
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    await choose('10C');
    await press('Smoker', 'button', 'Save smoker');
    await settle();
    expect(repos.cookers.load().smoker!.tempStepF).toBe(18);
  });

  test('no question for a kamado', async () => {
    await show({ gear: withStep(25, { id: 'bge', name: 'Big Green Egg', type: 'kamado', hopperLb: null }) });
    await fireEvent.press(row(/^Big Green Egg/));
    expect(sheet('Smoker').getByRole('button', { name: 'Model' })).toBeTruthy();
    expect(sheet('Smoker').queryByLabelText(QUESTION)).toBeNull();
  });

  test('the saved step drives the temp menu', async () => {
    const { repos } = await show();
    await fireEvent.press(row(/^Pit Boss Sportsman 850/));
    await choose('25F');
    await press('Smoker', 'button', 'Save smoker');
    await settle();
    const smoker = repos.cookers.load().smoker!;
    await render(
      <TempMenu
        smoker={smoker}
        input={{ ...cookInput, cookers: repos.cookers.load() }}
        plan={null}
        anchor={{ x: 16, y: 150, width: 328, height: 60 }}
        units={{ temp: 'F', weight: 'lb' }}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    const shown = screen.getAllByRole('option').map(o => String(within(o).getByText(/^\d+F$/).props.children));
    expect(shown).toEqual(['200F', '225F', '250F', '275F', '300F']);
  });
});
