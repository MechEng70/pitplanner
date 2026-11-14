import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type TextStyle } from 'react-native';
import { ResultBar } from './ResultBar';

const cells = [
  { label: 'Fire', value: '6:20 AM' },
  { label: 'Off heat', value: '3:40 PM' },
  { label: 'Serve', value: '5:00 PM' },
];

test('one button that reads every cell and reports a tap', async () => {
  const onPress = jest.fn();
  await render(<ResultBar cells={cells} onPress={onPress} />);
  const bar = screen.getByRole('button', { name: 'Fire 6:20 AM, Off heat 3:40 PM, Serve 5:00 PM' });
  await fireEvent.press(bar);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('values are tabular, unbreakable and never cut, so a changing time keeps its place', async () => {
  await render(<ResultBar cells={cells} onPress={() => {}} />);
  const value = screen.getByText('6:20 AM');
  expect((StyleSheet.flatten(value.props.style) as TextStyle).fontVariant).toEqual(['tabular-nums']);
  expect(value.props.numberOfLines).toBeUndefined();
});
