// Plan tab placeholder (T-002): proves the engine and rules data run in Metro by planning the Saturday
// fixture from engine/plan.test.ts. Replaced by the real Plan screen in T-017.
import { Text } from 'react-native';
import { buildPlan } from '../../../engine/plan.ts';
import type { PlanInput } from '../../../engine/types.ts';
import { rules } from '../../lib/rules.ts';
import { fmtTime } from '../../lib/format.ts';
import { Placeholder } from '../Placeholder';

/** Saturday Nov 14, 2026, serve 5:00 PM Eastern; 12 lb brisket at 0.75 hr/lb fires 6:20 AM. */
export const saturday: PlanInput = {
  mode: 'readyBy',
  at: Date.UTC(2026, 10, 14, 22, 0),
  pitTempF: 225,
  cookers: {
    smoker: {
      id: 'pb820',
      name: 'Pit Boss 820',
      type: 'pellet',
      tempStepF: 5,
      minTempF: 180,
      maxTempF: 500,
      hopperLb: 21,
      mainGrateSqIn: 593,
      upperRackSqIn: 256,
      pelletLbPerHrLow: 1.5,
      pelletLbPerHrHigh: 3,
      preheatMin: 20,
    },
  },
  rateOverrides: { brisket: 0.75 },
  items: [{ id: 'b', foodId: 'brisket', methodId: 'smoked', quantity: 12, options: { wrap: 'paper' }, restMin: 60 }],
};

export function PlanPlaceholder() {
  const plan = buildPlan(rules, saturday);
  return (
    <Placeholder title="Plan">
      <Text style={{ color: '#d8cfc7', fontSize: 16 }}>
        Brisket 12 lb, serve {fmtTime(plan.serveAt)}. Fire the smoker at{' '}
        {plan.fireAt == null ? 'no time' : fmtTime(plan.fireAt)}.
      </Text>
    </Placeholder>
  );
}
