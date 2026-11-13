// Hidden alarm test screen (T-015). Release builds: only from the 5 taps on the Gear version (T-026 calls
// `grantDebugPass()` and then opens this route); a `pitplanner://debug` link is sent to Plan. Dev builds:
// the link opens it (device test `alarm`).
import { Redirect, useRouter } from 'expo-router';
import { alarmService } from '@/platform/alarms';
import { permissionService } from '@/platform/permissions';
import { DebugGate } from '@/screens/debug/DebugGate';
import { DebugScreen } from '@/screens/debug/DebugScreen';

export default function Debug() {
  const router = useRouter();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/plan'));
  return (
    <DebugGate dev={__DEV__} denied={<Redirect href="/plan" />}>
      <DebugScreen alarms={alarmService} permissions={permissionService} onClose={close} />
    </DebugGate>
  );
}
