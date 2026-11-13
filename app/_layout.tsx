// Root stack: global styles (NativeWind), the dark navigation theme and light system bar icons.
// Roboto is registered natively by the expo-font config plugin (app.config.ts), so nothing loads at startup.
// The database is opened and migrated here, before any screen (T-010): the store is built over it, or, when
// a migration failed, the error screen is shown instead of the app. The 0.2.0 data is imported here too,
// once, with a one-time notice saying how it went (T-012). The store gets the phone's alarms (T-015). Setup (first run) joins as a stack route
// in T-024.
import '../global.css';
import Constants from 'expo-constants';
import { Stack, ThemeProvider, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { LogBox } from 'react-native';
import { openAppDb, rawDatabaseFiles } from '@/db/appDb';
import type { Db } from '@/db/db';
import { exportDump, exportFileName } from '@/db/export';
import { importLegacy, importNotice, markNoticeSeen } from '@/db/legacyImport';
import { repos } from '@/db/repos';
import { useAlarmWiring } from '@/lib/alarmWiring';
import { StoreProvider } from '@/lib/store';
import { alarmService } from '@/platform/alarms';
import { legacyStore } from '@/platform/legacy';
import { onResume } from '@/platform/resume';
import { shareFilesAsTar, shareTextFile } from '@/platform/shareFile';
import { ImportNotice } from '@/screens/shared/ImportNotice';
import { MigrationErrorScreen } from '@/screens/shared/MigrationError';
import { navTheme } from '@/theme/navTheme';

// react-native-css-interop (NativeWind) wraps ImageBackground at import time, so RN 0.88 warns on every dev
// start. Not ours to fix; its LogBox toast covered the tab bar on the emulator (T-006). Remove when NativeWind
// drops the wrapper.
LogBox.ignoreLogs(['ImageBackground is deprecated']);

/** Export my data: the JSON dump, or the database files themselves (one tar) when it could not be opened. */
function exportData(db: Db | null): Promise<void> {
  const now = Date.now();
  if (!db) {
    const raw = rawDatabaseFiles(now);
    return shareFilesAsTar(raw.uris, raw.name, 'Export my data', now);
  }
  const dump = exportDump(db, now, Constants.expoConfig?.version ?? '');
  return shareTextFile(exportFileName(now), JSON.stringify(dump, null, 1), 'application/json', 'Export my data');
}

/** Notification taps applied on start, on resume and while open; a change opens the Cook tab (T-015). */
function AlarmWiring() {
  const router = useRouter();
  useAlarmWiring(alarmService, onResume, () => router.navigate('/cook'));
  return null;
}

export default function RootLayout() {
  const [boot] = useState(() => openAppDb(__DEV__));
  // First start of 0.3.0 over 0.2.0: bring the old data across before the store loads (once; T-012).
  const [imported, setImported] = useState(() => (boot.ok ? importLegacy(boot.db, legacyStore, Date.now()) : null));
  const notice = imported ? importNotice(imported) : null;
  const closeNotice = () => {
    if (boot.ok) markNoticeSeen(boot.db, Date.now());
    setImported(r => r && { ...r, noticeSeen: true });
  };
  const data = useMemo(() => (boot.ok ? repos(boot.db) : null), [boot]);
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="light" />
      {data ? (
        <StoreProvider repos={data} alarms={alarmService}>
          <AlarmWiring />
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }}
          />
          {notice ? <ImportNotice title={notice.title} body={notice.body} onClose={closeNotice} /> : null}
        </StoreProvider>
      ) : boot.ok ? null : (
        <MigrationErrorScreen error={boot.error} onExport={() => exportData(boot.db)} />
      )}
    </ThemeProvider>
  );
}
