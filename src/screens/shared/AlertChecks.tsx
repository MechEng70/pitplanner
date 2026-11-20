// Alert permissions, as rows with their live status (mockup 03's rows; a port of
// legacy/src/screens/shared/AlertChecks.tsx). Used where a cook depends on them: the Start cook check and
// the Cook screen's red banner (SPEC section 6, failure mode 9), and Setup's alerts step (T-025), which adds
// the test alert.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, GroupCard, Num, StatusRow, Text } from '@/components/kit';
import { fmtTime } from '@/lib/format';
import type { AlarmService, AlarmStatus, AppLinks, PermissionService } from '@/platform/types';

/**
 * The alert permissions as the phone reports them now: read when shown and again whenever the app comes back
 * to the front (the user may have been in Settings). Null until the first answer, and when it cannot be read.
 */
export function useAlarmStatus(
  permissions: PermissionService,
  onResume: AppLinks['onResume'],
): [AlarmStatus | null, () => void] {
  const [status, setStatus] = useState<AlarmStatus | null>(null);
  const refresh = useCallback(() => {
    void permissions.status().then(setStatus, () => undefined);
  }, [permissions]);
  useEffect(() => {
    refresh();
    return onResume(refresh);
  }, [refresh, onResume]);
  return [status, refresh];
}

/**
 * While "No battery limits" is off: Allow opens Pit Planner's App info, and these are the taps from there, as
 * Android 15 and 16 name them (Jason, 2026-11-20, T-102). The one-tap question the row used to open needs a
 * permission Google Play allows for a few app types only. Tapping the switch on "Allow background usage"
 * turns background use off; the words beside it open the choice.
 */
export const BATTERY_STEPS =
  'Tap Allow, then App battery usage, then the words Allow background usage (not the switch), then Unrestricted';

/**
 * The three permission rows, plus full-screen alerts when Android has it off (Android 14 and up; a step still
 * rings without it, so it is a row here and never a fault: no banner, and Start cook is not stopped).
 */
export function AlertChecks({
  status,
  permissions,
  onChange,
}: {
  status: AlarmStatus;
  permissions: PermissionService;
  onChange: () => void;
}) {
  const allow = (what: string, fn: () => Promise<unknown>) => (
    <Button kind="small" aria-label={`Allow ${what}`} onPress={() => void fn().then(onChange, onChange)}>
      <Text>Allow</Text>
    </Button>
  );
  return (
    <GroupCard>
      <StatusRow
        title="Notifications"
        subtitle="Shows each step on your lock screen"
        ok={status.notifications}
        action={allow('notifications', async () => {
          // Android asks once or twice, then stops showing the question: Settings is the way after that.
          const r = await permissions.requestNotifications();
          if (!r.notifications) await permissions.openSettings('notifications');
        })}
      />
      <StatusRow
        title="Alarms and reminders"
        subtitle={'Rings at the exact time, not "around then"'}
        ok={status.exactAlarms}
        action={allow('alarms and reminders', () => permissions.openSettings('exactAlarm'))}
      />
      <StatusRow
        title="No battery limits"
        subtitle={status.batteryUnrestricted ? 'Keeps overnight alerts from being delayed' : BATTERY_STEPS}
        ok={status.batteryUnrestricted}
        action={allow('no battery limits', () => permissions.openSettings('battery'))}
      />
      {status.fullScreen ? null : (
        <StatusRow
          title="Full-screen alerts"
          subtitle="Wakes the screen for overnight steps"
          ok={false}
          action={allow('full-screen alerts', () => permissions.openSettings('fullScreen'))}
        />
      )}
    </GroupCard>
  );
}

/**
 * "Send a test alert in 10 sec" through the real alarm path (`AlarmService.testAlarm`). The line saying when
 * it rings comes in under the button, so the button stays put: keep this the last thing on its page.
 */
/** For phones that delay or drop alerts to save battery: no link, the user finds the setting (Jason, 2026-11-15). */
export const BATTERY_NOTE =
  "Alerts late or missing? Check the battery settings for Pit Planner in your phone's settings.";

export function BatteryNote() {
  return (
    <Text variant="label" tone="secondary" relaxed>
      {BATTERY_NOTE}
    </Text>
  );
}

/**
 * "Send a test alert in 10 sec" through the real alarm path, then a line saying when it rings. With `reserve`
 * the line's space is there from the start (a sheet must not grow when it appears).
 */
export function TestAlertButton({ alarms, reserve }: { alarms: Pick<AlarmService, 'testAlarm'>; reserve?: boolean }) {
  const [sent, setSent] = useState<number | null>(null);
  return (
    <>
      <Button
        kind="outline"
        block
        onPress={() =>
          void alarms.testAlarm(10).then(
            r => setSent(r.at),
            () => undefined,
          )
        }
      >
        <Text>Send a test alert in 10 sec</Text>
      </Button>
      {sent != null ? (
        <Text variant="label" tone="secondary" center>
          Test alert set for <Num>{fmtTime(sent)}</Num>. Lock the phone to check it rings.
        </Text>
      ) : reserve ? (
        <View className="opacity-0" aria-hidden importantForAccessibility="no-hide-descendants">
          <Text variant="label" tone="secondary" center>
            Test alert set for <Num>12:00 AM</Num>. Lock the phone to check it rings.
          </Text>
        </View>
      ) : null}
    </>
  );
}
