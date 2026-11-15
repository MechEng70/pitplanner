import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { Cookers } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { takeDebugPass } from '@/lib/debugPass';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { cookGear } from '@/test/cook';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { GearScreen, SUPPORT_URL } from './GearScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  takeDebugPass(false); // a pass a test left behind
});
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

/** The Gear tab over a real database. `handlers` false: as the route shows it today, without T-027 and T-028. */
async function show({
  gear = cookGear,
  handlers = true,
  seed,
}: { gear?: Cookers; handlers?: boolean; seed?: (r: ReturnType<typeof testRepos>['repos']) => void } = {}) {
  const { repos } = testRepos();
  repos.cookers.save(gear, NOW);
  repos.rates.setRate('brisket', 0.75, NOW);
  seed?.(repos);
  const alarms = fakeAlarms();
  const resume = fakeResume();
  const onDebug = jest.fn();
  const onCooker = jest.fn();
  const onHistory = jest.fn();
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(
    <GearScreen
      version="0.3.0"
      permissions={alarms}
      alarms={alarms}
      onResume={resume.onResume}
      onDebug={onDebug}
      {...(handlers ? { onCooker, onHistory } : {})}
    />,
    { wrapper: storeWrapper(repos, () => NOW, alarms) },
  );
  return { repos, alarms, resume, onDebug, onCooker, onHistory, open };
}

/** Exact text, with the no-break spaces a Num puts inside a value. */
const text = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s')}$`);
// The letters in a row's avatar ("hr", "new") are hidden from TalkBack, but the test renderer still counts
// them in the row's name, so those rows are matched without `^`.
const row = (name: RegExp) => screen.getByRole('button', { name });

