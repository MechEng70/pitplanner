import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { Cookers } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { takeDebugPass } from '@/lib/debugPass';
import { useUpdateCheck } from '@/lib/updateWiring';
import { fakeAlarms, fakeHttp, fakeResume, type FakeHttp } from '@/platform/fakes';
import type { AppLinks } from '@/platform/types';
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

const DAY = 24 * 3_600_000;
/** The time the update check reads; a test moves it forward. */
const clock = { now: NOW };
const checkClock = () => clock.now;
beforeEach(() => {
  clock.now = NOW;
});

/** The update check as the root layout runs it (T-032), over a scripted GitHub. */
function UpdateCheck(p: { http: FakeHttp; onResume: AppLinks['onResume']; version: string }) {
  useUpdateCheck(p.http.get, p.onResume, p.version, checkClock);
  return null;
}

/**
 * The Gear tab over a real database. `handlers` false: as the route shows it today, without T-027 and T-028.
 * `http`: the update check runs too, at launch and on `resume.resume()`.
 */
async function show({
  gear = cookGear,
  handlers = true,
  seed,
  http,
  version = '0.3.0',
}: {
  gear?: Cookers;
  handlers?: boolean;
  seed?: (r: ReturnType<typeof testRepos>['repos']) => void;
  http?: FakeHttp;
  /** The installed version, for the screen and the update check. */
  version?: string;
} = {}) {
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
    <>
      {http ? <UpdateCheck http={http} onResume={resume.onResume} version={version} /> : null}
      <GearScreen
        version={version}
        permissions={alarms}
        alarms={alarms}
        onResume={resume.onResume}
        onDebug={onDebug}
        {...(handlers ? { onCooker, onHistory } : {})}
      />
    </>,
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
      seed: r =>
        r.settings.setUpdate(
          {
            checkedAt: NOW,
            latest: 'v0.4.0',
            url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.4.0/pitplanner.apk',
          },
          NOW,
        ),
    });
    const link = screen.getByRole('link', { name: /Update available/ });
    expect(
      within(link).getByText('Version 0.4.0. Download it in your browser, then open it to install.'),
    ).toBeOnTheScreen();
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith(
      'https://github.com/MechEng70/pitplanner/releases/download/v0.4.0/pitplanner.apk',
    );
  });

  test('the release this build is does not show the row', async () => {
    await show({ seed: r => r.settings.setUpdate({ checkedAt: NOW, latest: 'v0.3.0', url: null }, NOW) });
    expect(screen.queryByText('Update available')).toBeNull();
  });
});

