// Shown when Start cook finds an alert permission missing (SPEC failure mode 9; a port of
// legacy/src/screens/plan/StartCheckSheet.tsx). The cook starts only once everything is on, or the user says
// to start anyway.
import { Button, Sheet, Text, useSheet } from '@/components/kit';
import { allGranted, type AppLinks, type PermissionService } from '@/platform/types';
import { AlertChecks, useAlarmStatus } from '@/screens/shared/AlertChecks';

export function StartCheckSheet({
  permissions,
  onResume,
  onStart,
  onClose,
}: {
  permissions: PermissionService;
  onResume: AppLinks['onResume'];
  onStart: () => void;
  onClose: () => void;
}) {
  const [status, refresh] = useAlarmStatus(permissions, onResume);
  return (
    <Sheet
      title="Alerts may not ring"
      onClose={onClose}
      footer={<Footer ok={!!status && allGranted(status)} onStart={onStart} />}
    >
      <Text variant="bodyM" tone="secondary" relaxed>
        Pit Planner rings at each step with the phone asleep. Turn these on first, or start anyway and keep an eye on
        the clock.
      </Text>
      {status ? <AlertChecks status={status} permissions={permissions} onChange={refresh} /> : null}
    </Sheet>
  );
}

function Footer({ ok, onStart }: { ok: boolean; onStart: () => void }) {
  const { close } = useSheet();
  return (
    <>
      {ok ? null : (
        <Button kind="text" block onPress={() => close(onStart)}>
          <Text>Start anyway</Text>
        </Button>
      )}
      <Button block disabled={!ok} onPress={() => close(onStart)}>
        <Text>Start cook</Text>
      </Button>
    </>
  );
}
