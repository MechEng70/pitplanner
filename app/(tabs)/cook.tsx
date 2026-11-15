// Cook tab: the running cook, or "No cook running" (src/screens/cook/CookScreen.tsx). Cook options and the
// keep or move sheet live in the screen. The Full timeline (`onTimeline`) and Cook finished (`onEnd`, from
// End cook) join with T-023; until then they are not passed.
import { useRouter } from 'expo-router';
import { permissionService } from '@/platform/permissions';
import { onResume } from '@/platform/resume';
import { CookScreen } from '@/screens/cook/CookScreen';

export default function CookTab() {
  const router = useRouter();
  return <CookScreen permissions={permissionService} onResume={onResume} onGoPlan={() => router.navigate('/plan')} />;
}
