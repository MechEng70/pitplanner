// Root stack: global styles (NativeWind), the dark navigation theme and light system bar icons.
// Roboto is registered natively by the expo-font config plugin (app.config.ts), so nothing loads at startup.
// Setup (first run) joins as a stack route in T-024.
import '../global.css';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { navTheme } from '@/theme/navTheme';

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }} />
    </ThemeProvider>
  );
}
