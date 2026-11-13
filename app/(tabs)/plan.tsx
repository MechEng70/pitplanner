// Plan tab. The sheets and menus that open from it join with their tasks (T-018, T-019, T-021, T-028, T-029).
import { pickDateTime } from '@/platform/dateTime';
import { PlanScreen } from '@/screens/plan/PlanScreen';

export default function PlanTab() {
  return <PlanScreen pickDateTime={pickDateTime} />;
}
