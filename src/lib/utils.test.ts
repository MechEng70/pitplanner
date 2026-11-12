import { cn } from './utils';

test('cn keeps a token text size and a token text color together', () => {
  expect(cn('text-ink', 'text-title')).toBe('text-ink text-title');
});

test('cn lets the later color or size win', () => {
  expect(cn('text-ink', 'text-ink-2')).toBe('text-ink-2');
  expect(cn('text-body', 'text-title')).toBe('text-title');
  expect(cn('bg-surface', false, 'bg-ember-container')).toBe('bg-ember-container');
});
