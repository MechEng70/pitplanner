// A .pitplan file opened from another app (T-030), held at the root until the Plan tab has dealt with it.
// The file can arrive on any tab, or before the tabs exist (cold start, first run): the provider listens
// once for the whole app, asks for the Plan tab, and the Plan tab reads the file from here when it is shown.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OpenedPlanFile, ShareService } from '@/platform/types';

interface Held {
  file: OpenedPlanFile | null;
  /** The Plan tab is finished with the file (used or closed). */
  done: () => void;
}
const Ctx = createContext<Held>({ file: null, done: () => {} });

interface Props {
  onPlanOpened: ShareService['onPlanOpened'];
  /** A file arrived: open the Plan tab. */
  onArrive: () => void;
  children: ReactNode;
}

export function OpenedPlanProvider({ onPlanOpened, onArrive, children }: Props) {
  const [file, setFile] = useState<OpenedPlanFile | null>(null);
  useEffect(
    () =>
      onPlanOpened(f => {
        setFile(f);
        onArrive();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listen once; `onArrive` is the router's navigate.
    [onPlanOpened],
  );
  const held = useMemo(() => ({ file, done: () => setFile(null) }), [file]);
  return <Ctx.Provider value={held}>{children}</Ctx.Provider>;
}

export const useOpenedPlan = () => useContext(Ctx);
