// Cook tab: Live cook (mockup 12), a port of legacy/src/screens/cook/CookScreen.tsx. With no cook running it
// says so and sends the user to Plan: only Start cook on Plan starts a cook (Jason, 2026-11-15, T-064; 0.2.0
// started one from this tab, so a discarded cook came back on the next look).
//
// The Cook options button and Adjust open Cook options (mockup 13, CookOptions.tsx). A Done that is 5 min or
// more early or late, and Back up to temp after the pit went out, ask Keep serve or Move serve
// (KeepMoveSheet.tsx). Start over asks first, then drops the cook and goes to Plan; the menu on Plan and the
// cook history are not touched. Full timeline opens a sheet with every step, the done ones dimmed with the
// time they were done. End cook and Done on the Serve step (the last one) call `onEnd`: Cook finished
// (FinishScreen.tsx), which CookFlow.tsx shows in place of this screen.
//
// A change during the cook that makes a smoker conflict, or a hold that grows past the food's limit, shows as
// one banner with OK (T-069; Jason, 2026-11-16), the long holds on a line under the conflict (T-081). It only
// reports: nothing is re-timed and nothing rings.
//
// The cook is saved through the store's `setCook`, which also replaces the phone's alarm set: this screen
// never talks to the alarm service.
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { agree } from '../../../engine/labels';
import {
  BandNote,
  Banner,
  Button,
  Card,
  EmptyState,
  Fill,
  IconButton,
  Lanes,
  MoreVert,
  Num,
  Row,
  Screen,
  Sheet,
  Stack,
  StatusChip,
  Text,
  Timer,
} from '@/components/kit';
import { doneStep, driftMin, dueAt, pending, pitUp, stepText, steps, type ActiveCook } from '@/lib/cook';
import {
  cookStatus,
  countdown,
  dayWord,
  hourText,
  laneTicks,
  laneWindow,
  lanes,
  liveWarnings,
  overlapNote,
  overline,
} from '@/lib/cookView';
import { fmtDuration, fmtTemp, fmtTime, tx } from '@/lib/format';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { allGranted, type AppLinks, type PermissionService } from '@/platform/types';
import { AlertChecks, useAlarmStatus } from '@/screens/shared/AlertChecks';
import { colors } from '@/theme/tokens';
import { CookOptions, StartOverSheet } from './CookOptions';
import { KeepMoveSheet, type Ask } from './KeepMoveSheet';

const TICK_MS = 30_000;
/** ui.css `.step-time`: the time column of a step row, wide enough for "12:55 PM" at the body size. */
const STEP_TIME_DP = 90;
export const ALERTS_OFF = 'Alerts are off. Steps may not ring.';
export const ALARMS_NOT_SET = 'Alarms could not be set. Steps will not ring.';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The wall clock, read again every 30 s and when the app comes back to the front. */
function useNow(clock: () => number, onResume: AppLinks['onResume']): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const tick = () => setNow(clock());
    const t = setInterval(tick, TICK_MS);
    const off = onResume(tick);
    return () => {
      clearInterval(t);
      off();
    };
  }, [clock, onResume]);
  return now;
}

export interface CookScreenProps {
  permissions: PermissionService;
  onResume: AppLinks['onResume'];
  onGoPlan: () => void;
  now?: () => number;
  /** End cook, and Done on the Serve step: on to Cook finished (CookFlow). */
  onEnd?: () => void;
}

/** The sheet over Live cook: Cook options, the Start over question, the full timeline, or a keep or move question. */
type Open = null | 'options' | 'startOver' | 'timeline' | Ask;

export function CookScreen(props: CookScreenProps) {
  const cook = useStore().state.cook;
  const { onGoPlan } = props;
  if (cook) return <LiveCook cook={cook} {...props} />;
  return (
    <Screen title="Cook">
      <EmptyState
        icon={<Timer size={48} color={colors.text2} />}
        title="No cook running"
        body="Start a cook from the Plan tab. Each step shows up here as it comes due."
      >
        <Button block onPress={onGoPlan}>
          <Text>Go to Plan</Text>
        </Button>
      </EmptyState>
    </Screen>
  );
}

