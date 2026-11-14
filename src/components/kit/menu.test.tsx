import { fireEvent, render, screen, within } from '@testing-library/react-native';
import tailwind from '../../../tailwind.config.js';
import { SelectField } from './controls';
import { Menu, MenuRow } from './menu';
import { SearchField } from './input';
import { GroupLabel } from './rows';
import { Text } from '@/components/ui/text';

const anchor = { x: 16, y: 150, width: 328, height: 60 };

test('Menu shows its field, intro, rows and footer; the selected row is marked', async () => {
  const onPick = jest.fn();
  await render(
    <Menu
      anchor={anchor}
      onClose={jest.fn()}
      field={<Text>the field</Text>}
      intro={<Text>Sets in 5F steps.</Text>}
      footer={<Text>Show all</Text>}
    >
      <MenuRow label="220F" trailing="fire 6:00 AM" onPress={() => onPick(220)} />
      <MenuRow selected label="225F" trailing="fire 6:20 AM" onPress={() => onPick(225)} />
    </Menu>,
  );
  expect(screen.getByText('the field')).toBeOnTheScreen();
  expect(screen.getByText('Sets in 5F steps.')).toBeOnTheScreen();
  expect(screen.getByText('Show all')).toBeOnTheScreen();
  const rows = screen.getAllByRole('option');
  expect(rows).toHaveLength(2);
  expect(rows[0]).not.toBeSelected();
  expect(rows[1]).toBeSelected();
  expect(within(rows[1]!).getByText('fire 6:20 AM')).toBeOnTheScreen();
  await fireEvent.press(rows[0]!);
  expect(onPick).toHaveBeenCalledWith(220);
});

test('Menu sits under its anchor, as wide as it, with the field over the anchor', async () => {
  await render(
    <Menu anchor={anchor} onClose={jest.fn()} field={<Text>the field</Text>}>
      <MenuRow label="225F" onPress={jest.fn()} />
    </Menu>,
  );
  expect(screen.getByTestId('menu-anchor')).toHaveStyle({ top: 150, left: 16, width: 328 });
  expect(screen.getByTestId('menu')).toHaveStyle({ top: 218, left: 16, width: 328 });
});

test('Menu closes from the scrim and from Android back', async () => {
  const onClose = jest.fn();
  await render(
    <Menu anchor={anchor} onClose={onClose} field={<Text>the field</Text>}>
      <MenuRow label="225F" onPress={jest.fn()} />
    </Menu>,
  );
  await fireEvent.press(screen.getByLabelText('Close menu'));
  expect(onClose).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId('menu-modal'), 'requestClose');
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('SearchField is named by its placeholder and reports what is typed', async () => {
  const onInput = jest.fn();
  await render(<SearchField placeholder="Search foods" value="" onInput={onInput} />);
  const input = screen.getByLabelText('Search foods');
  expect(input.props.placeholder).toBe('Search foods');
  await fireEvent.changeText(input, 'rib');
  expect(onInput).toHaveBeenCalledWith('rib');
});

test('GroupLabel is a heading', async () => {
  await render(<GroupLabel label="Beef" />);
  expect(screen.getByRole('heading', { name: 'Beef' })).toBeOnTheScreen();
});

// Regression (T-018, emulator): the opened field used a class the theme does not have (`bg-field-open`), so it
// had no fill and the field under the menu's scrim showed through it (its fire time, dimmed).
test('an open SelectField has the theme fill, so nothing under it shows through', async () => {
  await render(<SelectField open label="Smoker temp" value="225F" onPress={jest.fn()} />);
  const classes = String(screen.getByRole('button', { name: 'Smoker temp' }).props.className).split(' ');
  expect(classes).toContain('bg-field');
  expect(Object.keys(tailwind.theme?.colors ?? {})).toContain('field');
});
