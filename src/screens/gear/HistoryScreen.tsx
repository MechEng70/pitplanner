import { useState } from 'preact/hooks';
import { Button, Card, Fill, GroupCard, InfoRow, Row, Screen, Sheet, Stack, Text, Tile, Tiles, useSheet } from '../../ui/components.tsx';
import { useBack } from '../../ui/back.ts';
import { useStore, defaultServe } from '../../lib/store.tsx';
import { rules } from '../../lib/rules.ts';
import { fmtDuration, fmtRate, fmtTemp, type Units } from '../../lib/format.ts';
import { catalogName, catalogSmokers } from '../../lib/gear.ts';
import type { CookRecord } from '../../lib/history.ts';
import { cookAgainItems, menuLine, missLine, rateRows, serveStatus, type RateRow } from '../../lib/historyView.ts';

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

/** Cook history (mockup 20): learned rate per food per cooker, then the saved cooks, newest first. */
export function HistoryScreen({ onBack, onCookAgain }: { onBack: () => void; onCookAgain: () => void }) {
  useBack(onBack);
  const { state, setDraft, removeRecord } = useStore();
  const { units } = state;
  const [open, setOpen] = useState<CookRecord | null>(null);
  const rows = rateRows(rules, state.history, state.rates);
  const records = [...state.records].sort((a, b) => b.date - a.date);
  const smokerName = (id: string) =>
    state.gear.smoker?.id === id ? state.gear.smoker.name
      : (e => e ? catalogName(e) : 'your smoker')(catalogSmokers.find(s => s.id === id));

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
      {rows.map(r => <RateCard key={`${r.foodId}|${r.methodId}|${r.smokerId}`} row={r} smoker={smokerName(r.smokerId)} units={units} />)}

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

      {open && <CookSheet record={open} units={units} onClose={() => setOpen(null)}
        onCookAgain={() => cookAgain(open)} onRemove={() => removeRecord(open.id)} />}
    </Screen>
  );
}

function RateCard({ row, smoker, units }: { row: RateRow; smoker: string; units: Units }) {
  const [value, unit] = fmtRate(row.hrPerLb, units).split(' ');
  return (
    <div class="card card-surface card-col pad-m gap-12">
      <Text v="section">{row.foodName} on {smoker}</Text>
      <Tiles inset>
        <Tile label="Rate" value={value} sub={unit} />
        <Tile label="Cooks" value={String(row.cooks)} sub="logged" />
        <Tile label="Timing" value={row.untilSize > 0 ? `Per ${units.weight}` : 'By size'}
          sub={row.untilSize > 0 ? `${row.untilSize} more ${row.untilSize === 1 ? 'cook' : 'cooks'}` : 'Unlocked'} />
      </Tiles>
    </div>
  );
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
