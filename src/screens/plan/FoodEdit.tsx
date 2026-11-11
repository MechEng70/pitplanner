import { useMemo, useState } from 'preact/hooks';
import { buildPlan, onHeatSpan } from '../../../engine/plan.ts';
import { lbToKg, kgToLb } from '../../../engine/units.ts';
import type { CookerKind, ItemInput, PlanInput, TimingModel } from '../../../engine/types.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { Chips, Segmented, Stepper } from '../../components/controls.tsx';
import { rules, food, method, cookerKinds, cookerName, hasCooker, defaultOptions } from '../../lib/rules.ts';
import { fmtDuration, fmtRate, fmtTempRange, fmtTime, type Units } from '../../lib/format.ts';

const REST_STEP = 5;
const REST_MAX = 240;
const KG_STEP = 0.25;

/** Food details: quantity, cooker, method, options, rest, timing model, live result. */
export function FoodEdit({ initial, isNew, base, units, onSave, onRemove, onClose }: {
  initial: ItemInput; isNew: boolean; base: PlanInput; units: Units;
  onSave: (it: ItemInput) => void; onRemove: () => void; onClose: () => void;
}) {
  const [it, setIt] = useState<ItemInput>(initial);
  const f = food(it.foodId);
  const m = method(it.foodId, it.methodId);
  const q = f.quantity;
  const cookers = base.cookers;

  // Live preview: the whole plan with this item in it, so fire time and conflicts are real.
  const preview = useMemo(() => {
    const items = isNew ? [...base.items, it] : base.items.map(x => x.id === it.id ? it : x);
    try {
      const plan = buildPlan(rules, { ...base, items });
      return { plan, item: plan.items.find(x => x.input.id === it.id)!, error: null };
    } catch (e) { return { plan: null, item: null, error: String(e) }; }
  }, [it, base, isNew]);

  // Quantity in display units. Weights step by the rules step in lb, or 0.25 kg.
  const kg = q.kind === 'weight' && units.weight === 'kg';
  const shownQty = kg ? lbToKg(it.quantity) : it.quantity;
  const qtyStep = kg ? KG_STEP : q.step;
  const setQty = (display: number) => {
    const lb = kg ? kgToLb(display) : display;
    setIt({ ...it, quantity: Math.min(q.max, Math.max(q.min, +lb.toFixed(4))) });
  };
  const qtyText = q.kind === 'weight' ? shownQty.toFixed(kg ? 2 : 1) : String(it.quantity);
  const qtyUnit = q.kind === 'weight' ? units.weight : q.unit;

  const kinds = cookerKinds(f);
  const methodsHere = f.methods.filter(x => x.cooker === m.cooker);
  const pickMethod = (id: string) => {
    const nm = method(f.id, id);
    // Keep option choices that still exist; fill the rest with the new method's defaults.
    const opts = defaultOptions(nm);
    for (const k of Object.keys(opts)) if (it.options?.[k] && nm.options[k].choices[it.options[k]]) opts[k] = it.options[k];
    setIt({ ...it, methodId: id, options: opts, restMin: nm.restMin.default });
  };
  const pickCooker = (k: string) => {
    if (k === m.cooker) return;
    const nm = f.methods.find(x => x.cooker === k);
    if (nm) pickMethod(nm.id);
  };

  const rest = it.restMin ?? m.restMin.default;
  const info = preview.item?.rateInfo;
  const unlockAfter: number = rules.learning.unlockAfterCooks;
  const sizeUnlocked = !!info && (base.history ?? []).filter(h => !h.discarded && h.foodId === f.id && h.smokerId === (cookers.smoker?.id ?? 'none')).length >= unlockAfter;

  const span = preview.item && onHeatSpan(preview.item);
  const cookerMissing = !hasCooker(cookers, m.cooker);
  const itemWarnings = preview.plan?.warnings.filter(w => w.itemIds?.includes(it.id)) ?? [];
  const fireLine = preview.plan && (m.cooker === 'smoker' && preview.plan.fireAt != null
    ? ` Fire the smoker at ${fmtTime(preview.plan.fireAt)}.`
    : m.cooker === 'griddle' && preview.plan.griddleOnAt != null ? ` Fire the griddle at ${fmtTime(preview.plan.griddleOnAt)}.` : '');

  return (
    <Sheet title={f.name} onClose={onClose} footer={
      <div class="foot-row">
        {!isNew && <button class="btn-text danger" onClick={onRemove}>Remove</button>}
        <button class="btn-primary grow" disabled={cookerMissing || !!preview.error} onClick={() => onSave(it)}>
          {isNew ? 'Add to plan' : 'Save'}
        </button>
      </div>
    }>
      <Field label={q.label ?? (q.kind === 'weight' ? 'Weight' : 'How many')}>
        <Stepper label={q.label ?? 'Quantity'} value={qtyText} unit={qtyUnit}
          decDisabled={it.quantity <= q.min} incDisabled={it.quantity >= q.max}
          onDec={() => setQty(shownQty - qtyStep)} onInc={() => setQty(shownQty + qtyStep)} />
      </Field>

      <Field label="Cook on">
        <Chips label="Cook on" value={m.cooker} onChange={pickCooker}
          options={kinds.map((k: CookerKind) => ({ id: k, label: cookerName(cookers, k), disabled: !hasCooker(cookers, k), hint: hasCooker(cookers, k) ? undefined : 'Add in Gear' }))} />
      </Field>

      {methodsHere.length > 1 && (
        <Field label="Method" note={m.note}>
          <Chips label="Method" value={m.id} onChange={pickMethod} options={methodsHere.map(x => ({ id: x.id, label: x.label }))} />
        </Field>
      )}

      {Object.entries(m.options ?? {}).map(([key, opt]) => {
        const val = it.options?.[key] ?? opt.default;
        const choice = opt.choices[val];
        return (
          <Field key={key} label={opt.label}>
            <Chips label={opt.label} value={val} onChange={v => setIt({ ...it, options: { ...it.options, [key]: v } })}
              options={Object.entries(opt.choices).map(([id, c]) => ({ id, label: c.label }))} />
            {(choice?.pullF || choice?.note) && (
              <div class="info-box">
                {choice.pullF && <b>Pull at {fmtTempRange(choice.pullF, units)}. </b>}
                {choice.note}
              </div>
            )}
          </Field>
        );
      })}

      <Field label="Rest after pull">
        <Stepper label="Rest" value={String(rest)} unit="min"
          decDisabled={rest <= m.restMin.min} incDisabled={rest >= REST_MAX}
          onDec={() => setIt({ ...it, restMin: Math.max(m.restMin.min, rest - REST_STEP) })}
          onInc={() => setIt({ ...it, restMin: Math.min(REST_MAX, rest + REST_STEP) })} />
      </Field>

      {m.timing.kind === 'perWeight' && info && (
        <Field label="Timing" note={`${fmtRate(info.hrPerLbAt225, units)} ${info.source === 'learned' ? 'from your cooks' : info.source === 'override' ? '(your setting)' : '(default)'}.${sizeUnlocked ? '' : ` Size-adjusted unlocks after ${unlockAfter} ${f.name.toLowerCase()} cooks in your history.`}`}>
          <Segmented label="Timing model" value={it.timingModel ?? 'perPound'} onChange={v => setIt({ ...it, timingModel: v as TimingModel })}
            options={[{ id: 'perPound', label: 'Hours per pound' }, { id: 'sizeAdjusted', label: 'Size-adjusted', disabled: !sizeUnlocked }]} />
        </Field>
      )}

      {preview.plan && span && (
        <div class="result-card">
          <span class="overline">For serve at {fmtTime(preview.plan.serveAt)}</span>
          <span class="result-main">On {fmtTime(span.start)}, off {fmtTime(preview.item!.finish)}</span>
          <span class="result-sub">{fmtDuration(span.minutes)} on heat.{fireLine}</span>
          {itemWarnings.map(w => <span key={w.code} class={`result-warn ${w.level}`}>{w.message}</span>)}
        </div>
      )}
      {preview.error && <div class="info-box">Could not plan this item: {preview.error}</div>}
    </Sheet>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: preact.ComponentChildren }) {
  return (
    <div class="field">
      <span class="field-label">{label}</span>
      {children}
      {note && <span class="field-note">{note}</span>}
    </div>
  );
}
