import { useMemo, useRef, useState } from 'preact/hooks';
import { buildPlan, onHeatSpan } from '../../../engine/plan.ts';
import type { ItemInput, Plan, SmokerProfile } from '../../../engine/types.ts';
import {
  Avatar, Button, Card, Chips, EmptyState, Fill, Fixed, IconButton, Num, Row, Screen, SelectField, Stack, Text, Tile, Tiles,
} from '../../ui/components.tsx';
import { Calendar, ChevronDown, Plus, ShareIcon } from '../../ui/icons.tsx';
import { useStore, planInput } from '../../lib/store.tsx';
import { rules, method, food, newItem, itemSummary, countText } from '../../lib/rules.ts';
import { fmtDuration, fmtPellets, fmtTemp, fmtTime, fmtWeight, fromLocalInput, toLocalInput, type Units } from '../../lib/format.ts';
import { sharePlan, toPitPlan } from '../../lib/share.ts';
import { FoodPick } from './FoodPick.tsx';
import { FoodEdit } from './FoodEdit.tsx';
import { TempMenu } from './TempMenu.tsx';
import { IssuesSheet } from './IssuesSheet.tsx';

type Layer =
  | { kind: 'pick' }
  | { kind: 'edit'; item: ItemInput; isNew: boolean }
  | { kind: 'temp'; anchor: DOMRect }
  | { kind: 'issues' }
  | null;

