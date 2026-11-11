import { useMemo, useState } from 'preact/hooks';
import { ActionRow, Button, Card, Divider, ChoiceCards, Num, Sheet, Stack, Stepper, Text, useSheet } from '../../ui/components.tsx';
import { BellOff, FlameOff, Restart, StopSquare, Timer } from '../../ui/icons.tsx';
import { fmtTime } from '../../lib/format.ts';
import { pending, pitDown, postpone, keepServeIfCovered, quiet, QUIET_MIN, shift, stepText, type ActiveCook } from '../../lib/cook.ts';
import { shiftImpact } from '../../lib/cookView.ts';

const STEP = 15, LIMIT = 180, NOT_YET_MIN = 30;

/** Cook options (mockup 13). Every change goes through onChange (save + reschedule alarms). */
export function CookOptions({ cook, onChange, onStartOver, onEnd, onClose }: {
  cook: ActiveCook; onChange: (c: ActiveCook) => void; onStartOver: () => void; onEnd: () => void; onClose: () => void;
}) {
  const [delta, setDelta] = useState(0);
  const [pick, setPick] = useState<'keep' | 'move'>('keep');
  // Preview against the time the sheet opened, so the numbers hold still while you tap.
  const [now] = useState(Date.now());
  const preview = useMemo(() => delta ? { keep: shift(cook, now, delta, true), move: shift(cook, now, delta, false) } : null, [delta]);
  const impact = preview && shiftImpact(cook.plan, (pick === 'keep' ? preview.keep : preview.move).plan);
  const next = pending(cook)[0];
  const quietNow = cook.quietUntil != null && cook.quietUntil > now;
  const serve = fmtTime(cook.plan.serveAt);

  return (
    <Sheet title="Cook options" onClose={onClose}
      footer={delta ? <Footer label="Apply" onClick={() => onChange(pick === 'keep' ? preview!.keep : preview!.move)} /> : undefined}>
      <Card tone="inset" pad="m">
        <Stack gap={12}>
          <Stack gap={2}>
            <Text v="bodyL" weight={500}>Running behind or ahead</Text>
            <Text v="label" tone="secondary">Shifts every step after now</Text>
          </Stack>
          <Stepper label="Shift" value={`${delta > 0 ? '+' : ''}${delta}`} unit="min"
            onDec={() => setDelta(d => d - STEP)} onInc={() => setDelta(d => d + STEP)} decDisabled={delta <= -LIMIT} incDisabled={delta >= LIMIT} />
          {preview && <>
            <ChoiceCards label="Serve time" value={pick} onChange={v => setPick(v as 'keep' | 'move')} options={[
              { id: 'keep', title: <>Keep serve at <Num>{serve}</Num></>, subtitle: delta > 0 ? 'use up hold time' : 'hold longer' },
              { id: 'move', title: <>Move serve to <Num>{fmtTime(preview.move.plan.serveAt)}</Num></>, subtitle: 'tell the family' },
            ]} />
            {impact && <Text v="label" tone={impact.tone === 'warn' ? 'warn' : 'accentHi'}>{impact.text}</Text>}
          </>}
        </Stack>
      </Card>

      <Stack>
        {next?.event.checkStep && (() => {
          const later = keepServeIfCovered(keep => postpone(cook, next.key, Date.now(), NOT_YET_MIN, keep));
          const moved = later.plan.serveAt !== cook.plan.serveAt;
          return <Row icon={<Timer />} title={`Not yet, check again in ${NOT_YET_MIN} min`}
            subtitle={`${stepText(next.event.label).title}. Serve ${moved ? `moves to ${fmtTime(later.plan.serveAt)}` : `stays at ${serve}`}.`}
            run={() => onChange(later)} />;
        })()}
        {quietNow
          ? <Row icon={<BellOff />} title="Alerts back on" subtitle={`Quiet until ${fmtTime(cook.quietUntil!)}`} run={() => onChange({ ...cook, quietUntil: null })} />
          : <Row icon={<BellOff />} title={`Quiet alerts for ${QUIET_MIN} min`} subtitle="The plan keeps running. Missed steps wait for you." run={() => onChange(quiet(cook, Date.now()))} />}
        {cook.pitDownAt == null && (
          <Row icon={<FlameOff color="var(--accent)" />} title="Pit went out" subtitle={'Stops the clock until you tap "Back up to temp"'} run={() => onChange(pitDown(cook, Date.now()))} />
        )}
        <Row icon={<Restart />} title="Start over" subtitle="Back to Plan with the same menu" run={onStartOver} />
        <Divider />
        <Row icon={<StopSquare />} title="End cook" subtitle="Save to history or discard. Turns off all alerts." run={onEnd} danger />
      </Stack>
    </Sheet>
  );
}

/** Action row that closes the sheet first, then acts. */
function Row({ icon, title, subtitle, run, danger }: { icon: preact.ComponentChildren; title: string; subtitle: string; run: () => void; danger?: boolean }) {
  const { close } = useSheet();
  return <ActionRow icon={icon} title={title} subtitle={subtitle} onClick={() => close(run)} tone={danger ? 'danger' : undefined} />;
}

function Footer({ label, onClick }: { label: string; onClick: () => void }) {
  const { close } = useSheet();
  return <Button block onClick={() => close(onClick)}>{label}</Button>;
}
