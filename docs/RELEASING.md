# Releasing Pit Planner

A checklist to cut a release from a cold start. Everything here is what the scripts do today
(`tools/release.sh`, `plugins/version.ts`, `tools/device/upgrade020.sh`, `package.json`). Design background:
`docs/design/TECH-DESIGN.md` section 12.

Releases are built on Jason's machine (no EAS, no CI) and go out as GitHub Releases on
`MechEng70/pitplanner`. Pushing, tagging and publishing each need Jason's yes.

## Never in the repo

- The keystore (`*.jks`, `*.keystore`) and `keystore.properties`. All three are git-ignored. Keep it that way.
- Keystore passwords, the key alias value, Snyk and GitHub tokens, the Snyk org ID. Snyk and `gh` read their
  own CLI config.
- APKs, bundles (`.aab`) and their mapping files. `release/` is git-ignored; they live there on the build
  machine. APKs go to GitHub Releases, bundles to Google Play.

Add files to a commit by path. Never `git add -A` or `git add .`.

What to back up for signing: `docs/HANDOFF.md`, "Release signing: what to back up". Losing the key means
every user has to uninstall to get an update.

## Versions and versionCode

The version comes from `package.json` (`app.config.ts` reads it). `plugins/version.ts` turns it into the
Android versionCode:

`(major * 10000 + minor * 100 + patch) * 1000 + stage`

| Kind | Version | Stage | versionCode |
|---|---|---|---|
| alpha.N | 0.3.0-alpha.1 | N | 300001 |
| beta.N | 0.3.0-beta.1 | 300 + N | 300301 |
| rc.N | 0.3.0-rc.1 | 600 + N | 300601 |
| final | 0.3.0 | 999 | 300999 |

N is 1 to 299. Minor and patch are under 100. A prerelease always installs under its final release, and
every version installs over the one before. 0.1.0 (100) and 0.2.0 (200) used the old scheme and sit below
all of these, so 0.2.0 upgrades in place.

Which kind to use:

- **alpha:** internal builds, not given to anyone. Built with `--version` (below), from any branch state.
- **beta, rc:** builds for testers. Published on GitHub as a prerelease. Testers get betas (Jason,
  2026-11-15): send a tester the beta APK once; from then on their app offers later betas and the final.
- **final:** published as a normal release.

## 1. Before you start

- [ ] Every task for the release is done (`docs/design/TASKS.md`), and `docs/release-notes/<version>.md` is
      written and no longer says draft.
- [ ] No open high or critical finding without an entry in `docs/design/SECURITY-EXCEPTIONS.md`.
- [ ] On `main`, `git status` clean.
- [ ] `npm run check` passes (all six steps).
- [ ] `keystore.properties` is at the repo root (copy `keystore.properties.example`, fill it in, `chmod 600`).
- [ ] JDK 21 and the Android SDK are installed. The script uses `JAVA_HOME` (default
      `/usr/lib/jvm/temurin-21-jdk`) and `ANDROID_HOME` (default `~/Android/Sdk`).
- [ ] `release/pitplanner-0.2.0.apk` is in `release/` (for the upgrade test; it is not in git).

## 2. Set the version

- [ ] Set `version` in `package.json` and in `package-lock.json` (two places at the top). One way:
      `npm version <version> --no-git-tag-version`.
- [ ] Commit it by path: `git add package.json package-lock.json`, then commit. The release script refuses
      a working tree that is not clean, so the bump is committed before the build.

For an internal alpha, skip this step and use `--version`.

## 3. Build: `npm run release`

```
npm run release                                # the version in package.json; needs clean main
npm run release -- --version 0.3.0-alpha.4     # internal prerelease; any branch state
npm run release -- --dry-run                   # print the steps and checks, run nothing
npm run release -- --verify release/<apk>      # only check an APK's cert, app ID, version and app config
npm run release -- --bundle                    # the bundle for Google Play instead of the APK (section 3b)
```

- `--version` only takes a prerelease (`x.y.z-alpha.N`, `-beta.N`, `-rc.N`). For a release, bump
  `package.json`.
- `--verify` compares the APK with the version in `package.json`, or with `--version` when given.
- `--dry-run` lists problems it finds and carries on printing.

What a run does, in order:

1. Stops the test emulator (`tools/device/avd.sh stop`). The build needs the memory.
2. Runs `npm run check`.
3. Production prebuild: `APP_VARIANT=production APP_VERSION=<version> npx expo prebuild --platform android
   --clean --no-install`.
4. `./gradlew assembleRelease` in `android/`, with the same `APP_VARIANT=production APP_VERSION=<version>`,
   signed through `plugins/withReleaseSigning` and `keystore.properties`. The variable pair matters here
   too: expo-constants writes `assets/app.config` (what the app reads about itself at run time: Gear's
   version, the update check, Send to developer) during this build. 0.3.0-alpha.5 was built without them
   and said 0.2.0 inside (T-035).
