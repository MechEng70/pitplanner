// Root stack: global styles (NativeWind), the dark navigation theme and light system bar icons.
// Roboto is registered natively by the expo-font config plugin (app.config.ts), so nothing loads at startup.
// Setup (first run) joins as a stack route in T-024.
import '../global.css';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { navTheme } from '@/theme/navTheme';

// react-native-css-interop (NativeWind) wraps ImageBackground at import time, so RN 0.88 warns on every dev
// start. Not ours to fix; its LogBox toast covered the tab bar on the emulator (T-006). Remove when NativeWind
// drops the wrapper.
LogBox.ignoreLogs(['ImageBackground is deprecated']);

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }} />
    </ThemeProvider>
  );
}
