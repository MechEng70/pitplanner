// Cook tab: the running cook, or "No cook running" (src/screens/cook/CookScreen.tsx). Cook options and the
// Full timeline join with T-022 and T-023.
import { useRouter } from 'expo-router';
import { permissionService } from '@/platform/permissions';
import { onResume } from '@/platform/resume';
import { CookScreen } from '@/screens/cook/CookScreen';

export default function CookTab() {
  const router = useRouter();
  return <CookScreen permissions={permissionService} onResume={onResume} onGoPlan={() => router.navigate('/plan')} />;
}
