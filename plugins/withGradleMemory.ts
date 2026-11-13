// Expo config plugin: memory limits in the generated android/gradle.properties (see gradleMemory.ts).
import { withGradleProperties, type ConfigPlugin } from 'expo/config-plugins';
import { applyGradleMemory } from './gradleMemory.ts';

export const withGradleMemory: ConfigPlugin = config =>
  withGradleProperties(config, c => {
    c.modResults = applyGradleMemory(c.modResults);
    return c;
  });
