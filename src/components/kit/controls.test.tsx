import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Chips, ChoiceCards, Field, IconButton, Segmented, segmentFit, SelectField, Stepper } from './controls';
import { Close } from './icons';
import { Num } from './num';
import { Text } from '@/components/ui/text';

const opts = [
  { id: 'f', label: 'F' },
  { id: 'c', label: 'C' },
  { id: 'k', label: 'K', disabled: true },
];

describe('Stepper', () => {
  test('minus and plus call their handlers; the value shows with its unit', async () => {
    const onDec = jest.fn();
    const onInc = jest.fn();
    await render(<Stepper label="Weight" value="12.0" unit="lb" onDec={onDec} onInc={onInc} />);
    // Containers stay non-accessible (TalkBack reaches the buttons inside), so find them by label.
    expect(screen.getByLabelText('Weight').props.role).toBe('group');
    await fireEvent.press(screen.getByRole('button', { name: 'Less weight' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More weight' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More weight' }));
    expect(onDec).toHaveBeenCalledTimes(1);
    expect(onInc).toHaveBeenCalledTimes(2);
    expect(screen.getByText('12.0')).toBeOnTheScreen();
    expect(screen.getByText(' lb')).toBeOnTheScreen();
  });

  test('a disabled end does nothing and says it is disabled', async () => {
    const onDec = jest.fn();
    const onInc = jest.fn();
    await render(<Stepper label="Weight" value="0.5" onDec={onDec} onInc={onInc} decDisabled />);
    const less = screen.getByRole('button', { name: 'Less weight' });
    expect(less).toBeDisabled();
    await fireEvent.press(less);
    expect(onDec).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'More weight' })).toBeEnabled();
  });

  test('the buttons can have their own names (Cook options: Earlier / Later, T-074)', async () => {
    const onDec = jest.fn();
    const onInc = jest.fn();
    await render(<Stepper label="Shift" decLabel="Earlier" incLabel="Later" value="0" onDec={onDec} onInc={onInc} />);
    expect(screen.getByLabelText('Shift').props.role).toBe('group');
    await fireEvent.press(screen.getByRole('button', { name: 'Earlier' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    expect(onDec).toHaveBeenCalledTimes(1);
    expect(onInc).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /shift/i })).toBeNull();
  });
});

