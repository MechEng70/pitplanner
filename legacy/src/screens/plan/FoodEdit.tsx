import { useMemo, useState } from 'preact/hooks';
import { buildPlan, onHeatSpan } from '../../../engine/plan.ts';
import { lbToKg, kgToLb } from '../../../engine/units.ts';
import type { CookerKind, ItemInput, PlanInput, TimingModel } from '../../../engine/types.ts';
import {
  Button,
  CheckRow,
  Chips,
  Field,
  InfoBox,
  KeepVisible,
  Num,
  ResultCard,
  Sheet,
  Stepper,
  Text,
  useSheet,
} from '../../ui/components.tsx';
import { rules, food, method, cookerKinds, cookerName, hasCooker, defaultOptions } from '../../lib/rules.ts';
import { tx, fmtDuration, fmtRate, fmtTempRange, fmtTime, type Units } from '../../lib/format.ts';
import { useStore } from '../../lib/store.tsx';
import { sourceText } from '../../lib/historyView.ts';
import {
  HOURS_MAX,
  HOURS_MIN,
  hoursText,
  rateText,
  rateUnusual,
  roundHours,
  stepHours,
  stepRate,
} from '../../lib/timing.ts';

const REST_STEP = 5;
const REST_MAX = 240;
const KG_STEP = 0.25;

