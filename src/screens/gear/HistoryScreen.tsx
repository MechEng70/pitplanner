import { useState } from 'preact/hooks';
import { Button, Card, CheckRow, Field, Fill, GroupCard, InfoRow, Row, Screen, Sheet, Stack, Stepper, Text, Tile, Tiles, useSheet } from '../../ui/components.tsx';
import { useBack } from '../../ui/back.ts';
import { useStore, defaultServe } from '../../lib/store.tsx';
import { rules } from '../../lib/rules.ts';
import { fmtDuration, fmtTemp, type Units } from '../../lib/format.ts';
import type { CookRecord } from '../../lib/history.ts';
import { cookAgainItems, menuLine, missLine, rateRows, serveStatus, sourceText, type RateRow } from '../../lib/historyView.ts';
import { HOURS_MAX, HOURS_MIN, hoursText, rateShown, rateText, rateUnusual, roundHours, stepHours, stepRate } from '../../lib/timing.ts';

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

/** Cook history (mockup 20): learned rate per food per cooker, then the saved cooks, newest first. */
export function HistoryScreen({ onBack, onCookAgain }: { onBack: () => void; onCookAgain: () => void }) {
  useBack(onBack);
  const { state, setDraft, removeRecord, setRate, setTotalHours, setRateLock } = useStore();
  const { units } = state;
  const [open, setOpen] = useState<CookRecord | null>(null);
  const [edit, setEdit] = useState<RateRow | null>(null);
  const smokerId = state.gear.smoker?.id ?? 'none';
  const rows = rateRows(rules, state.history, smokerId, state.rates, state.totalHours, state.rateLocks);
  const records = [...state.records].sort((a, b) => b.date - a.date);
  const smoker = state.gear.smoker?.name ?? 'your smoker';

  const cookAgain = (r: CookRecord) => {
    const now = Date.now();
    setDraft(d => ({
      ...d, mode: 'readyBy', at: d.mode === 'readyBy' && d.at > now + 3_600_000 ? d.at : defaultServe(now), pitTempF: r.pitTempF,
      items: cookAgainItems(rules, r, () => crypto.randomUUID()),
    }));
    onCookAgain();
  };

  return (
    <Screen title="Cook history" onBack={onBack}>
      <Text v="section" tone="secondary" as="h2">Cook rates on {smoker}</Text>
      {rows.map(r => <RateCard key={r.foodId} row={r} units={units} onClick={() => setEdit(r)} />)}
      <Text v="bodyM" tone="tertiary" as="p">Rates are hours per {units.weight} at 225F. Tap a food to set your own rate or total hours.</Text>

      <Text v="section" tone="secondary" as="h2">Cooks</Text>
      {records.length === 0 && (
        <Text v="bodyM" tone="secondary" as="p">No cooks saved yet. Save a cook when it ends and your rates start to learn from it.</Text>
      )}
      {records.map(r => {
        const status = serveStatus(r);
        const miss = missLine(r);
        return (
          <Card key={r.id} onClick={() => setOpen(r)} label={dayFmt.format(r.date)}>
            <Fill>
              <Stack gap={4}>
                <Row gap={12} justify="between" align="start">
                  <Text v="section">{dayFmt.format(r.date)}</Text>
                  {status && <Text v="body" weight={500} tone={status.tone}>{status.text}</Text>}
                </Row>
                <Text v="body" tone="secondary">{menuLine(rules, r, units)}</Text>
                {miss && <Text v="body">{miss}</Text>}
              </Stack>
            </Fill>
          </Card>
        );
      })}
      {records.length > 0 && (
        <Text v="bodyM" tone="tertiary" as="p">Tap a cook to see planned vs actual times, your notes, and to cook it again with a new serve time.</Text>
      )}

      {edit && <RateSheet row={edit} units={units} onClose={() => setEdit(null)}
        onSave={(rate, hours, locked) => { setRate(edit.foodId, rate); setTotalHours(edit.foodId, hours); setRateLock(edit.foodId, rate != null && locked); }} />}
      {open && <CookSheet record={open} units={units} onClose={() => setOpen(null)}
        onCookAgain={() => cookAgain(open)} onRemove={() => removeRecord(open.id)} />}
    </Screen>
  );
}

const SOURCE_SHORT = { override: 'yours', blended: 'adjusted', learned: 'learned', default: 'published', item: 'yours' } as const;

function RateCard({ row, units, onClick }: { row: RateRow; units: Units; onClick: () => void }) {
  return (
    <Card onClick={onClick} label={row.foodName}>
      <Fill>
        <Stack gap={12}>
          <Text v="section">{row.foodName}</Text>
          <Tiles inset>
            {row.hrPerLb != null && <Tile label={`hr/${units.weight}`} value={rateText(row.hrPerLb, units)} sub={SOURCE_SHORT[row.source!]} />}
            {row.methodId && <Tile label="Cooks" value={String(row.cooks)} sub="logged" />}
            <Tile label="Total" value={row.totalHours != null ? `${hoursText(row.totalHours)} hr` : 'None'} sub={row.totalHours != null ? 'yours' : 'not set'} />
          </Tiles>
        </Stack>
      </Fill>
    </Card>
  );
}

