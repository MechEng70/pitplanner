// Food details (mockups 08-10): quantity, cooker, method, options, rest, the timing model and a live result.
// A port of legacy/src/screens/plan/FoodEdit.tsx with two changes (T-019):
// - Nothing scrolls, takes focus or moves when a value changes. 0.2.0 wrapped the result card in KeepVisible,
//   which scrolled the screen to it after every change and took the stepper from under the finger (Jason,
//   2026-11-14). Instead the result shows in a bar pinned above the buttons; the only scroll is the one the
//   user asks for by tapping that bar. The sheet keeps its full height and its content never gets shorter
//   while it is open, so a change cannot shift or clamp what is being tapped (T-017 PR-3).
// - The values the user saves for later (rate, total hours, the hint flag) go through the store.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { buildPlan, onHeatSpan, rateHintFor } from '../../../engine/plan';
import type { CookerKind, Cookers, ItemInput, PlanInput, TimingModel } from '../../../engine/types';
import { missingCookers, smokerReachF, smokerTooCool } from '../../../engine/rules';
import { kgToLb, lbToKg } from '../../../engine/units';
import {
  Button,
  CheckRow,
  Chips,
  Field,
  InfoBox,
  Num,
  ResultBar,
  ResultCard,
  Sheet,
  Stepper,
  Text,
  useReveal,
  useSheet,
  type ResultCell,
} from '@/components/kit';
import { fmtDuration, fmtRate, fmtTemp, fmtTempRange, fmtTime, tx, type Units } from '@/lib/format';
import { sourceText } from '@/lib/historyView';
import {
  cookerKinds,
  cookerName,
  defaultOptions,
  food,
  hasCooker,
  method,
  rules,
  type FoodDef,
  type MethodDef,
} from '@/lib/rules';
import { useStore } from '@/lib/store';
import { HOURS_MAX, HOURS_MIN, hoursText, rateText, rateUnusual, roundHours, stepHours, stepRate } from '@/lib/timing';

const REST_STEP = 5;
const REST_MAX = 240;
const KG_STEP = 0.25;

/**
 * The note on a method chip whose smoker cannot get hot enough for it (Jason, 2026-11-16, T-075): {temp} is
 * the lowest temp the method can be done at, from the rules (450F for the smoker sear), in the user's units.
 */
export const SMOKER_NEEDS = 'Needs {temp}';

/**
 * A method the cookers cannot do is offered but off, with its note where the Cook on chips put "Add in Gear"
 * (T-075): a step on a cooker that is not set up (tri-tip's griddle sear), or a smoker that tops out below
 * the method's lowest temp (the smoker sear on a smoker under 450F).
 */
function methodOff(f: FoodDef, x: MethodDef, cookers: Cookers, units: Units): { disabled?: boolean; hint?: string } {
  if (missingCookers(f, x, cookers).length > 0) return { disabled: true, hint: 'Add in Gear' };
  const reach = smokerReachF(f, x);
  if (reach != null && smokerTooCool(f, x, cookers))
    return { disabled: true, hint: SMOKER_NEEDS.replace('{temp}', fmtTemp(reach, units, true)) };
  return {};
}

export interface FoodEditProps {
  initial: ItemInput;
  /** Not on the menu yet: it goes there on "Add to plan". */
  isNew: boolean;
  /** The plan as it is: with the item in it when it is on the menu, without it when it is new. */
  base: PlanInput;
  units: Units;
  /** "Use for future" as it was left, when the screen is reopened after the app was killed (T-058). */
  remember?: boolean;
  /** Every change to the form, as it is made, so it can be saved and survive the app being killed. */
  onChange?: (it: ItemInput, remember: boolean) => void;
  onSave: (it: ItemInput) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function FoodEdit(props: FoodEditProps) {
  const { state, setRate, setTotalHours, setFlags } = useStore();
  const [it, setIt] = useState<ItemInput>(props.initial);
  const [remember, setRemember] = useState(props.remember ?? false);
  const { onChange } = props;
  useEffect(() => onChange?.(it, remember), [onChange, it, remember]);
  // Shown once ever, the first time a by-weight food is added on the published rate.
  const [showHint] = useState(props.isNew && !state.flags.rateHintShown);
  const preview = usePreview(it, props.base, props.isNew);
  const card = useRef<HostInstance>(null);
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
      tall
      title={food(it.foodId).name}
      onClose={props.onClose}
      footer={
        <Footer
          isNew={props.isNew}
          blocked={blocked}
          cells={barCells(preview, m.cooker)}
          card={card}
          onSave={save}
          onRemove={props.onRemove}
        />
      }
    >
      <Body
        {...props}
        it={it}
        setIt={setIt}
        preview={preview}
        remember={remember}
        setRemember={setRemember}
        hint={hint}
        card={card}
      />
    </Sheet>
  );
}

