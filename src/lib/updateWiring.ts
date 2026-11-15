// When the update check runs (SPEC section 10): at launch and when the app comes back to the front, at most
// once a day. The time of the last check is saved with its result (`state.update`), so the limit holds
// across restarts; a failed check counts too. Gear shows the result ("Update available").
import { useEffect, useRef } from 'react';
import type { AppLinks, GetJson } from '../platform/types.ts';
import { useStore } from './store.tsx';
import { dueForCheck, fetchLatest } from './update.ts';

export function useUpdateCheck(get: GetJson, onResume: AppLinks['onResume'], now: () => number = Date.now): void {
  const { state, setUpdate } = useStore();
  // What the last check saved; set here as soon as a check ends, so a resume right after does not ask again.
  const last = useRef(state.update);
  const checking = useRef(false);
  useEffect(() => {
    const run = async () => {
      const at = now();
      if (checking.current || !dueForCheck(last.current, at)) return;
      checking.current = true;
      try {
        const update = await fetchLatest(at, last.current, get);
        last.current = update;
        setUpdate(update);
      } catch {
        // Not saved: the next launch or resume checks again.
      } finally {
        checking.current = false;
      }
    };
    void run();
    return onResume(() => void run());
  }, [get, onResume, now, setUpdate]);
}
