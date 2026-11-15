// Open shared plan (mockup 11, T-030): the sheet alone, then the Plan tab given an opened file.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import type { Cookers, ItemInput } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Draft } from '@/lib/draft';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle } from '@/lib/gear';
import { rules } from '@/lib/rules';
import { parsePitPlan, type ImportedPlan, type SharedPlan } from '@/lib/sharedPlan';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import type { OpenedPlanFile } from '@/platform/types';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { PlanTab } from './PlanTab';
import { SharedPlanSheet } from './SharedPlanSheet';

const SERVE = saturday.at; // Sat Nov 14, 2026, 5:00 PM Eastern; NOW is two days before
const smoker = saturday.cookers.smoker!;
const withGriddle: Cookers = { smoker, griddle: defaultGriddle() };
const noGriddle: Cookers = { smoker };

/** The mockup's menu, as the sender's phone writes it. */
const MENU = [
  { id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 },
  { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2 },
  { id: 'c', foodId: 'breasts', methodId: 'griddle', quantity: 4, options: { thickness: 'pounded' } },
];
const fileText = (over: object = {}) =>
  JSON.stringify({
    app: 'pit-planner',
    version: 1,
    serveAt: new Date(SERVE).toISOString(),
    pitTempF: 225,
    items: MENU,
    ...over,
  });