type CardRef = RefObject<HostInstance | null>;

function Footer({
  isNew,
  blocked,
  cells,
  card,
  onSave,
  onRemove,
}: {
  isNew: boolean;
  blocked: boolean;
  cells: ResultCell[] | null;
  card: CardRef;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { close } = useSheet();
  const reveal = useReveal();
  return (
    <View className="min-w-0 flex-1 gap-2">
      {cells ? <ResultBar cells={cells} onPress={() => reveal(card.current)} /> : null}
      <View className="flex-row items-center gap-2">
        {!isNew ? (
          <Button kind="text" tone="danger" onPress={() => close(onRemove)}>
            <Text>Remove</Text>
          </Button>
        ) : null}
        <Button className="min-w-0 flex-1" disabled={blocked} onPress={() => close(onSave)}>
          <Text>{isNew ? 'Add to plan' : 'Save'}</Text>
        </Button>
      </View>
    </View>
  );
}

/** The whole plan with this item in it, so fire time and conflicts in the preview are real. */
function usePreview(it: ItemInput, base: PlanInput, isNew: boolean) {
  return useMemo(() => {
    const items = isNew ? [...base.items, it] : base.items.map(x => (x.id === it.id ? it : x));
    try {
      const plan = buildPlan(rules, { ...base, items });
      return { plan, item: plan.items.find(x => x.input.id === it.id) ?? null, error: null as string | null };
    } catch (e) {
      return { plan: null, item: null, error: String(e) };
    }
  }, [it, base, isNew]);
}
type Preview = ReturnType<typeof usePreview>;
type RateInfo = NonNullable<Preview['item']>['rateInfo'];

/** When this food's cooker is lit: the smoker's fire time or the griddle's. */
function fireOf(preview: Preview, cooker: CookerKind): { what: string; at: number } | null {
  const plan = preview.plan;
  if (!plan) return null;
  if (cooker === 'smoker' && plan.fireAt != null) return { what: 'smoker', at: plan.fireAt };
  if (cooker === 'griddle' && plan.griddleOnAt != null) return { what: 'griddle', at: plan.griddleOnAt };
  return null;
}

/** The pinned bar: fire (or on heat, for a cooker that is not lit ahead), off heat and serve. */
function barCells(preview: Preview, cooker: CookerKind): ResultCell[] | null {
  const { plan, item } = preview;
  if (!plan || !item) return null;
  const fire = fireOf(preview, cooker);
  return [
    fire ? { label: 'Fire', value: fmtTime(fire.at) } : { label: 'On', value: fmtTime(onHeatSpan(item).start) },
    { label: 'Off heat', value: fmtTime(item.finish) },
    { label: 'Serve', value: fmtTime(plan.serveAt) },
  ];
}

/**
 * The form's height only ever grows while the sheet is open: at the end of the scroll, content that got
 * shorter (a warning going away, a result line unwrapping) would make the view clamp and move everything.
 */
function useNeverShorter() {
  const [minHeight, setMinHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setMinHeight(min => (h > min ? h : min));
  };
  const style = useMemo(() => ({ minHeight }), [minHeight]);
  return { style, onLayout };
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
  card,
}: FoodEditProps & {
  it: ItemInput;
  setIt: (i: ItemInput) => void;
  preview: Preview;
  remember: boolean;
  setRemember: (v: boolean) => void;
  hint: boolean;
  card: CardRef;
}) {
  const f = food(it.foodId);
  const m = method(it.foodId, it.methodId);
  const q = f.quantity;
  const cookers = base.cookers;
  const frame = useNeverShorter();

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
    for (const k of Object.keys(opts)) {
      const mine = it.options?.[k];
      if (mine && nm.options?.[k]?.choices[mine]) opts[k] = mine;
    }
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
  const fire = fireOf(preview, m.cooker);

  return (
    <View className="gap-4" style={frame.style}>
      <View className="gap-4" onLayout={frame.onLayout}>
        <Field label={q.label ?? (q.kind === 'weight' ? 'Weight' : 'How many')}>
          <Stepper
            label={q.label ?? (q.kind === 'weight' ? 'Weight' : q.unit.charAt(0).toUpperCase() + q.unit.slice(1))}
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
            options={cookerKinds(f).map(k => ({
              id: k,
              label: cookerName(cookers, k),
              disabled: !hasCooker(cookers, k),
              hint: hasCooker(cookers, k) ? undefined : 'Add in Gear',
            }))}
          />
        </Field>

        {methodsHere.length > 1 ? (
          <Field label="Method" note={m.note ? tx(m.note, units) : undefined}>
            <Chips
              label="Method"
              value={m.id}
              onChange={pickMethod}
              options={methodsHere.map(x => ({
                id: x.id,
                label: tx(x.label, units),
                ...methodOff(f, x, cookers, units),
              }))}
            />
          </Field>
        ) : null}

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
              {choice?.pullF || choice?.note ? (
                <InfoBox
                  lead={
                    choice.pullF ? (
                      <>
                        Pull at <Num>{fmtTempRange(choice.pullF, units)}</Num>.
                      </>
                    ) : undefined
                  }
                >
                  {choice.note ? tx(choice.note, units) : null}
                </InfoBox>
              ) : null}
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

        {span ? (
          <Timing
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
        ) : null}

        {plan && span && preview.item ? (
          <View ref={card} collapsable={false}>
            <ResultCard
              overline={
                <Text>
                  For serve at <Num>{fmtTime(plan.serveAt)}</Num>
                </Text>
              }
              title={
                <Text>
                  On <Num>{fmtTime(span.start)}</Num>, off <Num>{fmtTime(preview.item.finish)}</Num>
                </Text>
              }
            >
              <Text variant="label" tone="soft">
                <Num>{fmtDuration(span.minutes)}</Num> on heat
                <MethodText it={it} info={info} units={units} />.
                {fire ? (
                  <>
                    {' '}
                    Fire the {fire.what} at <Num>{fmtTime(fire.at)}</Num>.
                  </>
                ) : null}
              </Text>
              {itemWarnings.map(w => (
                <Text key={`${w.code}:${w.message}`} variant="caption" tone={w.level === 'warn' ? 'warn' : 'secondary'}>
                  {tx(w.message, units)}
                </Text>
              ))}
            </ResultCard>
          </View>
        ) : null}
        {preview.error ? <InfoBox>Could not plan this item: {preview.error}</InfoBox> : null}
        {cookerMissing ? (
          <Text variant="label" tone="warn">
            Add a {m.cooker} in Gear to cook this.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Result card tail: ", your rate 0.75 hr/lb" */
function MethodText({ it, info, units }: { it: ItemInput; info: RateInfo; units: Units }) {
  if (it.timingModel === 'totalHours') return <Text>, your total hours</Text>;
  if (!info) return null;
  const rate = <Num>{fmtRate(info.hrPerLbAt225, units)}</Num>;
  if (info.model === 'sizeAdjusted') return <Text>, size-adjusted from {rate}</Text>;
  const who =
    info.source === 'item' || info.source === 'override'
      ? 'your rate'
      : info.source === 'blended'
        ? 'your rate, adjusted'
        : info.source === 'learned'
          ? 'learned rate'
          : 'published rate';
  return (
    <Text>
      , {who} {rate}
    </Text>
  );
}

/** Timing: hours per pound, total hours or size-adjusted (by-weight foods); standard or total hours (others). */
function Timing({
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
  const f = food(it.foodId);
  const byWeight = !!info;
  const model: TimingModel | 'standard' =
    it.timingModel === 'totalHours' ? 'totalHours' : byWeight ? (it.timingModel ?? 'perPound') : 'standard';
  const limits = rules.learning.rateLimits;
  const usual = rateHintFor(rules, it.foodId);
  const where = cookerName(base.cookers, method(it.foodId, it.methodId).cooker);

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
      {model === 'perPound' && info ? (
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
          <Text variant="caption" tone="secondary">
            At 225F: {sourceText(info.source, info.cooksLogged)}.
          </Text>
          {rateUnusual(info.hrPerLbAt225, usual) ? (
            <Text variant="caption" tone="warn">
              Unusual rate. Most cooks land between {rateText(usual[0], units)} and {rateText(usual[1], units)} hr/
              {units.weight}.
            </Text>
          ) : null}
        </>
      ) : null}
      {model === 'totalHours' ? (
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
          <Text variant="caption" tone="secondary">
            Used as-is. Smoker temp and wrap do not change it.
          </Text>
        </>
      ) : null}
      {model === 'sizeAdjusted' && info ? (
        <Text variant="caption" tone="secondary">
          Estimate. Gets better after a few logged cooks. Based on <Num>{fmtRate(info.hrPerLbAt225, units)}</Num> at{' '}
          {refText(it.foodId, units)}.
        </Text>
      ) : null}
      {model === 'perPound' || model === 'totalHours' ? (
        <View className="-mx-4">
          <CheckRow
            title={`Use for future ${f.name.toLowerCase()} on ${where}`}
            checked={remember}
            onChange={setRemember}
            subtitle={remember ? 'Saved when you tap Save. Change it in Gear, Cook rates.' : 'Only this cook.'}
          />
        </View>
      ) : null}
      {hint ? (
        <InfoBox>Published estimate. Most pellet smokers run faster. Set your own rate or total hours.</InfoBox>
      ) : null}
    </Field>
  );
}

function refText(foodId: string, units: Units) {
  const q = food(foodId).quantity;
  const w = q.referenceWeight ?? q.default;
  return units.weight === 'kg' ? `${+lbToKg(w).toFixed(1)} kg` : `${w} lb`;
}
