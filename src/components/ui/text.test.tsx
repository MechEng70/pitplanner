import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Button } from './button';
import { Text, textStyle } from './text';

const styleOf = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style);

test('text variants use Roboto at the token size, weight and line height', async () => {
  await render(
    <>
      <Text>Body</Text>
      <Text variant="title">Title</Text>
      <Text variant="countdown">Countdown</Text>
      <Text variant="body" weight="700">
        Bold
      </Text>
    </>,
  );
  expect(styleOf('Body')).toMatchObject({ fontFamily: 'Roboto', fontSize: 14, fontWeight: '400', lineHeight: 18 });
  expect(styleOf('Title')).toMatchObject({ fontFamily: 'Roboto', fontSize: 22, fontWeight: '500', lineHeight: 28 });
  expect(styleOf('Countdown')).toMatchObject({ fontFamily: 'Roboto', fontSize: 40, fontWeight: '500', lineHeight: 44 });
  expect(styleOf('Bold')).toMatchObject({ fontFamily: 'Roboto', fontSize: 14, fontWeight: '700' });
});

test('text never caps the system font scale', async () => {
  await render(<Text variant="value">225F</Text>);
  const t = screen.getByText('225F');
  expect(t.props.maxFontSizeMultiplier).toBeUndefined();
  expect(t.props.allowFontScaling).not.toBe(false);
  expect(t.props.numberOfLines).toBeUndefined();
});

test('button labels take the kind type from the 0.2.0 kit: primary 17/500, text 15/400', async () => {
  await render(
    <>
      <Button>
        <Text>Start cook</Text>
      </Button>
      <Button kind="text">
        <Text>Skip</Text>
      </Button>
      <Button kind="tonal">
        <Text variant="caption">Own variant wins</Text>
      </Button>
    </>,
  );
  expect(styleOf('Start cook')).toMatchObject({ fontFamily: 'Roboto', fontSize: 17, fontWeight: '500' });
  expect(styleOf('Skip')).toMatchObject({ fontSize: 15, fontWeight: '400' });
  expect(styleOf('Own variant wins')).toMatchObject({ fontSize: 12, fontWeight: '500' });
  expect(screen.getAllByRole('button')).toHaveLength(3);
});

test('textStyle falls back to the 1.25 line height', () => {
  expect(textStyle('bodyL')).toEqual({ fontFamily: 'Roboto', fontSize: 16, fontWeight: '400', lineHeight: 20 });
});

test('a disabled primary turns grey with a tertiary label; tones recolor outline and text labels', async () => {
  await render(
    <>
      <Button disabled>
        <Text>Start cook</Text>
      </Button>
      <Button kind="outline" tone="accent">
        <Text>Add food</Text>
      </Button>
      <Button kind="text" tone="danger">
        <Text>Remove</Text>
      </Button>
    </>,
  );
  const start = screen.getByRole('button', { name: 'Start cook' });
  expect(start).toBeDisabled();
  expect(start.props.className).toContain('bg-surface-2');
  expect(screen.getByText('Start cook').props.className).toContain('text-ink-3');
  expect(screen.getByText('Add food').props.className).toContain('text-ember');
  expect(screen.getByText('Remove').props.className).toContain('text-error');
});
