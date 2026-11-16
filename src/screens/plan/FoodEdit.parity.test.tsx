// T-034 parity review, docs/parity.md section 1b rows T8, T9 and T10: Food details' result bar for a cooker
// that is not lit ahead, the form that never gets shorter while open, and the method chips.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { ItemInput, PlanInput } from '../../../engine/types';
import { SHEET_OUT_MS } from '@/components/kit/sheet';
import { saturday } from '@/lib/fixtures/saturday';
import { storeWrapper, testRepos } from '@/test/store';
import { FoodEdit } from './FoodEdit';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

const units = { temp: 'F', weight: 'lb' } as const;
const base = (over: Partial<PlanInput> = {}): PlanInput => ({ ...saturday, items: [], ...over });
const brisket: ItemInput = saturday.items[0]!;

async function open(item: ItemInput, b: PlanInput = base()) {
  const onSave = jest.fn();
  await render(
    <FoodEdit
      initial={item}
      isNew={false}
      base={{ ...b, items: [...b.items, item] }}
      units={units}
      onSave={onSave}
      onRemove={jest.fn()}
      onClose={jest.fn()}
    />,
    { wrapper: storeWrapper(testRepos().repos) },
  );
  return { onSave };
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const methods = () => within(screen.getByLabelText('Method'));

describe('result bar for a cooker that is not lit ahead (T8)', () => {
  // Catches: barCells always reading "Fire" (with no fire time it would show nothing or a wrong time), or
  // "On" showing a time other than when the food goes on heat.
  test('with no smoker set up, the bar reads On, the time the food goes on heat, instead of Fire', async () => {
    // 12 lb at the saved 0.75 hr/lb: 9 hr on heat, on at 6:40 AM, off at 3:40 PM, serve at 5:00 PM.
    await open(brisket, base({ cookers: {} }));
    const footer = within(screen.getByTestId('footer'));
    expect(footer.getByRole('button', { name: 'On 6:40 AM, Off heat 3:40 PM, Serve 5:00 PM' })).toBeOnTheScreen();
    expect(footer.queryByRole('button', { name: /^Fire / })).toBeNull();
  });

  // Catches: the same "On" showing when the smoker is there and is lit ahead (20 min preheat).
  test('with the smoker set up, the same food reads Fire, 20 min before it goes on', async () => {
    await open(brisket);
    const footer = within(screen.getByTestId('footer'));
    expect(footer.getByRole('button', { name: 'Fire 6:20 AM, Off heat 3:40 PM, Serve 5:00 PM' })).toBeOnTheScreen();
  });
});

describe('the form never gets shorter while open (T9)', () => {
  /** The view that reports the form's height, and the frame around it that holds the tallest one seen. */
  function frame() {
    const weight = screen.getAllByLabelText('Trimmed weight').find(n => n.props.role === 'group')!;
    let inner = weight.parent;
    while (inner && !(inner.props.onLayout && inner.parent && 'minHeight' in flat(inner.parent))) inner = inner.parent;
    if (!inner?.parent) throw new Error('no never-shorter frame around the form');
    return { inner, outer: inner.parent };
  }
  const flat = (n: { props: { style?: unknown } }) => (StyleSheet.flatten(n.props.style as never) ?? {}) as object;
  const minHeight = (n: { props: { style?: unknown } }) => (flat(n) as { minHeight?: number }).minHeight;
  const layout = (n: Parameters<typeof fireEvent>[0], height: number) =>
    act(() => fireEvent(n, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 328, height } } }));

  // Catches: useNeverShorter setting minHeight to the latest height (content that got shorter, like a warning
  // going away, would let the scroll view clamp and move the control under the finger) or not growing.
  test('the frame keeps the tallest height the form has had, and grows with it', async () => {
    await open(brisket);
    const f = frame();
    await layout(f.inner, 800);
    expect(minHeight(frame().outer)).toBe(800);
    await layout(frame().inner, 600);
    expect(minHeight(frame().outer)).toBe(800);
    await layout(frame().inner, 900);
    expect(minHeight(frame().outer)).toBe(900);
  });
});

describe('method chips (T10)', () => {
  const ribs: ItemInput = { id: 'r', foodId: 'stlribs', methodId: '221', quantity: 2 };

  // Catches: picking a method not changing the item's methodId, or the note not following the method.
  test('ribs: every method on the smoker is a chip, and picking 3-2-1 changes the note and what is saved', async () => {
    const { onSave } = await open(ribs);
    const labels = methods()
      .getAllByRole('radio')
      .map(r => r.props.accessibilityLabel);
    expect(labels).toEqual(['2-2-1', '3-2-1', 'No wrap']);
    expect(screen.getByText('Smoke, wrapped, unwrapped hours at 225F. 2-2-1 suits St. Louis cut.')).toBeOnTheScreen();
    await fireEvent.press(methods().getByRole('radio', { name: '3-2-1' }));
    expect(methods().getByRole('radio', { name: '3-2-1' })).toBeChecked();
    expect(screen.getByText('Smoke, wrapped, unwrapped hours at 225F. Longer smoke, softer ribs.')).toBeOnTheScreen();
    await fireEvent.press(button('Save'));
    await settle();
    expect(onSave.mock.calls[0][0]).toMatchObject({ foodId: 'stlribs', methodId: '321' });
  });

  // Catches: pickMethod keeping the old method's rest instead of taking the new method's default.
  test("tri-tip: picking brisket-style takes that method's rest (45 min, from 10)", async () => {
    const tritip: ItemInput = { id: 't', foodId: 'tritip', methodId: 'reverse', quantity: 2.5, restMin: 10 };
    const { onSave } = await open(tritip);
    await fireEvent.press(methods().getByRole('radio', { name: 'Smoked brisket-style (200F)' }));
    await fireEvent.press(button('Save'));
    await settle();
    expect(onSave.mock.calls[0][0]).toMatchObject({ methodId: 'brisketStyle', restMin: 45 });
  });

  // Catches: Method chips shown for a food with one method on its cooker (a chip that does nothing).
  test('brisket has one method: no Method chips', async () => {
    await open(brisket);
    expect(screen.queryByLabelText('Method')).toBeNull();
  });
});
