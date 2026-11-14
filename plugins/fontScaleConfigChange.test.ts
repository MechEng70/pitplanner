import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addFontScale, addFontScaleHook, type ManifestLike } from './fontScaleConfigChange.ts';

// AndroidManifest.xml as `expo prebuild` generates it (SDK 58), the parts that matter here.
const CHANGES = 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths';
const manifest = (changes?: string): ManifestLike => ({
  manifest: {
    application: [
      {
        activity: [
          { $: { 'android:name': '.MainActivity', ...(changes == null ? {} : { 'android:configChanges': changes }) } },
          { $: { 'android:name': 'com.example.Other', 'android:configChanges': 'orientation' } },
        ],
      },
    ],
  },
});
const changesOf = (m: ManifestLike, name: string) =>
  m.manifest.application?.[0]?.activity?.find(a => a.$['android:name'] === name)?.$['android:configChanges'];

test('fontScale joins the configChanges of the main activity; the others stay', () => {
  const out = addFontScale(manifest(CHANGES));
  assert.equal(changesOf(out, '.MainActivity'), `${CHANGES}|fontScale`);
});

test('it is added once, however often the plugin runs', () => {
  const out = addFontScale(addFontScale(manifest(CHANGES)));
  assert.equal(
    changesOf(out, '.MainActivity')!
      .split('|')
      .filter(c => c === 'fontScale').length,
    1,
  );
});

test('an activity with no configChanges gets fontScale alone', () => {
  assert.equal(changesOf(addFontScale(manifest()), '.MainActivity'), 'fontScale');
});

test('other activities are left alone', () => {
  assert.equal(changesOf(addFontScale(manifest(CHANGES)), 'com.example.Other'), 'orientation');
});

test('a manifest without the main activity fails the prebuild, not the phone', () => {
  assert.throws(() => addFontScale({ manifest: { application: [{ activity: [] }] } }), /MainActivity/);
});

// MainActivity.kt as `expo prebuild` generates it (SDK 58), shortened.
const ACTIVITY = `package io.github.mecheng70.pitplanner
import expo.modules.splashscreen.SplashScreenManager

import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

test('the activity passes a font-size change on to React Native as soon as it arrives', () => {
  const out = addFontScaleHook(ACTIVITY);
  assert.match(out, /^package io\.github\.mecheng70\.pitplanner\nimport android\.content\.res\.Configuration\n/);
  assert.match(out, /import com\.facebook\.react\.bridge\.LifecycleEventListener\n/);
  assert.match(
    out,
    /override fun onConfigurationChanged\(newConfig: Configuration\) \{\n {4}super\.onConfigurationChanged\(newConfig\)\n {4}\(reactHost\?\.currentReactContext\?\.getNativeModule\("DeviceInfo"\) as\? LifecycleEventListener\)\?\.onHostResume\(\)\n {2}\}\n\}\n$/,
  );
  assert.ok(out.includes('override fun getMainComponentName(): String = "main"'), 'the rest of the class stays');
});

test('the hook is added once, however often the plugin runs', () => {
  const once = addFontScaleHook(ACTIVITY);
  assert.equal(addFontScaleHook(once), once);
});

test('a MainActivity this plugin does not know is an error, not a silent skip', () => {
  assert.throws(() => addFontScaleHook('public class MainActivity extends ReactActivity {}'), /MainActivity\.kt/);
  assert.throws(
    () =>
      addFontScaleHook(
        ACTIVITY.replace(
          'override fun getMainComponentName',
          'override fun onConfigurationChanged(c: Configuration) {}\n  override fun getMainComponentName',
        ),
      ),
    /MainActivity\.kt/,
  );
});
