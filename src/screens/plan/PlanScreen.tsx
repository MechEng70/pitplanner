import { useMemo, useRef, useState } from 'preact/hooks';
import { buildPlan, onHeatSpan } from '../../../engine/plan.ts';
import type { ItemInput, Plan, SmokerProfile } from '../../../engine/types.ts';
import { Calendar, ChevronDown, CookerAvatar, Flame, Plus, ShareIcon } from '../../components/icons.tsx';
import { useStore, planInput } from '../../lib/store.tsx';
import { rules, method, food, newItem, itemSummary } from '../../lib/rules.ts';
import { fmtDayTime, fmtDuration, fmtPellets, fmtTemp, fmtTime, fmtWeight, fromLocalInput, toLocalInput, type Units } from '../../lib/format.ts';
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

  const setMode = (mode: 'readyBy' | 'startAt') => {
    if (mode === draft.mode) return;
    // Keep the same schedule when flipping: start-at takes the first action, ready-by the serve time.
    const at = plan ? (mode === 'startAt' ? firstAction(plan) : plan.serveAt) : draft.at;
    setDraft(d => ({ ...d, mode, at }));
  };

  const openDate = () => {
    const el = dateRef.current;
    if (!el) return;
    el.value = toLocalInput(draft.at);
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  const saveItem = (it: ItemInput) => {
    setDraft(d => ({ ...d, items: d.items.some(x => x.id === it.id) ? d.items.map(x => x.id === it.id ? it : x) : [...d.items, it] }));
    close();
  };
  const removeItem = (id: string) => { setDraft(d => ({ ...d, items: d.items.filter(x => x.id !== id) })); close(); };
  const editItem = (id: string) => { const it = draft.items.find(x => x.id === id); if (it) setLayer({ kind: 'edit', item: it, isNew: false }); };

  const warnCount = plan?.warnings.filter(w => w.level === 'warn').length ?? 0;
  const qtyText = (it: ItemInput) => {
    const q = food(it.foodId).quantity;
    return q.kind === 'weight' ? fmtWeight(it.quantity, units) : `${it.quantity} ${q.unit}`;
  };

  const empty = !draft.items.length;

  return (
    <div class="screen">
      <header class="top-bar">
        <h1>Plan</h1>
        {!empty && plan && (
          <button class="icon-btn" aria-label="Share plan" onClick={() => sharePlan(toPitPlan(plan.serveAt, draft.pitTempF, draft.items))}>
            <ShareIcon />
          </button>
        )}
      </header>

      <div class="content">
        <div class="when-card">
          <div class="when-main">
            <div class="mode-chips" role="radiogroup" aria-label="Plan mode">
              <button role="radio" aria-checked={draft.mode === 'readyBy'} class={`mini-chip ${draft.mode === 'readyBy' ? 'on' : ''}`} onClick={() => setMode('readyBy')}>Ready by</button>
              <button role="radio" aria-checked={draft.mode === 'startAt'} class={`mini-chip ${draft.mode === 'startAt' ? 'on' : ''}`} onClick={() => setMode('startAt')}>Start at</button>
            </div>
            <button class="when-time" onClick={openDate} aria-label={`${draft.mode === 'readyBy' ? 'Ready by' : 'Start at'} ${fmtDayTime(draft.at)}. Change`}>
              {fmtDayTime(draft.at)}
            </button>
          </div>
          {!empty && <button class="icon-btn" aria-label="Pick date and time" onClick={openDate}><Calendar color="var(--text-2)" /></button>}
          <input ref={dateRef} type="datetime-local" class="hidden-input" tabIndex={-1} aria-hidden="true"
            onChange={e => { const t = fromLocalInput(e.currentTarget.value); if (t != null) setDraft(d => ({ ...d, at: t })); }} />
        </div>

        {empty ? (
          <div class="empty">
            <span class="empty-badge"><Flame size={32} color="var(--accent)" /></span>
            <h2>What are we cooking?</h2>
            <p>Add each food and Pit Planner works back from serve time to tell you when to fire the smoker.</p>
            <div class="spacer" />
            <button class="btn-primary block" onClick={() => setLayer({ kind: 'pick' })}>Add food</button>
            {state.history.length > 0 && <button class="btn-text">Cook a past plan again</button>}
          </div>
        ) : (
          <>
            {gear.smoker && (
              <button ref={tempRef} class="temp-field" aria-haspopup="listbox"
                onClick={() => tempRef.current && setLayer({ kind: 'temp', anchor: tempRef.current.getBoundingClientRect() })}>
                <span class="tf-text"><span class="tf-label">Smoker temp</span><span class="tf-value">{fmtTemp(draft.pitTempF, units, true)}</span></span>
                <span class="tf-right">
                  {plan?.fireAt != null && <span class="muted">Fire {fmtTime(plan.fireAt)}</span>}
                  <ChevronDown color="var(--text-1)" size={20} />
                </span>
              </button>
            )}

            <div class="section-head">
              <h2>On the menu</h2>
              <span class="muted">{draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}</span>
            </div>

            {draft.items.map(it => {
              const pi = plan?.items.find(x => x.input.id === it.id);
              const span = pi && onHeatSpan(pi);
              const m = method(it.foodId, it.methodId);
              return (
                <button key={it.id} class="food-card" onClick={() => editItem(it.id)}>
                  <CookerAvatar kind={m.cooker} />
                  <span class="fc-text">
                    <span class="t1">{food(it.foodId).name}</span>
                    <span class="t2">{itemSummary(it, qtyText(it))}</span>
                  </span>
                  {span && (
                    <span class="fc-time">
                      <span class="t1">{fmtTime(span.start)}</span>
                      <span class="t2">{fmtDuration(span.minutes)}{m.timing.kind === 'perWeight' ? ' on heat' : ''}</span>
                    </span>
                  )}
                </button>
              );
            })}

            <button class="btn-outline block accent" onClick={() => setLayer({ kind: 'pick' })}><Plus size={18} /> Add food</button>

            {built.error && <p class="error-text">Could not build the plan: {built.error}</p>}

            {plan && (
              <div class="tiles">
                {summaryTiles(plan, gear.smoker, units).map(t => <Tile key={t.label} {...t} />)}
                <Tile label="Conflicts" value={warnCount ? String(warnCount) : 'None'} tone={warnCount ? 'warn' : 'ok'}
                  onClick={() => setLayer({ kind: 'issues' })} />
              </div>
            )}

            <button class="btn-primary block" disabled={!plan} onClick={() => plan && onStartCook(plan)}>Start cook</button>
          </>
        )}
      </div>

      {layer?.kind === 'pick' && (
        <FoodPick onClose={close} onPick={fid => setLayer({ kind: 'edit', item: newItem(fid, gear, crypto.randomUUID()), isNew: true })} />
      )}
      {layer?.kind === 'edit' && (
        <FoodEdit initial={layer.item} isNew={layer.isNew} base={input} units={units}
          onSave={saveItem} onRemove={() => removeItem(layer.item.id)} onClose={close} />
      )}
      {layer?.kind === 'temp' && gear.smoker && (
        <TempMenu smoker={gear.smoker} input={input} anchor={layer.anchor} units={units} onClose={close}
          onPick={t => { setDraft(d => ({ ...d, pitTempF: t })); close(); }} />
      )}
      {layer?.kind === 'issues' && plan && (
        <IssuesSheet plan={plan} items={draft.items} cookers={gear} onClose={close}
          onMoveToGriddle={(id, methodId) => setDraft(d => ({ ...d, items: d.items.map(x => x.id === id ? { ...x, methodId, restMin: method(x.foodId, methodId).restMin.default } : x) }))}
          onEdit={editItem}
          onChangeTemp={() => tempRef.current && setLayer({ kind: 'temp', anchor: tempRef.current.getBoundingClientRect() })} />
      )}
    </div>
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

function Tile({ label, value, tone, onClick }: { label: string; value: string; tone?: 'ok' | 'warn'; onClick?: () => void }) {
  const body = <><span class="tile-label">{label}</span><span class={`tile-value ${tone ?? ''}`}>{value}</span></>;
  return onClick ? <button class="tile" onClick={onClick}>{body}</button> : <div class="tile">{body}</div>;
}
