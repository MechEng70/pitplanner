import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, View } from 'react-native';
import { ActionRow, CheckRow, ListRow, StatusRow } from './rows';
import { IconColor, StopSquare } from './icons';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

test('CheckRow toggles: pressing reports the opposite of checked', async () => {
  const onChange = jest.fn();
  const { rerender } = await render(
    <CheckRow title="Griddle" subtitle="Blackstone 36" checked={false} onChange={onChange} />,
  );
  const row = screen.getByRole('checkbox', { name: 'Griddle' });
  expect(row).not.toBeChecked();
  await fireEvent.press(row);
  expect(onChange).toHaveBeenLastCalledWith(true);
  await rerender(<CheckRow title="Griddle" checked onChange={onChange} />);
  expect(screen.getByRole('checkbox', { name: 'Griddle' })).toBeChecked();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Griddle' }));
  expect(onChange).toHaveBeenLastCalledWith(false);
});

test('StatusRow shows On when ok, otherwise its action', async () => {
  const { rerender } = await render(<StatusRow title="Notifications" subtitle="Step alerts" ok />);
  expect(screen.getByText('On')).toBeOnTheScreen();
  await rerender(
    <StatusRow
      title="Notifications"
      ok={false}
      action={
        <Button kind="tonal">
          <Text>Allow</Text>
        </Button>
      }
    />,
  );
  expect(screen.queryByText('On')).toBeNull();
  expect(screen.getByRole('button', { name: 'Allow' })).toBeOnTheScreen();
});

test('ListRow: onPress makes it a button, href a link that opens the browser, neither a plain row', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const onPress = jest.fn();
  await render(
    <>
      <ListRow title="Cook rates" subtitle="3 saved" onPress={onPress} />
      <ListRow title="Support" href="https://example.org/support" />
      <ListRow title="Version 0.3.0" />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: /Cook rates/ }));
  expect(onPress).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('link', { name: /Support/ }));
  expect(open).toHaveBeenCalledWith('https://example.org/support');
  expect(screen.queryByRole('button', { name: /Version/ })).toBeNull();
  expect(screen.getByText('Version 0.3.0')).toBeOnTheScreen();
});

test('ListRow subtitle is one line unless wrap', async () => {
  await render(
    <>
      <ListRow title="A" subtitle="one line" />
      <ListRow title="B" subtitle="wraps" wrap />
    </>,
  );
  expect(screen.getByText('one line').props.numberOfLines).toBe(1);
  expect(screen.getByText('wraps').props.numberOfLines).toBeUndefined();
});

/** Stands in for an icon: shows the color an icon without its own would draw in. */
function IconProbe() {
  return <IconColor.Consumer>{c => <View testID="icon" accessibilityValue={{ text: c }} />}</IconColor.Consumer>;
}
const iconColor = () => screen.getByTestId('icon', { includeHiddenElements: true }).props.accessibilityValue.text;

test('ActionRow is one button with its title and what it does; danger draws the title and icon in the error color', async () => {
  const onPress = jest.fn();
  const { rerender } = await render(
    <ActionRow icon={<IconProbe />} title="Start over" subtitle="Back to Plan with the same menu" onPress={onPress} />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Start over Back to Plan with the same menu' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Start over').props.className).not.toContain('text-error');
  expect(iconColor()).toBe(colors.text1);

  await rerender(<ActionRow icon={<IconProbe />} title="End cook" onPress={onPress} tone="danger" />);
  expect(screen.getByText('End cook').props.className).toContain('text-error');
  expect(iconColor()).toBe(colors.error);
  // The subtitle wraps, it is never cut.
  await rerender(<ActionRow icon={<StopSquare />} title="Pit went out" subtitle="Stops the clock" onPress={onPress} />);
  expect(screen.getByText('Stops the clock').props.numberOfLines).toBeUndefined();
});
