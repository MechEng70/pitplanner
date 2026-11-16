// Open shared plan (mockup 11): the sender's menu, a serve date, the receiver's cookers, then Use this plan.
// A port of legacy/src/screens/plan/SharedPlanSheet.tsx. The file never says who sent it (no personal data
// in a .pitplan), so the first line says "Someone", as 0.2.0 did. Mapping to the receiver's cookers and the
// serve date are pure (src/lib/sharedPlan.ts); the time comes in through `now`.
import { useMemo, useState } from 'react';
import type { CookerKind, ItemInput } from '../../../engine/types';
import { Button, Card, Chips, Field, InfoBox, Num, SelectField, Sheet, Stack, Text, useSheet } from '@/components/kit';
import { fmtDay, fmtTemp, fmtTime, fmtWeight, tx } from '@/lib/format';
import { countText, food, rules } from '@/lib/rules';
import { importPlan, serveMove, sharedLine, suggestServe, type ImportedPlan, type SharedPlan } from '@/lib/sharedPlan';
import { useStore } from '@/lib/store';
import type { PickDateTime } from '@/platform/types';

const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const NAMES: Record<CookerKind, string> = { smoker: 'smoker', griddle: 'griddle', oven: 'oven' };
const names = (xs: { foodName: string }[]) => xs.map(x => x.foodName).join(' and ');

/** What the sheet says for a file that could not be opened (`error` of an opened file, src/platform/share.ts). */
export const OPEN_ERRORS: Record<string, string> = {
  tooBig: 'That file is too big to be a Pit Planner plan.',
  unreadable: 'Could not read that file.',
};
export const openError = (code: string) => OPEN_ERRORS[code] ?? OPEN_ERRORS.unreadable!;

interface Props {
  shared: SharedPlan;
  pickDateTime: PickDateTime;
  now: () => number;
  onClose: () => void;
  /** Use this plan: the menu on the receiver's cookers and the serve time they chose. Runs after the sheet closes. */
  onUse: (plan: ImportedPlan, serveAt: number) => void;
}

export function SharedPlanSheet({ shared, pickDateTime, now, onClose, onUse }: Props) {
  const { state } = useStore();
  const { gear, units } = state;
  // One reading of the clock for the date offered and for why it was moved, so the two cannot disagree.
  const [{ suggested, move }] = useState(() => {
    const at = now();
    return { suggested: suggestServe(shared.serveAt, at), move: serveMove(shared.serveAt, at) };
  });
  const [serveAt, setServeAt] = useState(suggested);
  const plan = useMemo(() => importPlan(rules, shared, gear), [shared, gear]);
  const picked = serveAt !== suggested;

  // The dialog opens on the date that is set. One exception (Jason, 2026-11-16): a plan under an hour away
  // was moved a week, and its note says "Pick a date to keep today", so there the dialog opens on the shared
  // date, today, as long as the moved date is still the one set.
  const pick = async () => {
    const at = await pickDateTime(move === 'soon' && !picked ? shared.serveAt : serveAt);
    if (at != null) setServeAt(at);
  };
  const qty = (it: ItemInput) => {
    const f = food(it.foodId);
    return f.quantity.kind === 'weight' ? fmtWeight(it.quantity, units) : countText(f, it.quantity);
  };
  // Moves and gaps grouped by the missing cooker: "No griddle set up." Breasts will move to the smoker...
  const missing = [...new Set([...plan.moves.map(m => m.from), ...plan.gaps.map(g => g.cooker)])] as CookerKind[];

  return (
    <Sheet title="Open shared plan" onClose={onClose} footer={<UseButton onUse={() => onUse(plan, serveAt)} />}>
      <Text variant="bodyL" tone="secondary" relaxed>
        Someone shared a {weekdayFmt.format(shared.serveAt)} plan. Times will be worked out for your gear and your cook
        rates.
      </Text>
      <Card tone="result" col>
        <Stack gap={8}>
          <Text variant="overline" tone="accentHi" className="uppercase">
            Serve at <Num>{fmtTime(shared.serveAt)}</Num>
          </Text>
          {shared.items.map(it => (
            <MenuLine key={it.id} line={tx(sharedLine(rules, it, qty(it)), units)} qty={tx(qty(it), units)} />
          ))}
          {shared.dropped > 0 ? (
            <Text variant="label" tone="secondary">
              <Num>{shared.dropped}</Num> more {shared.dropped === 1 ? 'food' : 'foods'} this app does not know.
            </Text>
          ) : null}
        </Stack>
      </Card>

      <Field
        label="Serve on"
        note={
          // T-073: say when the date offered is not the sender's. Shown only while that moved date is the one
          // set: once the receiver picks their own date the note no longer describes what is set, and it
          // comes back if they go back to the offered date. Nothing when the sender's date was kept.
          move !== 'kept' && !picked ? (
            <Text>
              {move === 'passed' ? 'That time has passed.' : "That's less than an hour away."} Set for{' '}
              <Num>{fmtDay(suggested)}</Num>.{move === 'soon' ? ' Pick a date to keep today.' : ''}
            </Text>
          ) : undefined
        }
      >
        <Chips
          label="Serve on"
          value={picked ? 'pick' : 'suggested'}
          onChange={v => (v === 'suggested' ? setServeAt(suggested) : void pick())}
          options={[
            { id: 'suggested', label: fmtDay(suggested) },
            { id: 'pick', label: picked ? `${fmtDay(serveAt)}, ${fmtTime(serveAt)}` : 'Pick a date' },
          ]}
        />
      </Field>

      {gear.smoker ? (
        <Field
          label="Cook the smoker items on"
          note={
            plan.pitTempF !== shared.pitTempF ? (
              <Text>
                Smoker set to <Num>{fmtTemp(plan.pitTempF, units, true)}</Num>, the closest your smoker allows to{' '}
                <Num>{fmtTemp(shared.pitTempF, units, true)}</Num>.
              </Text>
            ) : undefined
          }
        >
          <SelectField label="Your smoker" value={gear.smoker.name} />
        </Field>
      ) : null}

      {missing.map(k => {
        const moves = plan.moves.filter(m => m.from === k);
        const gaps = plan.gaps.filter(g => g.cooker === k);
        return (
          <InfoBox key={k} lead={`No ${NAMES[k]} set up.`}>
            {[
              moves.length > 0
                ? `${names(moves)} will move to the ${NAMES[moves[0]!.to as CookerKind]}, or add a ${NAMES[k]} in Gear.`
                : '',
              gaps.length > 0
                ? `${names(gaps)} ${gaps.length === 1 ? 'needs' : 'need'} a ${NAMES[k]}. Add one in Gear.`
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </InfoBox>
        );
      })}

      {state.draft.items.length > 0 ? (
        <Text variant="label" tone="secondary">
          Replaces the plan you have now.
        </Text>
      ) : null}
    </Sheet>
  );
}

/** "Brisket, 12 lb, butcher paper", with the quantity as a Num so it never breaks or truncates. */
function MenuLine({ line, qty }: { line: string; qty: string }) {
  const at = line.indexOf(qty);
  if (at < 0) return <Text variant="bodyL">{line}</Text>;
  return (
    <Text variant="bodyL">
      {line.slice(0, at)}
      <Num>{qty}</Num>
      {line.slice(at + qty.length)}
    </Text>
  );
}

function UseButton({ onUse }: { onUse: () => void }) {
  const { close } = useSheet();
  return (
    <Button block onPress={() => close(onUse)}>
      <Text>Use this plan</Text>
    </Button>
  );
}