interface Props {
  initial: ItemInput;
  isNew: boolean;
  base: PlanInput;
  units: Units;
  onSave: (it: ItemInput) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Food details (mockups 08-10): quantity, cooker, method, options, rest, timing model, live result. */
export function FoodEdit(props: Props) {
  const { state, setRate, setTotalHours, setFlags } = useStore();
  const [it, setIt] = useState<ItemInput>(props.initial);
  const [remember, setRemember] = useState(false);
  // Shown once ever, the first time a by-weight food is added on the published rate.
  const [showHint] = useState(props.isNew && !state.flags.rateHintShown);
  const preview = usePreview(it, props.base, props.isNew);
  const m = method(it.foodId, it.methodId);
  const blocked = !hasCooker(props.base.cookers, m.cooker) || !!preview.error;
  const hint = showHint && preview.item?.rateInfo?.source === 'default' && it.timingModel !== 'totalHours';
  const save = () => {
    let out = it;
    if (remember && it.timingModel === 'totalHours' && it.totalHours) setTotalHours(it.foodId, it.totalHours);
    else if (remember && preview.item?.rateInfo && (it.timingModel ?? 'perPound') === 'perPound') {
      setRate(it.foodId, preview.item.rateInfo.hrPerLbAt225);
      out = { ...it, hrPerLb: undefined }; // the saved rate now covers it
    }
    // Seen once is enough, even if the user then set a rate and the hint went away.
    if (showHint && preview.item?.rateInfo) setFlags({ ...state.flags, rateHintShown: true });
    props.onSave(out);
  };
  return (
    <Sheet
      title={food(it.foodId).name}
      onClose={props.onClose}
      footer={<Footer isNew={props.isNew} blocked={blocked} onSave={save} onRemove={props.onRemove} />}
    >
      <Body
        {...props}
        it={it}
        setIt={setIt}
        preview={preview}
        remember={remember}
        setRemember={setRemember}
        hint={hint}
      />
    </Sheet>
  );
}

function Footer({
  isNew,
  blocked,
  onSave,
  onRemove,
}: {
  isNew: boolean;
  blocked: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { close } = useSheet();
  return (
    <>
      {!isNew && (
        <Button kind="text" tone="danger" onClick={() => close(onRemove)}>
          Remove
        </Button>
      )}
      <Button block disabled={blocked} onClick={() => close(onSave)}>
        {isNew ? 'Add to plan' : 'Save'}
      </Button>
    </>
  );
}

/** The whole plan with this item in it, so fire time and conflicts in the preview are real. */
function usePreview(it: ItemInput, base: PlanInput, isNew: boolean) {
  return useMemo(() => {
    const items = isNew ? [...base.items, it] : base.items.map(x => (x.id === it.id ? it : x));
    try {
      const plan = buildPlan(rules, { ...base, items });
      return { plan, item: plan.items.find(x => x.input.id === it.id)!, error: null as string | null };
    } catch (e) {
      return { plan: null, item: null, error: String(e) };
    }
  }, [it, base, isNew]);
}

function Body({
  base,
  units,
  it,
  setIt,
  preview,
  remember,
  setRemember,
  hint,
}: Props & {
  it: ItemInput;
  setIt: (i: ItemInput) => void;
  preview: ReturnType<typeof usePreview>;
  remember: boolean;
  setRemember: (v: boolean) => void;
  hint: boolean;
}) {
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
    for (const k of Object.keys(opts))
      if (it.options?.[k] && nm.options[k].choices[it.options[k]]) opts[k] = it.options[k];
    setIt({ ...it, methodId: id, options: opts, restMin: nm.restMin.default });
  };
  const pickCooker = (k: string) => {
    if (k === m.cooker) return;
    const nm = f.methods.find(x => x.cooker === k);
    if (nm) pickMethod(nm.id);
  };

  const rest = it.restMin ?? m.restMin.default;
  const info = preview.item?.rateInfo;

  const span = preview.item && onHeatSpan(preview.item);
  const cookerMissing = !hasCooker(cookers, m.cooker);
  const itemWarnings = preview.plan?.warnings.filter(w => w.itemIds?.includes(it.id)) ?? [];
  const plan = preview.plan;
  const fire =
    plan &&
    (m.cooker === 'smoker' && plan.fireAt != null
      ? { what: 'smoker', at: plan.fireAt }
      : m.cooker === 'griddle' && plan.griddleOnAt != null
        ? { what: 'griddle', at: plan.griddleOnAt }
        : null);

  return (
    <>
      <Field label={q.label ?? (q.kind === 'weight' ? 'Weight' : 'How many')}>
        <Stepper
          label={q.label ?? 'Quantity'}
          value={qtyText}
          unit={qtyUnit}
          decDisabled={it.quantity <= q.min}
          incDisabled={it.quantity >= q.max}
          onDec={() => setQty(shownQty - qtyStep)}
          onInc={() => setQty(shownQty + qtyStep)}
        />
      </Field>

      <Field label="Cook on">
        <Chips
          label="Cook on"
          value={m.cooker}
          onChange={pickCooker}
          options={cookerKinds(f).map((k: CookerKind) => ({
            id: k,
            label: cookerName(cookers, k),
            disabled: !hasCooker(cookers, k),
            hint: hasCooker(cookers, k) ? undefined : 'Add in Gear',
          }))}
        />
      </Field>

      {methodsHere.length > 1 && (
        <Field label="Method" note={m.note && tx(m.note, units)}>
          <Chips
            label="Method"
            value={m.id}
            onChange={pickMethod}
            options={methodsHere.map(x => ({ id: x.id, label: tx(x.label, units) }))}
          />
        </Field>
      )}

      {Object.entries(m.options ?? {}).map(([key, opt]) => {
        const val = it.options?.[key] ?? opt.default;
        const choice = opt.choices[val];
        return (
          <Field key={key} label={opt.label}>
            <Chips
              label={opt.label}
              value={val}
              onChange={v => setIt({ ...it, options: { ...it.options, [key]: v } })}
              options={Object.entries(opt.choices).map(([id, c]) => ({ id, label: tx(c.label, units) }))}
            />
            {(choice?.pullF || choice?.note) && (
              <InfoBox
                lead={
                  choice.pullF && (
                    <>
                      Pull at <Num>{fmtTempRange(choice.pullF, units)}</Num>.
                    </>
                  )
                }
              >
                {choice.note && tx(choice.note, units)}
              </InfoBox>
            )}
          </Field>
        );
      })}

      <Field label="Rest after pull">
        <Stepper
          label="Rest"
          value={String(rest)}
          unit="min"
          decDisabled={rest <= m.restMin.min}
          incDisabled={rest >= REST_MAX}
          onDec={() => setIt({ ...it, restMin: Math.max(m.restMin.min, rest - REST_STEP) })}
          onInc={() => setIt({ ...it, restMin: Math.min(REST_MAX, rest + REST_STEP) })}
        />
      </Field>

      {span && (
        <Timing
          f={f}
          it={it}
          setIt={setIt}
          info={info}
          spanMin={span.minutes}
          base={base}
          units={units}
          remember={remember}
          setRemember={setRemember}
          hint={hint}
        />
      )}

      {plan && span && (
        <KeepVisible deps={[it]}>
          <ResultCard
            overline={
              <>
                For serve at <Num>{fmtTime(plan.serveAt)}</Num>
              </>
            }
            title={
              <>
                On <Num>{fmtTime(span.start)}</Num>, off <Num>{fmtTime(preview.item!.finish)}</Num>
              </>
            }
          >
            <Text v="label" tone="soft">
              <Num>{fmtDuration(span.minutes)}</Num> on heat{methodText(it, info, units)}.
              {fire && (
                <>
                  {' '}
                  Fire the {fire.what} at <Num>{fmtTime(fire.at)}</Num>.
                </>
              )}
            </Text>
            {itemWarnings.map(w => (
              <Text key={w.code} v="caption" tone={w.level === 'warn' ? 'warn' : 'secondary'}>
                {tx(w.message, units)}
              </Text>
            ))}
          </ResultCard>
        </KeepVisible>
      )}
      {preview.error && <InfoBox>Could not plan this item: {preview.error}</InfoBox>}
      {cookerMissing && (
        <Text v="label" tone="warn">
          Add a {m.cooker} in Gear to cook this.
        </Text>
      )}
    </>
  );
}

type RateInfo = NonNullable<ReturnType<typeof usePreview>['item']>['rateInfo'];

/** Result card tail: ", your rate 0.75 hr/lb" */
function methodText(it: ItemInput, info: RateInfo, units: Units) {
  if (it.timingModel === 'totalHours') return ', your total hours';
  if (!info) return '';
  const rate = <Num>{fmtRate(info.hrPerLbAt225, units)}</Num>;
  if (info.model === 'sizeAdjusted') return <>, size-adjusted from {rate}</>;
  const who =
    info.source === 'item' || info.source === 'override'
      ? 'your rate'
      : info.source === 'blended'
        ? 'your rate, adjusted'
        : info.source === 'learned'
          ? 'learned rate'
          : 'published rate';
  return (
    <>
      , {who} {rate}
    </>
  );
}

/** Timing: hours per pound, total hours or size-adjusted (by-weight foods); standard or total hours (others). */
function Timing({
  f,
  it,
  setIt,
  info,
  spanMin,
  base,
  units,
  remember,
  setRemember,
  hint,
}: {
  f: ReturnType<typeof food>;
  it: ItemInput;
  setIt: (i: ItemInput) => void;
  info: RateInfo;
  spanMin: number;
  base: PlanInput;
  units: Units;
  remember: boolean;
  setRemember: (v: boolean) => void;
  hint: boolean;
}) {
  const { state } = useStore();
  const byWeight = !!info;
  const model: TimingModel | 'standard' =
    it.timingModel === 'totalHours' ? 'totalHours' : byWeight ? (it.timingModel ?? 'perPound') : 'standard';
  const limits: [number, number] = rules.learning.rateLimits;
  const usual: [number, number] = rules.learning.rateHint;
  const m = method(it.foodId, it.methodId);
  const where = cookerName(base.cookers, m.cooker);

  const pick = (v: string) => {
    if (v === model) return;
    if (v === 'totalHours') {
      const hours = it.totalHours ?? state.totalHours[it.foodId] ?? roundHours(spanMin);
      setIt({ ...it, timingModel: 'totalHours', totalHours: hours, totalHoursAtF: base.pitTempF });
    } else setIt({ ...it, timingModel: v === 'standard' ? undefined : (v as TimingModel) });
    setRemember(false);
  };
  const options = byWeight
    ? [
        { id: 'perPound', label: 'Hours per pound' },
        { id: 'totalHours', label: 'Total hours' },
        { id: 'sizeAdjusted', label: 'Size-adjusted' },
      ]
    : [
        { id: 'standard', label: 'Standard' },
        { id: 'totalHours', label: 'Total hours' },
      ];
  const hours = it.totalHours ?? roundHours(spanMin);
  const setHours = (h: number) => setIt({ ...it, totalHours: h, totalHoursAtF: base.pitTempF });

  return (
    <Field label="Timing">
      <Chips label="Timing" value={model} onChange={pick} options={options} />
      {model === 'perPound' && info && (
        <>
          <Stepper
            label="Hours per pound"
            value={rateText(info.hrPerLbAt225, units)}
            unit={`hr/${units.weight}`}
            decDisabled={info.hrPerLbAt225 <= limits[0] + 1e-9}
            incDisabled={info.hrPerLbAt225 >= limits[1] - 1e-9}
            onDec={() => setIt({ ...it, hrPerLb: stepRate(info.hrPerLbAt225, -1, units, limits) })}
            onInc={() => setIt({ ...it, hrPerLb: stepRate(info.hrPerLbAt225, 1, units, limits) })}
          />
          <Text v="caption" tone="secondary">
            At 225F: {sourceText(info.source, info.cooksLogged)}.
          </Text>
          {rateUnusual(info.hrPerLbAt225, usual) && (
            <Text v="caption" tone="warn">
              Unusual rate. Most cooks land between {rateText(usual[0], units)} and {rateText(usual[1], units)} hr/
              {units.weight}.
            </Text>
          )}
        </>
      )}
      {model === 'totalHours' && (
        <>
          <Stepper
            label="Total hours"
            value={hoursText(hours)}
            unit="hr on heat"
            decDisabled={hours <= HOURS_MIN}
            incDisabled={hours >= HOURS_MAX}
            onDec={() => setHours(stepHours(hours, -1))}
            onInc={() => setHours(stepHours(hours, 1))}
          />
          <Text v="caption" tone="secondary">
            Used as-is. Smoker temp and wrap do not change it.
          </Text>
        </>
      )}
      {model === 'sizeAdjusted' && info && (
        <Text v="caption" tone="secondary">
          Estimate. Gets better after a few logged cooks. Based on <Num>{fmtRate(info.hrPerLbAt225, units)}</Num> at{' '}
          {refText(f, units)}.
        </Text>
      )}
      {(model === 'perPound' || model === 'totalHours') && (
        <CheckRow
          title={`Use for future ${f.name.toLowerCase()} on ${where}`}
          checked={remember}
          onChange={setRemember}
          subtitle={remember ? 'Saved when you tap Save. Change it in Gear, Cook rates.' : 'Only this cook.'}
        />
      )}
      {hint && <InfoBox>Published estimate. Most pellet smokers run faster. Set your own rate or total hours.</InfoBox>}
    </Field>
  );
}

function refText(f: ReturnType<typeof food>, units: Units) {
  const w: number = f.quantity.referenceWeight ?? f.quantity.default;
  return units.weight === 'kg' ? `${+lbToKg(w).toFixed(1)} kg` : `${w} lb`;
}
