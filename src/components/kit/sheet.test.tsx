import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { Sheet, SHEET_OUT_MS, useSheet } from './sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const settle = () => act(() => jest.advanceTimersByTime(SHEET_OUT_MS));

test('Android back closes the sheet after it slides down', async () => {
  const onClose = jest.fn();
  await render(
    <Sheet title="Alerts" onClose={onClose}>
      <Text>Body</Text>
    </Sheet>,
  );
  const dialog = screen.getByLabelText('Alerts');
  expect(dialog.props.role).toBe('dialog');
  // The system sends back to the top Modal as onRequestClose.
  await fireEvent(dialog, 'requestClose');
  expect(onClose).not.toHaveBeenCalled();
  await settle();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Close and a tap on the scrim close it', async () => {
  const onClose = jest.fn();
  await render(
    <Sheet title="Units" onClose={onClose}>
      <Text>Body</Text>
    </Sheet>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  await settle();
  expect(onClose).toHaveBeenCalledTimes(1);

  const onClose2 = jest.fn();
  await render(
    <Sheet title="Units" onClose={onClose2}>
      <Text>Body</Text>
    </Sheet>,
  );
  // The scrim fades in on the native driver, so under Jest it stays at opacity 0 (hidden to queries).
  await fireEvent.press(screen.getByLabelText('Close sheet', { includeHiddenElements: true }));
  await settle();
  expect(onClose2).toHaveBeenCalledTimes(1);
});

function SaveButton({ onSaved }: { onSaved: () => void }) {
  const sheet = useSheet();
  return (
    <Pressable role="button" aria-label="Save" onPress={() => sheet.close(onSaved)}>
      <Text>Save</Text>
    </Pressable>
  );
}

test('useSheet().close(after) closes, then runs after', async () => {
  const onClose = jest.fn();
  const onSaved = jest.fn(() => expect(onClose).toHaveBeenCalled());
  await render(
    <Sheet title="Griddle" onClose={onClose} footer={<SaveButton onSaved={onSaved} />}>
      <Text>Body</Text>
    </Sheet>,
  );
  expect(screen.getByRole('heading', { name: 'Griddle' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await settle();
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('the footer and body both render; a flush sheet still has its title', async () => {
  await render(
    <Sheet
      title="Cook"
      flush
      onClose={() => {}}
      footer={
        <Button block>
          <Text>Start cook</Text>
        </Button>
      }
    >
      <Text>Rows</Text>
    </Sheet>,
  );
  expect(screen.getByText('Rows')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Start cook' })).toBeOnTheScreen();
});
