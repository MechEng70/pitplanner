// When notification taps (Done, +15 min) are applied to the running cook: at start, when the app comes back
// to the front, and when one is tapped while the app is open. The start also puts the cook's alarms back
// (an imported cook from 0.2.0 has none yet; after an app update Android has dropped them).
import { useEffect, useRef } from 'react';
import type { AlarmService, AppLinks } from '../platform/types.ts';
import { useStore } from './store.tsx';

export function useAlarmWiring(alarms: AlarmService, onResume: AppLinks['onResume'], onApplied: () => void): void {
  const { drainAlerts } = useStore();
  const applied = useRef(onApplied);
  useEffect(() => {
    applied.current = onApplied;
  }, [onApplied]);
  useEffect(() => {
    const run = (resync: boolean) =>
      void drainAlerts(resync).then(changed => {
        if (changed) applied.current();
      });
    run(true);
    const offs = [onResume(() => run(false)), alarms.onAction(() => run(false))];
    return () => offs.forEach(off => off());
  }, [alarms, onResume, drainAlerts]);
}
