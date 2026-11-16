# Security pass, T-035 (2026-11-16)

A read-only review of the release build `release/pitplanner-0.3.0-alpha.5.apk` (versionCode 300005) and its
inputs. Nothing in the code, config or docs was changed. Jason decides on every fix.

How facts were read:

- **APK:** `aapt2 dump xmltree` / `dump badging` / `dump resources` (build-tools 37.0.0), `apkanalyzer dex
  packages`, `apksigner verify --print-certs`, and `unzip -p` of `assets/app.config` and
  `assets/index.android.bundle` (the Hermes bundle, searched with `strings`). Copies only went to the session
  scratchpad, never into the repo.
- **Source:** tracked files at HEAD. `Receivers.kt` was read with `git show HEAD:` (a temporary local edit was
  in the working tree during the review, at Jason's request).
- **`android/`:** it was being regenerated during the review. It was used once, for where the template
  permissions come from, and that is marked below.

Severity is set for what this app is: a sideloaded hobby app with no account, no server and a few testers.

## Summary

| # | Finding | Severity | Recommended action |
|---|---|---|---|
| 1 | The release APK embeds the development app config: `Constants.expoConfig` says version 0.2.0, build 200999, variant development | medium | Pass `APP_VARIANT` and `APP_VERSION` to the Gradle step; check `assets/app.config` in `--verify` |
| 2 | No backup rules: `allowBackup=true` and no rules file, so everything is backed up. TECH-DESIGN's "secure-store excluded" can't be checked because expo-secure-store isn't in the build | low | Add explicit backup rules; reword TECH-DESIGN section 10 |
| 3 | A `.pitplan` open accepts a `file://` or `content://` URI that points into the app's own private storage | low | Refuse URIs that resolve into the app's own data or its own providers |
| 4 | A hostile `.pitplan` can freeze the app (serve date far in the past) and `pitTempF` is not clamped | low | Bound `serveAt` and clamp `pitTempF` in `parsePitPlan` |
| 5 | The new `PitShare` log line can still hold a bare file path or a provider's own text | low | Log the exception class only, or cut paths too |
| 6 | Permissions the app never uses: `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE` (API 32 and below) | low | `android.blockedPermissions` in `app.config.ts` |
| 7 | Dev leftovers in the release build: dev routes are in the bundle (they redirect), dev-launcher and dev-menu stubs, the `exp+pitplanner` scheme, and probably Expo Router's `_sitemap` route | info | Optional tidy-up. For the dev build, see the note on `exp+pitplanner` |
| 8 | The update check opens whatever URL GitHub's answer gives, without checking the scheme or host | info | Allow only `https://github.com/MechEng70/pitplanner/...` |
| 9 | Send to developer carries free text (cook notes, quarantined 0.2.0 values). Debug and export copies pile up in the cache | info | Name "notes" on the debug screen; delete old copies before writing |
| 10 | Doc drift: SECURITY-EXCEPTIONS, TECH-DESIGN section 10 and the T-065 note no longer match the build in places | info | Update the docs |

Gate notes (not findings): see "Dependencies and gate" near the end.

---

## 1. The release APK embeds the development app config (medium)

**What I found**

- `unzip -p release/pitplanner-0.3.0-alpha.5.apk assets/app.config` holds `"name": "Pit Planner dev"`,
  `"version": "0.2.0"`, `"android.package": "io.github.mecheng70.pitplanner.debug"`, `"versionCode": 200999` and
  `"extra": {"variant": "development"}`.
- The manifest of the same APK is right: package `io.github.mecheng70.pitplanner`, versionCode 300005,
  versionName 0.3.0-alpha.5 (`aapt2 dump badging`).
- Why: expo-constants writes `assets/app.config` during the Gradle build, not at prebuild
  (`node_modules/expo-constants/scripts/get-app-config-android.gradle`, lines 31 to 48: "regenerate app.config on
  every build"). `tools/release.sh:83` sets `APP_VARIANT=production APP_VERSION="$V"` for the prebuild only. The
  Gradle step at `tools/release.sh:85` runs `./gradlew -q assembleRelease` without them. So `app.config.ts` is
  evaluated with its defaults: the development variant and `package.json`'s version (0.2.0, `package.json:3`).
- In a release build, expo-constants reads that embedded file (`ConstantsService.kt:12`,
  `CONFIG_FILE_NAME = "app.config"`). The app reads `Constants.expoConfig.version` and `.android.versionCode`
  in five places:
  - `app/(tabs)/gear.tsx:45`: the version line on Gear.
  - `app/_layout.tsx` (`UpdateCheck`): the installed version for the update check.
  - `app/_layout.tsx` (`exportData`): the version in "Export my data".
  - `src/platform/device.ts:22-23`: version and build in the Send to developer file.
- Nothing reads `extra.variant` at run time (searched `src/` and `app/`). The dev-only gates use `__DEV__`, which
  is false in the release bundle (finding 7). So the wrong variant does no harm today.

**Why it matters here**

This is not a hole an attacker can use. It breaks the update path for testers and makes debug files wrong:

- An APK built with `--version` (every alpha, and betas if they are built the same way) believes it is 0.2.0, a
  final release. `src/lib/update.ts` then offers final releases only (`newestRelease`, `finalsOnly`). A tester on
  a beta would never be offered the next beta, which is the plan in RELEASING.md ("from then on their app offers
  later betas and the final").
- Gear's version line, and with it the 5-tap debug entry, would read 0.2.0. A Send to developer file from a
  tester would say version 0.2.0, build 200999.
- The T-065 note in TASKS.md (line 1531) accepts "build 200999" as reading right. That is correct for a dev build
  but would be wrong for a release build. I did not check which build was on the phone then.
- A final release made after bumping `package.json` would show the right version. Its embedded config would
  still say "development".

**Recommendation**

- Run the Gradle step with the same environment as the prebuild: `APP_VARIANT=production APP_VERSION="$V"` on
  the `./gradlew assembleRelease` line, or `export` them once for the whole release run.
- Add a check to `--verify`: `assets/app.config` must hold the expected version and `extra.variant` must be
  `production`. That catches this class of mistake in every later build.
- Rebuild before any APK goes to a tester.

**Size (estimate):** under an hour, including a case in `tools/release.test.mjs`. One rebuild (about 20 minutes).

**How sure:** high for the APK contents and the cause (both read directly). I did not run the app, so the Gear
display and update-check effects are inferred from the code.

## 2. No backup rules; the secure-store claim can't be checked (low)

**What I found**

- The release manifest's `<application>` has `android:allowBackup=true` (`aapt2 dump xmltree`, manifest line 69).
  It has no `android:fullBackupContent` and no `android:dataExtractionRules`. So Auto Backup and device-to-device
  transfer take everything in the app's data: the SQLite database, every SharedPreferences file (including
  `CapacitorStorage.imported`), `files/`, and the device-protected alarm store `pit_alarms`.
- `expo-secure-store` is not a dependency (`package.json`) and no `expo.modules.securestore` class is in the dex.
  TECH-DESIGN section 10 says "T-035 checks that secure-store entries are excluded from backup". There is nothing
  to exclude today. The app stores no secret now (HA is v2).

**Why it matters here**

- There is no secret to leak through a backup today, so the security impact is low.
- One side effect (inferred, not tested): a backup taken during a live cook brings back `pit_alarms` and the
  active cook on a restored phone. `RestoreReceiver` would put those stale alarms back on the next reboot. That
  could ring "Missed while the phone was off" alerts for an old cook.
- When `expo-secure-store` is added for HA, I expect its config plugin to add its own backup rules (the
  `configureAndroidBackup` option, on by default in recent SDKs). I did not check this in SDK 58's source,
  because the package is not installed.

**Recommendation**

- Decide what a backup should hold. TECH-DESIGN wants cook history kept.
- Suggested: back up the database and `kv`, and exclude the device-protected `pit_alarms` and
  `pit_alarms_meta` prefs. The cache is never backed up anyway.
- Write it as a config plugin (`fullBackupContent` for API 30 and below, `dataExtractionRules` for 31 and up),
  with a node:test like the other plugins.
- Change TECH-DESIGN section 10 to say secure-store is not in the build yet. When it is added, T-035's check
  applies: verify its rules in the merged manifest.

**Size (estimate):** 1 to 2 hours with the plugin, its test and a backup/restore check (`bmgr`) on the emulator.
The doc change is minutes.

**How sure:** high for the manifest facts. Medium for the stale-alarm side effect (read from code, not tested).

## 3. A `.pitplan` open can point at the app's own private files (low)

**What I found**

- `OpenedPlan.uriOf` (`modules/pit-share/.../OpenedPlan.kt:49-58`) takes any `content://` or `file://` URI from
  a VIEW intent's data or a SEND intent's `EXTRA_STREAM`. `read` (lines 93-110) opens it with the app's own
  identity.
- So another app on the phone can send, for example,
  `file:///data/user/0/io.github.mecheng70.pitplanner/files/SQLite/<db>` or
  `content://io.github.mecheng70.pitplanner.FileSystemFileProvider/...`. Pit Planner then reads its own private
  file (up to 256 KB) and passes the text to the JS parser.
- The device test in HANDOFF (line 287) does exactly this on purpose:
  `am start ... -d file:///data/user/0/<pkg>/cache/test.pitplan`.
- I found no way for that text to get back out:
  - `parsePitPlan` only answers with fixed messages (`src/lib/sharedPlan.ts:62-95`).
  - The JS side never shows the text or the name (`src/platform/share.ts`, `src/screens/plan/PlanTab.tsx:195-230`).
  - The log line does not include the content (finding 5).
- The only private files that parse as a plan are the user's own `cache/cook.pitplan`, and opening that is
  harmless.

**Why it matters here**

This is the classic "confused deputy" pattern, but nothing leaks today, because the parser is strict and silent.
It becomes a real leak only if a later change echoes file text: a parse error showing a snippet, or a
"re-share this file" button.

**Recommendation**

- Refuse, before reading:
  - a `file://` URI whose canonical path is inside the app's data folders (`dataDir`, and the device-protected
    data dir);
  - a `content://` URI whose authority belongs to this app (`<package>.*`).
- `SendFile.ownFile` already has the canonical-path logic, the other way round.
- Add JUnit cases for both.

**Size (estimate):** 1 hour with tests.

**How sure:** high that the read happens (the code, and the documented device test). High that nothing leaks out
today (I read every consumer of the text).

## 4. A hostile `.pitplan` can freeze the app; `pitTempF` is not clamped (low)

**What I found**

- `parsePitPlan` accepts any `serveAt` that `Date.parse` accepts (`src/lib/sharedPlan.ts:66`).
  `suggestServe` (lines 179-184) then steps forward one week at a time until it passes now. It runs when the
  Shared plan sheet opens (`src/screens/plan/SharedPlanSheet.tsx:38-41`).
- With `"serveAt": "-271821-04-20T00:00:00Z"` (the earliest date JS allows), that is 14,288,682 loop turns.
  The same loop in Node (V8, with a JIT) took 5.7 s on this machine. Hermes interprets bytecode and is likely
  slower; I did not measure it on a phone.
- While the loop runs, the JS thread is blocked and the app stops responding.
- `pitTempF` is only checked to be a finite number (line 67). `fitPitTemp` (lines 170-176) snaps it to a settable
  temp only when the receiver has a smoker with settable temps; otherwise any value (for example 1e9 or -400)
  goes into the draft. TECH-DESIGN section 10 says "numbers clamped".
- Quantity and rest are clamped, items are capped at 20, and options are allow-listed. Those are fine.

**Why it matters here**

Someone has to send a crafted file and the user has to open it. The worst case is a frozen app until it is
killed, plus a plan with a nonsense temp. The file is not kept (the opened file lives in memory only), so a
restart clears it. I did not trace what the engine does with an extreme `pitTempF`.

**Recommendation**

- In `parsePitPlan`, reject (as "damaged") or clamp a `serveAt` outside a sane window, for example now minus a
  year to now plus a year. Since `parsePitPlan` takes no clock, either pass `now` in or use fixed bounds such as
  year 2000 to 2100.
- Have `suggestServe` jump with arithmetic (whole weeks in one step), not a loop.
- Clamp `pitTempF` to the range the rules allow (for example `trustedRange` or the cooker type's bounds).
- Add regression tests for all three.

**Size (estimate):** 1 hour.

**How sure:** high for the loop and the missing clamp (code, plus a timing in Node). Medium for how long the
freeze lasts on a phone.

## 5. The `PitShare` log line can still hold a file path (low)

**What I found**

`OpenedPlan.describe` (`OpenedPlan.kt:25-39`) cuts every `content://` or `file://` URI in the message down to
its scheme and provider. The tests cover that (`OpenedPlanTest.kt:163-175`). Three things are not cut:

- **Bare paths.** For a `file://` URI, `openInputStream` opens a plain file, and Android's
  `FileNotFoundException` message is the path itself, for example
  `/storage/emulated/0/Download/<file name>: open failed: EACCES (Permission denied)`. That holds no scheme, so
  the regex leaves it. This is the libcore message format as I know it; I did not reproduce it here.
- **Provider text.** A provider's own message may name an account or a file without a URI around it.
- **URIs with spaces.** The regex stops at whitespace (`\S*`), so the part of a decoded URI after a space is not
  cut.

The file's contents are never logged. That claim holds.

**Why it matters here**

Logcat is readable only by the app itself, adb and the system, and in bug reports. The exposure is Jason's own
logcat captures and any bug report a tester sends. It matters a bit more because the repo is public: a logcat
excerpt pasted into a doc or issue could carry a tester's file name.

**Recommendation**

- Log only the exception class names, plus the errno text after `open failed:` if useful.
- Or extend `cut` to replace any absolute path (`/\S+`) as well.
- Add a JUnit case with a bare path.

**Size (estimate):** 30 minutes.

**How sure:** high for what the code does. Medium for the exact Android message text.

## 6. Permissions the app never uses (low)

**What I found** (release manifest, `aapt2 dump badging`):

| Permission | Comes from | Used? |
|---|---|---|
| `INTERNET` | Expo template, expo-file-system | Yes, the update check |
| `POST_NOTIFICATIONS`, `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` (max 32), `RECEIVE_BOOT_COMPLETED`, `USE_FULL_SCREEN_INTENT`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `VIBRATE` | `modules/pit-alarms/android/src/main/AndroidManifest.xml` | Yes, SPEC section 6 |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (signature) | androidx.core | Library internal, fine |
| `SYSTEM_ALERT_WINDOW` | Expo prebuild template main manifest (seen in the generated `android/app/src/main/AndroidManifest.xml:4`, development variant; the line is the same in both variants) | **No.** Nothing calls `canDrawOverlays` or asks for it. |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` (max SDK 32) | `node_modules/expo-file-system/android/src/main/AndroidManifest.xml:3-4` and the template | **No.** Never requested at run time (no `PermissionsAndroid` anywhere). The app writes only its own cache and files. |

`<queries>` asks to see apps that handle VIEW and SEND of `*/*`, and browsers (from expo-sharing and
expo-linking). That is normal for a share sheet.

**Why it matters here**

- `SYSTEM_ALERT_WINDOW` makes "Display over other apps" appear for Pit Planner in Settings. It is not granted
  unless the user turns it on, but a tester may wonder why it is there.
- The storage permissions are runtime permissions that are never requested, so they are never granted.
- Least privilege; no direct risk.

**Recommendation**

- Add `android.blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']` to `app.config.ts`.
- Then check the merged manifest and that a `.pitplan` still opens from a file manager on an API 29 to 32
  emulator. A `file://` path in shared storage needs the storage permission there, but the app never requests
  it anyway, so nothing should change.
- Keep `INTERNET`.

**Size (estimate):** 30 minutes plus one prebuild and a device check.

**How sure:** high.

## 7. Dev leftovers in the release build (info)

**What I found**

- **Dev routes are in the bundle.** The release bundle's strings list `./dev/alarm.tsx`, `./dev/db.tsx`,
  `./dev/kit.tsx`, `./dev/plan.tsx` and `./dev/spike.tsx`. Each route redirects to `/plan` when `__DEV__` is
  false (`app/dev/alarm.tsx`, `db.tsx:18`, `kit.tsx:49`, `spike.tsx:19`, `plan.tsx:212`).
  - `app/dev/plan.tsx`'s effect also returns first on `!__DEV__` (line 144), so a link cannot seed data in
    release.
  - The dev-only screen text ("alarm check running", "failure armed", "cook started, smoker fires") is not in the
    release bundle. That fits `__DEV__` being compiled as false and the code being dropped.
- **Debug screen.** `pitplanner://debug` is refused without the one-time pass from the 5 taps (`app/debug.tsx`,
  `src/screens/debug/DebugGate.tsx`).
- **Native dev code.** The dex has only `expo.modules.devlauncher.DevLauncherPackage` and
  `expo.modules.devmenu.DevMenuPackage` (the release stubs) and React Native's own `devsupport` classes, which
  are always shipped. No dev-launcher activity is in the manifest.
- **`exp+pitplanner` scheme.** The release manifest's link filter has schemes `pitplanner` and `exp+pitplanner`,
  with BROWSABLE (manifest lines 101-110). The `exp+` scheme comes from expo-dev-client's config plugin. In
  release it only reaches the same router as `pitplanner://`.
- **Expo Router `_sitemap`.** Probably present (inference). `node_modules/expo-router/build/getRoutesCore.js:394-398`
  adds it unless `sitemap: false`, and the string `_sitemap` is in the bundle. It lists the routes; every one
  that matters is gated as above.

**Every route an outside app or a web page can open in a release build:**

| Route | What it does |
|---|---|
| `/`, `/plan`, `/cook`, `/gear` | Open a tab |
| `/gear?history=1` or `?history=plan` | Open history |
| `/plan?edit=x&add=y` | Ignored in release (`app/(tabs)/plan.tsx:13`); only remounts the Plan tab |
| `/setup` | Redirects home once setup is done |
| `/debug` | Redirects to Plan without the pass |
| `/dev/*` | Redirect to Plan |

None of them changes or deletes data, or starts or ends a cook, without the user. A `content:` or `file:` path
goes to Plan (`src/lib/systemPath.ts`).

**Dev build only.** The dev build (`.debug`, on Jason's devices only) has the real dev-launcher.
`DevLauncherController.handleIntent` (`node_modules/expo-dev-launcher/android/src/debug/.../DevLauncherController.kt:289`
on) treats an `exp+pitplanner://expo-development-client/?url=...` link as an order to load that bundle URL. With
BROWSABLE, a web page could ask the dev build to load JavaScript from a server of its choosing. That code would
run with the dev build's permissions and its own (separate) data. I did not check whether the launcher asks
first.

**Recommendation** (all optional)

- Drop the `exp+pitplanner` scheme from the production variant.
- Set `['expo-router', { sitemap: false }]`.
- Keep the dev build off phones used for everyday browsing, or accept it knowingly.
- Moving `app/dev/*` out of the production bundle is possible but not needed: the gates work.

**Size (estimate):** under an hour for the scheme and the sitemap, plus a prebuild.

**How sure:** high for the APK facts. Medium for `_sitemap` being reachable and for the dev-launcher behaviour.

## 8. The update check trusts the URL in GitHub's answer (info)

**What I found**

- `src/lib/update.ts` fetches `https://api.github.com/repos/MechEng70/pitplanner/releases?per_page=30` over HTTPS,
  anonymously (`src/platform/http.ts`: `credentials: 'omit'`, a 15 s timeout).
- The answer's `browser_download_url` (or `html_url`) is saved in `state.update.url`. Gear opens it with
  `Linking.openURL` when tapped (`src/screens/gear/GearScreen.tsx:184`, `src/components/kit/rows.tsx:95`).
- Nothing checks that the URL is `https:` or on github.com. `tag_name` is shown as text only.
- This is the only network call in the app's code. The Buy me a coffee link is a fixed URL opened on a tap.

**Why it matters here**

Pointing the URL elsewhere needs control of the GitHub repo's releases, or a TLS break. The app targets SDK 36,
so it does not trust user-installed CAs by default. Android also refuses to install an APK over Pit Planner
unless it carries the same signing key, so a fake APK could not replace the app. It could only be installed as a
separate app, and only if the user agrees.

**Recommendation**

Accept a URL only when it starts with `https://github.com/MechEng70/pitplanner/`; otherwise fall back to
`RELEASES_PAGE`. Add one test.

**Size (estimate):** 20 minutes.

**How sure:** high.

## 9. Send to developer and the cache files (info)

**What I found**

- `src/lib/debugReport.ts` keeps an allow-list of tables (lines 69-76), drops secret-named keys and columns,
  leaves out byte values, and copies every field by name.
- Free text still rides along:
  - `cook_history.notes`, typed by the user on Cook finished (`src/screens/cook/FinishScreen.tsx:138`);
  - `kv` rows named `quarantine:legacy:*`, raw 0.2.0 values that could not be imported
    (`src/db/legacyImport.ts:122-124`);
  - possibly a cooker name typed in "Enter it yourself" inside `cookers.profile`. I did not check the profile
    schema.
- The debug screen says "Your cookers, plan, running cook, cook history, rates and settings" (`REPORT_HOLDS`).
  It does not name notes.
- `writeCacheFile` (`src/platform/shareFile.ts:11-16`) writes:
  - `cook.pitplan` (overwritten each time);
  - `pitplanner-debug-<UTC minute>.json`, one new file per send;
  - the export file (named by time) and the database tar.
- Nothing deletes old copies. They stay in the app's private cache until Android trims it or the user clears it.
  The cache is not backed up and no other app can read it. Each share grants one app read access to one URI.

**Why it matters here**

A tester may write something personal in a cook note and not expect it in the developer file. The cache copies
are private to the app, so the risk is small.

**Recommendation**

- Add "and your cook notes" to the list on the debug screen. Or leave notes out of the file if Jason does not
  need them.
- Before writing a new debug or export file, delete older `pitplanner-debug-*.json` and export files in the cache.

**Size (estimate):** 30 to 60 minutes with tests.

**How sure:** high for the code. The cooker-name part is unverified.

## 10. Doc drift (info)

- **SE-001 and SE-002** say the Snyk flags are in `tools/check.sh`. They are in `tools/snyk.sh` now:
  `--configuration-matching='^releaseRuntimeClasspath$'` at lines 52-53, and
  `EXCLUDE=reference,release,legacy,docs,modules,.claude` at line 15, which adds `modules` and `.claude` to what
  SE-002 lists. The intent still matches; the file names do not.
- **TECH-DESIGN section 10, "Exported components":** lists `pitplanner://` and does not mention `exp+pitplanner`
  or the BROWSABLE category on that filter. The `.pitplan` filters match it exactly.
- **TECH-DESIGN section 10, "SQLite database":** the secure-store line (finding 2).
- **TASKS.md T-065 status line:** "build 200999" is called right (finding 1).

**Size (estimate):** 15 minutes.

---

## Dependencies and gate

- **Last recorded results:** HANDOFF.md lines 140 and 242-245 (2026-11-15): all 26 projects tested, Snyk Code 0
  issues, gate passing. I found no newer recorded Semgrep result with a count. TASKS.md line 139 says Semgrep had
  no findings in the repo when `r/generic.secrets` was added. Not re-run here, as instructed.
- **Snyk quota:** every run since 2026-11-15 prints "You have reached your monthly limit of 200 private tests".
  Scans still complete. If Snyk starts refusing, step 6 fails, and HANDOFF already says to stop and ask Jason.
  Worth watching before the next release run, which runs the gate again.
- **Dates coming up** (none in the next 30 days):
  - `snyk:monitor` pause ends 2026-12-01. That is a process note, not an exception.
  - SE-001: T-057 must remove the Gradle scope limit by 2027-02-01.
  - SE-003: the `.snyk` ignores for `braces` and `open` expire 2027-02-10 (`.snyk` lines 18-31); the gate fails
    again then.
  - SE-002 and SE-004 have no dates.
- **SE-001 to SE-004 still match reality:**
  - SE-001: the scope flag is in place (in `tools/snyk.sh`).
  - SE-002: `.snyk` `exclude.global` and `.semgrepignore` hold `reference/`, `docs/`, `legacy/`.
  - SE-003: the ignores are on their two issue IDs with the expiry.
  - SE-004: `.claude/` is in `.prettierignore:15`, `eslint.config.js:34`, `jest.config.js:8`, `.semgrepignore`,
    `tools/snyk.sh:15` and `.snyk`.
- **Semgrep rulesets:** `p/typescript`, `p/kotlin`, `p/secrets`, `r/generic.secrets` (`tools/semgrep.sh:18`).
  `android/` is excluded as generated. Classes of issue they would not catch here:
  - **Release-build and manifest facts:** backup rules, exported components, permissions, or an embedded config
    with the wrong variant (finding 1). No ruleset reads the merged manifest or the APK, and shell scripts like
    `tools/release.sh` have no ruleset in the list. T-035's planned node:test on the prebuilt manifest is the
    right home for these.
  - **App logic on untrusted input:** an unbounded loop driven by a file's date (finding 4), or an intent URI
    pointing back into the app (finding 3). These need a reviewer or targeted tests.

## Checked and fine

- **Debug flags:** `android:debuggable` is absent (false), `testOnly` absent, `requestLegacyExternalStorage`
  absent. `usesCleartextTraffic` is absent, so cleartext is off at targetSdk 36, and there is no
  `networkSecurityConfig`. (Release manifest.)
- **Exported components:** only `MainActivity` (launcher, links, `.pitplan`) and androidx's
  `ProfileInstallReceiver`, which needs `android.permission.DUMP` (shell and system only).
  - `AlarmReceiver`, `ActionReceiver` and `RestoreReceiver` are `exported=false` and `directBootAware`.
    `RestoreReceiver` hears system broadcasts only.
  - All four `<provider>`s are `exported=false`: FileSystem, Sharing, Clipboard, androidx-startup. (Release
    manifest.)
- **PendingIntents:** every one is explicit (class or launch intent) and `FLAG_IMMUTABLE`
  (`Notifications.kt:50-62`, `AlarmScheduler.kt:152-167`). The `pitAlarmId` extra on the launch intent is not
  read anywhere, so an outside app setting it does nothing.
- **FileProviders:**
  - The path files are broad: FileSystem covers `files/.` and `cache/.`; Sharing adds `external-path .`;
    Clipboard covers `cache/.clipboard/`. (APK `res/pT.xml`, `res/5_.xml`, `res/LV.xml`.)
  - That is fine because the providers are not exported and grant one URI at a time.
  - `SendFile.ownFile` limits the debug share to a canonical path inside cache or files, refusing `..` and
    symlinks out. `SendFile.intent` grants read on that one URI only.
- **`.pitplan` intent filters** match TECH-DESIGN: DEFAULT only, no BROWSABLE, `content` and `file` only.
- **The 256 KB cap** holds natively (`readCapped` reads one byte past it at most) and again in JS
  (`checkOpened`).
- **Parser:** nothing inside the file is used as a path or URI. Unknown foods are dropped, items capped at 20,
  options allow-listed, quantity and rest clamped, new ids given.
- **Notification actions:** Done and +15 min reach `ActionReceiver` only through the app's own immutable
  PendingIntents.
- **pit-legacy** reads only the app's own `CapacitorStorage` SharedPreferences and `files/history.json`
  (`LegacyPrefs.kt`, `src/platform/legacy.ts`). Nothing outside the app's private storage, so another app cannot
  plant a file there. The 0.2.0 app stored no tokens (searched `legacy/src`).
- **Device-protected storage** (`pit_alarms`, `AlarmStore.kt:67-88`) holds step ids, times, titles, bodies, step
  keys, the quiet-until time and pending notification actions. No secrets, no notes. Readable before first
  unlock by design (SPEC section 6).
- **Logging:** the only log calls in the app's own code (`src/`, `app/`, `engine/`, `modules/`) are the two
  `Log.w` in `OpenedPlan.kt`. No `console.*`.
- **Network:** one call, the update check, over HTTPS without credentials.
- **Secrets:**
  - No key, keystore, `.env` or properties file is tracked or in git history (by file name, all branches).
  - No token patterns in tracked files (GitHub, AWS, Slack, Google, private key headers).
  - `.gitignore` covers `*.jks`, `*.keystore`, `keystore.properties`, `.env`, `release/`, `/android/`.
  - `keystore.properties` exists at the repo root, untracked, mode 600; its values were not read.
  - `keystore.properties.example` has an empty alias and empty passwords.
  - `plugins/releaseSigning.ts` writes only Gradle code that reads the properties file at build time, into the
    git-ignored `android/`.
- **Signing:** the APK is signed with v2 only (fine for minSdk 24), one signer. Certificate SHA-256 is
  `b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29`, the same as `tools/release.sh:17` and
  RELEASING.md section 4.
- **APK metadata:** `META-INF/version-control-info.textproto` holds no repo data ("NO_SUPPORTED_VCS_FOUND").
- **expo-updates:** the `expo.modules.updates.*` meta-data says `ENABLED=false`, and no `expo.modules.updates`
  class is in the dex. The app cannot fetch over-the-air JS.

## What I could not check, and why

- **Nothing run on a device or emulator** (as instructed). The effects in findings 1, 2 and 4 are read from code,
  not observed. The freeze in finding 4 was timed in Node only; Hermes on a phone will differ.
- **Semgrep and Snyk were not run** (as instructed). Results are as recorded in the docs.
- **Tools:** `aapt2` and `apksigner` are not on `PATH`; I used the copies in `~/Android/Sdk/build-tools/37.0.0/`.
  `keytool -printcert -jarfile` printed nothing, because the APK has no v1 (JAR) signature; `apksigner` gave the
  digest instead.
- **R8-renamed classes:** the share and legacy module classes are renamed in the dex, so I reviewed those modules
  from source at HEAD, not from the dex.
- **The Hermes bundle** is bytecode. I could only search its strings, not read its control flow. "Dev code
  dropped" rests on the dev-only strings being absent.
- **`android/`** was being regenerated by another session during the review. I used it once, for the template
  permission lines, and otherwise relied on the APK and tracked files.
- **Unverified points:**
  - whether expo-router's `_sitemap` route actually renders in release;
  - whether the dev launcher asks before loading a URL from a link;
  - what expo-secure-store's backup plugin does in SDK 58 (not installed);
  - the exact text of Android's file-open error.