describe('rows (mockup 16)', () => {
  test('cookers, Your numbers and App, each with its line; the version last', async () => {
    await show();
    expect(screen.getByRole('heading', { name: 'Gear' })).toBeOnTheScreen();
    for (const h of ['Cookers', 'Your numbers', 'App'])
      expect(screen.getByRole('heading', { name: h })).toBeOnTheScreen();

    expect(within(row(/^Pit Boss 820/)).getByText(text('Pellet smoker, 21 lb hopper'))).toBeOnTheScreen();
    expect(within(row(/^Griddle/)).getByText(text('36 in, 4 burners'))).toBeOnTheScreen();
    expect(within(row(/^Oven/)).getByText(text('Holding at 170F'))).toBeOnTheScreen();
    expect(within(row(/Cook rates/)).getByText(text('Brisket 0.75 hr/lb, your setting'))).toBeOnTheScreen();
    expect(await within(row(/^Alerts/)).findByText('All set: exact alarms on, battery saver off')).toBeOnTheScreen();
    expect(within(row(/^Units/)).getByText('Fahrenheit, pounds')).toBeOnTheScreen();
    expect(screen.getByText('If the app saved your brisket')).toBeOnTheScreen();
    expect(row(/^Pit Planner 0\.3\.0$/)).toBeOnTheScreen();
    // All three cookers are there, so there is nothing to add; no update was found.
    expect(screen.queryByText('Add a cooker')).toBeNull();
    expect(screen.queryByText('Update available')).toBeNull();
  });

  test('a cooker row opens its sheet and Cook rates opens history (handlers of T-027 and T-028)', async () => {
    const { onCooker, onHistory } = await show();
    await fireEvent.press(row(/^Pit Boss 820/));
    await fireEvent.press(row(/^Griddle/));
    await fireEvent.press(row(/^Oven/));
    expect(onCooker.mock.calls).toEqual([['smoker'], ['griddle'], ['oven']]);
    await fireEvent.press(row(/Cook rates/));
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  test('as the route shows it today, those rows do nothing and nothing is saved', async () => {
    const { repos } = await show({ handlers: false });
    for (const name of [/^Pit Boss 820/, /^Griddle/, /^Oven/, /Cook rates/]) await fireEvent.press(row(name));
    expect(repos.cookers.load()).toEqual(cookGear);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('a renamed griddle shows its name; an oven that holds in a cooler says so', async () => {
    await show({
      gear: {
        ...cookGear,
        griddle: { ...cookGear.griddle!, name: 'Blackstone' },
        oven: { ...cookGear.oven!, holdIn: 'cooler' },
      },
    });
    expect(within(row(/^Griddle/)).getByText('Blackstone')).toBeOnTheScreen();
    expect(within(row(/^Oven/)).getByText('Holding in a cooler')).toBeOnTheScreen();
  });

  test('Home Assistant says Coming later and is not a button', async () => {
    await show();
    expect(screen.getByText('Home Assistant')).toBeOnTheScreen();
    expect(screen.getByText('Coming later')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Home Assistant/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Home Assistant/ })).toBeNull();
  });

  test('Buy me a bag of pellets opens the support page in the browser', async () => {
    const { open } = await show();
    await fireEvent.press(screen.getByRole('link', { name: /^Buy me a bag of pellets/ }));
    expect(open).toHaveBeenCalledWith(SUPPORT_URL);
    expect(SUPPORT_URL).toBe('https://buymeacoffee.com/PitPlanner');
  });
});

describe('Add a cooker (mockup 17)', () => {
  test('offers only the cookers that are missing and hands the choice over', async () => {
    const { onCooker, repos } = await show({ gear: { smoker: cookGear.smoker } });
    expect(screen.queryByRole('button', { name: /^Griddle/ })).toBeNull();
    await fireEvent.press(row(/^Add a cooker$/));
    const sheet = screen.getByLabelText('Add a cooker');
    expect(within(sheet).queryByRole('button', { name: 'Smoker' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Oven' })).toBeOnTheScreen();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Griddle' }));
    await settle();
    expect(onCooker.mock.calls).toEqual([['griddle']]);
    expect(screen.queryByLabelText('Add a cooker')).toBeNull();
    // Nothing is added here: the cooker's sheet saves it (T-027).
    expect(repos.cookers.load()).toEqual({ smoker: cookGear.smoker });
  });
});

describe('Units sheet', () => {
  test('switching units changes what is shown and not what is stored', async () => {
    const { repos } = await show();
    const stored = { gear: repos.cookers.load(), rates: repos.rates.load() };

    await fireEvent.press(row(/^Units/));
    const sheet = screen.getByLabelText('Units');
    expect(within(sheet).getByRole('radio', { name: 'Fahrenheit' })).toBeChecked();
    expect(within(sheet).getByRole('radio', { name: 'Pounds' })).toBeChecked();

    await fireEvent.press(within(sheet).getByRole('radio', { name: 'Celsius' }));
    expect(within(screen.getByLabelText('Units')).getByRole('radio', { name: 'Celsius' })).toBeChecked();
    expect(screen.getByText(text('Holding at 76C'))).toBeOnTheScreen();
    expect(screen.getByText(text('Pellet smoker, 21 lb hopper'))).toBeOnTheScreen();
    expect(screen.getByText('Celsius, pounds')).toBeOnTheScreen();

    await fireEvent.press(within(screen.getByLabelText('Units')).getByRole('radio', { name: 'Kilograms' }));
    expect(screen.getByText(text('Pellet smoker, 9.5 kg hopper'))).toBeOnTheScreen();
    expect(screen.getByText(text('Brisket 1.65 hr/kg, your setting'))).toBeOnTheScreen();
    expect(screen.getByText('Celsius, kilograms')).toBeOnTheScreen();
    expect(screen.queryByText(text('Holding at 170F'))).toBeNull();

    expect(repos.settings.units()).toEqual({ temp: 'C', weight: 'kg' });
    expect(repos.cookers.load()).toEqual(stored.gear);
    expect(repos.cookers.load().oven!.lowestTempF).toBe(170);
    expect(repos.cookers.load().smoker!.hopperLb).toBe(21);
    expect(repos.rates.load()).toEqual(stored.rates);

    await fireEvent.press(within(screen.getByLabelText('Units')).getByRole('button', { name: 'Close' }));
    await settle();
    expect(screen.queryByLabelText('Units')).toBeNull();

    // And back: the same stored numbers read as they did.
    await fireEvent.press(row(/^Units/));
    await fireEvent.press(within(screen.getByLabelText('Units')).getByRole('radio', { name: 'Fahrenheit' }));
    await fireEvent.press(within(screen.getByLabelText('Units')).getByRole('radio', { name: 'Pounds' }));
    expect(screen.getByText(text('Holding at 170F'))).toBeOnTheScreen();
    expect(screen.getByText(text('Pellet smoker, 21 lb hopper'))).toBeOnTheScreen();
    expect(screen.getByText(text('Brisket 0.75 hr/lb, your setting'))).toBeOnTheScreen();
    expect(repos.settings.units()).toEqual({ temp: 'F', weight: 'lb' });
  });
});

describe('Alerts', () => {
  test('a permission that is off shows on the row and in the sheet, and clears when the user comes back', async () => {
    const r = testRepos();
    r.repos.cookers.save(cookGear, NOW);
    const alarms = fakeAlarms();
    alarms.granted = { ...alarms.granted, exactAlarms: false, batteryUnrestricted: false };
    const resume = fakeResume();
    await render(
      <GearScreen
        version="0.3.0"
        permissions={alarms}
        alarms={alarms}
        onResume={resume.onResume}
        onDebug={jest.fn()}
      />,
      {
        wrapper: storeWrapper(r.repos, () => NOW, alarms),
      },
    );
    expect(await screen.findByText('Needs a fix: exact alarms, battery limits')).toBeOnTheScreen();

    await fireEvent.press(row(/^Alerts/));
    const sheet = screen.getByLabelText('Alerts');
    expect(within(sheet).getByText('Notifications')).toBeOnTheScreen();
    expect(within(sheet).getByText('On')).toBeOnTheScreen();
    expect(within(sheet).getByRole('button', { name: 'Allow no battery limits' })).toBeOnTheScreen();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Allow alarms and reminders' }));
    expect(alarms.calls).toEqual(['openSettings exactAlarm']);

    // Allowed in Settings; the app comes back to the front.
    alarms.granted = { ...alarms.granted, exactAlarms: true, batteryUnrestricted: true };
    await act(async () => resume.resume());
    expect(within(screen.getByLabelText('Alerts')).getAllByText('On')).toHaveLength(3);
    expect(screen.getByText('All set: exact alarms on, battery saver off')).toBeOnTheScreen();

    await fireEvent.press(within(screen.getByLabelText('Alerts')).getByRole('button', { name: 'Close' }));
    await settle();
    expect(screen.queryByLabelText('Alerts')).toBeNull();
  });
});

describe('Update available (the check is T-032)', () => {
  test('a newer release found by the last check is a link to its download', async () => {
    const { open } = await show({
      seed: r => r.settings.setUpdate({ checkedAt: NOW, latest: 'v0.4.0', url: 'https://example.org/pit.apk' }, NOW),
    });
    const link = screen.getByRole('link', { name: /Update available/ });
    expect(
      within(link).getByText('Version 0.4.0. Download it in your browser, then open it to install.'),
    ).toBeOnTheScreen();
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith('https://example.org/pit.apk');
  });

  test('the release this build is does not show the row', async () => {
    await show({ seed: r => r.settings.setUpdate({ checkedAt: NOW, latest: 'v0.3.0', url: null }, NOW) });
    expect(screen.queryByText('Update available')).toBeNull();
  });
});

describe('version', () => {
  test('the fifth tap grants the debug pass and opens the test screen; four do nothing', async () => {
    const { onDebug } = await show();
    const version = row(/^Pit Planner 0\.3\.0$/);
    for (let i = 0; i < 4; i++) await fireEvent.press(version);
    expect(onDebug).not.toHaveBeenCalled();
    expect(takeDebugPass(false)).toBe(false);

    await fireEvent.press(version);
    expect(onDebug).toHaveBeenCalledTimes(1);
    // A release build lets the screen open only with this pass, once.
    expect(takeDebugPass(false)).toBe(true);
    expect(takeDebugPass(false)).toBe(false);

    // The count starts over.
    for (let i = 0; i < 4; i++) await fireEvent.press(version);
    expect(onDebug).toHaveBeenCalledTimes(1);
    await fireEvent.press(version);
    expect(onDebug).toHaveBeenCalledTimes(2);
  });
});

// Jason, 2026-11-15: the Alerts sheet can send a test alert, and says where to look when alerts are late.
test('the Alerts sheet sends a test alert through the alarm service and says when it rings', async () => {
  const r = testRepos();
  r.repos.cookers.save(cookGear, NOW);
  const alarms = fakeAlarms();
  await render(
    <GearScreen
      version="0.3.0"
      permissions={alarms}
      alarms={alarms}
      onResume={fakeResume().onResume}
      onDebug={jest.fn()}
    />,
    { wrapper: storeWrapper(r.repos, () => NOW, alarms) },
  );
  await fireEvent.press(screen.getByRole('button', { name: /^Alerts/ }));
  const sheet = within(screen.getByLabelText('Alerts'));
  expect(
    sheet.getByText("Alerts late or missing? Check the battery settings for Pit Planner in your phone's settings."),
  ).toBeOnTheScreen();
  expect(sheet.queryByText(/Test alert set for/)).toBeNull();
  await fireEvent.press(sheet.getByRole('button', { name: 'Send a test alert in 10 sec' }));
  await act(async () => {});
  expect(alarms.calls).toContain('testAlarm 10');
  expect(sheet.getByText(/Test alert set for .*\. Lock the phone to check it rings\./)).toBeOnTheScreen();
});