/** Edit one food's saved hr/lb and saved total hours. Clearing the rate goes back to learned or published. */
function RateSheet({ row, units, onClose, onSave }: {
  row: RateRow; units: Units; onClose: () => void; onSave: (rate: number | null, hours: number | null, locked: boolean) => void;
}) {
  const learnAfter: number = rules.learning.savedRateLearnsAfter;
  const limits: [number, number] = rules.learning.rateLimits;
  const usual: [number, number] = rules.learning.rateHint;
  const [rate, setRate] = useState<number | null>(row.saved);
  const [locked, setLocked] = useState(row.locked);
  const [hours, setHours] = useState<number | null>(row.totalHours);
  const shownRate = rate ?? row.hrPerLb;
  const fallback = row.saved != null ? (row.cooks ? 'learned' : 'published') : sourceText(row.source ?? 'default', row.cooks);
  return (
    <Sheet title={row.foodName} onClose={onClose} footer={<SaveButton onSave={() => onSave(rate, hours, locked)} />}>
      <Stack gap={16}>
        {shownRate != null && (
          <Field label={`Hours per ${units.weight} at 225F`}
            note={rate == null ? `Using the ${fallback} rate. Change it to save your own.`
              : row.source === 'blended' && rate === row.saved && !locked ? `Plans use ${rateText(row.hrPerLb!, units)}: your rate adjusted by ${row.cooks} logged cooks.`
              : 'Your setting. Plans use it as-is.'}>
            <Stepper label="Hours per pound" value={rateText(shownRate, units)} unit={`hr/${units.weight}`}
              decDisabled={rateShown(shownRate, units) <= rateShown(limits[0], units)} incDisabled={rateShown(shownRate, units) >= rateShown(limits[1], units)}
              onDec={() => setRate(stepRate(shownRate, -1, units, limits))} onInc={() => setRate(stepRate(shownRate, 1, units, limits))} />
            {rateUnusual(shownRate, usual) && <Text v="caption" tone="warn">Unusual rate. Most cooks land between {rateText(usual[0], units)} and {rateText(usual[1], units)} hr/{units.weight}.</Text>}
            {rate != null && <CheckRow title="Keep my rate exactly" checked={locked} onChange={setLocked}
              subtitle={locked ? 'Logged cooks never change it.' : `After ${learnAfter} logged cooks, plans adjust it to how your cooks went.`} />}
            {rate != null && <Button kind="text" onClick={() => setRate(null)}>Clear my rate</Button>}
          </Field>
        )}
        <Field label="Total hours on heat" note={hours != null ? 'New plans with this food start on total hours.' : 'Not set. Plans use the rate.'}>
          {hours != null ? <>
            <Stepper label="Total hours" value={hoursText(hours)} unit="hr"
              decDisabled={hours <= HOURS_MIN} incDisabled={hours >= HOURS_MAX}
              onDec={() => setHours(stepHours(hours, -1))} onInc={() => setHours(stepHours(hours, 1))} />
            <Button kind="text" onClick={() => setHours(null)}>Clear total hours</Button>
          </> : <Button kind="outline" onClick={() => setHours(startHours(row))}>Set total hours</Button>}
        </Field>
      </Stack>
    </Sheet>
  );
}

/** Starting value for Set total hours: last saved, else the rate at the food's usual size. */
function startHours(row: RateRow): number {
  if (row.totalHours != null) return row.totalHours;
  const f = rules.foods.find((x: any) => x.id === row.foodId);
  return row.hrPerLb != null ? roundHours(row.hrPerLb * f.quantity.default * 60) : 4;
}

function SaveButton({ onSave }: { onSave: () => void }) {
  const { close } = useSheet();
  return <Button block onClick={() => close(onSave)}>Save</Button>;
}

/** One saved cook: planned vs actual per food, notes, Cook again, Remove. */
function CookSheet({ record, units, onClose, onCookAgain, onRemove }: {
  record: CookRecord; units: Units; onClose: () => void; onCookAgain: () => void; onRemove: () => void;
}) {
  const status = serveStatus(record);
  return (
    <Sheet title={longFmt.format(record.date)} onClose={onClose} footer={<CookActions onCookAgain={onCookAgain} onRemove={onRemove} />}>
      <Stack gap={12}>
        <Text v="bodyM" tone="secondary">
          Pit at {fmtTemp(record.pitTempF, units, true)}{status ? `. ${status.text}.` : '.'}
        </Text>
        <GroupCard>
          {record.items.map((it, i) => {
            const d = it.actualMin - it.plannedMin;
            const logged = !it.log.discarded;
            const verdict = !logged ? 'Not logged' : Math.abs(d) < 2 ? 'On plan' : d < 0 ? `${fmtDuration(-d)} ahead` : `${fmtDuration(d)} behind`;
            return (
              <InfoRow key={i} title={it.name} trailing={verdict} tone={!logged ? 'secondary' : d >= 2 ? 'warn' : 'ok'}
                subtitle={logged ? `Planned ${fmtDuration(it.plannedMin)}, took ${fmtDuration(it.actualMin)}` : `Planned ${fmtDuration(it.plannedMin)}`} />
            );
          })}
        </GroupCard>
        {record.notes && (
          <Stack gap={4}>
            <Text v="label" tone="secondary">Notes</Text>
            <Text v="bodyM">{record.notes}</Text>
          </Stack>
        )}
      </Stack>
    </Sheet>
  );
}

function CookActions({ onCookAgain, onRemove }: { onCookAgain: () => void; onRemove: () => void }) {
  const { close } = useSheet();
  const [confirm, setConfirm] = useState(false);
  return (
    <Stack gap={4} grow>
      <Button block onClick={() => close(onCookAgain)}>Cook again</Button>
      <Button kind="text" block tone="danger" onClick={() => confirm ? close(onRemove) : setConfirm(true)}>
        {confirm ? 'Tap again to remove from history' : 'Remove from history'}
      </Button>
    </Stack>
  );
}
