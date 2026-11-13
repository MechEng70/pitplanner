// Root stack: global styles (NativeWind), the dark navigation theme and light system bar icons.
// Roboto is registered natively by the expo-font config plugin (app.config.ts), so nothing loads at startup.
// The database is opened and migrated here, before any screen (T-010): the store is built over it, or, when
// a migration failed, the error screen is shown instead of the app. Setup (first run) joins as a stack route
// in T-024.
import '../global.css';
import Constants from 'expo-constants';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { LogBox } from 'react-native';
import { openAppDb } from '@/db/appDb';
import type { Db } from '@/db/db';
import { exportDump, exportFileName } from '@/db/export';
import { repos } from '@/db/repos';
import { StoreProvider } from '@/lib/store';
import { shareTextFile } from '@/platform/shareFile';
import { MigrationErrorScreen } from '@/screens/shared/MigrationError';
import { navTheme } from '@/theme/navTheme';

// react-native-css-interop (NativeWind) wraps ImageBackground at import time, so RN 0.88 warns on every dev
// start. Not ours to fix; its LogBox toast covered the tab bar on the emulator (T-006). Remove when NativeWind
// drops the wrapper.
LogBox.ignoreLogs(['ImageBackground is deprecated']);

function exportData(db: Db): Promise<void> {
  const now = Date.now();
  const dump = exportDump(db, now, Constants.expoConfig?.version ?? '');
  return shareTextFile(exportFileName(now), JSON.stringify(dump, null, 1), 'application/json', 'Export my data');
}

export default function RootLayout() {
  const [boot] = useState(() => openAppDb(__DEV__));
  const data = useMemo(() => (boot.ok ? repos(boot.db) : null), [boot]);
  const failedDb = boot.ok ? null : boot.db;
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      {data ? (
        <StoreProvider repos={data}>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }}
          />
        </StoreProvider>
      ) : boot.ok ? null : (
        <MigrationErrorScreen error={boot.error} onExport={failedDb ? () => exportData(failedDb) : undefined} />
      )}
    </ThemeProvider>
  );
}
