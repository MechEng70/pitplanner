// T-058: `fontScale` in the main activity's android:configChanges. Without it Android destroys and recreates
// the activity when the user changes the system font size, and the app comes back on Plan with its screen
// state lost (T-004 finding). With it the running activity is handed the change and React Native re-renders
// text at the new scale. Pure, so it is tested without a prebuild; withFontScaleConfigChange.ts applies it.

interface ActivityLike {
  $: Record<string, string | undefined>;
}
export interface ManifestLike {
  manifest: { application?: { activity?: ActivityLike[] }[] };
}

const MAIN = '.MainActivity';
const ATTR = 'android:configChanges';

export function addFontScale<T extends ManifestLike>(manifest: T): T {
  const main = manifest.manifest.application?.[0]?.activity?.find(a => a.$['android:name'] === MAIN);
  if (!main) throw new Error(`withFontScaleConfigChange: ${MAIN} is not in AndroidManifest.xml`);
  const changes = (main.$[ATTR] ?? '').split('|').filter(Boolean);
  if (!changes.includes('fontScale')) changes.push('fontScale');
  main.$[ATTR] = changes.join('|');
  return manifest;
}

// The other half (emulator, 2026-11-14): with the activity kept, React Native tells JavaScript the new font
// scale only the next time the app is resumed, so text stayed at the old size when the size was changed with
// the app in front (the quick-settings font tile, split screen). The activity asks React Native's DeviceInfo
// module to run that same check as soon as the change arrives; `Text` (src/components/ui/text.tsx) does the rest.
const MARK = '// pit-planner: font scale';
const IMPORTS = ['android.content.res.Configuration', 'com.facebook.react.bridge.LifecycleEventListener'];
const HOOK = `
  ${MARK}
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    (reactHost?.currentReactContext?.getNativeModule("DeviceInfo") as? LifecycleEventListener)?.onHostResume()
  }
`;

/** MainActivity.kt with the font-scale hook. Throws when the file is not the Kotlin class prebuild writes. */
export function addFontScaleHook(src: string): string {
  if (src.includes(MARK)) return src;
  const pkg = /^package .+$/m.exec(src);
  const end = src.lastIndexOf('}');
  if (!pkg || end < 0 || !/class MainActivity\b/.test(src) || /fun onConfigurationChanged\b/.test(src)) {
    throw new Error('withFontScaleConfigChange: MainActivity.kt is not what this plugin expects');
  }
  const imports = IMPORTS.filter(i => !src.includes(`import ${i}\n`)).map(i => `import ${i}`);
  const at = pkg.index + pkg[0].length;
  return `${src.slice(0, at)}\n${imports.join('\n')}${src.slice(at, end)}${HOOK.slice(1)}${src.slice(end)}`;
}
