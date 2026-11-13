import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Chips, Field, IconButton, Segmented, SelectField, Stepper } from './controls';
import { Close } from './icons';
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

describe('Chips keep their width when selected (T-017 PR-3)', () => {
  const weightOf = (node: { props: { style?: unknown } }) =>
    StyleSheet.flatten(node.props.style as never) as { fontWeight?: string };

  test('every chip is sized by an unseen copy of its label in the selected weight', async () => {
    await render(<Chips label="Plan from" value="a" onChange={() => {}} options={opts} />);
    for (const o of opts) {
      // Two copies: the unseen one that sizes the chip (always medium) and the one that shows.
      const copies = screen.getAllByText(o.label, { includeHiddenElements: true });
      expect(copies).toHaveLength(2);
      expect(weightOf(copies[0]!).fontWeight).toBe('500');
      expect(weightOf(copies[1]!).fontWeight).toBe(o.id === 'a' ? '500' : '400');
      // Only one of them is there for a screen reader or a text query.
      expect(screen.getAllByText(o.label)).toHaveLength(1);
    }
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
