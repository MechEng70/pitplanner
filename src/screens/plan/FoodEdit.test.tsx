// Food details, Timing (HA-INTEGRATION "Do first", T-001): three models for by-weight foods, two for the rest,
// rate source shown, the one-time published-rate hint, "Use for future", and the result card's method line.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import type { ItemInput, PlanInput } from '../../../engine/types.ts';
import { smokerFromCatalog } from '../../lib/gear.ts';

const store = vi.hoisted(() => ({
  state: { flags: {} as { rateHintShown?: boolean }, totalHours: {} as Record<string, number> },
  setRate: vi.fn(),
  setTotalHours: vi.fn(),
  setFlags: vi.fn(),
}));
vi.mock('../../lib/store.tsx', () => ({ useStore: () => store }));

const { FoodEdit } = await import('./FoodEdit.tsx');

const SERVE = new Date(2026, 10, 14, 17, 0).getTime(); // Sat Nov 14 2026, 5:00 PM local
const smoker = smokerFromCatalog('pitboss-sportsman-850')!;
const units = { temp: 'F', weight: 'lb' } as const;
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  mode: 'readyBy',
  at: SERVE,
  pitTempF: 225,
  cookers: { smoker },
  items: [],
  ...over,
});
const brisket: ItemInput = {
  id: 'b',
  foodId: 'brisket',
  methodId: 'smoked',
  quantity: 12,
  options: { wrap: 'paper' },
  restMin: 60,
};
const ribs: ItemInput = { id: 'r', foodId: 'stlribs', methodId: '321', quantity: 2 };

/** As the Plan screen opens it: an existing item is already in the plan, a new one is not. */
function open(item: ItemInput, opts: { isNew?: boolean; base?: PlanInput } = {}) {
  const onSave = vi.fn();
  const b = opts.base ?? base();
  render(
    <FoodEdit
      initial={item}
      isNew={opts.isNew ?? false}
      base={opts.isNew ? b : { ...b, items: [...b.items, item] }}
      units={units}
      onSave={onSave}
      onRemove={() => {}}
      onClose={() => {}}
    />,
  );
  return { onSave, timing: within(screen.getByRole('radiogroup', { name: 'Timing' })) };
}

beforeEach(() => {
  store.state.flags = {};
  store.state.totalHours = {};
  vi.clearAllMocks();
});

describe('FoodEdit timing', () => {
  it('offers three models for brisket and two for ribs', () => {
    const { timing } = open(brisket);
    expect(timing.getAllByRole('radio').map(r => r.textContent)).toEqual([
      'Hours per pound',
      'Total hours',
      'Size-adjusted',
    ]);
  });

  it('offers Standard and Total hours for a food that is not by weight', () => {
    const { timing } = open(ribs);
    expect(timing.getAllByRole('radio').map(r => r.textContent)).toEqual(['Standard', 'Total hours']);
  });

  it('hours per pound shows the rate, its source and Use for future on the smoker', () => {
    open(brisket);
    expect(screen.getByRole('group', { name: 'Hours per pound' })).toHaveTextContent('1.25');
    expect(screen.getByText('At 225F: published estimate.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Use for future brisket on Pit Boss Sportsman 850/ })).toBeVisible();
  });

  it('a saved 0.75 hr/lb plans 9 hr and the result card names the rate', () => {
    open(brisket, { base: base({ rateOverrides: { brisket: 0.75 } }) });
    expect(screen.getByText('At 225F: your setting.')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/9 hr on heat, your rate 0\.75 hr\/lb/);
  });

  it('stepping the rate changes this cook only until Use for future is checked', async () => {
    const { onSave } = open(brisket, { base: base({ rateOverrides: { brisket: 0.75 } }) });
    fireEvent.click(screen.getByRole('button', { name: 'More hours per pound' }));
    expect(screen.getByRole('group', { name: 'Hours per pound' })).toHaveTextContent('0.8');
    fireEvent.click(screen.getByRole('checkbox', { name: /Use for future/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    // Save runs once the sheet's close animation ends.
    await waitFor(() => expect(store.setRate).toHaveBeenCalledWith('brisket', 0.8));
    expect(onSave.mock.calls[0][0].hrPerLb).toBeUndefined();
  });

  it('total hours are used as-is and can be saved for future cooks', async () => {
    const { timing } = open(brisket, { base: base({ rateOverrides: { brisket: 0.75 } }) });
    fireEvent.click(timing.getByRole('radio', { name: 'Total hours' }));
    expect(screen.getByText('Used as-is. Smoker temp and wrap do not change it.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Total hours' })).toHaveTextContent('9');
    expect(document.body.textContent).toMatch(/your total hours/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Use for future/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(store.setTotalHours).toHaveBeenCalledWith('brisket', 9));
  });

  it('size-adjusted is open with no history and says it is an estimate', () => {
    const { timing } = open(brisket);
    fireEvent.click(timing.getByRole('radio', { name: 'Size-adjusted' }));
    expect(screen.getByText(/Estimate\. Gets better after a few logged cooks\./)).toHaveTextContent('at 12 lb');
    expect(screen.queryByRole('checkbox', { name: /Use for future/ })).toBeNull();
  });

  it('shows the published-rate hint once, for a new by-weight food', async () => {
    open(brisket, { isNew: true });
    const hint = 'Published estimate. Most pellet smokers run faster. Set your own rate or total hours.';
    expect(screen.getByText(hint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    await waitFor(() => expect(store.setFlags).toHaveBeenCalledWith({ rateHintShown: true }));
  });

  it('does not show the hint once it has been seen', () => {
    store.state.flags = { rateHintShown: true };
    open(brisket, { isNew: true });
    expect(screen.queryByText(/Most pellet smokers run faster/)).toBeNull();
  });
});
