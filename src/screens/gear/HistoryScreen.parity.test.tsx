// T-034 parity review, docs/parity.md section 1b row T7: the Cook history card for a food that is not cooked
// by weight (ribs) but has saved total hours.
import { render, screen, within } from '@testing-library/react-native';
import type { Repos } from '@/db/repos';
import { cookGear } from '@/test/cook';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { HistoryScreen } from './HistoryScreen';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function show(seed?: (r: Repos) => void) {
  const { repos } = testRepos();
  repos.cookers.save(cookGear, NOW);
  seed?.(repos);
  await render(<HistoryScreen onBack={jest.fn()} onCookAgain={jest.fn()} now={() => NOW} />, {
    wrapper: storeWrapper(repos, () => NOW),
  });
}
const card = (label: string) => screen.getByRole('button', { name: label });

describe('Cook history: a food with only saved total hours (T7)', () => {
  // Catches: the card filter in HistoryScreen or rateRows dropping a food that is not by weight, or that
  // card growing the by-weight tiles (hr/lb, Cooks) or the "on <smoker>" title it has no rate for.
  test('ribs with saved total hours get a card with the total and no rate or cooks tiles', async () => {
    await show(r => r.rates.setTotalHours('stlribs', 5.5, NOW));
    const ribs = within(card('St. Louis ribs'));
    expect(ribs.getByText('St. Louis ribs')).toBeOnTheScreen();
    expect(ribs.queryByText(/ on Pit Boss Sportsman 850$/)).toBeNull();
    expect(ribs.getByLabelText('Total 5.5 hr yours')).toBeOnTheScreen();
    expect(ribs.queryByLabelText(/^hr\/lb /)).toBeNull();
    expect(ribs.queryByLabelText(/^Cooks /)).toBeNull();
    // Only the ribs: no by-weight food has been cooked or has a saved rate.
    expect(screen.queryByRole('button', { name: 'Brisket' })).toBeNull();
  });

  // Catches: a card for every food in the rules (a screenful of published rates before the cooks).
  test('ribs with no saved total hours and no cooks get no card', async () => {
    await show();
    expect(screen.queryByRole('button', { name: 'St. Louis ribs' })).toBeNull();
  });
});
