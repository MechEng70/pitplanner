// Cook history (mockup 20; a port of legacy/src/screens/gear/HistoryScreen.tsx): the cook rates per by-weight
// food on the user's smoker, then the saved cooks, newest first. Opened from Gear, Cook rates and from Plan,
// Cook a past plan again.
// - A rate card opens the saved rate and total hours for that food ("Keep my rate exactly").
// - A cook opens its sheet: planned vs actual per food, notes, Cook again, Edit and Remove from history.
//   Remove is the only thing in the app that deletes a saved cook (T-064).
// - Edit (SPEC failure mode 14, new in 0.3.0, no mockup): smoker temp, each food's size and time on heat,
//   "Leave out of rates" per by-weight food, notes. Left out is the item's `discarded` flag, the one a food
//   that never came off heat already has, so no schema change was needed. The edit sheet keeps its full
//   height and every control keeps its place when a value changes (T-017 PR-3).
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { inSentence } from '../../../engine/labels';
import { rateHintFor } from '../../../engine/plan';
import { resolveMethod, type RuleFood } from '../../../engine/rules';
import { settableTemps } from '../../../engine/temps';
import type { CookLog, SmokerProfile } from '../../../engine/types';
import { kgToLb, lbToKg } from '../../../engine/units';
import {
  Button,
  Card,
  CheckRow,
  Divider,
  Field,
  Fill,
  InputField,
  Num,
  Row,
  Screen,
  Sheet,
  Stack,
  Stepper,
  Text,
  Tile,
  Tiles,
  useSheet,
} from '@/components/kit';
import { fmtDay, fmtDuration, fmtTemp, tx, type Units } from '@/lib/format';
import type { CookRecord } from '@/lib/history';
import { cookAgainItems, menuLine, missLine, rateRows, serveStatus, sourceText, type RateRow } from '@/lib/historyView';
import { newItemId } from '@/lib/itemId';
import { rules } from '@/lib/rules';
import { defaultServe, useStore } from '@/lib/store';
import {
  HOURS_MAX,
  HOURS_MIN,
  hoursText,
  rateShown,
  rateText,
  rateUnusual,
  roundHours,
  stepHours,
  stepRate,
} from '@/lib/timing';

const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
const HOUR_MS = 3_600_000;
/** Within this many minutes reads as on plan (same as Cook finished). */
const ON_PLAN_MIN = 2;
const KG_STEP = 0.25;
/** Time on heat in the edit sheet: 5 min steps, up to two days. */
const MIN_STEP = 5;
const MIN_MAX = 48 * 60;
/** Smoker temps offered in the edit sheet when no smoker is set up. */
const TEMP_STEP_F = 5;
const TEMP_RANGE_F = [150, 500] as const;

export const EDIT_TITLE = 'Edit cook';

export interface HistoryScreenProps {
  onBack: () => void;
  /** After Cook again has put the menu on the plan: the route opens Plan. */
  onCookAgain: () => void;
  /** The phone's back button, while this screen is the one showing (the route subscribes). */
  onBackPress?: (handler: () => boolean) => () => void;
  now?: () => number;
}