function LiveCook({
  cook,
  permissions,
  onResume,
  onGoPlan,
  now: clock = Date.now,
  onEnd,
}: CookScreenProps & { cook: ActiveCook }) {
  const { state, setCook } = useStore();
  const { units } = state;
  const now = useNow(clock, onResume);
  const [alerts, refreshAlerts] = useAlarmStatus(permissions, onResume);
  const [fixing, setFixing] = useState(false);
  const [open, setOpen] = useState<Open>(null);

  const { plan } = cook;
  const todo = pending(cook);
  const next = todo[0] ?? null;
  const due = next ? dueAt(cook, next) : null;
  const status = cookStatus(due, next ? driftMin(cook, next) : 0, now);
  const smoker = plan.items.some(i => i.phases.some(p => p.cooker === 'smoker'));

  const onDone = () => {
    if (!next) return;
    const at = clock();
    const r = doneStep(cook, next.key, at);
    // Serve is the last step: it is marked done, then on to Cook finished.
    if (next.event.kind === 'serve') {
      setCook(r.cook);
      return onEnd?.();
    }
    if (!r.ask) return setCook(r.cook);
    // 5 min or more early or late: nothing is saved until Keep serve or Move serve is picked.
    const d = r.ask.deltaMin;
    const item = plan.items.find(i => i.input.id === next.event.itemId);
    const name = item?.name ?? 'This step';
    // "Chicken wings are behind" (Jason, 2026-11-17): the food's own plural flag in the rules.
    const be = agree(item && rules.foods.find(f => f.id === item.input.foodId)?.plural, 'is', 'are');
    setOpen({
      title: `${fmtDuration(Math.abs(d))} ${d > 0 ? 'later' : 'earlier'} than planned`,
      body: (
        <Text>
          {name} {be} {d > 0 ? 'behind' : 'ahead'}. Keep serve time and change the hold, or move serve?
        </Text>
      ),
      keep: r.ask.keepServe,
      move: r.ask.moveServe,
      itemId: next.event.itemId,
    });
  };

  const onPitUp = () => {
    if (cook.pitDownAt == null) return;
    const at = clock();
    setOpen({
      title: 'Pit back up to temp',
      body: (
        <Text>
          The pit was out from <Num>{fmtTime(cook.pitDownAt)}</Num>. Keep serve time and shorten holds, or move serve?
        </Text>
      ),
      keep: pitUp(cook, at, true),
      move: pitUp(cook, at, false),
    });
  };

  const startOver = () => {
    // The cook is dropped, not saved: history and the menu on Plan stay as they are.
    setCook(null);
    onGoPlan();
  };

  const win = laneWindow(plan, now);
  const note = overlapNote(plan, now, units);
  // A smoker conflict or a hold past its limit that the plan did not have at Start cook (T-069). Silent: it
  // is only this banner, never an alert.
  const warned = liveWarnings(plan, cook.original, cook.warningsSeen, now, units);
  const text = next ? stepText(tx(next.event.label, units)) : null;
  const late = due != null && now > due;
  const detail = [text?.body, next?.event.checkStep ? 'Not ready? Tap Adjust.' : ''].filter(Boolean).join(' ');

  return (
    <Screen
      title="Cooking"
      subtitle={
        smoker ? (
          <Text>
            Smoker <Num>{fmtTemp(plan.pitTempF, units, true)}</Num>, serve <Num>{fmtTime(plan.serveAt)}</Num>
          </Text>
        ) : (
          <Text>
            Serve <Num>{fmtTime(plan.serveAt)}</Num>
          </Text>
        )
      }
      actions={
        <>
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
          <IconButton label="Cook options" onPress={() => setOpen('options')}>
            <MoreVert />
          </IconButton>
        </>
      }
    >
      {alerts && !allGranted(alerts) ? (
        <Banner
          action={
            <Button kind="small" onPress={() => setFixing(true)}>
              <Text>Fix</Text>
            </Button>
          }
        >
          {ALERTS_OFF}
        </Banner>
      ) : null}
      {state.alarmSync === 'failed' ? (
        // The phone refused the alarm set. Try again saves the cook again, which clears every alarm and sets
        // the whole list from the plan (the store's one way of setting alarms).
        <Banner
          tone="warn"
          action={
            <Button kind="small" onPress={() => setCook(cook)}>
              <Text>Try again</Text>
            </Button>
          }
        >
          {ALARMS_NOT_SET}
        </Banner>
      ) : null}
      {cook.pitDownAt != null ? (
        <Banner
          tone="warn"
          action={
            <Button kind="small" onPress={onPitUp}>
              <Text>Back up to temp</Text>
            </Button>
          }
        >
          Pit out since <Num>{fmtTime(cook.pitDownAt)}</Num>. Steps are on hold.
        </Banner>
      ) : null}
      {cook.notice ? (
        <Banner
          tone="warn"
          action={
            <Button kind="small" onPress={() => setCook({ ...cook, notice: null })}>
              <Text>OK</Text>
            </Button>
          }
        >
          {tx(cook.notice, units)}
        </Banner>
      ) : null}
      {warned ? (
        <Banner
          tone="warn"
          action={
            <Button
              kind="small"
              onPress={() => setCook({ ...cook, warningsSeen: [...cook.warningsSeen, ...warned.keys] })}
            >
              <Text>OK</Text>
            </Button>
          }
        >
          {warned.text}
        </Banner>
      ) : null}

      {next && text && due != null ? (
        <Card tone="result" pad="l" col>
          <Stack gap={12}>
            <Text variant="overline" tone={late ? 'warn' : 'accentHi'} className="uppercase">
              <Num>{overline(due, next.event.checkStep, now)}</Num>
            </Text>
            {/* One sentence that wraps where it fits: "Fire the smoker to 225F in 1 day 22 hr" (Jason,
                2026-11-15; mockup 12 had the countdown on a line of its own). Whole minutes, no seconds;
                "1 hr" and "12 min" never split. The countdown keeps its warn color when overdue. */}
            <Text variant="nextTitle" role="heading" testID="next-title">
              {text.title.replace(/\.$/, '')}
              {late ? ', ' : ' '}
              <Text tone={late ? 'warn' : undefined}>
                {countdown(due, now)
                  .split(/(\d+ (?:days?|hr|min))/)
                  .map((part, i) => (i % 2 ? <Num key={i}>{part}</Num> : part))}
              </Text>
            </Text>
            {detail ? (
              <Text variant="bodyM" tone="secondary" relaxed>
                {detail}
              </Text>
            ) : null}
            <Row gap={12}>
              <Fill>
                <Button block onPress={onDone}>
                  <Text>Done</Text>
                </Button>
              </Fill>
              <Button kind="outline" onPress={() => setOpen('options')}>
                <Timer size={20} />
                <Text>Adjust</Text>
              </Button>
            </Row>
          </Stack>
        </Card>
      ) : null}

      <Card pad="m" col>
        <Stack gap={12}>
          <Row justify="between" gap={8} wrap>
            <Text variant="bodyL" weight="500">
              {dayWord(win.from, now)}, <Num>{hourText(win.from)}</Num> to serve
            </Text>
            <Text variant="label" tone="secondary">
              Now <Num>{fmtTime(now)}</Num>
            </Text>
          </Row>
          <Lanes
            lanes={lanes(plan, units, cap)}
            from={win.from}
            to={win.to}
            now={now}
            band={note?.band}
            ticks={laneTicks(win.from, win.to)}
          />
          {note ? <BandNote lead={note.lead}>{note.rest}</BandNote> : null}
        </Stack>
      </Card>

      <Stack gap={4}>
        <Row justify={todo.length > 1 ? 'between' : 'end'}>
          {todo.length > 1 ? (
            <Text variant="section" role="heading">
              After that
            </Text>
          ) : null}
          <Button kind="text" onPress={() => setOpen('timeline')}>
            <Text>Full timeline</Text>
          </Button>
        </Row>
        {todo.slice(1, 4).map(k => (
          <StepRow key={k.key} at={dueAt(cook, k)} label={tx(k.event.label, units)} />
        ))}
      </Stack>

      {fixing && alerts ? (
        <Sheet title="Alerts" onClose={() => setFixing(false)}>
          <Text variant="bodyM" tone="secondary" relaxed>
            Pit Planner rings at each step with the phone asleep. Turn these back on.
          </Text>
          <AlertChecks status={alerts} permissions={permissions} onChange={refreshAlerts} />
        </Sheet>
      ) : null}
      {open === 'options' ? (
        <CookOptions
          cook={cook}
          now={clock}
          onChange={setCook}
          onStartOver={() => setOpen('startOver')}
          onEnd={() => onEnd?.()}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'timeline' ? (
        <Sheet title="Full timeline" onClose={() => setOpen(null)}>
          <Stack gap={10}>
            {steps(cook).map(k => (
              <StepRow
                key={k.key}
                at={cook.done[k.key] ?? dueAt(cook, k)}
                label={tx(k.event.label, units)}
                done={k.key in cook.done}
              />
            ))}
          </Stack>
        </Sheet>
      ) : null}
      {open === 'startOver' ? <StartOverSheet onStartOver={startOver} onClose={() => setOpen(null)} /> : null}
      {open && typeof open === 'object' ? (
        <KeepMoveSheet ask={open} before={plan} onPick={setCook} onClose={() => setOpen(null)} />
      ) : null}
    </Screen>
  );
}

/**
 * A step: its time in a column that keeps its width, then what to do. A `done` step is dimmed and `at` is
 * when it was done.
 */
function StepRow({ at, label, done }: { at: number; label: string; done?: boolean }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Row gap={16} align="start">
      <View style={{ minWidth: Math.round(STEP_TIME_DP * fontScale) }}>
        <Num variant="bodyL" tone={done ? 'tertiary' : 'accentHi'}>
          {fmtTime(at)}
        </Num>
      </View>
      <Fill>
        <Text variant="bodyL" tone={done ? 'tertiary' : undefined}>
          {label.replace(/\.$/, '')}
        </Text>
      </Fill>
    </Row>
  );
}
