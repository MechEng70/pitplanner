// Cook finished (mockup 15), a port of legacy/src/screens/cook/FinishScreen.tsx: planned vs actual per food,
// what the cook does to each food's rate, notes, Save to history or Discard, and the support link the first
// time this screen is ever reached. Save writes one history record; Discard writes nothing. Neither touches
// a record that is already saved (T-064: only Remove on Cook history removes one). `onClose` runs after
// either; the caller ends the cook and goes to Plan. "Back to the cook" (T-063; not in the mockup, approved by
// Jason, 2026-11-15) shows only while a Done on Serve can still be taken back; `onBack` does it.
import { useState } from 'react';
import { inSentence } from '../../../engine/labels';
import {
  Chips,
  Button,
  Card,
  Field,
  Fill,
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
import { serveUndoable, type ActiveCook } from '@/lib/cook';
import { summarize, toRecord, type RateChange } from '@/lib/finish';
import { fmtDuration, fmtRate, type Units } from '@/lib/format';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';

export const SUPPORT_URL = 'https://buymeacoffee.com/PitPlanner';
const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

export function FinishScreen({
  cook,
  now = Date.now,
  onClose,
  onBack,
}: {
  cook: ActiveCook;
  now?: () => number;
  onClose: () => void;
  /** Serve was marked Done by mistake: the caller takes that Done back and shows Live cook again. */
  onBack: () => void;
}) {
  const { state, addRecord, setFlags } = useStore();
  // Read once: the summary does not move while the notes are typed.
  const [summary] = useState(() => summarize(rules, cook, now()));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // Foods whose old rate the user keeps: saved with the cook, left out of rates (Jason, 2026-11-15).
  const [keepRate, setKeepRate] = useState<ReadonlySet<string>>(() => new Set());
  const chooseRate = (itemId: string, keep: boolean) =>
    setKeepRate(prev => {
      const next = new Set(prev);
      if (keep) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  // Shown once, ever: on the first cook that reaches this screen.
  const [support] = useState(!state.flags.supportShown);

  const finish = (keep: boolean) => {
    if (busy) return;
    setBusy(true);
    if (keep) addRecord(toRecord(summary, cook, notes, String(cook.startedAt), keepRate));
    if (support) setFlags({ ...state.flags, supportShown: true });
    onClose();
  };

  return (
    <Screen
      overline={dateFmt.format(summary.date)}
      title="Cook finished"
      subtitle={<Nums text={summary.served} />}
      footer={
        // Fill: the footer is a row, so without it the column is only as wide as its widest line, and Save to
        // history shrank to the width of Discard this cook on every cook after the first (no support link).
        <Fill>
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
            {/* Always on its own line, so the row above never wraps because of it (Jason, 2026-11-15). */}
            {serveUndoable(cook) ? (
              <Row>
                <Button kind="text" disabled={busy} onPress={onBack}>
                  <Text>Back to the cook</Text>
                </Button>
              </Row>
            ) : null}
          </Stack>
        </Fill>
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
        <RateCard
          key={r.itemId}
          r={r}
          units={state.units}
          keep={keepRate.has(r.itemId)}
          onChoose={keep => chooseRate(r.itemId, keep)}
        />
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

/**
 * What this cook does to the rate plans start from, in plain words, with the choice to take the new rate or
 * keep the old one (Jason, 2026-11-15: "Brisket finished early. Next time the plan uses 0.73", then agree or
 * not). Keeping the old rate saves the cook and leaves that food out of rates. A saved rate that is still
 * held (`waiting`) only says so. A locked rate gets no card (`summarize`).
 */
function RateCard({
  r,
  units,
  keep,
  onChoose,
}: {
  r: RateChange;
  units: Units;
  keep: boolean;
  onChoose: (keep: boolean) => void;
}) {
  const before = fmtRate(r.before, units);
  const after = fmtRate(r.after, units);
  const num = (rate: string) => rate.split(' ')[0] ?? '';
  const moved = before !== after;
  return (
    <Card tone="result" pad="m" col>
      <Stack gap={8}>
        {r.kind === 'waiting' ? (
          <>
            <Text variant="bodyL" weight="500">
              Your {inSentence(r.foodName)} rate stays
            </Text>
            <Text variant="bodyM" relaxed>
              Plans keep your <Num>{after}</Num>. {r.cooksLogged} of {r.learnAfter} logged cooks before it adjusts. Lock
              it in Gear, Cook rates.
            </Text>
          </>
        ) : moved ? (
          <>
            <Text variant="bodyL" weight="500">
              {r.foodName} finished {r.after < r.before ? 'early' : 'late'}
            </Text>
            <Text variant="bodyM" relaxed>
              Next time the plan uses <Num>{after}</Num> instead of <Num>{num(before)}</Num>.
            </Text>
            <Chips
              label={`${r.foodName} rate`}
              value={keep ? 'keep' : 'use'}
              onChange={id => onChoose(id === 'keep')}
              options={[
                { id: 'use', label: `Use ${num(after)}` },
                { id: 'keep', label: `Keep ${num(before)}` },
              ]}
            />
          </>
        ) : (
          <>
            <Text variant="bodyL" weight="500">
              {r.foodName} finished on time
            </Text>
            <Text variant="bodyM" relaxed>
              Your rate stays <Num>{after}</Num>.
            </Text>
          </>
        )}
      </Stack>
    </Card>
  );
}
