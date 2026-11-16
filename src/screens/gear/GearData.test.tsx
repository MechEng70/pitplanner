// Gear's Export my data and Restore from a file (T-036; Jason, 2026-11-16, mockup 16), over a real database
// with the share sheet and the file picker faked.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { buildPlan } from '../../../engine/plan';
import type { Cookers } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { newCook } from '@/lib/cook';
import { buildDataFile, dataFileName, MAX_CHARS, type DataInput } from '@/lib/dataFile';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle } from '@/lib/gear';
import type { CookRecord } from '@/lib/history';
import { rules } from '@/lib/rules';
import { fakeAlarms, fakeFilePicker, fakeFileShare, fakeResume } from '@/platform/fakes';
import type { PickedFile } from '@/platform/types';
import { cookGear } from '@/test/cook';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { GearScreen } from './GearScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
/** Let the picker's answer arrive. */
const flush = () => act(async () => {});

const DAY = 86_400_000;
const NOV_12 = 'Nov 12'; // NOW in the tests' time zone (America/New_York)

const cook = (id: string, date: number, foodId = 'brisket', methodId = 'smoked'): CookRecord => ({
  id,
  date,
  notes: '',
  pitTempF: 225,
  lateMin: 0,
  items: [
    {
      name: 'Brisket',
      plannedMin: 540,
      actualMin: 550,
      log: { foodId, methodId, smokerId: 'pb820', quantity: 12, pitTempF: 225, minutesOnHeat: 550 },
    },
  ],
});

/** The phone's own data before a restore: one cook and one saved rate. */
const PHONE_COOK = cook('phone-1', NOW - 40 * DAY);

const fileGear: Cookers = { smoker: saturday.cookers.smoker!, griddle: defaultGriddle() };
/** The file of Jason's example: 2 cookers, 3 cook rates and 30 cooks. */
const many: DataInput = {
  gear: fileGear,
  units: { temp: 'F', weight: 'lb' },
  rates: { brisket: 0.8, butt: 1.4 },
  totalHours: { turkey: 4.5 },
  rateLocks: {},
  records: Array.from({ length: 30 }, (_, i) => cook(`c${i + 1}`, NOW - (30 - i) * DAY)),
  flags: {},
};
const one: DataInput = {
  ...many,
  gear: { smoker: fileGear.smoker },
  rates: { brisket: 0.8 },
  totalHours: {},
  records: [cook('c1', NOW - DAY)],
};
const fileText = (d: DataInput, over: Record<string, unknown> = {}) =>
  JSON.stringify({ ...JSON.parse(buildDataFile(d, NOW, '0.3.0')), ...over });

async function show({ picked, cooking = false }: { picked?: PickedFile; cooking?: boolean } = {}) {
  const { repos } = testRepos();
  repos.cookers.save(cookGear, NOW);
  repos.rates.setRate('brisket', 0.75, NOW);
  repos.history.save(PHONE_COOK, NOW);
  if (cooking) repos.activeCook.save(newCook(saturday, buildPlan(rules, saturday), NOW), NOW);
  const alarms = fakeAlarms();
  const share = fakeFileShare();
  const picker = fakeFilePicker(picked);
  await render(
    <GearScreen
      version="0.3.0"
      permissions={alarms}
      alarms={alarms}
      onResume={fakeResume().onResume}
      onDebug={jest.fn()}
      shareDataFile={share.share}
      pickDataFile={picker.pick}
      now={() => NOW}
    />,
    { wrapper: storeWrapper(repos, () => NOW, alarms) },
  );
  /** What a restore would change, to show it did not. */
  const data = () => ({
    gear: repos.cookers.load(),
    rates: repos.rates.load(),
    history: repos.history.list(),
    units: repos.settings.units(),
  });
  return { repos, share, picker, data, before: data() };
}

const row = (name: RegExp) => screen.getByRole('button', { name });
const exportRow = () => row(/^Export my data/);
const restoreRow = () => row(/^Restore from a file/);
async function restore() {
  await fireEvent.press(restoreRow());
  await flush();
}
const confirmSheet = () => within(screen.getByLabelText('Replace your data?'));

