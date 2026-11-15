// Cook tab: Live cook (mockup 12), a port of legacy/src/screens/cook/CookScreen.tsx. With no cook running it
// says so and sends the user to Plan: only Start cook on Plan starts a cook (Jason, 2026-11-15, T-064; 0.2.0
// started one from this tab, so a discarded cook came back on the next look).
//
// What opens from here arrives as a handler from the route, with its task: Cook options and Adjust (T-022),
// Full timeline and Cook finished (T-023). Until then those controls do nothing. Until the keep or move
// sheet (T-022), a Done that is early or late keeps serve when the holds cover it, else moves serve, as a
// Done from an alert does.
//
// The cook is saved through the store's `setCook`, which also replaces the phone's alarm set: this screen
// never talks to the alarm service.
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
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
import { doneStep, driftMin, dueAt, keepServeIfCovered, pending, stepText, type ActiveCook } from '@/lib/cook';
import {
  cookStatus,
  countdown,
  dayWord,
  hourText,
  laneTicks,
  laneWindow,
  lanes,
  overlapNote,
  overline,
} from '@/lib/cookView';
import { fmtTemp, fmtTime, tx } from '@/lib/format';
import { useStore } from '@/lib/store';
import { allGranted, type AppLinks, type PermissionService } from '@/platform/types';
import { AlertChecks, useAlarmStatus } from '@/screens/shared/AlertChecks';
import { colors } from '@/theme/tokens';

const TICK_MS = 30_000;
/** ui.css `.step-time`: the time column of a step row, wide enough for "12:55 PM" at the body size. */
const STEP_TIME_DP = 90;
export const ALERTS_OFF = 'Alerts are off. Steps may not ring.';
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
  /** Cook options (mockup 13), from the menu button and from Adjust: T-022. */
  onOptions?: () => void;
  /** Full timeline: T-023. */
  onTimeline?: () => void;
}

export function CookScreen({ onGoPlan, ...rest }: CookScreenProps) {
  const cook = useStore().state.cook;
  if (cook) return <LiveCook cook={cook} {...rest} />;
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
  now: clock = Date.now,
  onOptions,
  onTimeline,
}: Omit<CookScreenProps, 'onGoPlan'> & { cook: ActiveCook }) {
  const { state, setCook } = useStore();
  const { units } = state;
  const now = useNow(clock, onResume);
  const [alerts, refreshAlerts] = useAlarmStatus(permissions, onResume);
  const [fixing, setFixing] = useState(false);

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
    setCook(r.ask ? keepServeIfCovered(keep => doneStep(cook, next.key, at, keep).cook) : r.cook);
  };

  const win = laneWindow(plan, now);
  const note = overlapNote(plan, now, units);
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
          <IconButton label="Cook options" onPress={() => onOptions?.()}>
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

      {next && text && due != null ? (
        <Card tone="result" pad="l" col>
          <Stack gap={12}>
            <Text variant="overline" tone={late ? 'warn' : 'accentHi'} className="uppercase">
              <Num>{overline(due, next.event.checkStep, now)}</Num>
            </Text>
            <Text variant="nextTitle" role="heading">
              {text.title.replace(/\.$/, '')}
            </Text>
            {detail ? (
              <Text variant="bodyM" tone="secondary" relaxed>
                {detail}
              </Text>
            ) : null}
            {/* Whole minutes, no seconds; it breaks only between "1 hr" and "12 min", never inside one. */}
            <Text variant="countdown" tone={late ? 'warn' : undefined} aria-label={countdown(due, now)}>
              {countdown(due, now)
                .split(/(\d+ (?:hr|min))/)
                .map((part, i) => (i % 2 ? <Num key={i}>{part}</Num> : part))}
            </Text>
            <Row gap={12}>
              <Fill>
                <Button block onPress={onDone}>
                  <Text>Done</Text>
                </Button>
              </Fill>
              <Button kind="outline" onPress={() => onOptions?.()}>
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
          <Button kind="text" onPress={() => onTimeline?.()}>
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
    </Screen>
  );
}

/** A coming step: its time in a column that keeps its width, then what to do. */
function StepRow({ at, label }: { at: number; label: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Row gap={16} align="start">
      <View style={{ minWidth: Math.round(STEP_TIME_DP * fontScale) }}>
        <Num variant="bodyL" tone="accentHi">
          {fmtTime(at)}
        </Num>
      </View>
      <Fill>
        <Text variant="bodyL">{label.replace(/\.$/, '')}</Text>
      </Fill>
    </Row>
  );
}