5. Verifies the APK: signing certificate, app ID `io.github.mecheng70.pitplanner`, versionCode, versionName,
   and the embedded `assets/app.config`: the same version and versionCode, the app ID, variant `production`
   (`tools/release-app-config.mjs`).
6. Copies it to `release/pitplanner-<version>.apk` and prints its SHA-256. Keep that line for the release
   notes.
7. On exit, generates the development `android/` again, so `npm run android` and the gate keep working.

It stops before building when `keystore.properties` is missing, when the APK already exists in `release/`
(an APK is never overwritten), or, for a real release, when you are not on clean `main`.

A run takes about 20 minutes.

- [ ] The run ended with `cert ok; package: name='io.github.mecheng70.pitplanner' versionCode=... `,
      `app config ok: version <version>, versionCode <code>, ...` and a SHA-256 line.

## 3b. The bundle for Google Play: `npm run release -- --bundle`

Google Play takes an Android App Bundle (`.aab`), not an APK. `--bundle` builds it (T-102). It is a second
run: one run builds the APK, another the bundle, from the same commit and version.

```
npm run release -- --bundle                             # the version in package.json; needs clean main
npm run release -- --version 0.3.1-beta.1 --bundle      # a prerelease
npm run release -- --verify release/<aab>               # only check a bundle (add --version for a prerelease)
```

The same pipeline as the APK: the emulator stopped, `npm run check`, the production prebuild, the same
variable pair and signing, the development `android/` generated again on exit. What differs:

1. Gradle runs `bundleRelease`.
2. The bundle is verified: `jarsigner -verify` (a bundle is signed as a JAR; `apksigner` does not read one),
   the certificate SHA-256 from `keytool -printcert -jarfile`, then the app ID, versionCode and versionName
   from the base module's manifest, and the embedded `base/assets/app.config`.
