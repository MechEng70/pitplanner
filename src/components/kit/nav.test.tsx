import { fireEvent, render, screen } from '@testing-library/react-native';
import { BottomNav } from './nav';
import { ListIcon, Sliders, Timer } from './icons';

const items = [
  { id: 'plan', label: 'Plan', icon: <ListIcon testID="icon-plan" /> },
  { id: 'cook', label: 'Cook', icon: <Timer testID="icon-cook" /> },
  { id: 'gear', label: 'Gear', icon: <Sliders testID="icon-gear" /> },
];

describe('BottomNav', () => {
  test('every tab shows its icon and label; the open one is selected', async () => {
    await render(<BottomNav items={items} value="cook" onChange={() => {}} />);
    for (const id of ['plan', 'cook', 'gear'])
      expect(screen.getByTestId(`icon-${id}`, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Cook' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Plan' })).not.toBeSelected();
    expect(screen.getByText('Gear')).toBeOnTheScreen();
  });

  test('a tap reports the tab', async () => {
    const onChange = jest.fn();
    await render(<BottomNav items={items} value="plan" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Gear' }));
    expect(onChange).toHaveBeenCalledWith('gear');
  });

  test('items grow with the font (min height, no fixed height) so labels are never cut', async () => {
    await render(<BottomNav items={items} value="plan" onChange={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Plan' });
    expect(tab.props.className ?? '').toContain('min-h-20');
    expect(tab.props.className ?? '').not.toMatch(/(^|\s)h-\d/);
  });
});