const sharedOf = (text = fileText()): SharedPlan => {
  const p = parsePitPlan(rules, text, i => `n${i}`);
  if ('error' in p) throw new Error(p.error);
  return p;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest
    .spyOn(View.prototype as unknown as { measureInWindow: (cb: (...r: number[]) => void) => void }, 'measureInWindow')
    .mockImplementation(cb => cb(16, 150, 328, 60));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const chip = (name: string | RegExp) => screen.getByRole('radio', { name });

function repos(gear: Cookers, items: ItemInput[] = []) {
  const r = testRepos();
  r.repos.cookers.save(gear, NOW);
  const draft: Draft = { mode: 'readyBy', at: SERVE, pitTempF: 250, items };
  r.repos.settings.setDraft(draft, NOW);
  return r.repos;
}

describe('Shared plan sheet', () => {
  async function show(
    gear: Cookers,
    opts: { shared?: SharedPlan; now?: number; picked?: number | null; items?: ItemInput[] } = {},
  ) {
    const onUse = jest.fn<void, [ImportedPlan, number]>();
    const onClose = jest.fn();
    const pickDateTime = jest.fn(async () => opts.picked ?? null);
    await render(
      <SharedPlanSheet
        shared={opts.shared ?? sharedOf()}
        pickDateTime={pickDateTime}
        now={() => opts.now ?? NOW}
        onClose={onClose}
        onUse={onUse}
      />,
      { wrapper: storeWrapper(repos(gear, opts.items)) },
    );
    return { onUse, onClose, pickDateTime };
  }

  test("shows the sender's menu and serve time as they set them", async () => {
    await show(withGriddle);
    expect(screen.getByRole('heading', { name: 'Open shared plan' })).toBeOnTheScreen();
    expect(
      screen.getByText(/Someone shared a Saturday plan\. Times will be worked out for your gear/),
    ).toBeOnTheScreen();
    expect(screen.getByText(/^Serve at/)).toHaveTextContent('Serve at 5:00 PM');
    expect(screen.getByText(/^Brisket/)).toHaveTextContent('Brisket, 12 lb, butcher paper');
    expect(screen.getByText(/^Chicken wings/)).toHaveTextContent('Chicken wings, 2 lb, smoke then 400F crisp');
    expect(screen.getByText(/^Chicken breasts/)).toHaveTextContent('Chicken breasts, 4, griddle');
  });

  test('with every cooker the plan needs, nothing is flagged', async () => {
    await show(withGriddle);
    expect(screen.queryByText(/set up\./)).toBeNull();
    expect(screen.queryByText('Replaces the plan you have now.')).toBeNull();
  });

  test('a missing griddle is flagged, with where the food goes instead (failure mode 13)', async () => {
    await show(noGriddle);
    expect(screen.getByText('No griddle set up.')).toBeOnTheScreen();
    expect(screen.getByText('Chicken breasts will move to the smoker, or add a griddle in Gear.')).toBeOnTheScreen();
  });

  test('a food with no cooker to move to says what it needs', async () => {
    await show({ griddle: defaultGriddle() }, { shared: sharedOf(fileText({ items: [MENU[0]] })) });
    expect(screen.getByText('No smoker set up.')).toBeOnTheScreen();
    expect(screen.getByText('Brisket needs a smoker. Add one in Gear.')).toBeOnTheScreen();
    expect(screen.queryByText('Cook the smoker items on')).toBeNull();
  });

  test("the smoker items go on the receiver's smoker", async () => {
    await show(noGriddle);
    expect(screen.getByText('Cook the smoker items on')).toBeOnTheScreen();
    expect(screen.getByText(smoker.name)).toBeOnTheScreen();
  });

  test('a temp the smoker cannot be set to snaps to the closest, and the sheet says so (failure mode 12)', async () => {
    const { onUse } = await show(noGriddle, { shared: sharedOf(fileText({ pitTempF: 227 })) });
    expect(screen.getByText(/^Smoker set to/)).toHaveTextContent(
      'Smoker set to 225F, the closest your smoker allows to 227F.',
    );
    await fireEvent.press(button('Use this plan'));
    await settle();
    expect(onUse.mock.calls[0]![0].pitTempF).toBe(225);
  });

  test('foods this app does not know are counted, not shown', async () => {
    const items = [...MENU, { foodId: 'unicorn', methodId: 'x', quantity: 1 }];
    await show(withGriddle, { shared: sharedOf(fileText({ items })) });
    expect(screen.getByText(/more food this app does not know\./)).toHaveTextContent(
      '1 more food this app does not know.',
    );
  });

  test('says when it will replace a plan that has food on it', async () => {
    await show(withGriddle, { items: saturday.items });
    expect(screen.getByText('Replaces the plan you have now.')).toBeOnTheScreen();
  });

  describe('Serve on', () => {
    test("offers the sender's day when it is still ahead, already chosen", async () => {
      await show(withGriddle);
      expect(chip('Sat, Nov 14')).toBeChecked();
      expect(chip('Pick a date')).not.toBeChecked();
    });

    test('a plan from the past is offered for the next same weekday', async () => {
      const { onUse } = await show(withGriddle, { now: SERVE + 3 * 86_400_000 });
      expect(chip('Sat, Nov 21')).toBeChecked();
      await fireEvent.press(button('Use this plan'));
      await settle();
      expect(onUse.mock.calls[0]![1]).toBe(SERVE + 7 * 86_400_000);
    });

    test('Pick a date opens the date and time pickers from the offered time and takes the answer', async () => {
      const friday = SERVE + 6 * 86_400_000 + 3_600_000; // Fri Nov 20, 6:00 PM
      const { pickDateTime, onUse } = await show(withGriddle, { picked: friday });
      await fireEvent.press(chip('Pick a date'));
      expect(pickDateTime).toHaveBeenCalledWith(SERVE);
      expect(chip(/^Fri, Nov 20, 6:00/)).toBeChecked();
      expect(chip('Sat, Nov 14')).not.toBeChecked();
      await fireEvent.press(button('Use this plan'));
      await settle();
      expect(onUse.mock.calls[0]![1]).toBe(friday);
    });

    test('a dismissed picker changes nothing; the offered day brings the offer back', async () => {
      const { onUse } = await show(withGriddle, { picked: null });
      await fireEvent.press(chip('Pick a date'));
      expect(chip('Sat, Nov 14')).toBeChecked();
      await fireEvent.press(chip('Sat, Nov 14'));
      await fireEvent.press(button('Use this plan'));
      await settle();
      expect(onUse.mock.calls[0]![1]).toBe(SERVE);
    });
  });

  test('Use this plan closes the sheet, then hands over the menu on the receiver cookers', async () => {
    const { onUse, onClose } = await show(noGriddle);
    await fireEvent.press(button('Use this plan'));
    expect(onUse).not.toHaveBeenCalled();
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onUse).toHaveBeenCalledTimes(1);
    const [plan, serveAt] = onUse.mock.calls[0]!;
    expect(serveAt).toBe(SERVE);
    expect(plan.items.map(i => [i.foodId, i.methodId])).toEqual([
      ['brisket', 'smoked'],
      ['wings', 'smokeCrisp'],
      ['breasts', 'smoker'],
    ]);
    expect(plan.movedIds).toEqual(['n2']);
  });

  test('Close uses nothing', async () => {
    const { onUse, onClose } = await show(noGriddle);
    await fireEvent.press(button('Close'));
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onUse).not.toHaveBeenCalled();
  });
});

