// Cook tab: the running cook, or "No cook running" (src/screens/cook/CookScreen.tsx), and Cook finished after
// End cook or Done on Serve (src/screens/cook/CookFlow.tsx). Cook options, the full timeline and the keep or
// move sheet live in the screen.
import { useRouter } from 'expo-router';
import { permissionService } from '@/platform/permissions';
import { onResume } from '@/platform/resume';
import { CookFlow } from '@/screens/cook/CookFlow';

export default function CookTab() {
  const router = useRouter();
  return <CookFlow permissions={permissionService} onResume={onResume} onGoPlan={() => router.navigate('/plan')} />;
}
