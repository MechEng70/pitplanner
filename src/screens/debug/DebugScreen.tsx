import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildPlan } from '../../../engine/plan.ts';
import { alarmsFromPlan } from '../../../engine/alarms.ts';
import type { Plan } from '../../../engine/types.ts';
import { Button, Card, Fill, Fixed, IconButton, Num, Screen, Stack, Text } from '../../ui/components.tsx';
import { Close } from '../../ui/icons.tsx';
import { useBack } from '../../ui/back.ts';
import { PitAlarms, alarmsAreNative, type NotificationAction, type StoredNag } from '../../platform/alarms.ts';
import type { AlarmSpec } from '../../../engine/alarms.ts';
import { useStore, planInput } from '../../lib/store.tsx';
import { load } from '../../lib/storage.ts';
import { rules } from '../../lib/rules.ts';
import { fmtDayTime, fmtTime } from '../../lib/format.ts';
import { AlertChecks, TestAlertButton, useAlarmStatus } from '../shared/AlertChecks.tsx';

/**
 * Hidden alarm test screen (SPEC section 6, "Test hooks"). Opened by tapping the version on Gear 5 times.
 * Doze and reboot commands for testing are in docs/alarm-testing.md.
 */
export function DebugScreen({ onClose }: { onClose: () => void }) {
  useBack(onClose);
  const { state } = useStore();
  const [status, refresh] = useAlarmStatus();
  const [active, setActive] = useState<Plan | null>(null);
  const [stored, setStored] = useState<{ alarms: (AlarmSpec & { test: boolean })[]; nags: StoredNag[] } | null>(null);
  const [actions, setActions] = useState<NotificationAction[] | null>(null);
  const [note, setNote] = useState('');

  const reload = () => PitAlarms.getScheduled().then(setStored);
  useEffect(() => { load<{ plan: Plan }>('activeCook').then(c => setActive(c?.plan ?? null)); reload(); }, []);

  // Steps from the active cook if there is one, else from the draft plan. Past steps included.
  const plan = useMemo(() => {
    if (active) return active;
    try { return state.draft.items.length ? buildPlan(rules, planInput(state)) : null; } catch { return null; }
  }, [active, state]);
  const steps = plan ? alarmsFromPlan(plan, -Infinity) : [];

  const fireSoon = async (a: AlarmSpec) => {
    const r = await PitAlarms.testAlarm({ seconds: 10, title: a.title, body: a.body });
    setNote(`"${a.title}" fires at ${fmtTime(r.at)}${r.exact ? '' : ' (inexact: exact alarms are off)'}.`);
    reload();
  };

  return (
    <div class="overlay-screen">
      <Screen title="Alarm tests" actions={<IconButton label="Close" onClick={onClose}><Close /></IconButton>}>
        {!alarmsAreNative && <Text v="label" tone="warn">Running in a browser: alarms only work in the Android app.</Text>}
        {status && <AlertChecks status={status} onChange={refresh} />}
        <TestAlertButton />
        {note && <Text v="label" tone="secondary">{note}</Text>}

        <Text v="section" as="h2">{active ? 'Active cook steps' : 'Draft plan steps'}</Text>
        {!steps.length && <Text v="label" tone="secondary">No steps. Add food on Plan first.</Text>}
        {steps.map(a => (
          <Card key={a.id} pad="s">
            <Fill>
              <Stack gap={2}>
                <Text v="body" weight={500}><Num>{fmtDayTime(a.at)}</Num> {a.title}</Text>
                <Text v="caption" tone="secondary">{a.body}</Text>
              </Stack>
            </Fill>
            <Fixed><Button kind="small" onClick={() => fireSoon(a)}>10 sec</Button></Fixed>
          </Card>
        ))}

        <Text v="section" as="h2">Scheduled on this phone</Text>
        <Button kind="outline" block onClick={reload}>Refresh</Button>
        {stored && !stored.alarms.length && !stored.nags.length && <Text v="label" tone="secondary">Nothing scheduled.</Text>}
        {stored?.alarms.map(a => (
          <Text key={a.id} v="label"><Num>{fmtDayTime(a.at)}</Num> {a.title}{a.test ? ' (test)' : ''}{a.critical ? ' (critical)' : ''}</Text>
        ))}
        {stored?.nags.map(n => (
          <Text key={n.alarmId} v="label" tone="warn">Repeating {n.title}: <Num>{n.count} of 6</Num>, next <Num>{fmtTime(n.nextAt)}</Num></Text>
        ))}

        <Text v="section" as="h2">Notification taps</Text>
        <Button kind="outline" block onClick={async () => setActions((await PitAlarms.drainActions()).actions)}>Read and clear</Button>
        {actions && !actions.length && <Text v="label" tone="secondary">None since last read.</Text>}
        {actions?.map((x, i) => <Text key={i} v="label"><Num>{fmtTime(x.at)}</Num> {x.type} {x.keys.join(', ')}</Text>)}

        <Button kind="text" tone="danger" block onClick={async () => { await PitAlarms.cancelAll(); reload(); }}>Cancel all alarms</Button>
      </Screen>
    </div>
  );
}
