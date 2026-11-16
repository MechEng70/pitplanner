import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { markPullDone } from '../../../engine/live';
import { doneStep, pending, postpone, quiet, steps, type ActiveCook } from '@/lib/cook';
import { fmtTime } from '@/lib/format';
import { rules } from '@/lib/rules';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { AT_1023, MIN, cookAt, cookGear, cookMenu } from '@/test/cook';
import { storeWrapper, testRepos } from '@/test/store';
import { ALARMS_NOT_SET, ALERTS_OFF, CookScreen } from './CookScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** The Cook tab over a real database, with the fake phone alarms and a clock the test moves. */
async function show(cook: ActiveCook | null, at = AT_1023) {
  const r = testRepos();
  r.repos.cookers.save(cookGear, at);
  r.repos.settings.setDraft({ mode: 'readyBy', at: Date.UTC(2026, 10, 14, 22, 0), pitTempF: 225, items: cookMenu }, at);
  if (cook) r.repos.activeCook.save(cook, at);
  const alarms = fakeAlarms();
  const resume = fakeResume();
  const clock = { now: at };
  const onGoPlan = jest.fn();
  await render(
    <CookScreen permissions={alarms} onResume={resume.onResume} onGoPlan={onGoPlan} now={() => clock.now} />,
    { wrapper: storeWrapper(r.repos, () => clock.now, alarms) },
  );
  return { repos: r.repos, alarms, resume, clock, onGoPlan };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** A Num draws its spaces as no-break spaces. */
const nbsp = (s: string) => s.replace(/ /g, '\u00a0');
/** The text color class of a Text (its tone). */
const tone = (el: { props: { className?: string } }) => /text-(ink|ember)[\w-]*/.exec(el.props.className ?? '')?.[0];
const replaced = (calls: string[]) => calls.filter(c => c.startsWith('replaceAll')).length;

describe('no cook running (T-064)', () => {
  // 0.2.0 started a cook when the Cook tab was opened with food on the plan, so a discarded cook came back
  // on the next look (Jason's phone, 2026-11-15).
  test('says so and sends the user to Plan; food on the plan never starts a cook', async () => {
    const { repos, alarms, onGoPlan } = await show(null);
    expect(screen.getByRole('heading', { name: 'Cook' })).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'No cook running' })).toBeOnTheScreen();
    expect(
      screen.getByText('Start a cook from the Plan tab. Each step shows up here as it comes due.'),
    ).toBeOnTheScreen();
    await fireEvent.press(button('Go to Plan'));
    expect(onGoPlan).toHaveBeenCalledTimes(1);
    expect(repos.activeCook.load()).toBeNull();
    expect(alarms.calls).toEqual([]);
  });
});

