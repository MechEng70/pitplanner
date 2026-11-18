// The Plan tab with what opens from it: the smoker temp menu, Add food and the Conflicts sheet (T-018) and
// food details (T-019), Start cook with its alert check (T-021), the share icon (T-029) and a shared plan
// opened from another app (T-030). Past plans (T-028) join with their task.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HostInstance } from 'react-native';
import { buildPlan } from '../../../engine/plan';
import type { ItemInput, Plan, PlanInput } from '../../../engine/types';
import type { Anchor } from '@/components/kit';
import { newCook } from '@/lib/cook';
import { errorText } from '@/lib/eventLog';
import { newItemId } from '@/lib/itemId';
import { method, newItem, rules } from '@/lib/rules';
import { importConflicts, parsePitPlan, type ImportedPlan, type SharedPlan } from '@/lib/sharedPlan';
import { planInput, useStore } from '@/lib/store';
import { restorableFood } from '@/lib/uiState';
import { PLAN_FILE_NAME, pitPlanText, toPitPlan } from '@/lib/pitPlanFile';
import {
  allGranted,
  type AppLinks,
  type OpenedPlanFile,
  type PermissionService,
  type PickDateTime,
  type ShareService,
} from '@/platform/types';
import { ImportNotice } from '@/screens/shared/ImportNotice';
import { FoodEdit } from './FoodEdit';
import { FoodPick } from './FoodPick';
import { IssuesSheet } from './IssuesSheet';
import { PlanScreen } from './PlanScreen';
import { openError, SharedPlanSheet } from './SharedPlanSheet';
import { StartCheckSheet } from './StartCheckSheet';
import { TempMenu } from './TempMenu';

type Layer =
  | { kind: 'temp'; anchor: Anchor }
  | { kind: 'pick' }
  | { kind: 'issues' }
  | { kind: 'food'; item: ItemInput; isNew: boolean; remember?: boolean }
  | { kind: 'check'; input: PlanInput; plan: Plan }
  | { kind: 'shareFailed' }
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

/** The sheet for a shared file that could not be opened says why and nothing else (0.2.0 SharedPlanError). */
export const OPEN_FAILED_TITLE = 'Open shared plan';

export const SHARE_FAILED = { title: "Couldn't share", body: 'The plan was not shared. Try again.' };

export interface PlanTabProps {
  pickDateTime: PickDateTime;
  /** The alert permissions Start cook checks, and the app coming back from Settings (they are read again). */
  permissions: PermissionService;
  onResume: AppLinks['onResume'];
  /** A cook has started: the Cook tab opens. */
  onCookStarted: () => void;
  /** Cook a past plan again (the empty Plan): opens Cook history, where Cook again is (T-028). */
  onCookAgain?: () => void;
  /** Hands the .pitplan file to the share sheet (T-029). Without it the share icon does nothing. */
  sharePlanFile?: ShareService['sharePlanFile'];
  /** A .pitplan file opened from another app (T-030): the Shared plan sheet shows over the tab until done. */
  opened?: OpenedPlanFile | null;
  /** The opened file was used or its sheet closed. */
  onOpenedDone?: () => void;
  now?: () => number;
  /** Open food details at once: for the item with this id, or for a new food of this kind (dev seed links). */
  open?: { edit?: string; add?: string };
}

export function PlanTab({
  pickDateTime,
  permissions,
  onResume,
  onCookStarted,
  onCookAgain,
  sharePlanFile,
  opened,
  onOpenedDone,
  now = Date.now,
  open,
}: PlanTabProps) {
  const { state, setDraft, setCook, ui, logEvent } = useStore();
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
  // The guard is for one start only. It is cleared when no cook is running any more (the cook ended, was
  // saved or discarded, or Start over): before this, it stayed set after the first start and Start cook did
  // nothing for the rest of the app's run (found on the phone, 0.3.0-beta.1). While a start is under way
  // `cooking` does not change, so the guard holds against a second tap.
  useEffect(() => {
    if (!cooking) starting.current = false;
  }, [cooking]);
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

  // Share (SPEC section 3): the menu, serve time and smoker temp as a .pitplan file. A share that fails says so
  // (Jason, 2026-11-15; 0.2.0 showed nothing) and is written to the event log, so it is not silent in a release
  // build. A second tap while the sheet is still opening is not a failure: shareTextFile drops that one.
  const share = (plan: Plan) => {
    if (!sharePlanFile) return;
    const text = pitPlanText(toPitPlan(plan.serveAt, input.pitTempF, input.items));
    const failed = (e: unknown) => {
      logEvent('error', `plan share failed: ${errorText(e)}`);
      setLayer({ kind: 'shareFailed' });
    };
    try {
      sharePlanFile(PLAN_FILE_NAME, text).catch(failed);
    } catch (e) {
      failed(e);
    }
  };

  // A shared plan from another app (T-030). The file is untrusted: `parsePitPlan` keeps only what the rules
  // know and gives every food a new id; nothing else in the file is used.
  const draftIds = draft.items.map(i => i.id);
  const incoming = useMemo((): SharedPlan | { error: string } | null => {
    if (!opened) return null;
    if (opened.text == null) return { error: openError(opened.error ?? '') };
    const ids = [...draftIds];
    return parsePitPlan(rules, opened.text, () => {
      const id = newItemId(ids, now());
      ids.push(id);
      return id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per file, not on every draft change.
  }, [opened]);
  const closeOpened = () => onOpenedDone?.();
  // Use this plan replaces the draft. If moving a food to a cooker this phone has made a conflict, the
  // Conflicts sheet opens with its fixes; otherwise the plan shows.
  const applyShared = (imported: ImportedPlan, serveAt: number) => {
    const next = { mode: 'readyBy' as const, at: serveAt, pitTempF: imported.pitTempF, items: imported.items };
    setDraft(() => next);
    ui.write({ food: null });
    const conflicts = importConflicts(rules, { ...input, ...next }, imported.movedIds);
    setLayer(conflicts.length > 0 ? { kind: 'issues' } : null);
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
        onShare={share}
        onCookAgain={onCookAgain}
      />
      {incoming && 'error' in incoming ? (
        <ImportNotice title={OPEN_FAILED_TITLE} body={incoming.error} onClose={closeOpened} />
      ) : null}
      {incoming && !('error' in incoming) ? (
        <SharedPlanSheet
          shared={incoming}
          pickDateTime={pickDateTime}
          now={now}
          onClose={closeOpened}
          onUse={applyShared}
        />
      ) : null}
      {layer?.kind === 'shareFailed' ? (
        <ImportNotice title={SHARE_FAILED.title} body={SHARE_FAILED.body} onClose={close} />
      ) : null}
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