describe('Plan tab with an opened file', () => {
  async function open(gear: Cookers, file: OpenedPlanFile | null, items: ItemInput[] = []) {
    const r = repos(gear, items);
    const onOpenedDone = jest.fn();
    // The route's part: the file is held until the tab is done with it.
    function Route() {
      const [held, setHeld] = useState(file);
      return (
        <PlanTab
          pickDateTime={jest.fn(async () => null)}
          permissions={fakeAlarms()}
          onResume={fakeResume().onResume}
          onCookStarted={jest.fn()}
          now={() => NOW}
          opened={held}
          onOpenedDone={() => {
            onOpenedDone();
            setHeld(null);
          }}
        />
      );
    }
    await render(<Route />, { wrapper: storeWrapper(r) });
    return { repos: r, onOpenedDone };
  }
  const sheet = (name: string) => screen.queryByRole('heading', { name });

  test('no file, no sheet', async () => {
    await open(withGriddle, null);
    expect(sheet('Open shared plan')).toBeNull();
  });

  test('Use this plan replaces the draft with the shared menu, under new ids, at the shared temp and time', async () => {
    const { repos: r, onOpenedDone } = await open(
      withGriddle,
      { text: fileText(), name: 'cook.pitplan' },
      saturday.items,
    );
    expect(sheet('Open shared plan')).toBeOnTheScreen();
    await fireEvent.press(button('Use this plan'));
    await settle();
    expect(onOpenedDone).toHaveBeenCalledTimes(1);
    const draft = r.settings.draft()!;
    expect(draft.mode).toBe('readyBy');
    expect(draft.at).toBe(SERVE);
    expect(draft.pitTempF).toBe(225);
    expect(draft.items.map(i => [i.foodId, i.methodId, i.quantity])).toEqual([
      ['brisket', 'smoked', 12],
      ['wings', 'smokeCrisp', 2],
      ['breasts', 'griddle', 4],
    ]);
    const ids = draft.items.map(i => i.id);
    expect(new Set(ids).size).toBe(3);
    // Never the sender's ids, and never one the plan being replaced used.
    for (const id of ids) expect(['b', 'w', 'c']).not.toContain(id);
    // Nothing moved, so no conflict sheet.
    expect(sheet('Conflicts')).toBeNull();
  });

  test('closing the sheet leaves the plan as it was', async () => {
    const { repos: r, onOpenedDone } = await open(withGriddle, { text: fileText() }, saturday.items);
    await fireEvent.press(button('Close'));
    await settle();
    expect(onOpenedDone).toHaveBeenCalledTimes(1);
    expect(r.settings.draft()!.items).toEqual(saturday.items);
    expect(r.settings.draft()!.pitTempF).toBe(250);
  });

  test('regression: an import that makes a pit conflict opens Conflicts with the fixes', async () => {
    // Wings at 350F on the smoker and wings on the griddle: fine for the sender. With no griddle the second
    // wings move to the smoker (smoke low, then crisp), and the smoker is asked for two temps at once.
    const items = [
      { id: 'a', foodId: 'wings', methodId: 'hot', quantity: 2 },
      { id: 'g', foodId: 'wings', methodId: 'griddle', quantity: 2 },
    ];
    const { repos: r } = await open(noGriddle, { text: fileText({ items }) });
    expect(screen.getByText('No griddle set up.')).toBeOnTheScreen();
    await fireEvent.press(button('Use this plan'));
    await settle();
    expect(sheet('Open shared plan')).toBeNull();
    expect(sheet('Conflicts')).toBeOnTheScreen();
    expect(screen.getByText(/needs 225F while .* needs 350F at the same time\./)).toBeOnTheScreen();
    expect(button('Change smoker temp')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^Edit / }).length).toBe(2);
    // The plan was imported; the fixes work on it.
    expect(r.settings.draft()!.items.map(i => i.methodId)).toEqual(['hot', 'smokeCrisp']);
  });

  test('the mockup menu with no griddle: breasts on the smoker hold too long, and Conflicts opens', async () => {
    await open(noGriddle, { text: fileText() });
    await fireEvent.press(button('Use this plan'));
    await settle();
    expect(sheet('Conflicts')).toBeOnTheScreen();
    expect(screen.getByText(/Chicken breasts holds .* past its 20 min limit/)).toBeOnTheScreen();
  });

  test('an oversized file shows an error and changes nothing', async () => {
    const { repos: r, onOpenedDone } = await open(withGriddle, { error: 'tooBig' }, saturday.items);
    expect(sheet('Open shared plan')).toBeOnTheScreen();
    expect(screen.getByText('That file is too big to be a Pit Planner plan.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Use this plan' })).toBeNull();
    await fireEvent.press(button('OK'));
    await settle();
    expect(onOpenedDone).toHaveBeenCalledTimes(1);
    expect(r.settings.draft()!.items).toEqual(saturday.items);
  });

  test.each([
    ['a file that could not be read', { error: 'unreadable' }, 'Could not read that file.'],
    ['an error this version does not know', { error: 'new' }, 'Could not read that file.'],
    ['a file with neither text nor error', {}, 'Could not read that file.'],
    ['a file that is not JSON', { text: 'PK\u0003\u0004' }, 'This file is not a Pit Planner plan.'],
    ['JSON from another app', { text: '{"app":"other","items":[]}' }, 'This file is not a Pit Planner plan.'],
    [
      'a plan from a newer version',
      { text: fileText({ version: 2 }) },
      'This plan was made by a newer Pit Planner. Update the app to open it.',
    ],
    ['a plan with no usable serve time', { text: fileText({ serveAt: 'soon' }) }, 'This plan file is damaged.'],
    [
      'a plan with no food this app knows',
      { text: fileText({ items: [{ foodId: 'unicorn' }] }) },
      'Nothing in this plan is a food Pit Planner knows.',
    ],
  ])('%s shows why and offers nothing to use', async (_name, file, message) => {
    await open(withGriddle, file);
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Use this plan' })).toBeNull();
  });

  test('a path or URI inside the file is ignored: only known fields reach the plan', async () => {
    const items = [
      { ...MENU[0], uri: 'content://evil/1', path: '/data/data/x', options: { wrap: 'paper', file: '/etc/passwd' } },
    ];
    const { repos: r } = await open(withGriddle, { text: fileText({ items, open: 'file:///sdcard/x' }) });
    await fireEvent.press(button('Use this plan'));
    await settle();
    const [item] = r.settings.draft()!.items;
    expect(Object.keys(item!).sort()).toEqual(['foodId', 'id', 'methodId', 'options', 'quantity', 'restMin']);
    expect(item!.options).toEqual({ wrap: 'paper' });
  });
});
