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

/**
 * The sheet footer is a row, and `block` alone is `w-full` with React Native's flexShrink 0: two of them are
 * each as wide as the row and the second starts off screen (seen at 115%). As ui.css `.sheet-foot .btn.block`,
 * the two share the row in equal halves; alone, Start cook grows to fill it. Repeated in GearScreen and
 * CookOptions until the kit does it (0.3.1).
 */
const SHARE_ROW = 'w-auto min-w-0 flex-1';

function Footer({ ok, onStart }: { ok: boolean; onStart: () => void }) {
  const { close } = useSheet();
  return (
    <>
      {ok ? null : (
        <Button kind="text" block className={SHARE_ROW} onPress={() => close(onStart)}>
          <Text>Start anyway</Text>
        </Button>
      )}
      <Button block className={SHARE_ROW} disabled={!ok} onPress={() => close(onStart)}>
        <Text>Start cook</Text>
      </Button>
    </>
  );
}
