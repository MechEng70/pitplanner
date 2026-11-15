// The Plan tab with what opens from it: the smoker temp menu, Add food and the Conflicts sheet (T-018) and
// food details (T-019), and Start cook with its alert check (T-021). Past plans (T-028) and share (T-029)
// join with their tasks.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { HostInstance } from 'react-native';
import { buildPlan } from '../../../engine/plan';
import type { ItemInput, Plan, PlanInput } from '../../../engine/types';
import type { Anchor } from '@/components/kit';
import { newCook } from '@/lib/cook';
import { newItemId } from '@/lib/itemId';
import { method, newItem, rules } from '@/lib/rules';
import { planInput, useStore } from '@/lib/store';
import { restorableFood } from '@/lib/uiState';
import { allGranted, type AppLinks, type PermissionService, type PickDateTime } from '@/platform/types';
import { FoodEdit } from './FoodEdit';
import { FoodPick } from './FoodPick';
import { IssuesSheet } from './IssuesSheet';
import { PlanScreen } from './PlanScreen';
import { StartCheckSheet } from './StartCheckSheet';
import { TempMenu } from './TempMenu';

type Layer =
  | { kind: 'temp'; anchor: Anchor }
  | { kind: 'pick' }
  | { kind: 'issues' }
  | { kind: 'food'; item: ItemInput; isNew: boolean; remember?: boolean }
  | { kind: 'check'; input: PlanInput; plan: Plan }
  | null;

/** A food and method the rules file knows (a saved item from an older rules file may not be). */
function knownMethod(foodId: string, methodId: string): boolean {
  try {
    method(foodId, methodId);
    return true;
  } catch {
    return false;
  }
}
const known = (it: ItemInput) => knownMethod(it.foodId, it.methodId);

export interface PlanTabProps {
  pickDateTime: PickDateTime;
  /** The alert permissions Start cook checks, and the app coming back from Settings (they are read again). */
  permissions: PermissionService;
  onResume: AppLinks['onResume'];
  /** A cook has started: the Cook tab opens. */
  onCookStarted: () => void;
  now?: () => number;
  /** Open food details at once: for the item with this id, or for a new food of this kind (dev seed links). */
  open?: { edit?: string; add?: string };
}

export function PlanTab({ pickDateTime, permissions, onResume, onCookStarted, now = Date.now, open }: PlanTabProps) {
  const { state, setDraft, setCook, ui } = useStore();
  const { draft, gear, units } = state;
  const fresh = (foodId: string): ItemInput =>
    newItem(
      foodId,
      gear,
      newItemId(
        draft.items.map(i => i.id),
        now(),
      ),
    );
  const [layer, setLayer] = useState<Layer>(() => {
    const item = open?.edit ? draft.items.find(x => x.id === open.edit) : undefined;
    if (item && known(item)) return { kind: 'food', item, isNew: false };
    if (open?.add && rules.foods.some(f => f.id === open.add))
      return { kind: 'food', item: fresh(open.add), isNew: true };
    if (open) return null;
    // Food details as it was left when the app was killed or its activity recreated (T-058).
    const left = restorableFood(
      ui.read().food,
      draft.items.map(i => i.id),
      knownMethod,
    );
    return left ? { kind: 'food', ...left } : null;
  });
  const foodIsNew = layer?.kind === 'food' && layer.isNew;
  const keepFood = useCallback(
    (item: ItemInput, remember: boolean) => ui.write({ food: { item, isNew: foodIsNew, remember } }),
    [ui, foodIsNew],
  );
  const closeFood = () => {
    ui.write({ food: null });
    setLayer(null);
  };
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

  // A chosen food opens food details with the rules defaults; it goes on the menu on Save (Jason, 2026-11-14).
  const addFood = (foodId: string) => setLayer({ kind: 'food', item: fresh(foodId), isNew: true });
  const editFood = (id: string) => {
    const item = draft.items.find(x => x.id === id);
    if (item && known(item)) setLayer({ kind: 'food', item, isNew: false });
  };
  const saveFood = (it: ItemInput, isNew: boolean) =>
    setDraft(d => ({ ...d, items: isNew ? [...d.items, it] : d.items.map(x => (x.id === it.id ? it : x)) }));
  const removeFood = (id: string) => setDraft(d => ({ ...d, items: d.items.filter(x => x.id !== id) }));
  const moveToGriddle = (id: string, methodId: string) =>
    setDraft(d => ({
      ...d,
      items: d.items.map(x =>
        x.id === id ? { ...x, methodId, restMin: method(x.foodId, methodId).restMin.default } : x,
      ),
    }));

  // Start cook (SPEC "Cook tab"): the only way a cook starts. A cook that is running is never replaced
  // (T-064: 0.2.0 dropped it with no save and no question), and one tap starts one cook: `starting` covers the
  // moment the permissions are being read and the time until the store's new state is drawn.
  const starting = useRef(false);
  const cooking = state.cook != null;
  const begin = (input: PlanInput, plan: Plan) => {
    if (cooking) return;
    starting.current = true;
    setCook(newCook(input, plan, now()));
    onCookStarted();
  };
  const startCook = async (plan: Plan) => {
    if (cooking || starting.current) return;
    starting.current = true;
    // Failure mode 9: a missing alert permission stops Start cook until it is fixed or acknowledged. A status
    // that cannot be read counts as missing.
    const ok = await permissions.status().then(allGranted, () => false);
    if (ok) return begin(input, plan);
    starting.current = false;
    setLayer({ kind: 'check', input, plan });
  };

  return (
    <>
      <PlanScreen
        pickDateTime={pickDateTime}
        tempFieldRef={tempField}
        onOpenTemp={openTemp}
        onAddFood={() => setLayer({ kind: 'pick' })}
        onEditItem={editFood}
        onOpenIssues={() => setLayer({ kind: 'issues' })}
        onStartCook={plan => void startCook(plan)}
      />
      {layer?.kind === 'check' ? (
        <StartCheckSheet
          permissions={permissions}
          onResume={onResume}
          onClose={close}
          onStart={() => begin(layer.input, layer.plan)}
        />
      ) : null}
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
          onEdit={editFood}
        />
      ) : null}
      {layer?.kind === 'food' ? (
        <FoodEdit
          key={layer.item.id}
          initial={layer.item}
          isNew={layer.isNew}
          remember={layer.remember}
          base={input}
          units={units}
          onChange={keepFood}
          onClose={closeFood}
          onSave={it => saveFood(it, layer.isNew)}
          onRemove={() => removeFood(layer.item.id)}
        />
      ) : null}
    </>
  );
}
