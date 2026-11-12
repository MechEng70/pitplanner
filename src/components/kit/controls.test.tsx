import { fireEvent, render, screen } from '@testing-library/react-native';
import { Chips, Field, IconButton, Segmented, Stepper } from './controls';
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
