import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
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

// Regression (T-006 device test sheet-keyboard): edge-to-edge, the Modal window does not resize for the
// keyboard, so a focused field low in the sheet and the pinned footer ended up under it.
test('the open keyboard lifts the sheet and shortens it by the keyboard height', async () => {
  const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((name, fn) => {
    handlers[name] = fn as (typeof handlers)[string];
    return { remove: () => {} } as ReturnType<typeof Keyboard.addListener>;
  });
  await render(
    <Sheet title="Griddle" onClose={() => {}} footer={<Text>Save</Text>}>
      <Text>Body</Text>
    </Sheet>,
  );
  const frameOf = () => StyleSheet.flatten(screen.getByLabelText('Griddle').props.style) as ViewStyle;
  const maxOf = () => (StyleSheet.flatten(screen.getByTestId('sheet-frame').props.style) as ViewStyle).maxHeight;
  expect(frameOf().marginBottom ?? 0).toBe(0);
  const closedMax = maxOf() as number;

  await act(() => handlers.keyboardDidShow({ endCoordinates: { height: 278 } }));
  expect(frameOf().marginBottom).toBe(278);
  expect(maxOf()).toBe(closedMax - 278);

  await act(() => handlers.keyboardDidHide({ endCoordinates: { height: 0 } }));
  expect(frameOf().marginBottom ?? 0).toBe(0);
  expect(maxOf()).toBe(closedMax);
  spy.mockRestore();
});

// Regression (T-006 on the emulator): React Native's keyboard height leaves out the navigation bar inset, so
// with a navigation bar (the emulator's; the phone's gesture bar is 0 dp) the sheet lifted 24 dp short and
// Save sat under the keyboard.
test('the lift includes the bottom inset under the keyboard (navigation bar)', async () => {
  const insets = jest.spyOn(SafeArea, 'useSafeAreaInsets').mockReturnValue({ top: 24, left: 0, right: 0, bottom: 24 });
  const handlers: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
  const kb = jest.spyOn(Keyboard, 'addListener').mockImplementation((name, fn) => {
    handlers[name] = fn as (typeof handlers)[string];
    return { remove: () => {} } as ReturnType<typeof Keyboard.addListener>;
  });
  await render(
    <Sheet title="Griddle" onClose={() => {}} footer={<Text>Save</Text>}>
      <Text>Body</Text>
    </Sheet>,
  );
  const frame = () => StyleSheet.flatten(screen.getByTestId('sheet-frame').props.style) as ViewStyle;
  const dialog = () => StyleSheet.flatten(screen.getByLabelText('Griddle').props.style) as ViewStyle;
  expect(frame().paddingBottom).toBe(24);
  const closedMax = frame().maxHeight as number;
  await act(() => handlers.keyboardDidShow({ endCoordinates: { height: 278 } }));
  expect(dialog().marginBottom).toBe(278 + 24);
  expect(frame().paddingBottom).toBe(0);
  expect(frame().maxHeight).toBe(closedMax - (278 + 24));
  kb.mockRestore();
  insets.mockRestore();
});
