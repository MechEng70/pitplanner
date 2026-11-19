// Cook options (mockup 13), a port of legacy/src/screens/cook/CookOptions.tsx: Running behind or ahead,
// Not yet (when the next step is a check), Quiet alerts, Pit went out, Start over, End cook, and Undo for the
// most recent Done (T-063; not in the mockup, approved as a SPEC line by Jason, 2026-11-15). Each action
// closes the sheet first and then hands the changed cook to `onChange`, which saves it through the store
// (one save, one alarm set). This sheet never talks to the alarm service.
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionRow,
  BellOff,
  Button,
  Card,
  ChoiceCards,
  Divider,
  FlameOff,
  Num,
  Nums,
  Restart,
  Sheet,
  Stack,
  Stepper,
  StopSquare,
  Text,
  Timer,
  UndoArrow,
  useSheet,
} from '@/components/kit';
import {
  QUIET_MIN,
  keepServeIfCovered,
  pending,
  pitDown,
  postpone,
  quiet,
  shift,
  stepText,
  undoStep,
  undoable,
  type ActiveCook,
} from '@/lib/cook';
import { shiftImpact } from '@/lib/cookView';
import { fmtTime, tx } from '@/lib/format';
import { useStore } from '@/lib/store';
import { colors } from '@/theme/tokens';

const STEP = 15;
const LIMIT = 180;
export const NOT_YET_MIN = 30;

export function CookOptions({
  cook,
  now: clock,
  onChange,
  onStartOver,
  onEnd,
  onClose,
}: {
  cook: ActiveCook;
  now: () => number;
  onChange: (c: ActiveCook) => void;
  /** Start over was tapped (the sheet has closed): the caller asks before dropping the cook. */
  onStartOver: () => void;
  onEnd: () => void;
  onClose: () => void;
}) {
  const { units } = useStore().state;
  const [delta, setDelta] = useState(0);
  const [pick, setPick] = useState<'keep' | 'move'>('keep');
  // Previews use the time the sheet opened, so the numbers hold still while you tap.
  const [now] = useState(clock);
  const preview = useMemo(
    () => (delta ? { keep: shift(cook, now, delta, true), move: shift(cook, now, delta, false) } : null),
    [cook, now, delta],
  );
  const impact = preview ? shiftImpact(cook.plan, (pick === 'keep' ? preview.keep : preview.move).plan) : null;
  const next = pending(cook)[0];
  // Not yet (SPEC section 5): that food only, 30 min. Made without asking, so serve stays only while every
  // food keeps its minimum rest; otherwise serve moves (live test of 2026-11-11).
  const later = useMemo(
    () => (next?.event.checkStep ? keepServeIfCovered(keep => postpone(cook, next.key, now, NOT_YET_MIN, keep)) : null),
    [cook, next, now],
  );
  // The most recent Done can be taken back until the next step is marked done.
  const undo = undoable(cook);
  const quietNow = cook.quietUntil != null && cook.quietUntil > now;
  const serve = fmtTime(cook.plan.serveAt);

  return (
    <Sheet
      title="Cook options"
      onClose={onClose}
      footer={
        preview ? (
          <Closing>
            {close => (
              <Button block onPress={() => close(() => onChange(pick === 'keep' ? preview.keep : preview.move))}>
                <Text>Apply</Text>
              </Button>
            )}
          </Closing>
        ) : undefined
      }
    >
      <Card tone="inset" pad="m" col>
        <Stack gap={12}>
          <Stack gap={2}>
            <Text variant="bodyL" weight="500">
              Running behind or ahead
            </Text>
            <Text variant="label" tone="secondary">
              Shifts every step after now
            </Text>
          </Stack>
          <Stepper
            label="Shift"
            decLabel="Earlier"
            incLabel="Later"
            value={`${delta > 0 ? '+' : ''}${delta}`}
            unit="min"
            onDec={() => setDelta(d => d - STEP)}
            onInc={() => setDelta(d => d + STEP)}
            decDisabled={delta <= -LIMIT}
            incDisabled={delta >= LIMIT}
          />
          {preview ? (
            <ChoiceCards
              label="Serve time"
              value={pick}
              onChange={id => setPick(id === 'move' ? 'move' : 'keep')}
              options={[
                {
                  id: 'keep',
                  title: (
                    <Text>
                      Keep serve at <Num>{serve}</Num>
                    </Text>
                  ),
                  subtitle: delta > 0 ? 'use up hold time' : 'hold longer',
                },
                {
                  id: 'move',
                  title: (
                    <Text>
                      Move serve to <Num>{fmtTime(preview.move.plan.serveAt)}</Num>
                    </Text>
                  ),
                  subtitle: 'tell the family',
                },
              ]}
            />
          ) : null}
          {impact ? (
            <Text variant="label" tone={impact.tone === 'warn' ? 'warn' : 'accentHi'}>
              <Nums text={impact.text} />
            </Text>
          ) : null}
        </Stack>
      </Card>

      <Stack>
        {undo ? (
          <Action
            icon={<UndoArrow testID="icon-undo" />}
            title={`Undo: ${stepText(tx(undo.label, units)).title}`}
            subtitle={
              <Nums
                text={`Done at ${fmtTime(undo.doneAt)}. ${
                  undo.changed ? 'Also takes back the changes made since.' : 'Puts the step and its alerts back.'
                }`}
              />
            }
            run={() => onChange(undoStep(cook, clock()))}
          />
        ) : null}
        {next && later ? (
          <Action
            icon={<Timer />}
            title={
              <Text>
                Not yet, check again in <Num>{`${NOT_YET_MIN} min`}</Num>
              </Text>
            }
            subtitle={
              <Nums
                text={`${stepText(tx(next.event.label, units)).title}. Serve ${
                  later.plan.serveAt !== cook.plan.serveAt
                    ? `moves to ${fmtTime(later.plan.serveAt)}`
                    : `stays at ${serve}`
                }.`}
              />
            }
            run={() => onChange(later)}
          />
        ) : null}
        {quietNow ? (
          <Action
            icon={<BellOff />}
            title="Alerts back on"
            subtitle={<Nums text={`Quiet until ${fmtTime(cook.quietUntil ?? now)}`} />}
            run={() => onChange({ ...cook, quietUntil: null })}
          />
        ) : (
          <Action
            icon={<BellOff />}
            title={
              <Text>
                Quiet alerts for <Num>{`${QUIET_MIN} min`}</Num>
              </Text>
            }
            subtitle="The plan keeps running. Missed steps wait for you."
            run={() => onChange(quiet(cook, clock()))}
          />
        )}
        {cook.pitDownAt == null ? (
          <Action
            icon={<FlameOff color={colors.accent} />}
            title="Pit went out"
            subtitle={'Stops the clock until you tap "Back up to temp"'}
            run={() => onChange(pitDown(cook, clock()))}
          />
        ) : null}
        <Action icon={<Restart />} title="Start over" subtitle="Back to Plan with the same menu" run={onStartOver} />
        <Divider />
        <Action
          icon={<StopSquare />}
          title="End cook"
          subtitle="Save to history or discard. Turns off all alerts."
          run={onEnd}
          danger
        />
      </Stack>
    </Sheet>
  );
}

