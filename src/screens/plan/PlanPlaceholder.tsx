// Plan tab placeholder (T-002): proves the engine and rules data run in Metro by planning the Saturday
// fixture from engine/plan.test.ts. Replaced by the real Plan screen in T-017.
import { buildPlan } from '../../../engine/plan.ts';
import { Text } from '@/components/ui/text';
import { saturday } from '@/lib/fixtures/saturday';
import { fmtTime } from '@/lib/format';
import { rules } from '@/lib/rules';
import { Placeholder } from '../Placeholder';

export function PlanPlaceholder() {
  const plan = buildPlan(rules, saturday);
  return (
    <Placeholder title="Plan">
      <Text variant="bodyL" tone="soft">
        Brisket 12 lb, serve {fmtTime(plan.serveAt)}. Fire the smoker at{' '}
        {plan.fireAt == null ? 'no time' : fmtTime(plan.fireAt)}.
      </Text>
    </Placeholder>
  );
}
