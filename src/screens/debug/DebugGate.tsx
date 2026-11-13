// Lets the hidden alarm test screen open only with a pass (src/lib/debugPass.ts): always in dev builds, in
// release builds only from the 5 taps on the Gear version. Otherwise it shows `denied` (the route redirects
// to Plan). The pass is taken once, when the screen opens.
import { useState, type ReactNode } from 'react';
import { takeDebugPass } from '@/lib/debugPass';

export function DebugGate({ dev, denied, children }: { dev: boolean; denied: ReactNode; children: ReactNode }) {
  const [allowed] = useState(() => takeDebugPass(dev));
  return allowed ? children : denied;
}
