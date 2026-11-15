import { systemPath } from './systemPath';

test('a shared file URI is not a route: the app opens on Plan', () => {
  expect(systemPath('content://com.google.android.gm.sapi/a%40b.com/message_attachment_external/1/cook.pitplan')).toBe(
    '/plan',
  );
  expect(systemPath('file:///storage/emulated/0/Download/cook.pitplan')).toBe('/plan');
  expect(systemPath('CONTENT://media/external/file/12')).toBe('/plan');
});

test('app links are left alone', () => {
  for (const path of [
    '/',
    '/cook',
    'pitplanner://dev/kit',
    'pitplanner://dev/db?fail=1',
    '/gear?history=plan',
    '/contents',
  ]) {
    expect(systemPath(path)).toBe(path);
  }
});