test('both rows are in Your numbers, after Cook rates and before the App card, each with its line', async () => {
  await show();
  const buttons = screen.getAllByRole('button');
  const at = (re: RegExp) => buttons.indexOf(row(re));
  expect(screen.getByText('Cookers, rates and past cooks in one file')).toBeOnTheScreen();
  expect(screen.getByText('Replaces the data on this phone')).toBeOnTheScreen();
  const order = [/Cook rates/, /^Export my data/, /^Restore from a file/, /^Alerts/].map(at);
  expect(order.every(i => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  // Next to each other: nothing between Cook rates and the two rows.
  expect(order[1]).toBe(order[0]! + 1);
  expect(order[2]).toBe(order[0]! + 2);
});

describe('Export my data', () => {
  test('shares one pitplanner-data file, named by the time, with the phone data in it', async () => {
    const { share, repos } = await show();
    await fireEvent.press(exportRow());
    expect(share.shared).toHaveLength(1);
    const { name, text } = share.shared[0]!;
    expect(name).toBe(dataFileName(NOW));
    expect(name).toMatch(/^pitplanner-data-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(JSON.parse(text)).toEqual({
      format: 'pitplanner-data',
      version: 1,
      exportedAt: NOW,
      appVersion: '0.3.0',
      units: { temp: 'F', weight: 'lb' },
      gear: repos.cookers.load(),
      rates: { brisket: 0.75 },
      totalHours: {},
      rateLocks: {},
      history: [PHONE_COOK],
      flags: {},
    });
    expect(screen.queryByLabelText("Couldn't export")).toBeNull();
  });

  test('a share that fails says so; OK closes it', async () => {
    const { share } = await show();
    share.failNext = new Error('no app');
    await fireEvent.press(exportRow());
    await flush();
    const sheet = within(screen.getByLabelText("Couldn't export"));
    expect(sheet.getByText('Your data was not shared. Try again.')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'OK' }));
    await settle();
    expect(screen.queryByLabelText("Couldn't export")).toBeNull();
  });
});

describe('Restore from a file', () => {
  test('opens the picker with the reader cap; a cancelled picker does nothing and says nothing', async () => {
    const { picker, data, before } = await show({ picked: { canceled: true } });
    await restore();
    expect(picker.calls).toEqual([MAX_CHARS]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Nothing was changed/)).toBeNull();
    expect(data()).toEqual(before);
  });

  test.each<[string, PickedFile, string]>([
    ['another app file', { text: '{"app":"other"}' }, 'This is not a Pit Planner data file. Nothing was changed.'],
    ['not JSON at all', { text: 'PK\u0003\u0004' }, 'This is not a Pit Planner data file. Nothing was changed.'],
    [
      'a newer file',
      { text: fileText(many, { version: 2 }) },
      'This file is from a newer Pit Planner. Update the app to restore it. Nothing was changed.',
    ],
    ['a broken version', { text: fileText(many, { version: 0 }) }, 'This file is damaged. Nothing was changed.'],
    ['a file that could not be read', { error: 'unreadable' }, 'This file is damaged. Nothing was changed.'],
    ['too big, by the picker size', { error: 'tooBig' }, 'This file is too big to restore. Nothing was changed.'],
    [
      'too big, by its text',
      { text: 'x'.repeat(MAX_CHARS + 1) },
      'This file is too big to restore. Nothing was changed.',
    ],
    [
      'nothing in it',
      { text: '{"format":"pitplanner-data","version":1}' },
      'There is nothing to restore in this file. Nothing was changed.',
    ],
  ])('%s: refused with its sentence, the data untouched', async (_, picked, sentence) => {
    const { data, before } = await show({ picked });
    await restore();
    const sheet = within(screen.getByLabelText('Restore from a file'));
    expect(sheet.getByText(sentence)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Replace your data?')).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: 'OK' }));
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(data()).toEqual(before);
  });

  test('refused while a cook runs, before the picker opens', async () => {
    const { picker, data, before } = await show({ picked: { text: fileText(many) }, cooking: true });
    await restore();
    expect(picker.calls).toEqual([]);
    const sheet = within(screen.getByLabelText('Restore from a file'));
    expect(sheet.getByText('End the cook first, then restore. Nothing was changed.')).toBeOnTheScreen();
    expect(data()).toEqual(before);
  });

  test('the confirm sheet says what the file holds and when it was made', async () => {
    await show({ picked: { text: fileText(many) } });
    await restore();
    const sheet = confirmSheet();
    expect(
      sheet.getByText(
        `This file has 2 cookers, 3 cook rates and 30 cooks, from ${NOV_12}. They replace what is on this phone. Your plan stays.`,
      ),
    ).toBeOnTheScreen();
    expect(sheet.queryByText(/could not be read/)).toBeNull();
    expect(sheet.getByRole('button', { name: 'Replace' })).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  test('one of each reads as one; one part left out', async () => {
    const text = fileText(one, { rates: { brisket: 0.8, lamb: 1 } });
    await show({ picked: { text } });
    await restore();
    const sheet = confirmSheet();
    expect(
      sheet.getByText(
        `This file has 1 cooker, 1 cook rate and 1 cook, from ${NOV_12}. They replace what is on this phone. Your plan stays.`,
      ),
    ).toBeOnTheScreen();
    expect(sheet.getByText('1 part of the file could not be read and is left out.')).toBeOnTheScreen();
  });

  test('several parts left out', async () => {
    const text = fileText(many, {
      rates: { brisket: 0.8, butt: 1.4, lamb: 1, goat: 1 },
      gear: { ...fileGear, spaceship: {} },
      units: 'metric',
    });
    await show({ picked: { text } });
    await restore();
    expect(confirmSheet().getByText('4 parts of the file could not be read and are left out.')).toBeOnTheScreen();
  });

  test('Replace restores the file and says what was restored; the plan stays', async () => {
    const { repos } = await show({ picked: { text: fileText(many) } });
    const draft = repos.settings.readDraft();
    await restore();
    await fireEvent.press(confirmSheet().getByRole('button', { name: 'Replace' }));
    await settle();
    expect(screen.queryByLabelText('Replace your data?')).toBeNull();
    const sheet = within(screen.getByLabelText('Restore from a file'));
    expect(sheet.getByText('Restored 2 cookers, 3 cook rates and 30 cooks.')).toBeOnTheScreen();
    expect(repos.cookers.load()).toEqual(fileGear);
    expect(repos.rates.load().rates).toEqual({ brisket: 0.8, butt: 1.4 });
    expect(repos.history.list().map(r => r.id)).toEqual(many.records.map(r => r.id));
    expect(repos.settings.readDraft()).toEqual(draft);
    // The screen follows at once: the oven row is gone.
    await fireEvent.press(sheet.getByRole('button', { name: 'OK' }));
    await settle();
    expect(screen.queryByRole('button', { name: /^Oven/ })).toBeNull();
  });

  test('Cancel changes nothing', async () => {
    const { data, before } = await show({ picked: { text: fileText(many) } });
    await restore();
    await fireEvent.press(confirmSheet().getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(data()).toEqual(before);
  });

  test('a cooked food the app does not know survives a round trip', async () => {
    const lamb = cook('lamb-1', NOW - 2 * DAY, 'lamb', 'spit');
    const { repos, share } = await show({ picked: { text: fileText({ ...one, records: [lamb] }) } });
    await restore();
    expect(confirmSheet().queryByText(/could not be read/)).toBeNull();
    await fireEvent.press(confirmSheet().getByRole('button', { name: 'Replace' }));
    await settle();
    expect(repos.history.list()).toEqual([lamb]);
    await fireEvent.press(within(screen.getByLabelText('Restore from a file')).getByRole('button', { name: 'OK' }));
    await settle();
    // And out again.
    await fireEvent.press(exportRow());
    expect(JSON.parse(share.shared[0]!.text).history).toEqual([lamb]);
  });
});
