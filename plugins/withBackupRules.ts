// Expo config plugin: explicit backup rules (see backupRules.ts): the two attributes on <application>, and the
// two XML files under android/app/src/main/res/xml, written at prebuild.
import { join } from 'node:path';
import { withAndroidManifest, withDangerousMod, type ConfigPlugin } from 'expo/config-plugins';
import { addBackupRules, writeBackupRules } from './backupRules.ts';

export const withBackupRules: ConfigPlugin = config =>
  withDangerousMod(
    withAndroidManifest(config, c => {
      c.modResults = addBackupRules(c.modResults);
      return c;
    }),
    [
      'android',
      c => {
        writeBackupRules(join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res'));
        return Promise.resolve(c);
      },
    ],
  );
