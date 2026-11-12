import { fireEvent, render, screen } from '@testing-library/react-native';
import { InputField } from './input';

describe('InputField', () => {
  test('shows its label and note, reports typed text and is found by its label', async () => {
    const onInput = jest.fn();
    await render(<InputField label="Name" value="" placeholder="Griddle" note="Shown on Plan." onInput={onInput} />);
    expect(screen.getByText('Name')).toBeOnTheScreen();
    expect(screen.getByText('Shown on Plan.')).toBeOnTheScreen();
    const input = screen.getByLabelText('Name');
    expect(input.props.placeholder).toBe('Griddle');
    await fireEvent.changeText(input, 'Blackstone');
    expect(onInput).toHaveBeenCalledWith('Blackstone');
  });

  test('numeric fields open the decimal keyboard and use tabular digits', async () => {
    await render(<InputField label="Weight" value="12.5" numeric onInput={() => {}} />);
    const input = screen.getByLabelText('Weight');
    expect(input.props.keyboardType).toBe('decimal-pad');
    expect(input.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontVariant: ['tabular-nums'] })]),
    );
  });

  test('the border turns accent while focused (ui.css .input:focus)', async () => {
    await render(<InputField label="Name" value="" onInput={() => {}} />);
    const input = screen.getByLabelText('Name');
    await fireEvent(input, 'focus');
    expect(screen.getByLabelText('Name').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderWidth: 2 })]),
    );
    await fireEvent(screen.getByLabelText('Name'), 'blur');
    expect(screen.getByLabelText('Name').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderWidth: 1 })]),
    );
  });
});
