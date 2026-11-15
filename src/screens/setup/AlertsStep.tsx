// Setup's last step (mockup 03; a port of AlertsStep in legacy/src/screens/setup/Setup.tsx): the alert
// permissions with their live status and a test alert through the real alarm path. Finish setup works with
// permissions off: the Start cook check asks again when it matters. The services come from the route.
import { SetupActions, SetupPage } from '@/components/kit';
import type { AlarmService, AppLinks, PermissionService } from '@/platform/types';
import { AlertChecks, TestAlertButton, useAlarmStatus } from '@/screens/shared/AlertChecks';
import { SETUP_STEPS } from './Setup';

export function AlertsStep({
  permissions,
  alarms,
  onResume,
  onBack,
  onFinish,
}: {
  permissions: PermissionService;
  alarms: Pick<AlarmService, 'testAlarm'>;
  onResume: AppLinks['onResume'];
  onBack: () => void;
  onFinish: () => void;
}) {
  const [status, refresh] = useAlarmStatus(permissions, onResume);
  return (
    <SetupPage
      step={3}
      steps={SETUP_STEPS}
      title="Make sure alerts get through"
      intro={
        'A 6 AM "wrap the brisket" alert has to ring even with the phone asleep. Android needs three permissions for that.'
      }
      footer={<SetupActions onBack={onBack} next="Finish setup" onNext={onFinish} />}
    >
      {status ? <AlertChecks status={status} permissions={permissions} onChange={refresh} /> : null}
      <TestAlertButton alarms={alarms} />
    </SetupPage>
  );
}
