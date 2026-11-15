import { PixelRatio, Platform } from 'react-native';
import { readDeviceFacts } from './device';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.3.0', android: { versionCode: 300 } }, deviceName: "Someone's phone" },
}));

test('the phone facts: version, build, Android, model, font size, time zone, and nothing that names anyone', () => {
  const constants = { Release: '16', Model: 'Pixel 8', Serial: 'ABC123', Fingerprint: 'google/shiba/abc' };
  jest.spyOn(Platform, 'constants', 'get').mockReturnValue(constants as unknown as typeof Platform.constants);
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(36);
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.3);
  const facts = readDeviceFacts();
  expect(facts).toEqual({
    appVersion: '0.3.0',
    build: 300,
    androidVersion: '16',
    apiLevel: 36,
    model: 'Pixel 8',
    fontScale: 1.3,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  expect(JSON.stringify(facts)).not.toMatch(/ABC123|shiba|Someone/);
});
