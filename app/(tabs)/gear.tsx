// Gear tab (src/screens/gear/GearScreen.tsx). A cooker row, or the kind chosen in Add a cooker, opens that
// cooker's sheet (src/screens/gear/CookerSheets.tsx). Cook rates and history (`onHistory`, T-028) joins with
// that task; until then it is not passed.
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { permissionService } from '@/platform/permissions';
import { onResume } from '@/platform/resume';
import { CookerSheets } from '@/screens/gear/CookerSheets';
import { GearScreen } from '@/screens/gear/GearScreen';
import type { CookerKind } from '@/screens/shared/AddCooker';

export default function GearTab() {
  const router = useRouter();
  const [cooker, setCooker] = useState<CookerKind | null>(null);
  return (
    <>
      <GearScreen
        version={Constants.expoConfig?.version ?? ''}
        permissions={permissionService}
        onResume={onResume}
        onDebug={() => router.push('/debug')}
        onCooker={setCooker}
      />
      {cooker ? <CookerSheets kind={cooker} onClose={() => setCooker(null)} /> : null}
    </>
  );
}
