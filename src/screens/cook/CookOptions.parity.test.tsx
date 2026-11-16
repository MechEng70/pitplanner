// T-034 parity review, docs/parity.md section 1b row T13: Undo lives in Cook options, not on the Cook screen.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { fakeAlarms, fakeResume } from '@/platform/fakes';
import { AT_1023, MIN, cookAt, cookGear, cookMenu } from '@/test/cook';
import { storeWrapper, testRepos } from '@/test/store';
import { CookScreen } from './CookScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const hidden = { includeHiddenElements: true };
const optionsSheet = () => screen.queryAllByLabelText('Cook options', hidden).find(e => e.props.role === 'dialog');

describe('Undo (T13)', () => {
  // Catches: an Undo button or "Undo" line added to the Cook screen itself (a snackbar after Done, say),
  // or the Undo row going missing from Cook options.
  test('after a Done there is nothing to undo on the Cook screen; Undo is a row in Cook options', async () => {
    const r = testRepos();
    r.repos.cookers.save(cookGear, AT_1023);
    r.repos.settings.setDraft(
      { mode: 'readyBy', at: Date.UTC(2026, 10, 14, 22, 0), pitTempF: 225, items: cookMenu },
      AT_1023,
    );
    r.repos.activeCook.save(cookAt(AT_1023), AT_1023);
    const alarms = fakeAlarms();
    const clock = { now: AT_1023 + 70 * MIN }; // 11:33 AM: the wrap check is 2 min away, so Done asks nothing
    await render(
      <CookScreen permissions={alarms} onResume={fakeResume().onResume} onGoPlan={jest.fn()} now={() => clock.now} />,
      { wrapper: storeWrapper(r.repos, () => clock.now, alarms) },
    );
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await act(async () => {});
    expect(r.repos.activeCook.load()!.done['phase:b:wrap']).toBe(clock.now);

    // The Cook screen, sheet closed: no Undo anywhere, shown or hidden.
    expect(optionsSheet()).toBeUndefined();
    expect(screen.queryAllByText(/undo/i, hidden)).toEqual([]);
    expect(screen.queryAllByRole('button', { name: /undo/i, ...hidden })).toEqual([]);

    // Cook options has it.
    await fireEvent.press(screen.getByRole('button', { name: 'Cook options' }));
    const sheet = within(optionsSheet()!);
    expect(sheet.getByRole('button', { name: /^Undo: / })).toBeOnTheScreen();
  });
});
