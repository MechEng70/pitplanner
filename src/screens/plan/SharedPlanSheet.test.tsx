// Open shared plan (mockup 11, T-030): the sheet alone, then the Plan tab given an opened file.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { View } from 'react-native';
import type { Cookers, ItemInput } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import type { Draft } from '@/lib/draft';
import { saturday } from '@/lib/fixtures/saturday';
import { defaultGriddle } from '@/lib/gear';
import { method, rules } from '@/lib/rules';
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

  // T-075 (Jason, 2026-11-16): the import checks every cooker a method's steps need, not only its own.
  const TRITIP = { id: 't', foodId: 'tritip', methodId: 'reverse', quantity: 2.5, restMin: 10 };
  const SEARED = 'Tri-tip will be seared on the smoker, or add a griddle in Gear.';

  test('a tri-tip with a griddle sear, no griddle: it is seared on the smoker, and the box says so', async () => {
    const { onUse } = await show(noGriddle, { shared: sharedOf(fileText({ items: [TRITIP] })) });
    expect(screen.getByText(/^Tri-tip, /)).toHaveTextContent('Tri-tip, 2.5 lb, smoke then sear');
    expect(screen.getByText('No griddle set up.')).toBeOnTheScreen();
    expect(screen.getByText(SEARED)).toBeOnTheScreen();
    await fireEvent.press(button('Use this plan'));
    await settle();
    const [plan] = onUse.mock.calls[0]!;
    expect(plan.items.map(i => [i.foodId, i.methodId, i.restMin])).toEqual([['tritip', 'smokerSear', 10]]);
    expect(plan.moves).toEqual([
      { foodName: 'Tri-tip', from: 'griddle', to: 'smoker', how: 'be seared on the smoker' },
    ]);
    expect(plan.movedIds).toEqual(['n0']);
  });

  test('a tri-tip with a griddle sear and a griddle set up stays as sent', async () => {
    const { onUse } = await show(withGriddle, { shared: sharedOf(fileText({ items: [TRITIP] })) });
    expect(screen.queryByText(/set up\./)).toBeNull();
    expect(screen.queryByText(/will be seared/)).toBeNull();
    await fireEvent.press(button('Use this plan'));
    await settle();
    expect(onUse.mock.calls[0]![0].items[0]!.methodId).toBe('reverse');
  });

  test('tri-tip and breasts with no griddle: one box, each food with its own words', async () => {
    await show(noGriddle, { shared: sharedOf(fileText({ items: [TRITIP, MENU[2]] })) });
    expect(screen.getAllByText('No griddle set up.')).toHaveLength(1);
    expect(
      screen.getByText(
        'Tri-tip will be seared on the smoker and Chicken breasts will move to the smoker, or add a griddle in Gear.',
      ),
    ).toBeOnTheScreen();
  });

  // Jason, 2026-11-16: a smoker that tops out under 450F cannot do the smoker sear, so the import does not
  // fall back to it.
  const upTo = (maxTempF: number): Cookers => ({ smoker: { ...smoker, maxTempF } });

  // T-075 follow-up (Jason, 2026-11-16): a tri-tip that falls to brisket-style stays on the smoker, so the box
  // says what it will do there, in the brisket-style method's own words from the data.
  const brisketStyleMove = method('tritip', 'brisketStyle').importMove!;
  const BRISKET_STYLE = `Tri-tip will ${brisketStyleMove}, or add a griddle in Gear.`;

  test('the brisket-style sentence, as Jason wrote it', () => {
    expect(BRISKET_STYLE).toBe('Tri-tip will cook brisket-style with no sear, or add a griddle in Gear.');
  });

  test('no griddle and a 425F smoker: the tri-tip falls back to brisket-style, and the box says so', async () => {
    const { onUse } = await show(upTo(425), { shared: sharedOf(fileText({ items: [TRITIP] })) });
    expect(screen.getByText('No griddle set up.')).toBeOnTheScreen();
    expect(screen.getByText(BRISKET_STYLE)).toBeOnTheScreen();
    expect(screen.queryByText(/will move to the smoker/)).toBeNull();
    await fireEvent.press(button('Use this plan'));
    await settle();
    expect(onUse.mock.calls[0]![0].items.map(i => [i.methodId, i.restMin])).toEqual([['brisketStyle', 45]]);
  });

  test('no griddle and a 450F smoker: the tri-tip is seared on the smoker', async () => {
    const { onUse } = await show(upTo(450), { shared: sharedOf(fileText({ items: [TRITIP] })) });
    expect(screen.getByText(SEARED)).toBeOnTheScreen();
    await fireEvent.press(button('Use this plan'));
    await settle();
    expect(onUse.mock.calls[0]![0].items[0]!.methodId).toBe('smokerSear');
  });

  test('a shared smoker sear on a 425F smoker takes the first method that smoker can do, and says so', async () => {
    const sent = { ...TRITIP, methodId: 'smokerSear' };
    const { onUse } = await show(upTo(425), { shared: sharedOf(fileText({ items: [sent] })) });
    // Never silent (Jason, 2026-11-16): the same box and words as for a griddle sear.
    expect(screen.getByText('No griddle set up.')).toBeOnTheScreen();
    expect(screen.getByText(BRISKET_STYLE)).toBeOnTheScreen();
    await fireEvent.press(button('Use this plan'));
    await settle();
    const [plan] = onUse.mock.calls[0]!;
    expect(plan.items[0]!.methodId).toBe('brisketStyle');
    expect(plan.movedIds).toEqual(['n0']);
  });

  // Jason, 2026-11-17: the griddle sear is said in the same box, the sentence alone: nothing is missing.
  const GRIDDLE_SEAR = 'Tri-tip will be seared on the griddle.';

  test('a shared smoker sear on a 425F smoker with a griddle: the griddle sear, and the box says so', async () => {
    const sent = { ...TRITIP, methodId: 'smokerSear' };
    const gear = { ...upTo(425), griddle: defaultGriddle() };
    const { onUse } = await show(gear, { shared: sharedOf(fileText({ items: [sent] })) });
    expect(screen.getByText(GRIDDLE_SEAR)).toHaveTextContent(GRIDDLE_SEAR, { exact: true });
    // No heading (no cooker is missing), no Gear tail, and not the brisket-style sentence.
    expect(screen.queryByText('No griddle set up.')).toBeNull();
    expect(screen.queryByText('No smoker set up.')).toBeNull();
    expect(screen.queryByText(/set up\./)).toBeNull();
    expect(screen.queryByText(/in Gear/)).toBeNull();
    expect(screen.queryByText(BRISKET_STYLE)).toBeNull();
    await fireEvent.press(button('Use this plan'));
    await settle();
    const [plan] = onUse.mock.calls[0]!;
    expect(plan.items.map(i => [i.methodId, i.restMin])).toEqual([['reverse', 10]]);
    expect(plan.moves).toEqual([{ foodName: 'Tri-tip', to: 'smoker', how: 'be seared on the griddle' }]);
    expect(plan.movedIds).toEqual(['n0']);
  });

  test('two shared smoker sears on a 425F smoker with a griddle: one box, the foods joined', async () => {
    const sent = { ...TRITIP, methodId: 'smokerSear' };
    const gear = { ...upTo(425), griddle: defaultGriddle() };
    await show(gear, { shared: sharedOf(fileText({ items: [sent, { ...sent, id: 'u', quantity: 3 }] })) });
    expect(screen.getAllByText(/will be seared on the griddle/)).toHaveLength(1);
    expect(screen.getByText('Tri-tip and Tri-tip will be seared on the griddle.')).toBeOnTheScreen();
    expect(screen.queryByText(/set up\.|in Gear/)).toBeNull();
  });

  test('a tri-tip with no smoker can be cooked no way: it needs a smoker', async () => {
    await show({ griddle: defaultGriddle() }, { shared: sharedOf(fileText({ items: [TRITIP] })) });
    expect(screen.getByText('No smoker set up.')).toBeOnTheScreen();
    expect(screen.getByText('Tri-tip needs a smoker. Add one in Gear.')).toBeOnTheScreen();
    expect(screen.queryByText('No griddle set up.')).toBeNull();
  });

  test('a food with no cooker to move to says what it needs', async () => {
    await show({ griddle: defaultGriddle() }, { shared: sharedOf(fileText({ items: [MENU[0]] })) });
    expect(screen.getByText('No smoker set up.')).toBeOnTheScreen();
    expect(screen.getByText('Brisket needs a smoker. Add one in Gear.')).toBeOnTheScreen();
    expect(screen.queryByText('Cook the smoker items on')).toBeNull();
  });

  // Jason, 2026-11-17: one food with a plural name agrees as a plural: "need", not "needs".
  test('one food with a plural name and no cooker to move to: "need a smoker"', async () => {
    const ribs = { id: 'r', foodId: 'stlribs', methodId: '221', quantity: 3 };
    await show({ griddle: defaultGriddle() }, { shared: sharedOf(fileText({ items: [ribs] })) });
    expect(screen.getByText('No smoker set up.')).toBeOnTheScreen();
    expect(screen.getByText('St. Louis ribs need a smoker. Add one in Gear.')).toBeOnTheScreen();
  });

  test('two foods with no cooker to move to: "need a smoker", as before', async () => {
    const ribs = { id: 'r', foodId: 'stlribs', methodId: '221', quantity: 3 };
    await show({ griddle: defaultGriddle() }, { shared: sharedOf(fileText({ items: [MENU[0], ribs] })) });
    expect(screen.getByText('Brisket and St. Louis ribs need a smoker. Add one in Gear.')).toBeOnTheScreen();
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

    // T-073: the sheet says when it moved the date. SERVE is Sat Nov 14, 5:00 PM; a week on is Sat, Nov 21.
    const MIN = 60_000;
    const PASSED = 'That time has passed. Set for Sat, Nov 21.';
    const SOON = "That's less than an hour away. Set for Sat, Nov 21. Pick a date to keep today.";
    const moveNote = () => screen.queryByText(/Set for/);

    test('a time that has passed: the note says so and names the new date', async () => {
      await show(withGriddle, { now: SERVE + 30 * MIN });
      expect(chip('Sat, Nov 21')).toBeChecked();
      expect(moveNote()).toHaveTextContent(PASSED, { exact: true });
    });

    test('a time under an hour away: the note says so and that Pick a date keeps today', async () => {
      await show(withGriddle, { now: SERVE - 30 * MIN });
      expect(chip('Sat, Nov 21')).toBeChecked();
      expect(moveNote()).toHaveTextContent(SOON, { exact: true });
    });

    test('a date that was kept has no note', async () => {
      await show(withGriddle, { now: SERVE - 5 * 60 * MIN });
      expect(chip('Sat, Nov 14')).toBeChecked();
      expect(moveNote()).toBeNull();
      expect(screen.queryByText(/has passed|less than an hour/)).toBeNull();
    });

    test('edge: exactly an hour out is kept, as the date offered is, so no note', async () => {
      await show(withGriddle, { now: SERVE - 60 * MIN });
      expect(chip('Sat, Nov 14')).toBeChecked();
      expect(moveNote()).toBeNull();
    });

    test('edge: exactly now has not passed, so the note is the under an hour one', async () => {
      await show(withGriddle, { now: SERVE });
      expect(chip('Sat, Nov 21')).toBeChecked();
      expect(moveNote()).toHaveTextContent(SOON, { exact: true });
    });

    test('the note shows only while the moved date is the one set: gone after a pick, back with the offer', async () => {
      const today = SERVE + 15 * MIN;
      await show(withGriddle, { now: SERVE - 30 * MIN, picked: today });
      expect(moveNote()).toBeOnTheScreen();
      await fireEvent.press(chip('Pick a date'));
      expect(chip(/^Sat, Nov 14, 5:15/)).toBeChecked();
      expect(moveNote()).toBeNull();
      await fireEvent.press(chip('Sat, Nov 21'));
      expect(moveNote()).toHaveTextContent(SOON, { exact: true });
    });

    test('Pick a date takes today at a time under an hour away, and Use this plan hands over that time', async () => {
      const now = SERVE - 30 * MIN; // Sat Nov 14, 4:30 PM
      const today = now + 20 * MIN; // 4:50 PM the same day, 20 min ahead
      const { pickDateTime, onUse } = await show(withGriddle, { now, picked: today });
      await fireEvent.press(chip('Pick a date'));
      // Jason, 2026-11-16: under an hour away, the dialog opens on the shared date (today), not the moved one.
      expect(pickDateTime).toHaveBeenCalledWith(SERVE);
      expect(chip(/^Sat, Nov 14, 4:50/)).toBeChecked();
      expect(chip('Sat, Nov 21')).not.toBeChecked();
      await fireEvent.press(button('Use this plan'));
      await settle();
      expect(onUse.mock.calls[0]![1]).toBe(today);
    });
  });

  test('Pick a date opens on the moved date when the time has passed, and on a date the user picked before', async () => {
    const now = SERVE + 2 * 3_600_000; // two hours after the shared serve time: passed
    const mine = SERVE + 3 * 86_400_000;
    const { pickDateTime } = await show(withGriddle, { now, picked: mine });
    await fireEvent.press(chip('Pick a date'));
    expect(pickDateTime).toHaveBeenLastCalledWith(SERVE + 7 * 86_400_000);
    await fireEvent.press(chip(/^Tue, Nov 17/));
    expect(pickDateTime).toHaveBeenLastCalledWith(mine);
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
    expect(
      screen.getByText(
        /^Smoker conflict: 2 lb chicken wings [12] at (225|350)F and 2 lb chicken wings [12] at (225|350)F at the same time\.$/,
      ),
    ).toBeOnTheScreen();
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
    expect(
      screen.getByText(
        /^Long hold: chicken breasts .*, limit 20 min\. Move them to the griddle or start them later\.$/,
      ),
    ).toBeOnTheScreen();
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
