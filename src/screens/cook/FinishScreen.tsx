import { useState } from 'preact/hooks';
import { Button, Card, Field, GroupCard, InfoRow, LinkButton, Screen, Stack, Text, TextArea } from '../../ui/components.tsx';
import { useStore } from '../../lib/store.tsx';
import { rules } from '../../lib/rules.ts';
import { fmtDuration, fmtRate, fmtTemp } from '../../lib/format.ts';
import { summarize, toRecord, type RateChange } from '../../lib/finish.ts';
import type { ActiveCook } from '../../lib/cook.ts';
import type { Units } from '../../lib/format.ts';

const SUPPORT_URL = 'https://buymeacoffee.com/PitPlanner';
const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

/** Cook finished (mockup 15). `onClose` runs after Save or Discard; the caller ends the cook. */
export function FinishScreen({ cook, onClose }: { cook: ActiveCook; onClose: () => void }) {
  const { state, addRecord, setFlags } = useStore();
  const [summary] = useState(() => summarize(rules, cook, Date.now()));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // Shown once, ever: on the first cook that reaches this screen.
  const [support] = useState(!state.flags.supportShown);

  const finish = async (keep: boolean) => {
    if (busy) return;
    setBusy(true);
    if (keep) await addRecord(toRecord(summary, cook, notes, String(cook.startedAt)));
    if (support) setFlags({ ...state.flags, supportShown: true });
    onClose();
  };

  return (
    <Screen overline={dateFmt.format(summary.date)} title="Cook finished" subtitle={summary.served} footer={
      <Stack gap={4}>
        <Button block disabled={busy} onClick={() => finish(true)}>Save to history</Button>
        <div class="finish-links">
          <Button kind="text" tone="danger" disabled={busy} onClick={() => finish(false)}>Discard this cook</Button>
          {support && <LinkButton href={SUPPORT_URL}>Buy me a bag of pellets</LinkButton>}
        </div>
      </Stack>
    }>
      <GroupCard>
        {summary.rows.map(r => (
          <InfoRow key={r.itemId} title={r.name} trailing={r.verdict.text} tone={r.verdict.tone}
            subtitle={r.logged ? `Planned ${fmtDuration(r.plannedMin)}, actual ${fmtDuration(r.actualMin)}` : `Planned ${fmtDuration(r.plannedMin)}. Ended before it came off.`} />
        ))}
      </GroupCard>
      {summary.rates.map(r => <RateCard key={r.foodName} r={r} units={state.units} />)}
      <Field label="Notes for next time">
        <TextArea label="Notes for next time" placeholder="Wind, wood, what you would change" value={notes} onInput={setNotes} />
      </Field>
    </Screen>
  );
}

function RateCard({ r, units }: { r: RateChange; units: Units }) {
  const unlock = r.cooksLogged >= r.unlockAfter
    ? 'Size-adjusted timing is now available.'
    : `${r.cooksLogged} of ${r.unlockAfter} cooks toward size-adjusted timing.`;
  return (
    <Card tone="result" pad="m">
      <Stack gap={4}>
        <Text v="bodyL" weight={500}>Your {r.foodName.toLowerCase()} rate updates</Text>
        <Text v="bodyM">{fmtRate(r.before, units).split(' ')[0]} to {fmtRate(r.after, units)} at {fmtTemp(225, units)}. {unlock}</Text>
      </Stack>
    </Card>
  );
}
