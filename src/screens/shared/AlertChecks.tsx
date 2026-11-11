import { useCallback, useEffect, useState } from 'preact/hooks';
import { App as CapApp } from '@capacitor/app';
import { Button, GroupCard, StatusRow, Text } from '../../ui/components.tsx';
import { PitAlarms, type AlarmStatus } from '../../platform/alarms.ts';
import { fmtTime } from '../../lib/format.ts';

/** Live alert permission status, re-checked whenever the app comes back from Settings. */
export function useAlarmStatus(): [AlarmStatus | null, () => void] {
  const [s, set] = useState<AlarmStatus | null>(null);
  const refresh = useCallback(() => { PitAlarms.status().then(set); }, []);
  useEffect(() => {
    refresh();
    const h = CapApp.addListener('resume', refresh);
    return () => { h.then(x => x.remove()); };
  }, []);
  return [s, refresh];
}

/** The three permission rows from mockup 03, plus full-screen alerts when Android has it off. */
export function AlertChecks({ status, onChange }: { status: AlarmStatus; onChange: () => void }) {
  const allow = (fn: () => Promise<unknown>) => <Button kind="small" onClick={() => fn().then(onChange)}>Allow</Button>;
  return (
    <GroupCard>
      <StatusRow title="Notifications" subtitle="Shows each step on your lock screen" ok={status.notifications}
        action={allow(async () => { const r = await PitAlarms.requestNotifications(); if (!r.notifications) await PitAlarms.openNotificationSettings(); })} />
      <StatusRow title="Alarms and reminders" subtitle={'Rings at the exact time, not "around then"'} ok={status.exactAlarms}
        action={allow(() => PitAlarms.openExactAlarmSettings())} />
      <StatusRow title="No battery limits" subtitle="Keeps overnight alerts from being delayed" ok={status.batteryUnrestricted}
        action={allow(() => PitAlarms.requestBatteryExemption())} />
      {!status.fullScreen && (
        <StatusRow title="Full-screen alerts" subtitle="Wakes the screen for overnight steps" ok={false}
          action={allow(() => PitAlarms.openFullScreenSettings())} />
      )}
    </GroupCard>
  );
}

/** "Send a test alert in 10 sec" through the real setAlarmClock path. */
export function TestAlertButton() {
  const [sent, setSent] = useState<number | null>(null);
  return (
    <>
      <Button kind="outline" block onClick={async () => { const r = await PitAlarms.testAlarm({ seconds: 10 }); setSent(r.at); }}>
        Send a test alert in 10 sec
      </Button>
      {sent && <Text v="label" tone="secondary" center>Test alert set for {fmtTime(sent)}. Lock the phone to check it rings.</Text>}
    </>
  );
}