/** Gives its child the sheet's `close` (slide down, then act). */
function Closing({ children }: { children: (close: (after?: () => void) => void) => ReactNode }) {
  return <>{children(useSheet().close)}</>;
}

/** An action row that closes the sheet first, then acts. */
function Action({
  icon,
  title,
  subtitle,
  run,
  danger,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  run: () => void;
  danger?: boolean;
}) {
  const { close } = useSheet();
  return (
    <ActionRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={() => close(run)}
      tone={danger ? 'danger' : undefined}
    />
  );
}

/**
 * The sheet footer is a row, and `block` alone is `w-full` with React Native's flexShrink 0: two of them are
 * each as wide as the row and the second starts off screen (seen at 115%). As ui.css `.sheet-foot .btn.block`,
 * the two share the row in equal halves. Repeated in GearScreen and StartCheckSheet until the kit does it (0.3.1).
 */
const SHARE_ROW = 'w-auto min-w-0 flex-1';

/**
 * Start over asks first (Jason, 2026-11-15, T-064: 0.2.0 dropped the running cook at once, with no question
 * and nothing saved).
 */
export function StartOverSheet({ onStartOver, onClose }: { onStartOver: () => void; onClose: () => void }) {
  return (
    <Sheet
      title="Start over?"
      onClose={onClose}
      footer={
        <Closing>
          {close => (
            <>
              <Button kind="text" block className={SHARE_ROW} onPress={() => close()}>
                <Text>Keep cooking</Text>
              </Button>
              <Button block className={SHARE_ROW} onPress={() => close(onStartOver)}>
                <Text>Start over</Text>
              </Button>
            </>
          )}
        </Closing>
      }
    >
      <Text variant="bodyM" tone="secondary" relaxed>
        {"This cook won't be saved."}
      </Text>
    </Sheet>
  );
}
