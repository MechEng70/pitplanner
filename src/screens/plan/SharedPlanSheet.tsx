import { useMemo, useRef, useState } from 'preact/hooks';
import {
  Button,
  Card,
  Chips,
  Field,
  InfoBox,
  Num,
  SelectField,
  Sheet,
  Stack,
  Text,
  useSheet,
} from '../../ui/components.tsx';
import { useStore } from '../../lib/store.tsx';
import { rules, food, countText } from '../../lib/rules.ts';
import { tx, fmtTemp, fmtTime, fmtWeight, fromLocalInput, toLocalInput } from '../../lib/format.ts';
import { fitPitTemp, mapToCookers, sharedLine, suggestServe, type SharedPlan } from '../../lib/sharedPlan.ts';
import type { CookerKind } from '../../../engine/types.ts';

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const NAMES: Record<CookerKind, string> = { smoker: 'smoker', griddle: 'griddle', oven: 'oven' };

/** Open shared plan (mockup 11): the sender's menu, a serve date, the receiver's cookers, then Use this plan. */
export function SharedPlanSheet({
  shared,
  onClose,
  onUse,
}: {
  shared: SharedPlan;
  onClose: () => void;
  onUse: () => void;
}) {
  const { state, setDraft } = useStore();
  const { gear, units } = state;
  const suggested = useMemo(() => suggestServe(shared.serveAt, Date.now()), [shared]);
  const [serveAt, setServeAt] = useState(suggested);
  const dateRef = useRef<HTMLInputElement>(null);
  const mapped = useMemo(() => mapToCookers(rules, shared.items, gear), [shared, gear]);
  const pitTempF = fitPitTemp(shared.pitTempF, gear);
  const picked = serveAt !== suggested;

  const qty = (foodId: string, q: number) => {
    const f = food(foodId);
    return f.quantity.kind === 'weight' ? fmtWeight(q, units) : countText(f, q);
  };
  const openDate = () => {
    const el = dateRef.current;
    if (!el) return;
    el.value = toLocalInput(serveAt);
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };
  const use = () => {
    setDraft(() => ({
      mode: 'readyBy',
      at: serveAt,
      pitTempF,
      items: mapped.items.map(it => ({ ...it, id: crypto.randomUUID() })),
    }));
    onUse();
  };

  // Moves and gaps grouped by the missing cooker: "No griddle set up." Breasts will move to the smoker...
  const missing = [...new Set([...mapped.moves.map(m => m.from), ...mapped.gaps.map(g => g.cooker)])] as CookerKind[];

  return (
    <Sheet title="Open shared plan" onClose={onClose} footer={<UseButton onUse={use} />}>
      <Stack gap={16}>
        <Text v="bodyL" tone="secondary" as="p">
          Someone shared a {weekdayFmt.format(shared.serveAt)} plan. Times will be worked out for your gear and your
          cook rates.
        </Text>
        <Card tone="result" pad="m">
          <Stack gap={8}>
            <Text v="overline" tone="accentHi">
              Serve at <Num>{fmtTime(shared.serveAt)}</Num>
            </Text>
            {shared.items.map(it => (
              <Text key={it.id} v="bodyL">
                {tx(sharedLine(rules, it, qty(it.foodId, it.quantity)), units)}
              </Text>
            ))}
            {shared.dropped > 0 && (
              <Text v="label" tone="secondary">
                {shared.dropped} more {shared.dropped === 1 ? 'food' : 'foods'} this app does not know.
              </Text>
            )}
          </Stack>
        </Card>

        <Field label="Serve on">
          <Chips
            label="Serve on"
            value={picked ? 'pick' : 'suggested'}
            onChange={v => (v === 'suggested' ? setServeAt(suggested) : openDate())}
            options={[
              { id: 'suggested', label: dayFmt.format(suggested) },
              { id: 'pick', label: picked ? `${dayFmt.format(serveAt)}, ${fmtTime(serveAt)}` : 'Pick a date' },
            ]}
          />
          <input
            ref={dateRef}
            type="datetime-local"
            class="hidden-input"
            tabIndex={-1}
            aria-hidden="true"
            onChange={e => {
              const t = fromLocalInput(e.currentTarget.value);
              if (t != null) setServeAt(t);
            }}
          />
        </Field>

        {gear.smoker && (
          <Field
            label="Cook the smoker items on"
            note={
              pitTempF !== shared.pitTempF ? (
                <>
                  Smoker set to <Num>{fmtTemp(pitTempF, units, true)}</Num>, the closest your smoker allows to{' '}
                  <Num>{fmtTemp(shared.pitTempF, units, true)}</Num>.
                </>
              ) : undefined
            }
          >
            <SelectField label="Your smoker" value={gear.smoker.name} />
          </Field>
        )}

        {missing.map(k => {
          const moves = mapped.moves.filter(m => m.from === k);
          const gaps = mapped.gaps.filter(g => g.cooker === k);
          const names = (xs: { foodName: string }[]) => xs.map(x => x.foodName).join(' and ');
          return (
            <InfoBox key={k} lead={`No ${NAMES[k]} set up.`}>
              {moves.length > 0 &&
                `${names(moves)} will move to the ${NAMES[moves[0].to as CookerKind]}, or add a ${NAMES[k]} in Gear.`}
              {gaps.length > 0 &&
                ` ${names(gaps)} ${gaps.length === 1 ? 'needs' : 'need'} a ${NAMES[k]}. Add one in Gear.`}
            </InfoBox>
          );
        })}

        {state.draft.items.length > 0 && (
          <Text v="label" tone="secondary">
            Replaces the plan you have now.
          </Text>
        )}
      </Stack>
    </Sheet>
  );
}

function UseButton({ onUse }: { onUse: () => void }) {
  const { close } = useSheet();
  return (
    <Button block onClick={() => close(onUse)}>
      Use this plan
    </Button>
  );
}

/** A file that could not be opened: says why, nothing else. */
export function SharedPlanError({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Sheet title="Open shared plan" onClose={onClose} footer={<CloseButton />}>
      <Text v="bodyL" tone="secondary" as="p">
        {message}
      </Text>
    </Sheet>
  );
}

function CloseButton() {
  const { close } = useSheet();
  return (
    <Button block kind="outline" onClick={() => close(() => {})}>
      Close
    </Button>
  );
}
