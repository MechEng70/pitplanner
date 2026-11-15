import { fireEvent, render, screen } from '@testing-library/react-native';
import { InputField, TextArea } from './input';

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

describe('TextArea', () => {
  test('takes several lines, shows its placeholder, reports typed text and is found by its label', async () => {
    const onInput = jest.fn();
    await render(
      <TextArea
        label="Notes for next time"
        value=""
        placeholder="Wind, wood, what you would change"
        onInput={onInput}
      />,
    );
    const box = screen.getByLabelText('Notes for next time');
    expect(box.props.multiline).toBe(true);
    expect(box.props.placeholder).toBe('Wind, wood, what you would change');
    // At least 56 dp, and it grows with what is typed: no fixed height, no line limit.
    expect(box).toHaveStyle({ minHeight: 56 });
    expect(box.props.numberOfLines).toBeUndefined();
    await fireEvent.changeText(box, 'Windy');
    expect(onInput).toHaveBeenCalledWith('Windy');
  });

  test('the border turns accent while focused (ui.css .textarea:focus)', async () => {
    await render(<TextArea label="Notes" value="" placeholder="" onInput={() => {}} />);
    await fireEvent(screen.getByLabelText('Notes'), 'focus');
    expect(screen.getByLabelText('Notes')).toHaveStyle({ borderWidth: 2 });
    await fireEvent(screen.getByLabelText('Notes'), 'blur');
    expect(screen.getByLabelText('Notes')).toHaveStyle({ borderWidth: 1 });
  });
});