export function HistoryScreen({ onBack, onCookAgain, onBackPress, now = Date.now }: HistoryScreenProps) {
  const { state, setDraft, updateRecord, removeRecord, setRate, setTotalHours, setRateLock } = useStore();
  const { units } = state;
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [rate, setRateRow] = useState<RateRow | null>(null);
  useEffect(
    () =>
      onBackPress?.(() => {
        onBack();
        return true;
      }),
    [onBackPress, onBack],
  );

  const smoker = state.gear.smoker;
  const records = [...state.records].sort((a, b) => b.date - a.date);
  // A card only for a food in a saved cook or with a saved rate or total hours (Jason, 2026-11-15), so the
  // cooks are not a screenful of published rates down.
  const cooked = new Set(records.flatMap(r => r.items.map(i => i.log.foodId)));
  const rows = rateRows(
    rules,
    state.history,
    smoker?.id ?? 'none',
    state.rates,
    state.totalHours,
    state.rateLocks,
  ).filter(r => cooked.has(r.foodId) || r.saved != null || r.totalHours != null);
  const open = records.find(r => r.id === openId);
  const edit = records.find(r => r.id === editId);

  const cookAgain = (r: CookRecord) => {
    const t = now();
    setDraft(d => {
      const ids: string[] = [];
      const newId = () => {
        const id = newItemId(ids, t);
        ids.push(id);
        return id;
      };
      return {
        ...d,
        mode: 'readyBy',
        at: d.mode === 'readyBy' && d.at > t + HOUR_MS ? d.at : defaultServe(t),
        pitTempF: r.pitTempF,
        items: cookAgainItems(rules, r, newId),
      };
    });
    onCookAgain();
  };

  return (
    <Screen title="Cook history" onBack={onBack}>
      {rows.map(r => (
        <RateCard key={r.foodId} row={r} smoker={smoker?.name} units={units} onPress={() => setRateRow(r)} />
      ))}
      {rows.length > 0 ? (
        <Text variant="bodyM" tone="tertiary">
          {tx(`Rates are hours per ${units.weight} at 225F.`, units)} Tap a food to set your own rate or total hours.
        </Text>
      ) : null}

      <Text variant="section" tone="secondary" role="heading">
        Cooks
      </Text>
      {records.length === 0 ? (
        <Text variant="bodyM" tone="secondary">
          No cooks saved yet. Save a cook when it ends and your rates start to learn from it.
        </Text>
      ) : null}
      {records.map(r => (
        <CookCard key={r.id} record={r} units={units} onPress={() => setOpenId(r.id)} />
      ))}
      {records.length > 0 ? (
        <Text variant="bodyM" tone="tertiary">
          Tap a cook to see planned vs actual times, your notes, and to cook it again with a new serve time.
        </Text>
      ) : null}

      {rate ? (
        <RateSheet
          row={rate}
          units={units}
          onClose={() => setRateRow(null)}
          onSave={(hrPerLb, hours, locked) => {
            setRate(rate.foodId, hrPerLb);
            setTotalHours(rate.foodId, hours);
            setRateLock(rate.foodId, hrPerLb != null && locked);
          }}
        />
      ) : null}
      {open ? (
        <CookSheet
          record={open}
          units={units}
          asks={state.draft.items.length > 0}
          onClose={() => setOpenId(null)}
          onCookAgain={() => cookAgain(open)}
          onEdit={() => setEditId(open.id)}
          onRemove={() => removeRecord(open.id)}
        />
      ) : null}
      {edit ? (
        <EditSheet record={edit} smoker={smoker} units={units} onClose={() => setEditId(null)} onSave={updateRecord} />
      ) : null}
    </Screen>
  );
}

/** A duration, weight or temp with its unit, as the format helpers write them. */
const VALUE = /(\d+ hr \d+ min|\d+(?:\.\d+)? (?:hr|min|lb|kg)\b|\d+[FC]\b)/;

/** A line from the view helpers with each value in it as a Num, so none breaks across lines. Goes inside a Text. */
function Values({ text }: { text: string }) {
  return <>{text.split(VALUE).map((part, i) => (i % 2 ? <Num key={i}>{part}</Num> : part))}</>;
}

const SOURCE_SHORT = {
  override: 'yours',
  blended: 'adjusted',
  learned: 'learned',
  default: 'published',
  item: 'yours',
} as const;

function RateCard({
  row,
  smoker,
  units,
  onPress,
}: {
  row: RateRow;
  smoker: string | undefined;
  units: Units;
  onPress: () => void;
}) {
  return (
    <Card col onPress={onPress} label={row.foodName}>
      <Text variant="section">{smoker && row.methodId ? `${row.foodName} on ${smoker}` : row.foodName}</Text>
      <Tiles inset>
        {row.hrPerLb != null && row.source ? (
          <Tile label={`hr/${units.weight}`} value={rateText(row.hrPerLb, units)} sub={SOURCE_SHORT[row.source]} />
        ) : null}
        {row.methodId ? <Tile label="Cooks" value={String(row.cooks)} sub="logged" /> : null}
        <Tile
          label="Total"
          value={row.totalHours != null ? `${hoursText(row.totalHours)} hr` : 'None'}
          sub={row.totalHours != null ? 'yours' : 'not set'}
        />
      </Tiles>
    </Card>
  );
}