describe('live cook (mockup 12)', () => {
  test('header, status, Next up worded as a check, the countdown and the next three steps', async () => {
    await show(cookAt(AT_1023));
    expect(screen.getByRole('heading', { name: 'Cooking' })).toBeOnTheScreen();
    expect(screen.getByText('Smoker 225F, serve 5:00 PM')).toBeOnTheScreen();
    expect(screen.getByText('On plan')).toBeOnTheScreen();
    expect(screen.getByText('Check at 11:35 AM')).toBeOnTheScreen();
    // One sentence, the step and how long until it (Jason, 2026-11-15).
    expect(screen.getByRole('heading', { name: 'Check the brisket in 1 hr 12 min' })).toBeOnTheScreen();
    expect(screen.getByText('Wrap once the bark is set, about 165-170F. Not ready? Tap Adjust.')).toBeOnTheScreen();
    expect(button('Done')).toBeEnabled();
    expect(button('Adjust')).toBeOnTheScreen();
    expect(button('Cook options')).toBeOnTheScreen();

    expect(screen.getByText('Today, 6 AM to serve')).toBeOnTheScreen();
    expect(screen.getByText('Now 10:23 AM')).toBeOnTheScreen();
    expect(screen.getByText('3:15 to 3:40 PM: brisket and wings share the smoker at 225F.')).toBeOnTheScreen();

    expect(screen.getByRole('heading', { name: 'After that' })).toBeOnTheScreen();
    expect(button('Full timeline')).toBeOnTheScreen();
    for (const [time, step] of [
      ['3:15 PM', 'Wings on the smoker on a wire rack'],
      ['3:25 PM', 'Oven to 170F for holding'],
      ['3:40 PM', 'Check tenderness: pull at 200-205F when the probe slides in like butter'],
    ]) {
      expect(screen.getByText(time!)).toBeOnTheScreen();
      expect(screen.getByText(step!)).toBeOnTheScreen();
    }
    // Only three: the fourth step waits its turn.
    expect(screen.queryByText(/Turn the smoker up to 400F/)).toBeNull();
  });

  test('a step that is not a check reads "At", with no Adjust hint', async () => {
    // 6:00 AM: nothing done yet, the smoker is fired at 6:20.
    await show(cookAt(AT_1023 - 263 * MIN), AT_1023 - 263 * MIN);
    expect(screen.getByText('At 6:20 AM')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Fire the smoker to 225F in 20 min' })).toBeOnTheScreen();
    expect(screen.queryByText(/Not ready\? Tap Adjust\./)).toBeNull();
  });

  // T-034 parity review: both were built with nothing at screen level to hold them.
  test('the lane chart gets the band where foods share the smoker', async () => {
    await show(cookAt(AT_1023));
    expect(screen.getByTestId('lane-band', { includeHiddenElements: true })).toBeTruthy();
  });

  test('with Quiet alerts on, a step past its time still reads overdue and Behind', async () => {
    const at = AT_1023 + 82 * MIN;
    await show(quiet(cookAt(AT_1023), at - 5 * MIN), at);
    expect(screen.getByText('Overdue since 11:35 AM')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Check the brisket, 10 min overdue' })).toBeOnTheScreen();
    expect(screen.getByText('Behind')).toBeOnTheScreen();
  });

  test('the countdown follows the clock without a tap, and a step past its time reads overdue and Behind', async () => {
    const { clock, resume } = await show(cookAt(AT_1023));
    clock.now += 2 * MIN;
    await act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByRole('heading', { name: 'Check the brisket in 1 hr 10 min' })).toBeOnTheScreen();
    // Back from another app two hours later: read at once, not at the next tick.
    clock.now = AT_1023 + 82 * MIN;
    await act(() => resume.resume());
    expect(screen.getByText('Overdue since 11:35 AM')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Check the brisket, 10 min overdue' })).toBeOnTheScreen();
    expect(screen.getByText('10 min overdue').props.className).toContain('text-warn');
    expect(screen.getByText('Behind')).toBeOnTheScreen();
    expect(screen.getByText('Now 11:45 AM')).toBeOnTheScreen();
  });

  test('temps read in Celsius when that is the unit', async () => {
    const r = testRepos();
    r.repos.cookers.save(cookGear, AT_1023);
    r.repos.settings.setUnits({ temp: 'C', weight: 'lb' }, AT_1023);
    r.repos.activeCook.save(cookAt(AT_1023), AT_1023);
    const alarms = fakeAlarms();
    await render(
      <CookScreen permissions={alarms} onResume={fakeResume().onResume} onGoPlan={jest.fn()} now={() => AT_1023} />,
      { wrapper: storeWrapper(r.repos, () => AT_1023, alarms) },
    );
    expect(screen.getByText(/^Smoker \d+C, serve 5:00 PM$/)).toBeOnTheScreen();
    expect(screen.queryByText(/165-170F/)).toBeNull();
  });
});

describe('Done', () => {
  test('marks the step done at the time of the tap, saves the cook and replaces the alarms once', async () => {
    const { repos, alarms, clock } = await show(cookAt(AT_1023));
    clock.now = AT_1023 + 70 * MIN; // 11:33 AM, two minutes early: no question to ask
    await act(() => jest.advanceTimersByTime(30_000));
    const before = replaced(alarms.calls);
    await fireEvent.press(button('Done'));
    await act(async () => {});
    const saved = repos.activeCook.load()!;
    expect(saved.done['phase:b:wrap']).toBe(clock.now);
    expect(replaced(alarms.calls) - before).toBe(1);
    expect(alarms.calls).toContain(`acknowledge ${Object.keys(saved.done).join(',')}`);
    expect(
      screen.getByRole('heading', { name: 'Wings on the smoker on a wire rack in 3 hr 42 min' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('At 3:15 PM')).toBeOnTheScreen();
  });

  // A Done that is 5 min or more early or late asks keep or move: CookOptions.test.tsx.

  test('after the last step there is no Next up card, and the cook is still there', async () => {
    const at = Date.UTC(2026, 10, 14, 22, 5);
    const { repos } = await show(cookAt(at), at);
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'After that' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Cooking' })).toBeOnTheScreen();
    expect(repos.activeCook.load()).not.toBeNull();
  });
});

describe('alert permissions (SPEC section 6)', () => {
  test('no banner while everything is allowed', async () => {
    await show(cookAt(AT_1023));
    expect(screen.queryByText(ALERTS_OFF)).toBeNull();
  });

  test('a permission taken away mid-cook shows the red banner when the app comes back; Fix lists what is off', async () => {
    const { alarms, resume } = await show(cookAt(AT_1023));
    alarms.granted = { ...alarms.granted, exactAlarms: false };
    await act(() => resume.resume());
    expect(screen.getByText(ALERTS_OFF)).toBeOnTheScreen();

    await fireEvent.press(button('Fix'));
    const sheet = within(screen.getByLabelText('Alerts'));
    expect(sheet.getByText('Alarms and reminders')).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Allow alarms and reminders' }));
    expect(alarms.calls).toContain('openSettings exactAlarm');

    // Turned back on in Settings: the row and the banner follow when the app is in front again.
    alarms.granted = { ...alarms.granted, exactAlarms: true };
    await act(() => resume.resume());
    expect(sheet.queryByRole('button', { name: 'Allow alarms and reminders' })).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: 'Close' }));
    await act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
    expect(screen.queryByText(ALERTS_OFF)).toBeNull();
  });

  test('notifications are asked for first, then Settings when Android no longer asks', async () => {
    const { alarms, resume } = await show(cookAt(AT_1023));
    alarms.granted = { ...alarms.granted, notifications: false };
    await act(() => resume.resume());
    await fireEvent.press(button('Fix'));
    await fireEvent.press(button('Allow notifications'));
    await act(async () => {});
    expect(alarms.calls.filter(c => /^(requestNotifications|openSettings)/.test(c))).toEqual([
      'requestNotifications',
      'openSettings notifications',
    ]);
  });
});

describe('the phone refuses the alarm set', () => {
  test('a banner says steps will not ring; Try again clears and sets the whole list again', async () => {
    const { alarms, clock } = await show(cookAt(AT_1023));
    expect(screen.queryByText(ALARMS_NOT_SET)).toBeNull();
    clock.now = AT_1023 + 70 * MIN; // on time, so Done has no question to ask
    alarms.failNext = new Error('refused');
    await fireEvent.press(button('Done'));
    await act(async () => {});
    expect(screen.getByText(ALARMS_NOT_SET)).toBeOnTheScreen();
    const before = alarms.sets.length;
    await fireEvent.press(button('Try again'));
    await act(async () => {});
    // One whole set (replaceAll cancels everything first), not a patch.
    expect(alarms.sets.length).toBe(before + 1);
    expect(alarms.sets.at(-1)!.length).toBeGreaterThan(5);
    expect(screen.queryByText(ALARMS_NOT_SET)).toBeNull();
  });

  test('a day or more away the title reads in days and hours', async () => {
    // Thu 8:00 PM, before the Saturday cook: the smoker is fired Sat 6:20 AM.
    const at = Date.UTC(2026, 10, 13, 1, 0);
    await show(cookAt(at), at);
    expect(screen.getByRole('heading', { name: 'Fire the smoker to 225F in 1 day 10 hr' })).toBeOnTheScreen();
  });
});

describe('what an alert changed', () => {
  test('the notice shows until OK, in the display units', async () => {
    const { repos } = await show({
      ...cookAt(AT_1023),
      notice: 'Fire the smoker to 225F: done at 6:21 AM from the alert.',
    });
    expect(screen.getByText('Fire the smoker to 225F: done at 6:21 AM from the alert.')).toBeOnTheScreen();
    await fireEvent.press(button('OK'));
    expect(screen.queryByText(/from the alert/)).toBeNull();
    expect(repos.activeCook.load()!.notice).toBeNull();
  });
});

describe('Full timeline (T-023)', () => {
  test('lists every step: done ones dimmed with the time they were done, the rest with the time they are due', async () => {
    const cook = cookAt(AT_1023);
    // The brisket went on 6 min late.
    const on = Object.keys(cook.done).find(k => k.startsWith('phase:b:'))!;
    const { repos, alarms } = await show({ ...cook, done: { ...cook.done, [on]: cook.done[on]! + 6 * MIN } });
    const calls = alarms.calls.length;
    await fireEvent.press(button('Full timeline'));
    const sheet = within(screen.getByLabelText('Full timeline'));
    const rows = steps(cook);
    expect(rows.length).toBeGreaterThan(6);
    for (const k of rows) {
      const label = sheet.getByText(k.event.label.replace(/\.$/, ''));
      expect(tone(label)).toBe(k.key in cook.done ? 'text-ink-3' : 'text-ink');
    }
    // Done: when it was done, dimmed. Still to do: when it is due, in the accent.
    expect(tone(sheet.getByText(nbsp(fmtTime(cook.done[on]! + 6 * MIN))))).toBe('text-ink-3');
    expect(sheet.queryByText(nbsp(fmtTime(cook.done[on]!)))).toBeNull();
    expect(tone(sheet.getByText(nbsp('11:35 AM')))).toBe('text-ember-hi');
    expect(tone(sheet.getByText(nbsp('5:00 PM')))).toBe('text-ember-hi');

    await fireEvent.press(sheet.getByRole('button', { name: 'Close' }));
    await act(() => jest.advanceTimersByTime(SHEET_OUT_MS));
    expect(screen.queryByLabelText('Full timeline')).toBeNull();
    // Looking changes nothing.
    expect(alarms.calls.length).toBe(calls);
    expect(repos.activeCook.load()!.done[on]).toBe(cook.done[on]! + 6 * MIN);
  });

  test('with one step left the button is still there', async () => {
    const at = Date.UTC(2026, 10, 14, 21, 58);
    await show(cookAt(at), at);
    expect(screen.queryByRole('heading', { name: 'After that' })).toBeNull();
    await fireEvent.press(button('Full timeline'));
    expect(screen.getByLabelText('Full timeline')).toBeOnTheScreen();
  });
});

describe('Done on Serve (T-023)', () => {
  test('marks the step done and hands over to Cook finished', async () => {
    const at = Date.UTC(2026, 10, 14, 22, 0);
    const cook = cookAt(at);
    const r = testRepos();
    r.repos.activeCook.save(cook, at);
    const alarms = fakeAlarms();
    const onEnd = jest.fn();
    await render(
      <CookScreen
        permissions={alarms}
        onResume={fakeResume().onResume}
        onGoPlan={() => {}}
        onEnd={onEnd}
        now={() => at}
      />,
      { wrapper: storeWrapper(r.repos, () => at, alarms) },
    );
    expect(screen.getByRole('heading', { name: /^Serve/ })).toBeOnTheScreen();
    await fireEvent.press(button('Done'));
    await act(async () => {});
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(pending(r.repos.activeCook.load()!)).toEqual([]);
    // No keep or move question on the last step.
    expect(screen.queryByRole('radio')).toBeNull();
  });
});

describe('a change that makes a new warning (T-069)', () => {
  const CONFLICT = 'Smoker conflict: brisket at 225F and chicken wings at 400F at the same time.';
  const HOLD = 'Long hold: brisket 6 hr 10 min, limit 4 hr. Keep it above 140F.';
  /** Not yet on the wrap check, an hour: the brisket comes off at 4:40 PM, after the smoker goes to 400F. */
  const behind = () => postpone(cookAt(AT_1023), 'phase:b:wrap', AT_1023, 60, true);
  /** The brisket off the smoker at 10:30 AM: it holds until it is sliced at 4:40 PM. */
  const pulled = (c: ActiveCook): ActiveCook => ({
    ...c,
    plan: markPullDone(rules, c.input, c.plan, 'b', AT_1023 + 7 * MIN),
  });

  /** 4:26 PM: the brisket is still on and the wings are climbing to 400F. */
  const AT_426 = Date.UTC(2026, 10, 14, 21, 26);
  /**
   * Both kinds on one cook: the brisket an hour behind with serve kept (the smoker conflict), and the breasts
   * on the griddle 20 min early at 4:20 PM with serve kept, so they hold 28 min, past their 20 min limit.
   * Until T-076 this was four +15 taps on the brisket's pull alert, which moved serve and left the wings and
   * the breasts holding 35 and 38 min; now they move with serve, so that cook has the conflict alone.
   */
  const both = (): ActiveCook => doneStep(behind(), 'phase:c:cook', Date.UTC(2026, 10, 14, 21, 20), true).cook;
  const BOTH = `${CONFLICT} Long hold: chicken breasts 28 min, limit 20 min.`;

  test('no banner on a cook that is as it started', async () => {
    await show(cookAt(AT_1023));
    expect(screen.queryByText(/Smoker conflict/)).toBeNull();
    expect(screen.queryByText(/Long hold/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
  });

  test('a smoker conflict shows as a banner with OK; OK hides it and it stays hidden', async () => {
    const { repos, alarms, resume } = await show(behind());
    expect(screen.getByRole('alert', { name: CONFLICT })).toBeOnTheScreen();
    // The chart's note says the same thing, with the times.
    expect(
      screen.getByText(/^\d+:\d\d to \d+:\d\d PM: smoker conflict, brisket at 225F and wings at 400F\.$/),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/share the smoker/)).toBeNull();
    await fireEvent.press(button('OK'));
    await act(async () => {});
    expect(screen.queryByRole('alert', { name: CONFLICT })).toBeNull();
    expect(repos.activeCook.load()!.warningsSeen).toEqual(['PIT_CONFLICT:b|w']);
    // The plan is not re-timed by the banner or by OK.
    expect(repos.activeCook.load()!.plan).toEqual(behind().plan);
    await act(() => resume.resume());
    expect(screen.queryByRole('alert', { name: CONFLICT })).toBeNull();
    // Silent: the phone is only ever given the steps.
    expect(alarms.sets.flat().some(a => /conflict/i.test(`${a.title} ${a.body}`))).toBe(false);
  });

  test('a hold that has grown past its limit shows the same way', async () => {
    const { repos } = await show(pulled(cookAt(AT_1023)));
    expect(screen.getByRole('alert', { name: HOLD })).toBeOnTheScreen();
    await fireEvent.press(button('OK'));
    await act(async () => {});
    expect(screen.queryByText(/Long hold/)).toBeNull();
    expect(repos.activeCook.load()!.warningsSeen).toEqual(['HOLD_TOO_LONG:b']);
  });

  test('both at once are one banner of two sentences with one OK, the conflict first', async () => {
    const { repos } = await show(both(), AT_426);
    expect(screen.getByRole('alert', { name: BOTH })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'OK' })).toHaveLength(1);
    await fireEvent.press(button('OK'));
    await act(async () => {});
    expect(screen.queryByRole('alert', { name: /Smoker conflict/ })).toBeNull();
    expect(repos.activeCook.load()!.warningsSeen).toEqual(['PIT_CONFLICT:b|w', 'HOLD_TOO_LONG:c']);
  });

  test('after OK on one warning a different one still shows', async () => {
    await show(pulled({ ...behind(), warningsSeen: ['PIT_CONFLICT:b|w'] }));
    expect(screen.queryByText(/Smoker conflict:/)).toBeNull();
    expect(
      screen.getByRole('alert', { name: /^Long hold: brisket .*, limit 4 hr\. Keep it above 140F\.$/ }),
    ).toBeOnTheScreen();
  });

  test('the banner goes away by itself once the conflict is in the past', async () => {
    const { clock, resume } = await show(behind());
    expect(screen.getByRole('alert', { name: CONFLICT })).toBeOnTheScreen();
    clock.now = Date.UTC(2026, 10, 14, 21, 41); // 4:41 PM, the brisket came off at 4:40 PM
    await act(() => resume.resume());
    expect(screen.queryByRole('alert', { name: CONFLICT })).toBeNull();
  });

  test('a warning the plan had at Start cook gets no banner', async () => {
    const c = behind();
    await show({ ...c, original: c.plan });
    expect(screen.queryByRole('alert', { name: CONFLICT })).toBeNull();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
  });

  test('a cook saved before this banner existed opens, shows a new warning, and OK works', async () => {
    const { warningsSeen: _w, ...old } = behind();
    const { repos } = await show(old as ActiveCook);
    expect(screen.getByRole('alert', { name: CONFLICT })).toBeOnTheScreen();
    await fireEvent.press(button('OK'));
    await act(async () => {});
    expect(screen.queryByRole('alert', { name: CONFLICT })).toBeNull();
    expect(repos.activeCook.load()!.warningsSeen).toEqual(['PIT_CONFLICT:b|w']);
  });

  test('temps in the banner read in Celsius when that is the unit', async () => {
    const r = testRepos();
    r.repos.cookers.save(cookGear, AT_1023);
    r.repos.settings.setUnits({ temp: 'C', weight: 'lb' }, AT_1023);
    r.repos.activeCook.save(both(), AT_426);
    const alarms = fakeAlarms();
    await render(
      <CookScreen permissions={alarms} onResume={fakeResume().onResume} onGoPlan={jest.fn()} now={() => AT_426} />,
      { wrapper: storeWrapper(r.repos, () => AT_426, alarms) },
    );
    expect(
      screen.getByRole('alert', {
        name: /^Smoker conflict: brisket at \d+C and chicken wings at \d+C at the same time\. Long hold: chicken breasts 28 min, limit 20 min\.$/,
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/225F|400F/)).toBeNull();
  });
});
