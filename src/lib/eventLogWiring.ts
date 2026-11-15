// What the event log (T-065) hears from the phone while the app is open: each alarm that rings, and errors
// nothing caught. Cook changes, alarm syncs and alert taps are noted by the store itself.
import { useEffect } from 'react';
import type { AlarmService, OnUncaughtError } from '../platform/types.ts';
import { errorText } from './eventLog.ts';
import { useStore } from './store.tsx';

export function useEventLogWiring(alarms: AlarmService, onUncaughtError: OnUncaughtError): void {
  const { logEvent } = useStore();
  useEffect(() => {
    const offs = [
      alarms.onFired(e => logEvent('fired', e.keys.join(',') || e.alarmId)),
      onUncaughtError((error, fatal) => logEvent('error', `${fatal ? 'fatal' : 'uncaught'}: ${errorText(error)}`)),
    ];
    return () => offs.forEach(off => off());
  }, [alarms, onUncaughtError, logEvent]);
}