describe('the update check (T-032)', () => {
  const release = (tag: string) => ({
    tag_name: tag,
    html_url: `https://github.com/MechEng70/pitplanner/releases/tag/${tag}`,
    prerelease: tag.includes('-'),
    draft: false,
    assets: [
      {
        name: `pitplanner-${tag.slice(1)}.apk`,
        browser_download_url: `https://github.com/MechEng70/pitplanner/releases/download/${tag}/pitplanner-${tag.slice(1)}.apk`,
      },
    ],
  });
  const resumed = (resume: { resume(): void }) => act(async () => resume.resume());

  const LIST = [release('v0.3.1'), release('v0.4.0-beta.1'), release('v0.3.0'), release('v0.3.0-rc.1')];

  test('a newer release shows the row with its download, and is saved', async () => {
    const { open, repos } = await show({ http: fakeHttp({ ok: true, json: LIST }) });
    const link = await screen.findByRole('link', { name: /Update available/ });
    // A final install is offered the newer final, not the newer beta.
    expect(
      within(link).getByText('Version 0.3.1. Download it in your browser, then open it to install.'),
    ).toBeOnTheScreen();
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith(
      'https://github.com/MechEng70/pitplanner/releases/download/v0.3.1/pitplanner-0.3.1.apk',
    );
    expect(repos.settings.update()).toEqual({
      checkedAt: NOW,
      latest: 'v0.3.1',
      url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.3.1/pitplanner-0.3.1.apk',
    });
  });

  test('a final install is not told about a prerelease', async () => {
    const http = fakeHttp({ ok: true, json: [release('v0.4.0-beta.1'), release('v0.3.1-rc.1'), release('v0.3.0')] });
    const { repos } = await show({ http });
    expect(http.requests).toHaveLength(1);
    expect(repos.settings.update()).toMatchObject({ checkedAt: NOW, latest: 'v0.3.0' });
    expect(screen.queryByText('Update available')).toBeNull();
  });

  test('a final install does not show a prerelease an earlier check saved', async () => {
    await show({ seed: r => r.settings.setUpdate({ checkedAt: NOW, latest: 'v0.4.0-beta.1', url: null }, NOW) });
    expect(screen.queryByText('Update available')).toBeNull();
  });

  test('a prerelease install is told about a newer prerelease', async () => {
    const { open } = await show({ http: fakeHttp({ ok: true, json: LIST }), version: '0.3.0-beta.1' });
    const link = await screen.findByRole('link', { name: /Update available/ });
    expect(
      within(link).getByText('Version 0.4.0-beta.1. Download it in your browser, then open it to install.'),
    ).toBeOnTheScreen();
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith(
      'https://github.com/MechEng70/pitplanner/releases/download/v0.4.0-beta.1/pitplanner-0.4.0-beta.1.apk',
    );
  });

  test('a prerelease install is told about its final release', async () => {
    const http = fakeHttp({ ok: true, json: [release('v0.3.0'), release('v0.3.0-rc.1'), release('v0.3.0-beta.2')] });
    await show({ http, version: '0.3.0-beta.1' });
    const link = await screen.findByRole('link', { name: /Update available/ });
    expect(
      within(link).getByText('Version 0.3.0. Download it in your browser, then open it to install.'),
    ).toBeOnTheScreen();
  });

  test('the same release shows no row', async () => {
    const http = fakeHttp({ ok: true, json: [release('v0.3.0'), release('v0.3.0-rc.1'), release('v0.2.0')] });
    const { repos } = await show({ http });
    expect(http.requests).toHaveLength(1);
    expect(repos.settings.update()).toMatchObject({ checkedAt: NOW, latest: 'v0.3.0' });
    expect(screen.queryByText('Update available')).toBeNull();
  });

  test('a network error shows no row, saves nothing and shows nothing else', async () => {
    const http = fakeHttp(new TypeError('Network request failed'));
    const { repos } = await show({ http });
    expect(http.requests).toHaveLength(1);
    expect(repos.settings.update()).toBeNull();
    expect(screen.queryByText('Update available')).toBeNull();
    expect(screen.getByRole('heading', { name: 'App' })).toBeOnTheScreen();
  });

  test('a network error keeps the update found before, and the time it was found', async () => {
    const http = fakeHttp(new TypeError('Network request failed'));
    const found = {
      checkedAt: NOW - DAY,
      latest: 'v0.4.0',
      url: 'https://github.com/MechEng70/pitplanner/releases/download/v0.4.0/pitplanner.apk',
    };
    const { open, repos } = await show({ http, seed: r => r.settings.setUpdate(found, NOW) });
    expect(http.requests).toHaveLength(1);
    expect(repos.settings.update()).toEqual(found);
    await fireEvent.press(screen.getByRole('link', { name: /Update available/ }));
    expect(open).toHaveBeenCalledWith(
      'https://github.com/MechEng70/pitplanner/releases/download/v0.4.0/pitplanner.apk',
    );
  });

  test('one anonymous request at launch, then none on resume until a day has passed', async () => {
    const http = fakeHttp({ ok: true, json: [release('v0.3.0')] });
    const { resume } = await show({ http });
    expect(http.requests).toEqual([
      {
        url: 'https://api.github.com/repos/MechEng70/pitplanner/releases?per_page=30',
        headers: { Accept: 'application/vnd.github+json' },
      },
    ]);
    await resumed(resume);
    clock.now = NOW + DAY - 1;
    await resumed(resume);
    expect(http.requests).toHaveLength(1);
    expect(screen.queryByText('Update available')).toBeNull();

    // The next day a release is out: the resume finds it.
    http.answer = { ok: true, json: [release('v0.3.1'), release('v0.3.0')] };
    clock.now = NOW + DAY;
    await resumed(resume);
    expect(http.requests).toHaveLength(2);
    expect(await screen.findByRole('link', { name: /Update available/ })).toBeOnTheScreen();
    await resumed(resume);
    expect(http.requests).toHaveLength(2);
  });

  test('a check made less than a day ago, by an earlier run of the app, is not repeated at launch', async () => {
    const http = fakeHttp({ ok: true, json: [release('v0.4.0')] });
    const { resume } = await show({
      http,
      seed: r => r.settings.setUpdate({ checkedAt: NOW - DAY + 60_000, latest: 'v0.3.0', url: null }, NOW),
    });
    await resumed(resume);
    expect(http.requests).toHaveLength(0);
    expect(screen.queryByText('Update available')).toBeNull();
  });

  test('a failed check is tried again at each resume, once; the first answer starts the day', async () => {
    const http = fakeHttp(new TypeError('Network request failed'));
    const { resume, repos } = await show({ http });
    // One attempt per launch or resume: nothing retries on its own while the app stays open.
    await act(() => jest.advanceTimersByTime(3_600_000));
    expect(http.requests).toHaveLength(1);
    await resumed(resume);
    expect(http.requests).toHaveLength(2);
    http.answer = { ok: false, json: null }; // rate limited
    await resumed(resume);
    expect(http.requests).toHaveLength(3);
    expect(repos.settings.update()).toBeNull();

    http.answer = { ok: true, json: [release('v0.3.1')] };
    clock.now = NOW + 60_000;
    await resumed(resume);
    expect(http.requests).toHaveLength(4);
    expect(repos.settings.update()).toMatchObject({ checkedAt: NOW + 60_000, latest: 'v0.3.1' });
    expect(await screen.findByRole('link', { name: /Update available/ })).toBeOnTheScreen();
    clock.now = NOW + 60_000 + DAY - 1;
    await resumed(resume);
    expect(http.requests).toHaveLength(4);
  });

  test('two resumes while a check is still out make one request', async () => {
    let answer: (v: { ok: boolean; json: unknown }) => void = () => {};
    const http = fakeHttp();
    const slow = { ...http, get: jest.fn(() => new Promise<{ ok: boolean; json: unknown }>(r => (answer = r))) };
    const { resume } = await show({ http: slow });
    await resumed(resume);
    await resumed(resume);
    expect(slow.get).toHaveBeenCalledTimes(1);
    await act(async () => answer({ ok: true, json: [release('v0.4.0')] }));
    expect(await screen.findByRole('link', { name: /Update available/ })).toBeOnTheScreen();
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
