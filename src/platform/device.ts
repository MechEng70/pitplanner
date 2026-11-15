// What "Send to developer" says about the app and the phone (T-065): version and build from the app's own
// config, Android version and model from React Native's Platform constants, the system font scale and the
// time zone. No identifiers: no serial, no fingerprint, no device name, no account.
import Constants from 'expo-constants';
import { PixelRatio, Platform } from 'react-native';
import type { ReadDeviceFacts } from './types';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

export const readDeviceFacts: ReadDeviceFacts = () => {
  const c = Platform.constants as unknown as Record<string, unknown>;
  return {
    appVersion: Constants.expoConfig?.version ?? '',
    build: num(Constants.expoConfig?.android?.versionCode),
    androidVersion: str(c.Release),
    apiLevel: num(Platform.Version),
    model: str(c.Model),
    fontScale: PixelRatio.getFontScale(),
    timeZone: timeZone(),
  };
};
