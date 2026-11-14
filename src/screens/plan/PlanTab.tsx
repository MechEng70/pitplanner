// The Plan tab with what opens from it: the smoker temp menu, Add food and the Conflicts sheet (T-018).
// Food details (T-019), Start cook (T-021), past plans (T-028) and share (T-029) join with their tasks.
import { useMemo, useRef, useState } from 'react';
import type { HostInstance } from 'react-native';
import { buildPlan } from '../../../engine/plan';
import type { Plan } from '../../../engine/types';
import type { Anchor } from '@/components/kit';
import { newItemId } from '@/lib/itemId';
import { method, newItem, rules } from '@/lib/rules';
import { planInput, useStore } from '@/lib/store';
import type { PickDateTime } from '@/platform/types';
import { FoodPick } from './FoodPick';
import { IssuesSheet } from './IssuesSheet';
import { PlanScreen } from './PlanScreen';
import { TempMenu } from './TempMenu';

type Layer = { kind: 'temp'; anchor: Anchor } | { kind: 'pick' } | { kind: 'issues' } | null;

export function PlanTab({ pickDateTime, now = Date.now }: { pickDateTime: PickDateTime; now?: () => number }) {
  const { state, setDraft } = useStore();
  const { draft, gear, units } = state;
  const [layer, setLayer] = useState<Layer>(null);
  const tempField = useRef<HostInstance>(null);
  const close = () => setLayer(null);

  const input = useMemo(() => planInput(state), [state]);
  const plan = useMemo((): Plan | null => {
    if (input.items.length === 0) return null;
    try {
      return buildPlan(rules, input);
    } catch {
      return null;
    }
  }, [input]);

  // The menu hangs under the field, so it needs to know where the field is on the screen right now.
  const openTemp = () =>
    tempField.current?.measureInWindow((x, y, width, height) =>
      setLayer({ kind: 'temp', anchor: { x, y, width, height } }),
    );

  // Until food details (T-019) opens here, a chosen food goes on the menu with the rules defaults.
  const addFood = (foodId: string) =>
    setDraft(d => ({
      ...d,
      items: [
        ...d.items,
        newItem(
          foodId,
          gear,
          newItemId(
            d.items.map(i => i.id),
            now(),
          ),
        ),
      ],
    }));
  const moveToGriddle = (id: string, methodId: string) =>
    setDraft(d => ({
      ...d,
      items: d.items.map(x =>
        x.id === id ? { ...x, methodId, restMin: method(x.foodId, methodId).restMin.default } : x,
      ),
    }));

  return (
    <>
      <PlanScreen
        pickDateTime={pickDateTime}
        tempFieldRef={tempField}
        onOpenTemp={openTemp}
        onAddFood={() => setLayer({ kind: 'pick' })}
        onOpenIssues={() => setLayer({ kind: 'issues' })}
      />
      {layer?.kind === 'temp' && gear.smoker ? (
        <TempMenu
          smoker={gear.smoker}
          input={input}
          plan={plan}
          anchor={layer.anchor}
          units={units}
          onClose={close}
          onPick={t => {
            setDraft(d => ({ ...d, pitTempF: t }));
            close();
          }}
        />
      ) : null}
      {layer?.kind === 'pick' ? <FoodPick onClose={close} onPick={addFood} /> : null}
      {layer?.kind === 'issues' && plan ? (
        <IssuesSheet
          plan={plan}
          items={draft.items}
          cookers={gear}
          units={units}
          onClose={close}
          onChangeTemp={openTemp}
          onMoveToGriddle={moveToGriddle}
        />
      ) : null}
    </>
  );
}
