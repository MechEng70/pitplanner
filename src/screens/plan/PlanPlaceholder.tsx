// Plan tab placeholder (T-002): proves the engine and rules data run in Metro by planning the Saturday
// fixture from engine/plan.test.ts. Replaced by the real Plan screen in T-017.
import { StyleSheet, Text } from 'react-native';
import { buildPlan } from '../../../engine/plan.ts';
import { saturday } from '../../lib/fixtures/saturday.ts';
import { rules } from '../../lib/rules.ts';
import { fmtTime } from '../../lib/format.ts';
import { Placeholder, placeholderColors } from '../Placeholder';

export function PlanPlaceholder() {
  const plan = buildPlan(rules, saturday);
  return (
    <Placeholder title="Plan">
      <Text style={styles.body}>
        Brisket 12 lb, serve {fmtTime(plan.serveAt)}. Fire the smoker at{' '}
        {plan.fireAt == null ? 'no time' : fmtTime(plan.fireAt)}.
      </Text>
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  body: { color: placeholderColors.text1, fontSize: 16 },
});
