import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Num, numText } from './num';
import { Text } from '@/components/ui/text';

const styleOf = (el: ReturnType<typeof screen.getByText>) => StyleSheet.flatten(el.props.style);

test('Num renders tabular digits, so a changing value keeps its width (T-017 PR-3)', async () => {
  await render(<Num>6:20 AM</Num>);
  expect(styleOf(screen.getByText('6:20 AM'))).toMatchObject({ fontVariant: ['tabular-nums'] });
});

test('Num never breaks: spaces become no-break spaces', () => {
  expect(numText('1 hr 40 min')).toBe('1 hr 40 min');
  expect(numText(['12.0', ' lb'])).toBe('12.0 lb');
  expect(numText(225)).toBe('225');
});

test('Num is never clamped, shrunk or capped', async () => {
  await render(<Num variant="countdown">45 hr 50 min</Num>);
  const n = screen.getByText('45 hr 50 min');
  expect(n.props.numberOfLines).toBeUndefined();
  expect(n.props.adjustsFontSizeToFit).toBeUndefined();
  expect(n.props.maxFontSizeMultiplier).toBeUndefined();
  expect(n.props.allowFontScaling).not.toBe(false);
});

test('Num inside a Text takes its type and tone, like CSS inheritance', async () => {
  await render(
    <Text variant="title" tone="accent">
      Fire at <Num>6:20 AM</Num>
    </Text>,
  );
  const n = screen.getByText('6:20 AM');
  expect(styleOf(n)).toMatchObject({ fontSize: 22, fontWeight: '500', fontVariant: ['tabular-nums'] });
  expect(n.props.className).toContain('text-ember');
});

test('a clamped Text is one line; relaxed text gets the 1.4 line height', async () => {
  await render(
    <>
      <Text clamp>Secondary</Text>
      <Text variant="label" relaxed>
        Note
      </Text>
    </>,
  );
  expect(screen.getByText('Secondary').props.numberOfLines).toBe(1);
  expect(styleOf(screen.getByText('Note'))).toMatchObject({ fontSize: 13, lineHeight: 18 });
});