/** First thing the cook has to do: fire the smoker, fire the griddle, or start an oven phase. */
function firstAction(plan: Plan): number {
  const oven = plan.items.flatMap(it => it.phases.filter(p => p.cooker === 'oven').map(p => p.start));
  return Math.min(...[plan.fireAt, plan.griddleOnAt, ...oven].filter((x): x is number => x != null));
}

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Plan tab: Empty (mockup 04) and Plan (05), with the temp menu (06) and food sheets (07-08). */
export function PlanScreen({ onStartCook }: { onStartCook: (plan: Plan) => void }) {
  const { state, setDraft } = useStore();
  const { draft, gear, units } = state;
  const [layer, setLayer] = useState<Layer>(null);
  const close = () => setLayer(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const tempRef = useRef<HTMLButtonElement>(null);

  const input = useMemo(() => planInput(state), [state]);
  const built = useMemo(() => {
    if (!draft.items.length) return { plan: null, error: null };
    try { return { plan: buildPlan(rules, input), error: null }; }
    catch (e) { return { plan: null, error: String(e) }; }
  }, [input]);
  const plan = built.plan;
  const empty = !draft.items.length;

  const setMode = (mode: string) => {
    if (mode === draft.mode) return;
    // Keep the same schedule when flipping: start-at takes the first action, ready-by the serve time.
    const at = plan ? (mode === 'startAt' ? firstAction(plan) : plan.serveAt) : draft.at;
    setDraft(d => ({ ...d, mode: mode as 'readyBy' | 'startAt', at }));
  };
  const openDate = () => {
    const el = dateRef.current;
    if (!el) return;
    el.value = toLocalInput(draft.at);
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };
  const openTemp = () => tempRef.current && setLayer({ kind: 'temp', anchor: tempRef.current.getBoundingClientRect() });
  const saveItem = (it: ItemInput) =>
    setDraft(d => ({ ...d, items: d.items.some(x => x.id === it.id) ? d.items.map(x => x.id === it.id ? it : x) : [...d.items, it] }));
  const editItem = (id: string) => { const it = draft.items.find(x => x.id === id); if (it) setLayer({ kind: 'edit', item: it, isNew: false }); };
  const qtyText = (it: ItemInput) => {
    const f = food(it.foodId);
    return f.quantity.kind === 'weight' ? fmtWeight(it.quantity, units) : countText(f, it.quantity);
  };
  const warnCount = plan?.warnings.filter(w => w.level === 'warn').length ?? 0;

  const when = (
    <Card tone="surface" pad="l">
      <Stack gap={empty ? 8 : 4} grow>
        <Row justify="between" align="center">
          <Chips label="Plan from" small={!empty} value={draft.mode} onChange={setMode}
            options={[{ id: 'readyBy', label: 'Ready by' }, { id: 'startAt', label: 'Start at' }]} />
          {!empty && <IconButton bleed label="Pick date and time" onClick={openDate}><Calendar color="var(--text-2)" /></IconButton>}
        </Row>
        <button class="rp when-btn" onClick={openDate} aria-label="Change date and time">
          {/* Day and time are separate units: at big font sizes the line breaks between them, never inside one. */}
          <Text v="when"><Num>{dayFmt.format(draft.at)}</Num> at <Num>{fmtTime(draft.at)}</Num></Text>
        </button>
      </Stack>
      <input ref={dateRef} type="datetime-local" class="hidden-input" tabIndex={-1} aria-hidden="true"
        onChange={e => { const t = fromLocalInput(e.currentTarget.value); if (t != null) setDraft(d => ({ ...d, at: t })); }} />
    </Card>
  );

  return (
    <Screen title="Plan" footer={!empty && <Button block disabled={!plan} onClick={() => plan && onStartCook(plan)}>Start cook</Button>} actions={!empty && plan &&
      <IconButton label="Share plan" onClick={() => sharePlan(toPitPlan(plan.serveAt, draft.pitTempF, draft.items))}><ShareIcon /></IconButton>}>
      {when}

      {empty ? (
        <EmptyState icon={<Avatar kind="smoker" size={72} />} title="What are we cooking?"
          body="Add each food and Pit Planner works back from serve time to tell you when to fire the smoker.">
          <Button block onClick={() => setLayer({ kind: 'pick' })}>Add food</Button>
          {/* TODO(history): opens Cook history (mockup 20) once Gear and history exist. */}
          <Button kind="text" block disabled={!state.history.length}>Cook a past plan again</Button>
        </EmptyState>
      ) : (
        <>
          {gear.smoker && (
            <SelectField fieldRef={tempRef} label="Smoker temp" value={<Num>{fmtTemp(draft.pitTempF, units, true)}</Num>} onClick={openTemp}
              trailing={<Row gap={10}>{plan?.fireAt != null && <Text v="label" tone="secondary"><Num>Fire {fmtTime(plan.fireAt)}</Num></Text>}<ChevronDown size={20} color="var(--text-1)" /></Row>} />
          )}

          <Row justify="between" align="baseline">
            <Text v="section" as="h2">On the menu</Text>
            <Text v="label" tone="secondary"><Num>{draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}</Num></Text>
          </Row>

          {draft.items.map(it => {
            const pi = plan?.items.find(x => x.input.id === it.id);
            const span = pi && onHeatSpan(pi);
            const m = method(it.foodId, it.methodId);
            return (
              <Card key={it.id} onClick={() => editItem(it.id)} label={`${food(it.foodId).name}, edit`}>
                <Avatar kind={m.cooker} />
                <Fill>
                  <Stack gap={2}>
                    <Text v="bodyL" weight={500}>{food(it.foodId).name}</Text>
                    <Text v="label" tone="secondary" clamp>{itemSummary(it, qtyText(it))}</Text>
                  </Stack>
                </Fill>
                {span && (
                  <Fixed>
                    <Text v="body" weight={500}><Num>{fmtTime(span.start)}</Num></Text>
                    <Text v="caption" tone="secondary"><Num>{fmtDuration(span.minutes)}</Num>{m.timing.kind === 'perWeight' ? ' on heat' : ''}</Text>
                  </Fixed>
                )}
              </Card>
            );
          })}

          <Button kind="outline" tone="accent" block icon={<Plus size={18} />} onClick={() => setLayer({ kind: 'pick' })}>Add food</Button>

          {built.error && <Text v="label" tone="error">Could not build the plan: {built.error}</Text>}

          {plan && (
            <Tiles>
              {summaryTiles(plan, gear.smoker, units).map(t => <Tile key={t.label} {...t} />)}
              <Tile label="Conflicts" value={warnCount ? String(warnCount) : 'None'} tone={warnCount ? 'warn' : 'ok'} onClick={() => setLayer({ kind: 'issues' })} />
            </Tiles>
          )}

        </>
      )}

      {layer?.kind === 'pick' && (
        <FoodPick onClose={close} onPick={fid => setLayer({ kind: 'edit', item: newItem(fid, gear, crypto.randomUUID()), isNew: true })} />
      )}
      {layer?.kind === 'edit' && (
        <FoodEdit initial={layer.item} isNew={layer.isNew} base={input} units={units} onClose={close}
          onSave={saveItem} onRemove={() => setDraft(d => ({ ...d, items: d.items.filter(x => x.id !== layer.item.id) }))} />
      )}
      {layer?.kind === 'temp' && gear.smoker && (
        <TempMenu smoker={gear.smoker} input={input} plan={plan} anchor={layer.anchor} units={units} onClose={close}
          onPick={t => { setDraft(d => ({ ...d, pitTempF: t })); close(); }} />
      )}
      {layer?.kind === 'issues' && plan && (
        <IssuesSheet plan={plan} items={draft.items} cookers={gear} onClose={close} onEdit={editItem} onChangeTemp={openTemp}
          onMoveToGriddle={(id, methodId) => setDraft(d => ({ ...d, items: d.items.map(x => x.id === id ? { ...x, methodId, restMin: method(x.foodId, methodId).restMin.default } : x) }))} />
      )}
    </Screen>
  );
}

/** Two tiles before Conflicts: first action, then fuel or smoker-off, padded with serve time. */
function summaryTiles(plan: Plan, smoker: SmokerProfile | undefined, units: Units): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (plan.fireAt != null) out.push({ label: 'Fire smoker', value: fmtTime(plan.fireAt) });
  else if (plan.griddleOnAt != null) out.push({ label: 'Fire griddle', value: fmtTime(plan.griddleOnAt) });
  if (smoker?.hopperLb && plan.fireAt != null) out.push({ label: smoker.type === 'gravity' ? 'Charcoal' : 'Pellets', value: fmtPellets(plan.pelletsLb, units) });
  else if (plan.pitOffAt != null) out.push({ label: 'Smoker off', value: fmtTime(plan.pitOffAt) });
  if (out.length < 2) out.push({ label: 'Serve', value: fmtTime(plan.serveAt) });
  return out;
}

