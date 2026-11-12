import { Button, Sheet, Text, useSheet } from '../../ui/components.tsx';
import { allGranted } from '../../platform/alarms.ts';
import { AlertChecks, useAlarmStatus } from '../shared/AlertChecks.tsx';

/**
 * Shown when Start cook finds an alert permission missing (failure mode 9).
 * The cook starts only once everything is on, or the user says to start anyway.
 */
export function StartCheckSheet({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  return (
    <Sheet title="Alerts may not ring" onClose={onClose} footer={<Footer onStart={onStart} />}>
      <Body />
    </Sheet>
  );
}

function Body() {
  const [status, refresh] = useAlarmStatus();
  return (
    <>
      <Text v="bodyM" tone="secondary" as="p">
        Pit Planner rings at each step with the phone asleep. Turn these on first, or start anyway and keep an eye on
        the clock.
      </Text>
      {status && <AlertChecks status={status} onChange={refresh} />}
    </>
  );
}

function Footer({ onStart }: { onStart: () => void }) {
  const { close } = useSheet();
  const [status] = useAlarmStatus();
  const ok = !!status && allGranted(status);
  return ok ? (
    <Button block onClick={() => close(onStart)}>
      Start cook
    </Button>
  ) : (
    <>
      <Button kind="text" onClick={() => close(onStart)}>
        Start anyway
      </Button>
      <Button block disabled>
        Start cook
      </Button>
    </>
  );
}
