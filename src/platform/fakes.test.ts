import { fakeAlarms } from './fakes';
import type { AlarmRing } from './types';

const ring = (alarmId: string): AlarmRing => ({
  alarmId,
  keys: [`${alarmId}:b`],
  plannedAt: 1_000,
  actualAt: 4_000,
  elapsedRealtime: 9_000,
  repeat: 0,
  last: false,
  source: 'alarm',
  test: false,
  idle: null,
  interactive: true,
  posted: true,
});

test('the fake ring log answers what the test put there, as copies, and replanning or ending leaves it', async () => {
  const alarms = fakeAlarms();
  expect(await alarms.rings()).toEqual([]);
  alarms.ringLog = [ring('wrap'), ring('rest')];
  const read = await alarms.rings();
  expect(read).toEqual([ring('wrap'), ring('rest')]);
  read[0]!.keys.push('changed');
  expect(alarms.ringLog[0]!.keys).toEqual(['wrap:b']);
  await alarms.replaceAll([]);
  await alarms.cancelAll();
  expect(await alarms.rings()).toHaveLength(2);
});

test('the fake ring log can be made to fail once, and clearRings empties it', async () => {
  const alarms = fakeAlarms();
  alarms.ringLog = [ring('wrap')];
  alarms.failRings = new Error('module gone');
  await expect(alarms.rings()).rejects.toThrow('module gone');
  expect(await alarms.rings()).toHaveLength(1);
  await alarms.clearRings();
  expect(alarms.calls).toContain('clearRings');
  expect(await alarms.rings()).toEqual([]);
});
