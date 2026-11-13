import { render, screen } from '@testing-library/react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { IconButton } from './controls';
import { ShareIcon } from './icons';
import { Screen } from './screen';

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
