// Errors nothing caught (T-065): the app's event log notes them before React Native's own handler shows the
// crash. The handler that was installed keeps running, and unsubscribing puts it back.
import type { OnUncaughtError } from './types';

export const onUncaughtError: OnUncaughtError = fn => {
  const before = ErrorUtils.getGlobalHandler();
  const ours = (error: unknown, fatal?: boolean) => {
    try {
      fn(error, fatal === true);
    } catch {
      // Noting an error must never hide it.
    }
    before(error, fatal);
  };
  ErrorUtils.setGlobalHandler(ours);
  return () => {
    // Only when nothing else replaced it since.
    if (ErrorUtils.getGlobalHandler() === ours) ErrorUtils.setGlobalHandler(before);
  };
};
