import { onUncaughtError } from './errors';

test('an uncaught error is handed over first, then the handler that was there still runs', () => {
  const calls: string[] = [];
  const original = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((e, fatal) => calls.push(`before ${String(e)} ${fatal}`));
  const before = ErrorUtils.getGlobalHandler();
  const off = onUncaughtError((e, fatal) => {
    calls.push(`ours ${String(e)} ${fatal}`);
    throw new Error('the listener itself fails');
  });
  ErrorUtils.getGlobalHandler()('boom', true);
  ErrorUtils.getGlobalHandler()('soft');
  expect(calls).toEqual(['ours boom true', 'before boom true', 'ours soft false', 'before soft undefined']);
  off();
  expect(ErrorUtils.getGlobalHandler()).toBe(before);
  ErrorUtils.setGlobalHandler(original);
});
