import { useMemo, useState } from 'preact/hooks';
import { buildPlan, onHeatSpan } from '../../../engine/plan.ts';
import { lbToKg, kgToLb } from '../../../engine/units.ts';
import type { CookerKind, ItemInput, PlanInput, TimingModel } from '../../../engine/types.ts';
import { Button, Chips, Field, InfoBox, KeepVisible, Num, ResultCard, Segmented, Sheet, Stepper, Text, useSheet } from '../../ui/components.tsx';
import { rules, food, method, cookerKinds, cookerName, hasCooker, defaultOptions } from '../../lib/rules.ts';
import { fmtDuration, fmtRate, fmtTempRange, fmtTime, type Units } from '../../lib/format.ts';

const REST_STEP = 5;
const REST_MAX = 240;
const KG_STEP = 0.25;

interface Props {
  initial: ItemInput; isNew: boolean; base: PlanInput; units: Units;
  onSave: (it: ItemInput) => void; onRemove: () => void; onClose: () => void;
}

/** Food details (mockups 08-10): quantity, cooker, method, options, rest, timing model, live result. */
export function FoodEdit(props: Props) {
  const [it, setIt] = useState<ItemInput>(props.initial);
  const preview = usePreview(it, props.base, props.isNew);
  const m = method(it.foodId, it.methodId);
  const blocked = !hasCooker(props.base.cookers, m.cooker) || !!preview.error;
  return (
    <Sheet title={food(it.foodId).name} onClose={props.onClose}
      footer={<Footer isNew={props.isNew} blocked={blocked} onSave={() => props.onSave(it)} onRemove={props.onRemove} />}>
      <Body {...props} it={it} setIt={setIt} preview={preview} />
    </Sheet>
  );
}

function Footer({ isNew, blocked, onSave, onRemove }: { isNew: boolean; blocked: boolean; onSave: () => void; onRemove: () => void }) {
  const { close } = useSheet();
  return (
    <>
      {!isNew && <Button kind="text" tone="danger" onClick={() => close(onRemove)}>Remove</Button>}
      <Button block disabled={blocked} onClick={() => close(onSave)}>{isNew ? 'Add to plan' : 'Save'}</Button>
    </>
  );
}

/** The whole plan with this item in it, so fire time and conflicts in the preview are real. */
function usePreview(it: ItemInput, base: PlanInput, isNew: boolean) {
  return useMemo(() => {
    const items = isNew ? [...base.items, it] : base.items.map(x => x.id === it.id ? it : x);
    try {
      const plan = buildPlan(rules, { ...base, items });
      return { plan, item: plan.items.find(x => x.input.id === it.id)!, error: null as string | null };
    } catch (e) { return { plan: null, item: null, error: String(e) }; }
  }, [it, base, isNew]);
}

function Body({ base, units, it, setIt, preview }: Props & { it: ItemInput; setIt: (i: ItemInput) => void; preview: ReturnType<typeof usePreview> }) {
  const f = food(it.foodId);
  const m = method(it.foodId, it.methodId);
  const q = f.quantity;
  const cookers = base.cookers;

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
  const plan = preview.plan;
  const fire = plan && (m.cooker === 'smoker' && plan.fireAt != null ? { what: 'smoker', at: plan.fireAt }
    : m.cooker === 'griddle' && plan.griddleOnAt != null ? { what: 'griddle', at: plan.griddleOnAt } : null);

  return (
    <>
      <Field label={q.label ?? (q.kind === 'weight' ? 'Weight' : 'How many')}>
        <Stepper label={q.label ?? 'Quantity'} value={qtyText} unit={qtyUnit}
          decDisabled={it.quantity <= q.min} incDisabled={it.quantity >= q.max}
          onDec={() => setQty(shownQty - qtyStep)} onInc={() => setQty(shownQty + qtyStep)} />
      </Field>

      <Field label="Cook on">
        <Chips label="Cook on" value={m.cooker} onChange={pickCooker}
          options={cookerKinds(f).map((k: CookerKind) => ({ id: k, label: cookerName(cookers, k), disabled: !hasCooker(cookers, k), hint: hasCooker(cookers, k) ? undefined : 'Add in Gear' }))} />
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
              <InfoBox lead={choice.pullF && <>Pull at <Num>{fmtTempRange(choice.pullF, units)}</Num>.</>}>{choice.note}</InfoBox>
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
        <Field label="Timing" note={<><Num>{fmtRate(info.hrPerLbAt225, units)}</Num> {info.source === 'learned' ? 'from your cooks' : info.source === 'override' ? '(your setting)' : '(default)'}.{sizeUnlocked ? '' : ` Size-adjusted unlocks after ${unlockAfter} ${f.name.toLowerCase()} cooks in your history.`}</>}>
          <Segmented label="Timing model" value={it.timingModel ?? 'perPound'} onChange={v => setIt({ ...it, timingModel: v as TimingModel })}
            options={[{ id: 'perPound', label: 'Hours per pound' }, { id: 'sizeAdjusted', label: 'Size-adjusted', disabled: !sizeUnlocked }]} />
        </Field>
      )}

      {plan && span && (
        <KeepVisible deps={[it]}><ResultCard overline={<>For serve at <Num>{fmtTime(plan.serveAt)}</Num></>}
          title={<>On <Num>{fmtTime(span.start)}</Num>, off <Num>{fmtTime(preview.item!.finish)}</Num></>}>
          <Text v="label" tone="soft">
            <Num>{fmtDuration(span.minutes)}</Num> on heat.
            {fire && <> Fire the {fire.what} at <Num>{fmtTime(fire.at)}</Num>.</>}
          </Text>
          {itemWarnings.map(w => <Text key={w.code} v="caption" tone={w.level === 'warn' ? 'warn' : 'secondary'}>{w.message}</Text>)}
        </ResultCard></KeepVisible>
      )}
      {preview.error && <InfoBox>Could not plan this item: {preview.error}</InfoBox>}
      {cookerMissing && <Text v="label" tone="warn">Add a {m.cooker} in Gear to cook this.</Text>}
    </>
  );
}