function CookCard({ record, units, onPress }: { record: CookRecord; units: Units; onPress: () => void }) {
  const status = serveStatus(record);
  const miss = missLine(record);
  const day = fmtDay(record.date);
  return (
    <Card col onPress={onPress} label={day}>
      <Stack gap={4}>
        <Row gap={12} justify="between" align="start">
          <Fill>
            <Text variant="tile">{day}</Text>
          </Fill>
          {status ? (
            <Text variant="bodyM" weight="500" tone={status.tone}>
              <Values text={status.text} />
            </Text>
          ) : null}
        </Row>
        <Text variant="bodyM" tone="secondary">
          <Values text={menuLine(rules, record, units)} />
        </Text>
        {miss ? (
          <Text variant="bodyM">
            <Values text={miss} />
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}

/** Kept in the layout, unseen and out of reach, so showing it later moves nothing. */
function Reserved({ shown, children }: { shown: boolean; children: React.ReactNode }) {
  return (
    <View
      className={shown ? undefined : 'opacity-0'}
      aria-hidden={!shown}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

/** Edit one food's saved hr/lb and saved total hours. Clearing the rate goes back to learned or published. */
function RateSheet({
  row,
  units,
  onClose,
  onSave,
}: {
  row: RateRow;
  units: Units;
  onClose: () => void;
  onSave: (rate: number | null, hours: number | null, locked: boolean) => void;
}) {
  const learnAfter = rules.learning.savedRateLearnsAfter;
  const limits = rules.learning.rateLimits;
  const usual = rateHintFor(rules, row.foodId);
  const [rate, setRate] = useState<number | null>(row.saved);
  const [locked, setLocked] = useState(row.locked);
  const [hours, setHours] = useState<number | null>(row.totalHours);
  const shownRate = rate ?? row.hrPerLb;
  const mine = rate != null;
  const fallback =
    row.saved != null ? (row.cooks ? 'learned' : 'published') : sourceText(row.source ?? 'default', row.cooks);
  return (
    <Sheet
      tall
      title={row.foodName}
      onClose={onClose}
      footer={<SaveButton onSave={() => onSave(rate, hours, locked)} />}
    >
      {shownRate != null ? (
        <Field
          label={tx(`Hours per ${units.weight} at 225F`, units)}
          note={
            !mine ? (
              `Using the ${fallback} rate. Change it to save your own.`
            ) : row.source === 'blended' && rate === row.saved && !locked && row.hrPerLb != null ? (
              <Text>
                Plans use <Num>{rateText(row.hrPerLb, units)}</Num>: your rate adjusted by {row.cooks} logged cooks.
              </Text>
            ) : (
              'Your setting. Plans use it as-is.'
            )
          }
        >
          <Stepper
            label="Hours per pound"
            value={rateText(shownRate, units)}
            unit={`hr/${units.weight}`}
            decDisabled={rateShown(shownRate, units) <= rateShown(limits[0], units)}
            incDisabled={rateShown(shownRate, units) >= rateShown(limits[1], units)}
            onDec={() => setRate(stepRate(shownRate, -1, units, limits))}
            onInc={() => setRate(stepRate(shownRate, 1, units, limits))}
          />
          {/* Its line is always there, so the rows under it stay put while the rate is stepped. */}
          <Reserved shown={rateUnusual(shownRate, usual)}>
            <Text variant="caption" tone="warn">
              Unusual rate. Most cooks land between <Num>{rateText(usual[0], units)}</Num> and{' '}
              <Num>{`${rateText(usual[1], units)} hr/${units.weight}`}</Num>.
            </Text>
          </Reserved>
          <Reserved shown={mine}>
            <View className="-mx-4">
              <CheckRow
                title="Keep my rate exactly"
                checked={locked}
                onChange={v => (mine ? setLocked(v) : undefined)}
                subtitle={
                  locked
                    ? 'Logged cooks never change it.'
                    : `After ${learnAfter} logged cooks, plans adjust it to how your cooks went.`
                }
              />
            </View>
            <Button kind="text" onPress={() => setRate(null)}>
              <Text>Clear my rate</Text>
            </Button>
          </Reserved>
        </Field>
      ) : null}
      <Field
        label="Total hours on heat"
        note={hours != null ? 'New plans with this food start on total hours.' : 'Not set. Plans use the rate.'}
      >
        {hours != null ? (
          <>
            <Stepper
              label="Total hours"
              value={hoursText(hours)}
              unit="hr"
              decDisabled={hours <= HOURS_MIN}
              incDisabled={hours >= HOURS_MAX}
              onDec={() => setHours(stepHours(hours, -1))}
              onInc={() => setHours(stepHours(hours, 1))}
            />
            <Button kind="text" onPress={() => setHours(null)}>
              <Text>Clear total hours</Text>
            </Button>
          </>
        ) : (
          <Button kind="outline" onPress={() => setHours(startHours(row))}>
            <Text>Set total hours</Text>
          </Button>
        )}
      </Field>
    </Sheet>
  );
}

/** Starting value for Set total hours: the rate at the food's usual size, else 4 hours. */
function startHours(row: RateRow): number {
  const f = rules.foods.find(x => x.id === row.foodId);
  return row.hrPerLb != null && f ? roundHours(row.hrPerLb * f.quantity.default * 60) : 4;
}

function SaveButton({ onSave }: { onSave: () => void }) {
  const { close } = useSheet();
  return (
    <Button block onPress={() => close(onSave)}>
      <Text>Save</Text>
    </Button>
  );
}

/** "On plan", "25 min ahead", "10 min behind", or "Not logged" for a food left out of rates. */
function verdictOf(it: CookRecord['items'][number]): { text: string; tone: 'ok' | 'warn' | 'secondary' } {
  if (it.log.discarded) return { text: 'Not logged', tone: 'secondary' };
  const d = it.actualMin - it.plannedMin;
  if (Math.abs(d) < ON_PLAN_MIN) return { text: 'On plan', tone: 'ok' };
  return d < 0 ? { text: `${fmtDuration(-d)} ahead`, tone: 'ok' } : { text: `${fmtDuration(d)} behind`, tone: 'warn' };
}

/** One saved cook: planned vs actual per food, notes, Cook again, Edit, Remove. */
function CookSheet({
  record,
  units,
  asks,
  onClose,
  onCookAgain,
  onEdit,
  onRemove,
}: {
  record: CookRecord;
  units: Units;
  asks: boolean;
  onClose: () => void;
  onCookAgain: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const status = serveStatus(record);
  return (
    <Sheet
      title={longFmt.format(record.date)}
      onClose={onClose}
      footer={<CookActions asks={asks} onCookAgain={onCookAgain} onEdit={onEdit} onRemove={onRemove} />}
    >
      <Text variant="bodyM" tone="secondary">
        Pit at <Num>{fmtTemp(record.pitTempF, units, true)}</Num>.
        {status ? (
          <>
            {' '}
            <Values text={status.text} />.
          </>
        ) : null}
      </Text>
      <Stack gap={4}>
        {record.items.map((it, i) => {
          const v = verdictOf(it);
          return (
            <Stack key={i} gap={4}>
              {i > 0 ? <Divider /> : null}
              <Row gap={12} justify="between" align="start">
                <Fill>
                  <Text variant="bodyL">{it.name}</Text>
                  <Text variant="label" tone="secondary" relaxed>
                    <Values
                      text={
                        it.log.discarded
                          ? `Planned ${fmtDuration(it.plannedMin)}`
                          : `Planned ${fmtDuration(it.plannedMin)}, took ${fmtDuration(it.actualMin)}`
                      }
                    />
                  </Text>
                </Fill>
                <Text variant="bodyM" weight="500" tone={v.tone}>
                  <Values text={v.text} />
                </Text>
              </Row>
            </Stack>
          );
        })}
      </Stack>
      {record.notes ? (
        <Stack gap={4}>
          <Text variant="label" tone="secondary">
            Notes
          </Text>
          <Text variant="bodyM">{record.notes}</Text>
        </Stack>
      ) : null}
    </Sheet>
  );
}

function CookActions({
  asks,
  onCookAgain,
  onEdit,
  onRemove,
}: {
  /** The plan has food on it: Cook again replaces it, so the first tap only says so. */
  asks: boolean;
  onCookAgain: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { close } = useSheet();
  const [confirm, setConfirm] = useState(false);
  const [asked, setAsked] = useState(false);
  return (
    <View className="min-w-0 flex-1 gap-1">
      <View className="flex-row items-center gap-2">
        <Button kind="text" onPress={() => close(onEdit)}>
          <Text>Edit</Text>
        </Button>
        <Button className="min-w-0 flex-1" onPress={() => (asks && !asked ? setAsked(true) : close(onCookAgain))}>
          <Text>Cook again</Text>
        </Button>
      </View>
      {/* Under the buttons, so the one just tapped does not move. */}
      {asked ? (
        <Text variant="label" tone="secondary">
          This replaces the plan you have now. Tap Cook again to go on.
        </Text>
      ) : null}
      {/* Two taps: the first only asks. */}
      <Button kind="text" block tone="danger" onPress={() => (confirm ? close(onRemove) : setConfirm(true))}>
        <Text>{confirm ? 'Tap again to remove from history' : 'Remove from history'}</Text>
      </Button>
    </View>
  );
}

/* ---------- Edit a saved cook (failure mode 14) ---------- */

interface ItemEdit {
  quantity: number; // lb or a count, as stored
  minutes: number; // on heat
  out: boolean; // left out of rates
}

const foodOf = (id: string): RuleFood | undefined => rules.foods.find(f => f.id === id);
/** Only a by-weight method has a rate to learn. */
function hasRate(log: CookLog): boolean {
  const f = foodOf(log.foodId);
  const m = f?.methods.find(x => x.id === log.methodId);
  return !!f && !!m && resolveMethod(f, m).timing?.kind === 'perWeight';
}

/** The temps the stepper walks: the smoker's own set points, else 5F steps. */
function tempsFor(smoker: SmokerProfile | undefined): number[] {
  const own = smoker ? settableTemps(smoker) : [];
  if (own.length > 1) return own;
  const out: number[] = [];
  for (let t = TEMP_RANGE_F[0]; t <= TEMP_RANGE_F[1]; t += TEMP_STEP_F) out.push(t);
  return out;
}

/** The record with the edits in it. Nothing else about it changes (date, lateness, planned times, names). */
export function applyEdit(r: CookRecord, pitTempF: number, notes: string, items: ItemEdit[]): CookRecord {
  return {
    ...r,
    notes,
    pitTempF,
    items: r.items.map((it, i) => {
      const e = items[i];
      if (!e) return it;
      const { discarded: _was, ...log } = it.log;
      return {
        ...it,
        actualMin: e.minutes,
        log: {
          ...log,
          quantity: e.quantity,
          // A changed smoker temp is the whole cook's; unchanged, each food keeps what it logged.
          pitTempF: pitTempF === r.pitTempF ? log.pitTempF : pitTempF,
          minutesOnHeat: e.minutes,
          ...(e.out ? { discarded: true } : {}),
        },
      };
    }),
  };
}

function EditSheet({
  record,
  smoker,
  units,
  onClose,
  onSave,
}: {
  record: CookRecord;
  smoker: SmokerProfile | undefined;
  units: Units;
  onClose: () => void;
  onSave: (r: CookRecord) => void;
}) {
  const [pitTempF, setPitTempF] = useState(record.pitTempF);
  const [notes, setNotes] = useState(record.notes);
  const [items, setItems] = useState<ItemEdit[]>(() =>
    record.items.map(it => ({ quantity: it.log.quantity, minutes: it.actualMin, out: !!it.log.discarded })),
  );
  const setItem = (i: number, patch: Partial<ItemEdit>) =>
    setItems(list => list.map((e, n) => (n === i ? { ...e, ...patch } : e)));
  const temps = tempsFor(smoker);
  const lower = temps.filter(t => t < pitTempF).pop();
  const higher = temps.find(t => t > pitTempF);
  return (
    <Sheet
      tall
      title={EDIT_TITLE}
      onClose={onClose}
      footer={<SaveButton onSave={() => onSave(applyEdit(record, pitTempF, notes, items))} />}
    >
      <Field label="Smoker temp">
        <Stepper
          label="Smoker temp"
          value={fmtTemp(pitTempF, units, true)}
          decDisabled={lower == null}
          incDisabled={higher == null}
          onDec={() => (lower != null ? setPitTempF(lower) : undefined)}
          onInc={() => (higher != null ? setPitTempF(higher) : undefined)}
        />
      </Field>
      {record.items.map((it, i) => {
        const e = items[i];
        return e ? <ItemFields key={i} item={it} edit={e} units={units} onChange={patch => setItem(i, patch)} /> : null;
      })}
      <InputField label="Notes" value={notes} onInput={setNotes} />
    </Sheet>
  );
}

function ItemFields({
  item,
  edit,
  units,
  onChange,
}: {
  item: CookRecord['items'][number];
  edit: ItemEdit;
  units: Units;
  onChange: (patch: Partial<ItemEdit>) => void;
}) {
  const q = foodOf(item.log.foodId)?.quantity;
  // Size in display units, stepped as Food details steps it: the rules step in lb, or 0.25 kg.
  const kg = q?.kind === 'weight' && units.weight === 'kg';
  const shownQty = kg ? lbToKg(edit.quantity) : edit.quantity;
  const qtyStep = kg ? KG_STEP : (q?.step ?? 1);
  const setQty = (display: number) => {
    if (!q) return;
    const stored = kg ? kgToLb(display) : display;
    onChange({ quantity: Math.min(q.max, Math.max(q.min, +stored.toFixed(4))) });
  };
  const min = edit.minutes;
  const setMin = (m: number) => onChange({ minutes: Math.min(MIN_MAX, Math.max(MIN_STEP, m)) });
  const hours = Math.floor(Math.round(min) / 60);
  const name = inSentence(item.name);
  return (
    <Field
      label={item.name}
      note={
        <Text>
          Planned <Num>{fmtDuration(item.plannedMin)}</Num> on heat.
        </Text>
      }
    >
      {q ? (
        <Stepper
          label={`${item.name} ${q.kind === 'weight' ? 'weight' : 'count'}`}
          value={q.kind === 'weight' ? shownQty.toFixed(kg ? 2 : 1) : String(edit.quantity)}
          unit={q.kind === 'weight' ? units.weight : q.unit}
          decDisabled={edit.quantity <= q.min}
          incDisabled={edit.quantity >= q.max}
          onDec={() => setQty(shownQty - qtyStep)}
          onInc={() => setQty(shownQty + qtyStep)}
        />
      ) : null}
      {/* Time on heat as two steppers: whole hours, and 5 min steps (a wrong Done can be hours off). */}
      <Stepper
        label={`${item.name} hours`}
        value={String(hours)}
        unit="hr on heat"
        decDisabled={min - 60 < MIN_STEP}
        incDisabled={min + 60 > MIN_MAX}
        onDec={() => setMin(min - 60)}
        onInc={() => setMin(min + 60)}
      />
      <Stepper
        label={`${item.name} minutes`}
        value={String(Math.round(min) - hours * 60)}
        unit="min"
        decDisabled={min <= MIN_STEP}
        incDisabled={min >= MIN_MAX}
        onDec={() => setMin(Math.ceil(min / MIN_STEP) * MIN_STEP - MIN_STEP)}
        onInc={() => setMin(Math.floor(min / MIN_STEP) * MIN_STEP + MIN_STEP)}
      />
      {hasRate(item.log) ? (
        <View className="-mx-4">
          <CheckRow
            title={`Leave ${name} out of rates`}
            checked={edit.out}
            onChange={out => onChange({ out })}
            subtitle={edit.out ? 'Rates do not learn from it.' : 'Rates learn from it.'}
          />
        </View>
      ) : null}
    </Field>
  );
}
