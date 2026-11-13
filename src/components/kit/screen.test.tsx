import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { IconButton } from './controls';
import { ShareIcon } from './icons';
import { Screen } from './screen';
import { FOOT_FADE } from './sheet';

test('Screen shows its title as the heading, its actions, its body and a pinned footer', async () => {
  await render(
    <Screen
      title="Plan"
      actions={
        <IconButton label="Share plan" onPress={() => {}}>
          <ShareIcon />
        </IconButton>
      }
      footer={
        <Button block>
          <Text>Start cook</Text>
        </Button>
      }
    >
      <Text>On the menu</Text>
    </Screen>,
  );
  expect(screen.getByRole('heading', { name: 'Plan' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Share plan' })).toBeOnTheScreen();
  expect(screen.getByText('On the menu')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Start cook' })).toBeOnTheScreen();
});

test('Screen without actions or footer is just the title and the body', async () => {
  await render(
    <Screen title="Gear">
      <Text>Cookers</Text>
    </Screen>,
  );
  expect(screen.getByRole('heading', { name: 'Gear' })).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
});

// Jason's T-017 review (2026-11-13): the tops of Plan's tiles showed in the 14 dp fade above Start cook.
// Nothing may half-show behind a pinned footer: the content fades out over 32 dp and is gone before the button.
describe('pinned footer', () => {
  const hidden = { includeHiddenElements: true };
  const withFooter = () =>
    render(
      <Screen
        title="Plan"
        footer={
          <Button block>
            <Text>Start cook</Text>
          </Button>
        }
      >
        <Text>On the menu</Text>
      </Screen>,
    );

  test('the fade above it is 32 dp tall and fully opaque for its last quarter', async () => {
    await withFooter();
    const fade = screen.getByTestId('footer-fade', hidden);
    expect(StyleSheet.flatten(fade.props.style)).toMatchObject({ height: 32 });
    expect(FOOT_FADE).toEqual({ height: 32, solidFrom: 0.75 });
  });

  test('the content ends where the fade starts: its bottom padding is the height of the footer with its fade', async () => {
    await withFooter();
    await fireEvent(screen.getByTestId('footer', hidden), 'layout', { nativeEvent: { layout: { height: 102 } } });
    // The body text sits in the scroll view's content container; the padding is the scroll view's prop.
    const scroll = screen.getByText('On the menu').parent?.parent;
    expect(StyleSheet.flatten(scroll?.props.contentContainerStyle)).toMatchObject({ paddingBottom: 102 });
  });
});

// Found on the device after Cook a past plan again was hidden (2026-11-13): Add food became the last thing
// on the empty Plan, and the fade at the end of a body without a footer (24 dp) was taller than the space
// under the content (16 dp), so it dimmed the button's bottom edge with the list scrolled to its end.
test('without a footer the fade at the end is no taller than the space under the content', async () => {
  await render(
    <Screen title="Plan">
      <Text>Add food</Text>
    </Screen>,
  );
  const fade = StyleSheet.flatten(screen.getByTestId('end-fade', { includeHiddenElements: true }).props.style);
  const scroll = screen.getByText('Add food').parent?.parent;
  const pad = StyleSheet.flatten(scroll?.props.contentContainerStyle).paddingBottom;
  expect(pad).toBe(16);
  expect(fade.height).toBeLessThanOrEqual(pad);
});
