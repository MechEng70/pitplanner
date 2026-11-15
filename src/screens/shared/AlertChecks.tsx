// Alert permissions, as rows with their live status (mockup 03's rows; a port of
// legacy/src/screens/shared/AlertChecks.tsx). Used where a cook depends on them: the Start cook check and
// the Cook screen's red banner (SPEC section 6, failure mode 9). Setup's alerts step joins in T-025.
import { useCallback, useEffect, useState } from 'react';
import { Button, GroupCard, StatusRow, Text } from '@/components/kit';
import type { AlarmStatus, AppLinks, PermissionService } from '@/platform/types';

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

/** The three permission rows, plus full-screen alerts when Android has it off. */
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
        subtitle="Keeps overnight alerts from being delayed"
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
