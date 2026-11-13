// Database check (T-010, dev builds only): what the device test reads to prove the real expo-sqlite
// database opened and migrated, that a change survives the app being killed, and to arm the forced
// migration failure. Not a screen of the app.
//   pitplanner://dev/db           show the status (and the keys the 0.2.0 app left in CapacitorStorage)
//   pitplanner://dev/db?set=C     save units C (or F) through the store first
//   pitplanner://dev/db?fail=1    the next start fails its migration once (shows the error screen)
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, Text } from '@/components/kit';
import { armForcedFailure, dbStatus, openAppDb, type DbStatus } from '@/db/appDb';
import { useStore } from '@/lib/store';
import { legacyStore } from '@/platform/legacy';

export default function DbCheck() {
  const { set, fail } = useLocalSearchParams<{ set?: string; fail?: string }>();
  if (!__DEV__) return <Redirect href="/plan" />;
  // Keyed by the request, so a new link runs it again.
  return <Check key={`${set}-${fail}`} set={set} fail={fail} />;
}

function Check({ set, fail }: { set?: string; fail?: string }) {
  const { state, setUnits } = useStore();
  // Arming is a database write with nothing to redraw, so it runs once with the first status read.
  const [status] = useState((): DbStatus | null => {
    const boot = openAppDb(true);
    if (!boot.ok) return null;
    if (fail === '1') armForcedFailure(boot.db, Date.now());
    return dbStatus(boot.db);
  });
  // T-011: the pit-legacy native module answers on a real build (read only; nothing is retired here).
  const [legacyKeys] = useState(() => Object.keys(legacyStore.readCapacitorPrefs()).sort());
  useEffect(() => {
    if (set === 'C' || set === 'F') setUnits({ temp: set, weight: set === 'C' ? 'kg' : 'lb' });
  }, [set, setUnits]);

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <Stack gap={8}>
        <Text variant="title" role="heading">
          Database
        </Text>
        {status ? (
          <>
            <Text>user_version {status.userVersion}</Text>
            <Text>journal {status.journalMode}</Text>
            <Text>tables {status.tables.join(', ')}</Text>
            <Text>failure armed {status.failureArmed ? 'yes' : 'no'}</Text>
          </>
        ) : null}
        <Text>
          units {state.units.temp} {state.units.weight}
        </Text>
        <Text>legacy prefs {legacyKeys.length > 0 ? legacyKeys.join(', ') : 'none'}</Text>
      </Stack>
    </SafeAreaView>
  );
}
