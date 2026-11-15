// Expo config plugin: the main activity opens shared .pitplan files (see pitplanIntents.ts).
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';
import { addPitplanIntents } from './pitplanIntents.ts';

export const withPitplanIntents: ConfigPlugin = config =>
  withAndroidManifest(config, c => {
    c.modResults = addPitplanIntents(c.modResults);
    return c;
  });
