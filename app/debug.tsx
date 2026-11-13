// Hidden alarm test screen (T-015): `pitplanner://debug`, and from Gear by tapping the version 5 times once
// the Gear screen exists (T-026).
import { useRouter } from 'expo-router';
import { alarmService } from '@/platform/alarms';
import { permissionService } from '@/platform/permissions';
import { DebugScreen } from '@/screens/debug/DebugScreen';

export default function Debug() {
  const router = useRouter();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/plan'));
  return <DebugScreen alarms={alarmService} permissions={permissionService} onClose={close} />;
}
