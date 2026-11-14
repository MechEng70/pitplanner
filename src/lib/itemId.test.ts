import { newItemId } from './itemId';

test('an id is made from the time and is not one of the ids in use', () => {
  const a = newItemId([], 1794500000000);
  expect(a).toMatch(/^i[0-9a-z]+$/);
  expect(newItemId([], 1794500000001)).not.toBe(a);
  const b = newItemId([a], 1794500000000);
  expect(b).not.toBe(a);
  expect(newItemId([a, b], 1794500000000)).not.toBe(b);
});
