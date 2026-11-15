// Setup shows only on a first run: while no cookers are saved (`state.firstRun`; a successful 0.2.0 import
// saves them, so Setup does not show after one). Once they are saved it shows `done` instead (the route
// redirects to the tabs).
import type { ReactNode } from 'react';
import { useStore } from '@/lib/store';

export function SetupGate({ done, children }: { done: ReactNode; children: ReactNode }) {
  const { state } = useStore();
  return state.firstRun ? children : done;
}
