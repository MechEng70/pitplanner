// Gear tab (src/screens/gear/GearScreen.tsx). The cooker sheets (`onCooker`, T-027) and Cook rates and
// history (`onHistory`, T-028) join with those tasks; until then they are not passed.
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { permissionService } from '@/platform/permissions';
import { onResume } from '@/platform/resume';
import { GearScreen } from '@/screens/gear/GearScreen';

export default function GearTab() {
  const router = useRouter();
  return (
    <GearScreen
      version={Constants.expoConfig?.version ?? ''}
      permissions={permissionService}
      onResume={onResume}
      onDebug={() => router.push('/debug')}
    />
  );
}
