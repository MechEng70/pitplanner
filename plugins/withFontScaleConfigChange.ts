// Expo config plugin: the main activity handles a font-size change itself (see fontScaleConfigChange.ts).
import { withAndroidManifest, withMainActivity, type ConfigPlugin } from 'expo/config-plugins';
import { addFontScale, addFontScaleHook } from './fontScaleConfigChange.ts';

export const withFontScaleConfigChange: ConfigPlugin = config =>
  withMainActivity(
    withAndroidManifest(config, c => {
      c.modResults = addFontScale(c.modResults);
      return c;
    }),
    c => {
      if (c.modResults.language !== 'kt') throw new Error('withFontScaleConfigChange: MainActivity is not Kotlin');
      c.modResults.contents = addFontScaleHook(c.modResults.contents);
      return c;
    },
  );
