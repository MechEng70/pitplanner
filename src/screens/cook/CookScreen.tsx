import { useEffect, useState } from 'preact/hooks';
import {
  BandNote, Banner, Button, Card, ChoiceCards, EmptyState, Fill, IconButton, Lanes, Num, Row, Screen, Sheet, Stack, StatusChip, Text, useSheet,
} from '../../ui/components.tsx';
import { MoreVert, Timer } from '../../ui/icons.tsx';
import { useStore } from '../../lib/store.tsx';
import { fmtDuration, fmtTemp, fmtTime } from '../../lib/format.ts';
import { doneStep, driftMin, dueAt, pending, pitUp, stepText, steps, syncAlarms, type ActiveCook } from '../../lib/cook.ts';
import { cookStatus, countdown, dayWord, holdImpact, holdMin, hourText, laneTicks, laneWindow, lanes, overlapNote, overline } from '../../lib/cookView.ts';
import { PitAlarms, allGranted } from '../../platform/alarms.ts';
import { AlertChecks, useAlarmStatus } from '../shared/AlertChecks.tsx';

const TICK_MS = 30_000;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Wall clock that re-renders every 30 s and on return to the app. */
function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    const vis = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return now;
}

/** Keep serve / Move serve: two outcomes of one change, the user picks one. */
export interface Ask { title: string; body: string; keep: ActiveCook; move: ActiveCook; itemId?: string }

type Open = null | 'timeline' | 'alerts' | 'options' | { ask: Ask };

