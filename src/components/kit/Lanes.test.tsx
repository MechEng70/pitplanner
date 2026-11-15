import { render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { Lanes, type Lane } from './Lanes';
import { BAND_FILL } from './surfaces';

const HR = 3_600_000;
const FROM = Date.UTC(2026, 10, 14, 15, 0); // 10 AM Eastern
const TO = FROM + 10 * HR;
const lanes: Lane[] = [
  {
    id: 'b',
    title: 'Brisket',
    subtitle: 'Smoker',
    segments: [
      { start: FROM - 3 * HR, end: FROM + 2 * HR, tone: 'smoke', label: 'smoke' },
      { start: FROM + 2 * HR, end: FROM + 7 * HR, tone: 'smoke2', label: 'wrapped' },
      { start: FROM + 7 * HR, end: FROM + 9 * HR, tone: 'hold', label: 'rest' },
    ],
  },
  {
    id: 'w',
    title: 'Wings',
    subtitle: 'Smoker',
    segments: [
      { start: FROM + 6.5 * HR, end: FROM + 9 * HR, tone: 'smoke', label: 'smoke' },
      { start: FROM + 9 * HR, end: FROM + 9.5 * HR, tone: 'hot', label: '400F' },
    ],
  },
  {
    id: 'c',
    title: 'Breasts',
    subtitle: 'Griddle',
    segments: [{ start: FROM + 9.5 * HR, end: FROM + 9.7 * HR, tone: 'griddle' }],
  },
  {
    id: 'old',
    title: 'Ribs',
    subtitle: 'Smoker',
    segments: [{ start: FROM - 5 * HR, end: FROM - HR, tone: 'smoke', label: 'smoke' }],
  },
];
const ticks = [
  { at: FROM, label: '10a' },
  { at: FROM + 2 * HR, label: '12p' },
  { at: TO, label: '8p' },
];
const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
const show = (props: Partial<React.ComponentProps<typeof Lanes>> = {}) =>
  render(<Lanes lanes={lanes} from={FROM} to={TO} now={FROM + HR} ticks={ticks} {...props} />);

test('each food has a lane with its name and cooker; phases sit at their share of the window', async () => {
  await show();
  for (const name of ['Brisket', 'Wings', 'Breasts', 'Griddle']) expect(screen.getByText(name)).toBeOnTheScreen();
  // A phase that began before the window is cut at its left edge.
  expect(style('seg-b-0')).toMatchObject({ left: '0%', width: '20%' });
  expect(style('seg-b-1')).toMatchObject({ left: '20%', width: '50%' });
  expect(style('seg-w-0')).toMatchObject({ left: '65%', width: '25%' });
  expect(screen.getByText('wrapped')).toBeOnTheScreen();
  expect(screen.getByText('rest')).toBeOnTheScreen();
});

test('a phase too narrow for its label has none, and a phase outside the window is not drawn', async () => {
  await show();
  expect(screen.getByTestId('seg-w-1')).toBeOnTheScreen();
  expect(screen.queryByText('400F')).toBeNull();
  expect(screen.queryByTestId('seg-old-0')).toBeNull();
});

test('the now line sits at the current time and is gone outside the window', async () => {
  const r = await show();
  expect(style('lane-now')).toMatchObject({ left: '10%' });
  await r.rerender(<Lanes lanes={lanes} from={FROM} to={TO} now={TO + HR} ticks={ticks} />);
  expect(screen.queryByTestId('lane-now', { includeHiddenElements: true })).toBeNull();
});

test('the band spans the lanes that share the smoker, from its start to its end', async () => {
  await show({ band: { start: FROM + 6.5 * HR, end: FROM + 7 * HR, laneIds: ['b', 'w'] } });
  // Two lanes from the first (46 dp each at the normal font size), 4 dp above and below them.
  const laneH = Math.round(46 * Math.max(1, Dimensions.get('window').fontScale));
  expect(style('lane-band')).toMatchObject({
    left: '65%',
    width: '5%',
    top: -4,
    height: 2 * laneH + 8,
    backgroundColor: BAND_FILL,
  });
});

test('no band for a single lane', async () => {
  await show({ band: { start: FROM, end: FROM + HR, laneIds: ['b'] } });
  expect(screen.queryByTestId('lane-band', { includeHiddenElements: true })).toBeNull();
});

test('ticks are numbers that never wrap: the first starts at the left edge, the last ends at the right edge', async () => {
  await show();
  for (const t of ['10a', '12p', '8p'])
    expect(StyleSheet.flatten(screen.getByText(t).props.style)).toMatchObject({ fontVariant: ['tabular-nums'] });
  expect(StyleSheet.flatten(screen.getByText('10a').props.style)).toMatchObject({ left: '0%' });
  expect(StyleSheet.flatten(screen.getByText('12p').props.style)).toMatchObject({
    left: '20%',
    transform: [{ translateX: '-50%' }],
  });
  expect(StyleSheet.flatten(screen.getByText('8p').props.style)).toMatchObject({ right: 0 });
});
