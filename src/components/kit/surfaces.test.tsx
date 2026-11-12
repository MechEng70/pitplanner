import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Avatar, Banner, Card, EmptyState, GroupCard, IconAvatar, InfoBox, ResultCard, Tile, Tiles } from './surfaces';
import { Bell } from './icons';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

test.each([
  ['smoker', colors.accent],
  ['griddle', colors.griddle],
  ['oven', colors.text1],
] as const)('Avatar shows the %s icon in its color (T-017 PR-2)', async (kind, color) => {
  await render(<Avatar kind={kind} />);
  // Icons are hidden from TalkBack (decoration), so include hidden elements.
  const icon = screen.getByTestId(`cooker-icon-${kind}`, { includeHiddenElements: true });
  expect(icon.props.stroke).toBe(color);
});

test('IconAvatar gives its icon the tone color', async () => {
  await render(
    <IconAvatar tone="ok">
      <Bell testID="bell" />
    </IconAvatar>,
  );
  expect(screen.getByTestId('bell', { includeHiddenElements: true }).props.stroke).toBe(colors.ok);
});

test('Tile shows label, a tabular value and its note; with onPress it is a button', async () => {
  const onPress = jest.fn();
  await render(
    <Tiles>
      <Tile label="Fire" value="6:20 AM" sub="Sat" />
      <Tile label="Pellets" value="14 lb" tone="warn" onPress={onPress} />
    </Tiles>,
  );
  expect(StyleSheet.flatten(screen.getByText('6:20 AM').props.style)).toMatchObject({
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  });
  expect(screen.getByText('Sat')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: /Pellets/ }));
  expect(onPress).toHaveBeenCalled();
});

test('Card with onPress is one labeled button; without it, not a button', async () => {
  const onPress = jest.fn();
  await render(
    <>
      <Card onPress={onPress} label="Brisket">
        <Text>Brisket</Text>
      </Card>
      <Card tone="inset">
        <Text>Plain</Text>
      </Card>
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Brisket' }));
  expect(onPress).toHaveBeenCalled();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

test('Banner is an alert with its action', async () => {
  await render(<Banner action={<Text>Fix</Text>}>Alerts are off.</Banner>);
  expect(screen.getByRole('alert', { name: 'Alerts are off.' })).toBeOnTheScreen();
  expect(screen.getByText('Fix')).toBeOnTheScreen();
});

test('InfoBox, ResultCard and EmptyState show their parts', async () => {
  await render(
    <>
      <InfoBox lead="Smoker busy">Ribs wait 30 min.</InfoBox>
      <ResultCard overline="FIRE THE SMOKER" title="6:20 AM">
        <Text>225F</Text>
      </ResultCard>
      <EmptyState icon={<Bell />} title="Nothing planned" body="Add food to plan a cook." />
    </>,
  );
  for (const t of [
    'Smoker busy',
    'Ribs wait 30 min.',
    'FIRE THE SMOKER',
    '6:20 AM',
    '225F',
    'Add food to plan a cook.',
  ])
    expect(screen.getByText(t)).toBeOnTheScreen();
  expect(screen.getByRole('heading', { name: 'Nothing planned' })).toBeOnTheScreen();
});

test('GroupCard puts a hairline between rows, not before the first', async () => {
  const { toJSON } = await render(
    <GroupCard>
      <Text>One</Text>
      <Text>Two</Text>
      <Text>Three</Text>
      {null}
    </GroupCard>,
  );
  const card = toJSON() as { children: { type: string }[] };
  expect(card.children.map(c => c.type)).toEqual(['Text', 'View', 'Text', 'View', 'Text']);
});