3. Every permission the bundle asks for is printed, one `permission:` line each. This list is what Play
   Console's permission declarations have to cover. A bundle that asks for
   `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is refused (`WRONG PERMISSIONS`): Play allows it for a few app
   types only (`PLAY_REFUSED` in `tools/release.sh`).
4. It writes three files and prints the bundle's SHA-256:
   - `release/pitplanner-<version>.aab`: upload this to Play Console.
   - `release/pitplanner-<version>-mapping.txt`: the R8 mapping file. Keep it with the bundle; Play uses it
     to make crash reports readable (the bundle carries a copy too).
   - `release/pitplanner-<version>-manifest-merger-report.txt`: Gradle's record of where each manifest
     line, permissions included, came from.

It stops before building when any of the three files already exists.

The bundle is signed with the same key as the APK. In Play Console that key is the upload key (and, if Play
App Signing was set up with it, the app signing key too). Play gives every upload its own check: a
versionCode can be uploaded once, so a bundle and the next bundle never share a version.

The emulator tests in sections 5 and 5b run on the APK. A bundle cannot be installed directly.

- [ ] The run ended with `cert ok; package: ...`, the `permission:` lines, `app config ok: ...` and a
      SHA-256 line.
- [ ] The `permission:` lines are the ones declared in Play Console.

## 4. Signing certificate

Every APK must carry this certificate SHA-256, or it will not install over the app people already have:

`b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29`

`npm run release` checks it and fails with `WRONG CERT` on any other. To check an APK again later:
`npm run release -- --verify release/pitplanner-<version>.apk`.

- [ ] Cert digest matches.

## 5. Upgrade test on the emulator

Emulator only. The script refuses to run against a phone. It installs the real 0.2.0 APK, makes data in
0.2.0's own screens, then installs the new APK over it.

```
tools/device/avd.sh start                                        # the release run stopped it
tools/device/upgrade020.sh setup                                 # 0.2.0 with gear, a saved rate, a plan, two past cooks
tools/device/upgrade020.sh check release/pitplanner-<version>.apk
tools/device/avd.sh stop
```

- `setup` stops if the release app or data from an earlier install is already on the emulator. It never
  uninstalls or deletes. Removing those is destructive: ask Jason first.
- `check` must end with `PASS  upgrade from 0.2.0`. It checks that the app opens with the "Pit Planner has a
  new look" notice and the full-import sentence, the imported cookers, saved rate, plan draft, units and
  past cooks in the database, that nothing was quarantined, and that the old files were kept as `.imported`
  copies.
- `upgrade020.sh live` (after `setup`) leaves a short cook running in 0.2.0 with alarms set, and
  `upgrade020.sh alarms` lists the pending alarms, for testing an upgrade in the middle of a cook.
- Checking the imported data on the Gear, Plan and History screens is by hand. A scripted check of the
  screens is not built yet (T-038).

- [ ] `PASS  upgrade from 0.2.0`.
- [ ] Gear, Plan and History show the imported data.

For 0.3.0, T-038 adds the upgrade on Jason's phone with his real data and a live cook. Every phone action
is listed first and waits for his yes.

## 5b. Locked-reboot test on the emulator (required before every release)

Required for every release (Jason, 2026-11-16, T-072): a phone that restarts overnight must have its cook's
alarms back before anyone unlocks it. On request at other times.

```
tools/device/locked-reboot.sh release/pitplanner-<version>.apk
```

- It runs on its own emulator, `pitplanner-lock` (the usual image with a PIN, so it boots locked like a
  phone after a restart). The script starts and stops it; the usual emulator is stopped first.
- It installs the release APK, goes through Setup, opens a plan file made for the run from the Files app,
  starts the cook, restarts the emulator, and while it is still locked checks: the app did not crash, every
  alarm still to come is registered again, and the first step that comes due rings (its alert is posted and
  its repeat is set). Then it unlocks and checks the app opens on the cook. About 20 to 25 minutes: it waits
  for a real step to come due.
- **The one place data is cleared.** At the start of each run the script runs `pm clear` on Pit Planner's
  data, on the `pitplanner-lock` emulator only. Jason's limit (2026-11-16): nowhere else, not the main
  emulator, not his phone. The script checks the target itself before clearing (an emulator serial, and
  the emulator's own name read back) and stops if it is anything else. Do not copy that line elsewhere.
- A release APK only. A dev build fails this test by design: it crashes at start while the phone is locked,
  in React Native's developer support code, which a release build does not run
  (`docs/alarm-testing.md`, "Locked restart on an emulator with a PIN"). That is a limit of dev builds: after
  a restart, a dev build's alarms come back when the phone is unlocked.
- The emulator proves the app's start-up while locked. It does not prove a maker's own power management:
  the same check runs once on Jason's phone with the release build at T-038, and once on the tester's
  Samsung at T-037.

- [ ] `== locked-reboot: PASS`, with every line above it a `PASS`.

## 6. Tag and push (Jason's yes first)

- [ ] `git tag v<version>` on the commit that was built. The tag must match `package.json` (`v0.3.0`).
- [ ] `git push origin main` and `git push origin v<version>`.

## 7. GitHub Release

- [ ] Put the APK's SHA-256 in `docs/release-notes/<version>.md` (commit it before tagging, or add it to the
      release text on GitHub).
- [ ] Final release:
      `gh release create v<version> release/pitplanner-<version>.apk --notes-file docs/release-notes/<version>.md`
- [ ] Alpha, beta or rc given to testers: the same command with `--prerelease`.

Why it matters: 0.2.0's update check asks GitHub for `/releases/latest`, which leaves out prereleases and
drafts. A final release must not be marked prerelease, or people on 0.2.0 never see "Update available".
Betas are marked prerelease so they do not show up for everyone.

From 0.3.0 on (T-032, `src/lib/update.ts`) the app reads the list of releases, at most once a day, on
launch and on resume. An install of a final release is offered final releases only. An install of a
prerelease (alpha, beta, rc) is offered anything newer: a later beta, an rc or the final.

The update check links to the first release file whose name ends in `.apk`, so attach exactly one APK.

If an install fails, the tester writes to the address in `docs/INSTALL.md` (the one the debug screen uses,
`DEVELOPER_EMAIL` in `src/lib/debugReport.ts`). Keep the two the same.

A Google Drive copy of the APK is optional.

## 8. After the release

- [ ] `npm run snyk:monitor` (it runs `snyk monitor --all-projects --exclude=reference,release,legacy,docs,modules`).
      Run it after a release or a push to `main`, never per task. It is not part of `npm run check`.
      **Paused until 2026-12-01:** do not run it before then. Run it once on the first push in December.
- [ ] On a phone still on the previous version, open Gear and check the "Update available" row shows the
      new version and opens the download. It checks at most once a day.
- [ ] Update `docs/HANDOFF.md` and the task's status line in `docs/design/TASKS.md`.

## If something fails

- `problem: ... already exists`: that version was already built. Bump the version or the prerelease number.
  Do not delete an APK that was given to anyone.
- `WRONG CERT`: the keystore in `keystore.properties` is not the release key. Stop. Do not publish.
- `WRONG PACKAGE OR VERSION`: the build did not pick up the version or the production variant. Stop and
  read the line it prints.
- `NOT SIGNED` (a bundle): Gradle did not sign it. Check `keystore.properties`. Stop. Do not upload.
- `WRONG PERMISSIONS` (a bundle): a library or a module added a permission Google Play restricts. The failed
  run prints each permission with the manifest it came from (from Gradle's manifest merger report, read
  before `android/` is deleted). Remove it at its source or block it in `app.config.ts`
  (`blockedPermissions`), and build again. Do not take the permission off the refused list to get a pass.
- `WRONG APP CONFIG`: the manifest is right but the app config inside the APK is not (the Gradle build ran
  without the production variant or the version). The app would show the wrong version and miss updates.
  Stop. Do not publish.
- Snyk's Gradle scan fails inside `npm run check`: see CLAUDE.md, "Quality gate". Never remove a gate step
  to get a pass.
