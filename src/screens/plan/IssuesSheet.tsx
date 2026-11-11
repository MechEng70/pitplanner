import type { Cookers, ItemInput, Plan } from '../../../engine/types.ts';
import { Button, Card, Row, Sheet, Stack, Text, useSheet } from '../../ui/components.tsx';
import { Warn } from '../../ui/icons.tsx';
import { food, method } from '../../lib/rules.ts';

const TEMP_CODES = new Set(['PIT_CONFLICT', 'TEMP_UNTRUSTED', 'TEMP_NOT_SETTABLE']);

interface Props {
  plan: Plan; items: ItemInput[]; cookers: Cookers;
  onMoveToGriddle: (itemId: string, methodId: string) => void;
  onEdit: (itemId: string) => void; onChangeTemp: () => void; onClose: () => void;
}

/** Conflicts tile: every warning, warn level first, with the fixes that apply. */
export function IssuesSheet(props: Props) {
  return <Sheet title="Conflicts" onClose={props.onClose}><Issues {...props} /></Sheet>;
}

function Issues({ plan, items, cookers, onMoveToGriddle, onEdit, onChangeTemp }: Props) {
  const { close } = useSheet();
  const list = [...plan.warnings].sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  const name = (it: ItemInput) => food(it.foodId).name.toLowerCase();
  const griddleFix = (id: string) => {
    const it = items.find(x => x.id === id);
    if (!it || !cookers.griddle || method(it.foodId, it.methodId).cooker === 'griddle') return null;
    const gm = food(it.foodId).methods.find(m => m.cooker === 'griddle');
    return gm ? { it, gm } : null;
  };

  if (!list.length) return <Text v="bodyM" tone="secondary">Nothing to fix. The plan fits your cookers.</Text>;
  return (
    <>
      {list.map((w, i) => {
        const its = (w.itemIds ?? []).map(id => items.find(x => x.id === id)).filter((x): x is ItemInput => !!x);
        return (
          <Card key={i} tone="inset" pad="s">
            <Stack gap={10}>
              <Row gap={10} align="start">
                <Warn size={18} color={w.level === 'warn' ? 'var(--warn)' : 'var(--text-2)'} />
                <Text v="body" tone={w.level === 'warn' ? 'primary' : 'soft'}>{w.message}</Text>
              </Row>
              <Row gap={8} wrap>
                {its.map(it => {
                  const g = griddleFix(it.id);
                  return g && <Button key={`g${it.id}`} kind="tonal" onClick={() => onMoveToGriddle(it.id, g.gm.id)}>Move {name(it)} to the griddle</Button>;
                })}
                {TEMP_CODES.has(w.code) && <Button kind="tonal" onClick={() => close(onChangeTemp)}>Change smoker temp</Button>}
                {its.map(it => <Button key={`e${it.id}`} kind="outline" onClick={() => close(() => onEdit(it.id))}>Edit {name(it)}</Button>)}
              </Row>
            </Stack>
          </Card>
        );
      })}
    </>
  );
}
