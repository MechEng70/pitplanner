// Plan tab placeholder (T-002): proves the engine and rules data run in Metro by planning the Saturday
// fixture from engine/plan.test.ts. Replaced by the real Plan screen in T-017, which keeps the notice for a
// saved plan that could not be loaded (Jason, 2026-11-12: never start empty without saying so).
import { buildPlan } from '../../../engine/plan.ts';
import { Banner } from '@/components/kit';
import { Text } from '@/components/ui/text';
import { saturday } from '@/lib/fixtures/saturday';
import { fmtTime } from '@/lib/format';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { Placeholder } from '../Placeholder';

export const DRAFT_LOST = 'Your saved plan could not be loaded.';

export function PlanPlaceholder() {
  const { state } = useStore();
  const plan = buildPlan(rules, saturday);
  return (
    <Placeholder title="Plan">
      {state.draftLost ? <Banner tone="warn">{DRAFT_LOST}</Banner> : null}
      <Text variant="bodyL" tone="soft">
        Brisket 12 lb, serve {fmtTime(plan.serveAt)}. Fire the smoker at{' '}
        {plan.fireAt == null ? 'no time' : fmtTime(plan.fireAt)}.
      </Text>
    </Placeholder>
  );
}
