// Hidden alarm test screen (SPEC section 6, "Test hooks"; a port of the 0.2.0 one). Opened by tapping the
// version on Gear 5 times (the Gear screen, T-026) or `pitplanner://debug`. Lists what is stored to fire and
// rings any step of the cook (or the draft plan) in 10 seconds through the real alarm path.
// Doze and reboot commands for testing are in docs/alarm-testing.md.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { alarmsFromPlan, type AlarmSpec } from '../../../engine/alarms';
import { buildPlan } from '../../../engine/plan';
import { Button, Card, Fill, Fixed, Num, Row, Stack, Text } from '@/components/kit';
import { fmtDayTime, fmtTime } from '@/lib/format';
import { rules } from '@/lib/rules';
import { planInput, useStore } from '@/lib/store';
import type { AlarmService, AlarmStatus, NotificationAction, PermissionService } from '@/platform/types';

type Stored = Awaited<ReturnType<AlarmService['scheduled']>>;

const onOff = (v: boolean) => (v ? 'on' : 'off');

export function DebugScreen({
  alarms,
  permissions,
  onClose,
}: {
  alarms: AlarmService;
  permissions: PermissionService;
  onClose: () => void;
}) {
  const { state } = useStore();
  const [status, setStatus] = useState<AlarmStatus | null>(null);
  const [stored, setStored] = useState<Stored | null>(null);
  const [actions, setActions] = useState<NotificationAction[] | null>(null);
  const [note, setNote] = useState('');

  const reload = async () => {
    setStored(await alarms.scheduled());
    setStatus(await permissions.status());
  };
  useEffect(() => {
    let live = true;
    void (async () => {
      const [nowStored, nowStatus] = [await alarms.scheduled(), await permissions.status()];
      if (!live) return;
      setStored(nowStored);
      setStatus(nowStatus);
    })();
    return () => {
      live = false;
    };
  }, [alarms, permissions]);

  // Steps from the running cook if there is one, else from the draft plan. Past steps included.
  const plan = useMemo(() => {
    if (state.cook) return state.cook.plan;
    try {
      return state.draft.items.length ? buildPlan(rules, planInput(state)) : null;
    } catch {
      return null;
    }
  }, [state]);
  const steps = plan ? alarmsFromPlan(plan, -Infinity) : [];

  const fireSoon = async (title?: string, body?: string) => {
    const r = await alarms.testAlarm(10, title, body);
    setNote(
      `"${title ?? 'Test alert'}" fires at ${fmtTime(r.at)}${r.exact ? '' : ' (inexact: exact alarms are off)'}.`,
    );
    await reload();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Row justify="between">
          <Text variant="title" role="heading">
            Alarm tests
          </Text>
          <Button kind="text" onPress={onClose}>
            <Text>Close</Text>
          </Button>
        </Row>

        {status ? (
          <Stack gap={4}>
            <Text variant="label">Notifications {onOff(status.notifications)}</Text>
            <Text variant="label">Exact alarms {onOff(status.exactAlarms)}</Text>
            <Text variant="label">Battery unrestricted {onOff(status.batteryUnrestricted)}</Text>
            <Text variant="label">Full screen {onOff(status.fullScreen)}</Text>
          </Stack>
        ) : null}
        <Button kind="outline" block onPress={() => void fireSoon()}>
          <Text>Send a test alert in 10 sec</Text>
        </Button>
        {note ? (
          <Text variant="label" tone="secondary">
            {note}
          </Text>
        ) : null}

        <Text variant="section" role="heading">
          {state.cook ? 'Active cook steps' : 'Draft plan steps'}
        </Text>
        {steps.length === 0 ? (
          <Text variant="label" tone="secondary">
            No steps. Add food on Plan first.
          </Text>
        ) : null}
        {steps.map(a => (
          <StepCard key={a.id} step={a} onFire={() => void fireSoon(a.title, a.body)} />
        ))}

        <Text variant="section" role="heading">
          Scheduled on this phone
        </Text>
        <Button kind="outline" block onPress={() => void reload()}>
          <Text>Refresh</Text>
        </Button>
        {stored && stored.alarms.length === 0 && stored.nags.length === 0 ? (
          <Text variant="label" tone="secondary">
            Nothing scheduled.
          </Text>
        ) : null}
        {stored?.alarms.map(a => (
          <Text key={a.id} variant="label">
            <Num>{fmtDayTime(a.at)}</Num> {a.title}
            {a.test ? ' (test)' : ''}
            {a.critical ? ' (critical)' : ''}
          </Text>
        ))}
        {stored?.nags.map(n => (
          <Text key={n.alarmId} variant="label" tone="warn">
            Repeating {n.title}: <Num>{n.count} of 6</Num>, next <Num>{fmtTime(n.nextAt)}</Num>
          </Text>
        ))}

        <Text variant="section" role="heading">
          Notification taps
        </Text>
        <Button kind="outline" block onPress={async () => setActions(await alarms.drainActions())}>
          <Text>Read and clear</Text>
        </Button>
        {actions && actions.length === 0 ? (
          <Text variant="label" tone="secondary">
            None since last read.
          </Text>
        ) : null}
        {actions?.map(x => (
          <Text key={`${x.at}-${x.type}-${x.alarmId}`} variant="label">
            <Num>{fmtTime(x.at)}</Num> {x.type} {x.keys.join(', ')}
          </Text>
        ))}

        <Button
          kind="text"
          tone="danger"
          block
          onPress={async () => {
            await alarms.cancelAll();
            await reload();
          }}
        >
          <Text>Cancel all alarms</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function StepCard({ step, onFire }: { step: AlarmSpec; onFire: () => void }) {
  return (
    <Card pad="s">
      <Fill>
        <Stack gap={2}>
          <Text variant="body" weight="500">
            <Num>{fmtDayTime(step.at)}</Num> {step.title}
          </Text>
          <Text variant="caption" tone="secondary">
            {step.body}
          </Text>
        </Stack>
      </Fill>
      <Fixed>
        <Button kind="tonal" onPress={onFire} accessibilityLabel={`Ring ${step.title} in 10 sec`}>
          <Text>10 sec</Text>
        </Button>
      </Fixed>
    </Card>
  );
}
