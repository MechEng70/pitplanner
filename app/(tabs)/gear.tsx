// Gear tab (src/screens/gear/GearScreen.tsx). A cooker row, or the kind chosen in Add a cooker, opens that
// cooker's sheet (src/screens/gear/CookerSheets.tsx). Cook history (T-028) shows in this tab, over Gear,
// while the `history` param is set: `1` from Gear's Cook rates row, `plan` from Plan's Cook a past plan again
// (back goes there). Export my data and Restore from a file (T-036) get the share sheet and the file picker.
import Constants from 'expo-constants';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler } from 'react-native';
import { alarmService } from '@/platform/alarms';
import { permissionService } from '@/platform/permissions';
import { pickTextFile } from '@/platform/pickFile';
import { onResume } from '@/platform/resume';
import { shareDataFile } from '@/platform/shareFile';
import { CookerSheets } from '@/screens/gear/CookerSheets';
import { GearScreen } from '@/screens/gear/GearScreen';
import { HistoryScreen } from '@/screens/gear/HistoryScreen';
import type { CookerKind } from '@/screens/shared/AddCooker';

export default function GearTab() {
  const router = useRouter();
  const navigation = useNavigation();
  const [cooker, setCooker] = useState<CookerKind | null>(null);
  const { history } = useLocalSearchParams<{ history?: string }>();
  // The phone's back button closes history only while this tab is the one showing.
  const onBackPress = useCallback(
    (handler: () => boolean) => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => navigation.isFocused() && handler());
      return () => sub.remove();
    },
    [navigation],
  );
  const closeHistory = (to?: '/plan') => {
    router.setParams({ history: undefined });
    if (to) router.navigate(to);
  };
  if (history)
    return (
      <HistoryScreen
        onBack={() => closeHistory(history === 'plan' ? '/plan' : undefined)}
        onCookAgain={() => closeHistory('/plan')}
        onBackPress={onBackPress}
      />
    );
  return (
    <>
      <GearScreen
        version={Constants.expoConfig?.version ?? ''}
        permissions={permissionService}
        alarms={alarmService}
        onResume={onResume}
        onDebug={() => router.push('/debug')}
        onCooker={setCooker}
        onHistory={() => router.setParams({ history: '1' })}
        shareDataFile={shareDataFile}
        pickDataFile={pickTextFile}
      />
      {cooker ? <CookerSheets kind={cooker} onClose={() => setCooker(null)} /> : null}
    </>
  );
}
