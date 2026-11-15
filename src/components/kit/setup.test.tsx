import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from '@/components/ui/text';
import { GroupLabel } from './rows';
import { DashedButton, OptionCard, PickRow, SetupActions, SetupPage } from './setup';

test('SetupPage shows the step, the title as the heading, the intro, its content and its footer', async () => {
  await render(
    <SetupPage
      step={2}
      steps={3}
      title="What do you cook on?"
      intro="You can change this later."
      footer={<Text>Foot</Text>}
    >
      <Text>Cookers</Text>
    </SetupPage>,
  );
  expect(screen.getByLabelText('Step 2 of 3')).toBeOnTheScreen();
  expect(screen.getAllByTestId('setup-step-on')).toHaveLength(2);
  expect(screen.getAllByTestId('setup-step-off')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'What do you cook on?' })).toBeOnTheScreen();
  expect(screen.getByText('You can change this later.')).toBeOnTheScreen();
  expect(screen.getByText('Cookers')).toBeOnTheScreen();
  expect(screen.getByText('Foot')).toBeOnTheScreen();
});

test('SetupActions: no Back on the first page; Back and the main action report their presses', async () => {
  const onBack = jest.fn();
  const onNext = jest.fn();
  const { rerender } = await render(<SetupActions next="Continue" onNext={onNext} />);
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(onNext).toHaveBeenCalledTimes(1);
  await rerender(<SetupActions onBack={onBack} next="Finish setup" onNext={onNext} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Finish setup' })).toBeEnabled();
});

test('SetupActions: a disabled main action does nothing', async () => {
  const onNext = jest.fn();
  await render(<SetupActions onBack={() => {}} next="Continue" onNext={onNext} disabled />);
  const next = screen.getByRole('button', { name: 'Continue' });
  expect(next).toBeDisabled();
  await fireEvent.press(next);
  expect(onNext).not.toHaveBeenCalled();
});

test('OptionCard: the header is a checkbox that toggles; the body stays when it is turned off', async () => {
  const onToggle = jest.fn();
  const { rerender } = await render(
    <OptionCard selected title="Pellet smoker" subtitle="Hopper and grate filled from the model" onToggle={onToggle}>
      <Text>Model</Text>
    </OptionCard>,
  );
  const head = screen.getByRole('checkbox', { name: 'Pellet smoker' });
  expect(head).toBeChecked();
  expect(screen.getByText('Hopper and grate filled from the model')).toBeOnTheScreen();
  await fireEvent.press(head);
  expect(onToggle).toHaveBeenCalledTimes(1);
  await rerender(
    <OptionCard selected={false} title="Pellet smoker" onToggle={onToggle}>
      <Text>Model</Text>
    </OptionCard>,
  );
  expect(screen.getByRole('checkbox', { name: 'Pellet smoker' })).not.toBeChecked();
  expect(screen.getByText('Model')).toBeOnTheScreen();
});

test('DashedButton is a button with its label', async () => {
  const onPress = jest.fn();
  await render(<DashedButton label="Add another cooker" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add another cooker' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('PickRow is an option, selected or not, and reports a press', async () => {
  const onPress = jest.fn();
  const { rerender } = await render(<PickRow label="Pit Boss 820" onPress={onPress} />);
  const row = screen.getByRole('option', { name: 'Pit Boss 820' });
  expect(row).not.toBeSelected();
  await fireEvent.press(row);
  expect(onPress).toHaveBeenCalledTimes(1);
  await rerender(<PickRow label="Pit Boss 820" selected onPress={onPress} />);
  expect(screen.getByRole('option', { name: 'Pit Boss 820' })).toBeSelected();
});

test('GroupLabel shows its note next to the heading', async () => {
  await render(<GroupLabel label="Pellet" note="Hopper alerts" />);
  expect(screen.getByRole('heading', { name: 'Pellet' })).toBeOnTheScreen();
  expect(screen.getByText('Hopper alerts')).toBeOnTheScreen();
});
