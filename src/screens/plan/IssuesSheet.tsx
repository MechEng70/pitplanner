// Conflicts sheet (opens from the Conflicts tile): every warning of the plan, warnings before notes, each
// with the fixes that apply. A port of legacy/src/screens/plan/IssuesSheet.tsx.
import type { Cookers, ItemInput, Plan } from '../../../engine/types';
import { Button, Card, Fill, Row, Sheet, Stack, Text, useSheet, Warn } from '@/components/kit';
import { tx, type Units } from '@/lib/format';
import { food, method } from '@/lib/rules';
import { colors } from '@/theme/tokens';

/** Warnings a different smoker temp can clear. */
const TEMP_CODES = new Set(['PIT_CONFLICT', 'TEMP_UNTRUSTED', 'TEMP_NOT_SETTABLE']);

interface Props {
  plan: Plan;
  items: ItemInput[];
  cookers: Cookers;
  units: Units;
  onMoveToGriddle: (itemId: string, methodId: string) => void;
  /** Opens a food's details. Left out until that screen exists (T-019): then no Edit buttons show. */
  onEdit?: (itemId: string) => void;
  onChangeTemp: () => void;
  onClose: () => void;
}

export function IssuesSheet(props: Props) {
  return (
    <Sheet title="Conflicts" onClose={props.onClose}>
      <Issues {...props} />
    </Sheet>
  );
}

function Issues({ plan, items, cookers, units, onMoveToGriddle, onEdit, onChangeTemp }: Props) {
  const { close } = useSheet();
  const list = [...plan.warnings].sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  // A saved item the rules do not know has no name or methods to offer: it gets no fix buttons.
  const known = (it: ItemInput) => {
    try {
      return { it, name: food(it.foodId).name.toLowerCase(), cooker: method(it.foodId, it.methodId).cooker };
    } catch {
      return null;
    }
  };
  const griddleMethod = (it: ItemInput, cooker: string) =>
    cookers.griddle && cooker !== 'griddle' ? food(it.foodId).methods.find(m => m.cooker === 'griddle') : undefined;

  if (list.length === 0)
    return (
      <Text variant="bodyM" tone="secondary">
        Nothing to fix. The plan fits your cookers.
      </Text>
    );
  return (
    <>
      {list.map(w => {
        const message = tx(w.message, units);
        const its = (w.itemIds ?? [])
          .map(id => items.find(x => x.id === id))
          .flatMap(it => (it ? [known(it)] : []))
          .filter(x => x != null);
        const tempFix = TEMP_CODES.has(w.code);
        const fixes = tempFix || (its.length > 0 && (!!onEdit || its.some(x => griddleMethod(x.it, x.cooker))));
        return (
          <Card key={`${w.code}:${w.message}`} tone="inset" pad="s" col>
            <Stack gap={10}>
              <Row gap={10} align="start">
                <Warn size={18} color={w.level === 'warn' ? colors.warn : colors.text2} />
                <Fill>
                  <Text testID="issue-message" variant="body" tone={w.level === 'warn' ? 'primary' : 'soft'}>
                    {message}
                  </Text>
                </Fill>
              </Row>
              {fixes ? (
                <Row gap={8} wrap>
                  {its.map(({ it, name, cooker }) => {
                    const gm = griddleMethod(it, cooker);
                    return gm ? (
                      <Button key={`g${it.id}`} kind="tonal" onPress={() => onMoveToGriddle(it.id, gm.id)}>
                        <Text>Move {name} to the griddle</Text>
                      </Button>
                    ) : null;
                  })}
                  {tempFix ? (
                    <Button kind="tonal" onPress={() => close(onChangeTemp)}>
                      <Text>Change smoker temp</Text>
                    </Button>
                  ) : null}
                  {onEdit
                    ? its.map(({ it, name }) => (
                        <Button key={`e${it.id}`} kind="outline" onPress={() => close(() => onEdit(it.id))}>
                          <Text>Edit {name}</Text>
                        </Button>
                      ))
                    : null}
                </Row>
              ) : null}
            </Stack>
          </Card>
        );
      })}
    </>
  );
}
