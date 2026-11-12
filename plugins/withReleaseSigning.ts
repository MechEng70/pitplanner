// Expo config plugin: release builds signed with the release key (see releaseSigning.ts). Runs at prebuild.
import { withAppBuildGradle, type ConfigPlugin } from 'expo/config-plugins';
import { applyReleaseSigning } from './releaseSigning.ts';

export const withReleaseSigning: ConfigPlugin = config =>
  withAppBuildGradle(config, c => {
    if (c.modResults.language !== 'groovy') throw new Error('withReleaseSigning: expected a Groovy build.gradle');
    c.modResults.contents = applyReleaseSigning(c.modResults.contents);
    return c;
  });