/** Live cook (mockup 12). */
export function CookScreen({ onGoPlan }: { onGoPlan: () => void }) {
  const { state, setCook } = useStore();
  const cook = state.cook;
  const now = useNow();
  const [alarm, refreshAlarm] = useAlarmStatus();
  const [open, setOpen] = useState<Open>(null);

  if (!cook) {
    return (
      <Screen title="Cook">
        <EmptyState icon={<Timer size={48} color="var(--text-2)" />} title="No cook running" body="Start a cook from the Plan tab. Each step shows up here as it comes due.">
          <Button block onClick={onGoPlan}>Go to Plan</Button>
        </EmptyState>
      </Screen>
    );
  }

  const commit = (c: ActiveCook | null) => {
    setCook(c);
    if (c) syncAlarms(c, Date.now()); else PitAlarms.cancelAll();
  };

  const { plan } = cook;
  const todo = pending(cook);
  const next = todo[0] ?? null;
  const due = next ? dueAt(cook, next) : null;
  const status = cookStatus(due, next ? driftMin(cook, next) : 0, now);
  const smoker = plan.items.some(i => i.phases.some(p => p.cooker === 'smoker'));
  const subtitle = <>{smoker && <>Smoker <Num>{fmtTemp(plan.pitTempF, state.units, true)}</Num>, </>}{smoker ? 'serve' : 'Serve'} <Num>{fmtTime(plan.serveAt)}</Num></>;

  const onDone = () => {
    if (!next) return;
    const at = Date.now();
    const r = doneStep(cook, next.key, at);
    // Serve is the last step: on to Cook finished.
    if (next.event.kind === 'serve') { commit(r.cook); return setOpen('options'); }
    if (!r.ask) return commit(r.cook);
    const d = r.ask.deltaMin, item = plan.items.find(i => i.input.id === next.event.itemId);
    setOpen({ ask: {
      title: `${fmtDuration(Math.abs(d))} ${d > 0 ? 'later' : 'earlier'} than planned`,
      body: `${item?.name ?? 'This step'} ${d > 0 ? 'is behind' : 'is ahead'}. Keep serve time and change the hold, or move serve?`,
      keep: r.ask.keepServe, move: r.ask.moveServe, itemId: next.event.itemId,
    } });
  };

  const onPitUp = () => {
    const at = Date.now();
    setOpen({ ask: {
      title: 'Pit back up to temp',
      body: `The pit was out from ${fmtTime(cook.pitDownAt!)}. Keep serve time and shorten holds, or move serve?`,
      keep: pitUp(cook, at, true), move: pitUp(cook, at, false),
    } });
  };

  const win = laneWindow(plan, now);
  const note = overlapNote(plan, now, state.units);
  const text = next && stepText(next.event.label);
  const late = due != null && now > due;

  return (
    <Screen title="Cooking" subtitle={subtitle} actions={<>
      <StatusChip tone={status.tone}>{status.label}</StatusChip>
      <IconButton label="Cook options" onClick={() => setOpen('options')}><MoreVert /></IconButton>
    </>}>
      {alarm && !allGranted(alarm) && (
        <Banner action={<Button kind="small" onClick={() => setOpen('alerts')}>Fix</Button>}>Alerts are off. Steps may not ring.</Banner>
      )}
      {cook.pitDownAt != null && (
        <Banner tone="warn" action={<Button kind="small" onClick={onPitUp}>Back up to temp</Button>}>
          Pit out since <Num>{fmtTime(cook.pitDownAt)}</Num>. Steps are on hold.
        </Banner>
      )}
      {cook.notice && (
        <Banner tone="warn" action={<Button kind="small" onClick={() => setCook({ ...cook, notice: null })}>OK</Button>}>{cook.notice}</Banner>
      )}

      {next && text && due != null && (
        <Card tone="result" pad="l">
          <Stack gap={12}>
            <Text v="overline" tone={late ? 'warn' : 'accentHi'}><Num>{overline(due, next.event.checkStep, now)}</Num></Text>
            <Text v="nextTitle" as="h2">{text.title}</Text>
            {(text.body || next.event.checkStep) && (
              <Text v="bodyM" tone="secondary" as="p">{[text.body, next.event.checkStep && 'Not ready? Tap Adjust.'].filter(Boolean).join(' ')}</Text>
            )}
            <Text v="countdown" tone={late ? 'warn' : undefined}>{countdown(due, now).split(/(?<=hr) /).map((part, i) => <>{i > 0 && ' '}<Num>{part}</Num></>)}</Text>
            <Row gap={12}>
              <Fill><Button block onClick={onDone}>Done</Button></Fill>
              <Button kind="outline" icon={<Timer size={20} />} onClick={() => setOpen('options')}>Adjust</Button>
            </Row>
          </Stack>
        </Card>
      )}

      <Card pad="m">
        <Stack gap={12}>
          <Row justify="between" gap={8} wrap>
            <Text v="bodyL" weight={500}>{dayWord(win.from, now)}, <Num>{hourText(win.from)}</Num> to serve</Text>
            <Text v="label" tone="secondary">Now <Num>{fmtTime(now)}</Num></Text>
          </Row>
          <Lanes lanes={lanes(plan, state.units, k => cap(k))} from={win.from} to={win.to} now={now}
            band={note?.band} ticks={laneTicks(win.from, win.to)} />
          {note && <BandNote lead={note.lead}>{note.rest}</BandNote>}
        </Stack>
      </Card>

      {todo.length > 1 && (
        <Stack gap={4}>
          <Row justify="between">
            <Text v="section" as="h3">After that</Text>
            <Button kind="text" tone="accent" onClick={() => setOpen('timeline')}>Full timeline</Button>
          </Row>
          {todo.slice(1, 4).map(k => <StepRow key={k.key} at={dueAt(cook, k)} label={k.event.label} />)}
        </Stack>
      )}
      {todo.length <= 1 && (
        <Row justify="end"><Button kind="text" tone="accent" onClick={() => setOpen('timeline')}>Full timeline</Button></Row>
      )}

      {open === 'timeline' && <TimelineSheet cook={cook} onClose={() => setOpen(null)} />}
      {open === 'alerts' && alarm && (
        <Sheet title="Alerts" onClose={() => setOpen(null)}>
          <Text v="bodyM" tone="secondary" as="p">Pit Planner rings at each step with the phone asleep. Turn these back on.</Text>
          <AlertChecks status={alarm} onChange={refreshAlarm} />
        </Sheet>
      )}
      {open === 'options' && <OptionsStub onEnd={() => commit(null)} onClose={() => setOpen(null)} />}
      {open && typeof open === 'object' && <AskSheet ask={open.ask} before={plan} onPick={commit} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

function StepRow({ at, label, done }: { at: number; label: string; done?: boolean }) {
  return (
    <Row gap={16} align="start">
      <span class="step-time"><Text v="bodyL" tone={done ? 'tertiary' : 'accentHi'}><Num>{fmtTime(at)}</Num></Text></span>
      <Fill><Text v="bodyL" tone={done ? 'tertiary' : undefined}>{label.replace(/\.$/, '')}</Text></Fill>
    </Row>
  );
}

function TimelineSheet({ cook, onClose }: { cook: ActiveCook; onClose: () => void }) {
  return (
    <Sheet title="Full timeline" onClose={onClose}>
      <Stack gap={10}>
        {steps(cook).map(k => <StepRow key={k.key} at={cook.done[k.key] ?? dueAt(cook, k)} label={k.event.label} done={k.key in cook.done} />)}
      </Stack>
    </Sheet>
  );
}

/** Keep serve vs Move serve, with what each does to the hold or serve time. */
function AskSheet({ ask, before, onPick, onClose }: { ask: Ask; before: ActiveCook['plan']; onPick: (c: ActiveCook) => void; onClose: () => void }) {
  const [pick, setPick] = useState<'keep' | 'move'>('keep');
  // Without a food named, show the one whose hold changes most.
  const itemId = ask.itemId ?? [...before.items].sort((a, b) =>
    Math.abs(holdMin(ask.keep.plan, b.input.id) - holdMin(before, b.input.id)) - Math.abs(holdMin(ask.keep.plan, a.input.id) - holdMin(before, a.input.id)))[0]?.input.id;
  return (
    <Sheet title={ask.title} onClose={onClose} footer={<ApplyButton onApply={() => onPick(pick === 'keep' ? ask.keep : ask.move)} />}>
      <Text v="bodyM" tone="secondary" as="p">{ask.body}</Text>
      <ChoiceCards label="Serve time" value={pick} onChange={v => setPick(v as 'keep' | 'move')} options={[
        { id: 'keep', title: <>Keep serve <Num>{fmtTime(ask.keep.plan.serveAt)}</Num></>, subtitle: itemId && holdImpact(before, ask.keep.plan, itemId) },
        { id: 'move', title: 'Move serve', subtitle: itemId && holdImpact(before, ask.move.plan, itemId) },
      ]} />
    </Sheet>
  );
}

function ApplyButton({ onApply }: { onApply: () => void }) {
  const { close } = useSheet();
  return <Button block onClick={() => close(onApply)}>Apply</Button>;
}

/** Until Cook options (mockup 13) is built: End cook only. */
function OptionsStub({ onEnd, onClose }: { onEnd: () => void; onClose: () => void }) {
  return (
    <Sheet title="Cook options" onClose={onClose}>
      <EndButton onEnd={onEnd} />
    </Sheet>
  );
}

function EndButton({ onEnd }: { onEnd: () => void }) {
  const { close } = useSheet();
  return <Button kind="outline" tone="danger" block onClick={() => close(onEnd)}>End cook</Button>;
}
