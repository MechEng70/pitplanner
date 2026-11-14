// Plan tab: the screen and what opens from it (src/screens/plan/PlanTab.tsx).
import { useLocalSearchParams } from 'expo-router';
import { pickDateTime } from '@/platform/dateTime';
import { PlanTab } from '@/screens/plan/PlanTab';

export default function PlanRoute() {
  // Dev builds only: the plan seed (app/dev/plan.tsx) can open food details for the device tests.
  const { edit, add } = useLocalSearchParams<{ edit?: string; add?: string }>();
  const open = __DEV__ && (edit || add) ? { edit, add } : undefined;
  return <PlanTab key={`${edit ?? ''}:${add ?? ''}`} pickDateTime={pickDateTime} open={open} />;
}
