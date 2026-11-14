// Plan tab: the screen and what opens from it (src/screens/plan/PlanTab.tsx).
import { pickDateTime } from '@/platform/dateTime';
import { PlanTab } from '@/screens/plan/PlanTab';

export default function PlanRoute() {
  return <PlanTab pickDateTime={pickDateTime} />;
}
