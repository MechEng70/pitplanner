// Proves jest.setup.ts: safe-area insets and fonts are mocked, so screens render without native modules.
import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { Text } from 'react-native';
import { useSafeAreaInsets, useSafeAreaFrame } from 'react-native-safe-area-context';

function Probe() {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const [fontsLoaded] = useFonts({ Roboto: 1 });
  return (
    <Text>
      insets {insets.top},{insets.bottom} frame {frame.width}x{frame.height} fonts {fontsLoaded ? 'loaded' : 'waiting'}
    </Text>
  );
}

test('safe area and fonts are mocked: zero insets, 320x640 frame, fonts loaded on first render', async () => {
  await render(<Probe />);
  expect(screen.getByText('insets 0,0 frame 320x640 fonts loaded')).toBeOnTheScreen();
});
