// Cook finished (mockup 15), a port of legacy/src/screens/cook/FinishScreen.tsx: planned vs actual per food,
// what the cook does to each food's rate, notes, Save to history or Discard, and the support link the first
// time this screen is ever reached. Save writes one history record; Discard writes nothing. Neither touches
// a record that is already saved (T-064: only Remove on Cook history removes one). `onClose` runs after
// either; the caller ends the cook and goes to Plan.
import { useState } from 'react';
import {
  Button,
  Card,
  Field,
  GroupCard,
  InfoRow,
  LinkButton,
  Num,
  Nums,
  Row,
  Screen,
  Stack,
  Text,
  TextArea,
} from '@/components/kit';
import type { ActiveCook } from '@/lib/cook';
import { summarize, toRecord, type RateChange } from '@/lib/finish';
import { fmtDuration, fmtRate, fmtTemp, type Units } from '@/lib/format';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';

export const SUPPORT_URL = 'https://buymeacoffee.com/PitPlanner';
const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
/** The pit temp the rates are quoted at. */
const RATE_AT_F = 225;

export function FinishScreen({
  cook,
  now = Date.now,
  onClose,
}: {
  cook: ActiveCook;
  now?: () => number;
  onClose: () => void;
}) {
  const { state, addRecord, setFlags } = useStore();
  // Read once: the summary does not move while the notes are typed.
  const [summary] = useState(() => summarize(rules, cook, now()));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // Shown once, ever: on the first cook that reaches this screen.
  const [support] = useState(!state.flags.supportShown);

  const finish = (keep: boolean) => {
    if (busy) return;
    setBusy(true);
    if (keep) addRecord(toRecord(summary, cook, notes, String(cook.startedAt)));
    if (support) setFlags({ ...state.flags, supportShown: true });
    onClose();
  };

  return (
    <Screen
      overline={dateFmt.format(summary.date)}
      title="Cook finished"
      subtitle={<Nums text={summary.served} />}
      footer={
        <Stack gap={4}>
          <Button block disabled={busy} onPress={() => finish(true)}>
            <Text>Save to history</Text>
          </Button>
          <Row justify="between" wrap gap={8}>
            <Button kind="text" tone="danger" disabled={busy} onPress={() => finish(false)}>
              <Text>Discard this cook</Text>
            </Button>
            {support ? (
              <LinkButton href={SUPPORT_URL}>
                <Text>Buy me a bag of pellets</Text>
              </LinkButton>
            ) : null}
          </Row>
        </Stack>
      }
    >
      <GroupCard>
        {summary.rows.map(r => (
          <InfoRow
            key={r.itemId}
            title={r.name}
            trailing={<Nums text={r.verdict.text} />}
            tone={r.verdict.tone}
            subtitle={
              <Nums
                text={
                  r.logged
                    ? `Planned ${fmtDuration(r.plannedMin)}, actual ${fmtDuration(r.actualMin)}`
                    : `Planned ${fmtDuration(r.plannedMin)}. Ended before it came off.`
                }
              />
            }
          />
        ))}
      </GroupCard>
      {summary.rates.map(r => (
        <RateCard key={r.foodName} r={r} units={state.units} />
      ))}
      <Field label="Notes for next time">
        <TextArea
          label="Notes for next time"
          placeholder="Wind, wood, what you would change"
          value={notes}
          onInput={setNotes}
        />
      </Field>
    </Screen>
  );
}

/** What this cook does to the rate plans start from. A locked rate gets no card (`summarize`). */
function RateCard({ r, units }: { r: RateChange; units: Units }) {
  return (
    <Card tone="result" pad="m" col>
      <Stack gap={4}>
        <Text variant="bodyL" weight="500">
          Your {r.foodName.toLowerCase()} rate updates
        </Text>
        {r.kind === 'waiting' ? (
          <Text variant="bodyM" relaxed>
            Plans keep your <Num>{fmtRate(r.after, units)}</Num>. {r.cooksLogged} of {r.learnAfter} logged cooks before
            it adjusts. Lock it in Gear, Cook rates.
          </Text>
        ) : (
          <Text variant="bodyM" relaxed>
            <Num>{fmtRate(r.before, units).split(' ')[0] ?? ''}</Num> to <Num>{fmtRate(r.after, units)}</Num> at{' '}
            <Num>{fmtTemp(RATE_AT_F, units)}</Num>, from {r.cooksLogged} {r.cooksLogged === 1 ? 'cook' : 'cooks'}.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
