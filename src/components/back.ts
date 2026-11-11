// Android back button: the top open sheet or menu closes first.

import { useEffect } from 'preact/hooks';

const stack: (() => void)[] = [];

/** Register a close handler while mounted. */
export function useBack(onBack: () => void) {
  useEffect(() => {
    stack.push(onBack);
    return () => { const i = stack.lastIndexOf(onBack); if (i >= 0) stack.splice(i, 1); };
  }, [onBack]);
}

/** Close the top layer. Returns false when nothing was open. */
export function popBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}
