// Plan tab: the screen and what opens from it (src/screens/plan/PlanTab.tsx).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pickDateTime } from '@/platform/dateTime';
import { permissionService } from '@/platform/permissions';
import { onResume } from '@/platform/resume';
import { sharePlanFile } from '@/platform/share';
import { PlanTab } from '@/screens/plan/PlanTab';

export default function PlanRoute() {
  // Dev builds only: the plan seed (app/dev/plan.tsx) can open food details for the device tests.
  const { edit, add } = useLocalSearchParams<{ edit?: string; add?: string }>();
  const open = __DEV__ && (edit || add) ? { edit, add } : undefined;
  const router = useRouter();
  return (
    <PlanTab
      key={`${edit ?? ''}:${add ?? ''}`}
      pickDateTime={pickDateTime}
      permissions={permissionService}
      onResume={onResume}
      onCookStarted={() => router.navigate('/cook')}
      sharePlanFile={sharePlanFile}
      open={open}
    />
  );
}