describe('Chips', () => {
  test('one radio is checked; pressing another reports its id', async () => {
    const onChange = jest.fn();
    await render(<Chips label="Units" options={opts} value="f" onChange={onChange} />);
    expect(screen.getByLabelText('Units').props.role).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'F' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'C' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'C' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  test('a disabled chip cannot be picked', async () => {
    const onChange = jest.fn();
    await render(<Chips label="Units" options={opts} value="f" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'K' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('scrolling and small chips keep the same roles', async () => {
    await render(
      <>
        <Chips label="Scroll" options={opts} value="c" onChange={() => {}} scroll />
        <Chips label="Small" options={opts} value="c" onChange={() => {}} small />
      </>,
    );
    expect(screen.getByLabelText('Scroll').props.role).toBe('radiogroup');
    expect(screen.getAllByRole('radio', { name: 'C', checked: true })).toHaveLength(2);
  });

  test('a hint shows under the label', async () => {
    await render(
      <Chips label="Sizes" options={[{ id: 'a', label: 'Small', hint: '3 lb' }]} value="a" onChange={() => {}} />,
    );
    expect(screen.getByText('3 lb')).toBeOnTheScreen();
  });
});

test('Segmented selects one option and reports the pressed one', async () => {
  const onChange = jest.fn();
  await render(<Segmented label="Timing" options={opts} value="c" onChange={onChange} />);
  expect(screen.getByRole('radio', { name: 'C' })).toBeChecked();
  await fireEvent.press(screen.getByRole('radio', { name: 'F' }));
  expect(onChange).toHaveBeenCalledWith('f');
  await fireEvent.press(screen.getByRole('radio', { name: 'K' }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('IconButton is a labeled button', async () => {
  const onPress = jest.fn();
  await render(
    <IconButton label="Close" onPress={onPress}>
      <Close />
    </IconButton>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onPress).toHaveBeenCalled();
});

test('Field shows its label, control and note', async () => {
  await render(
    <Field label="Name" note="Shown on the plan.">
      <Text>control</Text>
    </Field>,
  );
  expect(screen.getByText('Name')).toBeOnTheScreen();
  expect(screen.getByText('control')).toBeOnTheScreen();
  expect(screen.getByText('Shown on the plan.')).toBeOnTheScreen();
});

// Regression (T-082, 2026-11-19): on Setup's smoker card "Other" broke onto two lines at 115% ("Othe" / "r")
// and at 130%. Five equal segments left about 40 dp for a word that needs about 47 dp. Jason: no segment label
// ever breaks or is cut at any font scale; segments stay equal when every label fits, otherwise each takes
// the width its label needs and the others give up their spare room.
describe('Segmented: no label breaks or is cut', () => {
  const steps = ['5F', '10F', '15F', '25F', 'Other'].map(label => ({ id: label.toLowerCase(), label }));
  type Seg = {
    flexBasis?: number;
    flexGrow?: number;
    flexShrink?: number;
    width?: number;
    paddingHorizontal?: number;
    fontWeight?: string;
  };
  const styleOf = (node: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(node.props.style as never) ?? {}) as Seg;
  const layout = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 48 } } });
  /** What the phone reports: the control's width and each label's own width (the wider of its two weights). */
  const measure = async (row: number, labels: Record<string, number>) => {
    await fireEvent(screen.getByLabelText('Steps'), 'layout', layout(row));
    for (const [id, w] of Object.entries(labels)) {
      await fireEvent(screen.getByTestId(`segment-size-${id}`, { includeHiddenElements: true }), 'layout', layout(w));
    }
  };
  const seg = (label: string) => styleOf(screen.getByRole('radio', { name: label }));
  /** A segment's own fixed width, or null while it shares the row equally with the other free ones. */
  const fixed = () => steps.map(o => (seg(o.label).flexGrow === 0 ? seg(o.label).width : null));

  test('every label is measured by unseen copies in both weights; one copy shows', async () => {
    await render(<Segmented label="Steps" options={steps} value="5f" onChange={() => {}} />);
    for (const o of steps) {
      const copies = screen.getAllByText(o.label, { includeHiddenElements: true });
      expect(copies.map(c => styleOf(c).fontWeight)).toEqual(['500', '400', o.id === '5f' ? '500' : '400']);
      expect(screen.getAllByText(o.label)).toHaveLength(1);
    }
  });

  test('when every label fits an equal share, the segments stay equal (Gear at 115%)', async () => {
    await render(<Segmented label="Steps" options={steps} value="5f" onChange={() => {}} />);
    // 326 dp wide: an equal share is 64.8 dp, and Other needs 41 + 16 + 1 = 58.
    await measure(326, { '5f': 18.7, '10f': 28, '15f': 28, '25f': 28, other: 40.7 });
    expect(fixed()).toEqual([null, null, null, null, null]);
  });

  test('a label that needs more than an equal share takes what it needs; the others share the rest (Setup at 115%)', async () => {
    await render(<Segmented label="Steps" options={steps} value="5f" onChange={() => {}} />);
    // 282 dp wide: an equal share is 56 dp, and Other needs 41 (rounded up) + 8 either side + the 1 dp divider.
    await measure(282, { '5f': 18.7, '10f': 28, '15f': 28, '25f': 28, other: 40.7 });
    expect(fixed()).toEqual([null, null, null, null, 58]);
    expect(seg('Other')).toMatchObject({ flexGrow: 0, flexShrink: 0, paddingHorizontal: 8 });
  });

  test('fixing one segment can leave another short of its share: it takes what it needs too', () => {
    // 250 dp: an equal share is 49.6. The 60 dp label needs 77; the other four then share 171, 42.75 each,
    // and the 30 dp labels need 47, so they are fixed as well; the two short labels share the last 77.
    expect(segmentFit([10, 10, 30, 30, 60], 250)).toEqual({ pad: 8, width: [null, null, 47, 47, 77] });
  });

  test('when the labels and full padding do not fit, the padding gives way, never the label', async () => {
    await render(<Segmented label="Steps" options={steps} value="5f" onChange={() => {}} />);
    // 200% on Setup's card: labels 36 + 54 * 3 + 82 = 280 dp; 290 less 2 of border and 4 of dividers leaves 4.
    await measure(290, { '5f': 36, '10f': 54, '15f': 54, '25f': 54, other: 82 });
    // No room for padding. Other takes 83; the 54 dp labels need 55 of a 51 dp share, so they are fixed too.
    expect(fixed()).toEqual([null, 55, 55, 55, 83]);
    for (const o of steps) expect(seg(o.label).paddingHorizontal).toBe(0);
  });

  test('before the phone has measured anything, segments are as before: equal, with full padding', async () => {
    await render(<Segmented label="Steps" options={steps} value="5f" onChange={() => {}} />);
    expect(fixed()).toEqual([null, null, null, null, null]);
    for (const o of steps) {
      expect(seg(o.label)).toMatchObject({ flexGrow: 1, flexShrink: 1, width: 0, paddingHorizontal: 8 });
      // Never a flex basis: React Native keeps the first one it works out, so a later one would do nothing.
      expect(seg(o.label).flexBasis).toBeUndefined();
    }
  });
});

describe('Chips keep their width when selected (T-017 PR-3)', () => {
  const types = ['All', 'Pellet', 'Kamado', 'Offset', 'Drum', 'Gravity', 'Electric'].map(label => ({
    id: label.toLowerCase(),
    label,
  }));
  const weightOf = (node: { props: { style?: unknown } }) =>
    StyleSheet.flatten(node.props.style as never) as { fontWeight?: string };

  // Regression (T-066, 2026-11-19): at 115% the smoker picker's chip read "Kamad". The chip was sized by the
  // medium copy alone, and in Roboto the regular "Kamado" is a hair wider than the medium one, so the label
  // that shows broke onto a second, hidden line. Neither weight is always the wider: the chip is sized by both.
  test('every chip is sized by unseen copies of its label in both weights, so no label is cut off', async () => {
    await render(<Chips label="Plan from" value="a" onChange={() => {}} options={opts} />);
    for (const o of opts) {
      // Three copies: the two unseen ones that size the chip (medium, then regular) and the one that shows.
      const copies = screen.getAllByText(o.label, { includeHiddenElements: true });
      expect(copies).toHaveLength(3);
      expect(weightOf(copies[0]!).fontWeight).toBe('500');
      expect(weightOf(copies[1]!).fontWeight).toBe('400');
      expect(weightOf(copies[2]!).fontWeight).toBe(o.id === 'a' ? '500' : '400');
      // Only one of them is there for a screen reader or a text query.
      expect(screen.getAllByText(o.label)).toHaveLength(1);
    }
  });

  test('a scrolling row sizes its chips the same way', async () => {
    await render(<Chips scroll label="Smoker type" value="all" onChange={() => {}} options={types} />);
    const copies = screen.getAllByText('Kamado', { includeHiddenElements: true });
    expect(copies.map(c => weightOf(c).fontWeight)).toEqual(['500', '400', '400']);
    expect(screen.getAllByText('Kamado')).toHaveLength(1);
  });
});

describe('SelectField', () => {
  test('is one button named by its label, showing the value and what trails it; a press opens the menu', async () => {
    const onPress = jest.fn();
    await render(
      <SelectField label="Smoker temp" value="225F" trailing={<Text>Fire 6:20 AM</Text>} onPress={onPress} />,
    );
    const field = screen.getByRole('button', { name: 'Smoker temp' });
    expect(field).toHaveTextContent('Smoker temp225FFire 6:20 AM');
    expect(field).toBeCollapsed();
    await fireEvent.press(field);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('without onPress it is a read-only field, not a button', async () => {
    await render(<SelectField label="Hopper" value="21 lb" />);
    expect(screen.getByText('21 lb')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ChoiceCards', () => {
  const cards = [
    {
      id: 'keep',
      title: (
        <Text>
          Keep serve at <Num>5:00 PM</Num>
        </Text>
      ),
      subtitle: 'use up hold time',
    },
    { id: 'move', title: <Text>Move serve</Text> },
  ];

  test('one card is checked, read as its title and subtitle; pressing another reports its id', async () => {
    const onChange = jest.fn();
    await render(<ChoiceCards label="Serve time" options={cards} value="keep" onChange={onChange} />);
    expect(screen.getByLabelText('Serve time').props.role).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'Keep serve at 5:00 PM use up hold time' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Move serve' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Move serve' }));
    expect(onChange).toHaveBeenCalledWith('move');
  });

  test('the selected card has the accent border; the text wraps and is never cut', async () => {
    await render(<ChoiceCards label="Serve time" options={cards} value="keep" onChange={jest.fn()} />);
    expect(screen.getByRole('radio', { name: /^Keep serve/ }).props.className).toContain('border-ember');
    expect(screen.getByRole('radio', { name: 'Move serve' }).props.className).not.toContain('border-ember');
    expect(screen.getByText('use up hold time').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('5:00 PM').props.numberOfLines).toBeUndefined();
  });
});
