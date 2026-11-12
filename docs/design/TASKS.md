# Pit Planner: tasks

One entry per task, each sized for one session (under a day). Phases, order and the critical path are in
[WBS.md](WBS.md); architecture and rules in [TECH-DESIGN.md](TECH-DESIGN.md).

**Stack change (2026-11-12, plan approved by Jason):** the app is being rebuilt on Expo + React Native
(TECH-DESIGN section 1). T-001 stays as done. Everything from T-002 is renumbered for the new stack; the old
Capacitor-era entries T-002..T-040 are superseded (mapping at the end of this file).

How to work a task (every task; see CLAUDE.md "Quality gate"):
1. Read CLAUDE.md, SPEC.md, TECH-DESIGN.md, `docs/HANDOFF.md`, then this entry. Look at the named mockups in
   `docs/mockups/` (PNG and `source/*.dc.html`) before building a screen; the Capacitor version in `legacy/`
   shows how each screen behaves today.
2. Check the dependencies are done. If not, stop and say so.
3. Write the tests listed (failing first for bug fixes), then the code.
4. Run `npm run check` until it passes. Report its summary.
5. Update the status line here, `docs/HANDOFF.md`, and SPEC.md if behavior changed. Commit on `main` (push
   only when Jason asks).
6. List the device steps for Jason (the "Device testing" field) in the final message.

Status values: `todo`, `in progress`, `done (commit)`, `blocked (reason)`.

UI tasks share these acceptance rules (not repeated per task): match the named mockups; theme tokens only;
`Num` values never truncate, shrink or ellipsize at 115% and 130% (Maestro screenshots in `docs/fidelity/`);
Android back closes the top sheet first; copy per CLAUDE.md.

---

## Phase 1: Cook timing fix

### T-001 Close out the cook timing fix (HA-INTEGRATION "Do first")
- **Status:** done (`b524245`); Jason's phone check on 0.2.0 passed 2026-11-12. Engine work; independent of the stack.
- **Goal:** every "Do first" item verifiably met, with screenshots.
- **Files:** `engine/plan.test.ts`, `engine/timing.test.ts`, `src/screens/plan/FoodEdit.test.tsx` (moves to
  `legacy/` in T-002), `docs/fidelity/timing-*.png`, `docs/HANDOFF.md` (checklist table).
- **Depends on:** none.
- **Acceptance:** met: HANDOFF maps items 1-7 to code and tests; 0.75 hr/lb fires 6:20 AM for a 5:00 PM serve;
  nothing clipped at 115/130%.
- **Tests:** done. The Vitest FoodEdit cases are rewritten for React Native in T-019.
- **Device testing (Jason):** on 0.2.0: brisket 12 lb at 0.75 hr/lb with "Use for future" checked; Plan fires
  about 6:20 AM for 5:00 PM; still 0.75 after reopening the next day.

---

## Phase 2: Scaffold and quality gate

### T-002 Expo scaffold; Capacitor app to `legacy/`
- **Status:** done (`a8a8ad6`, close-out in the next commit). Dev build on the phone 2026-11-12: three tabs, Plan
  shows "Fire the smoker at 6:20 AM" (`docs/fidelity/t002-expo-dev-build.png`). SE-003 waits for Jason's approval.
- **Goal:** an Expo SDK 58 app with Expo Router tabs (Plan, Cook, Gear placeholders) runs as a development
  build on the phone and imports the engine; the Capacitor app is kept as reference.
- **Files:** `package.json`, `app.config.ts`, `app/_layout.tsx`, `app/(tabs)/{_layout,plan,cook,gear}.tsx`,
  `tsconfig.json`, `babel.config.js`, `metro.config.js`, `.gitignore` (`android/`, `ios/`, `.expo/`),
  `legacy/**` (moved: old `src/` UI, `android/` sources, `capacitor.config.ts`, `index.html`, Vite configs,
  `public/`, `tools/device/*.mjs`), `SPEC.md` section 2, `CLAUDE.md` (stack lines), `README.md`.
- **Depends on:** Jason approves this plan (approved 2026-11-12).
- **Approach:**
  1. `git tag v0.2.0 e86d930` (the commit the 0.2.0 APK was built from); push the tag only when Jason says.
  2. `git mv` the Capacitor files into `legacy/` (keep `engine/`, `data/`, `assets/`, `reference/`, `docs/` at
     the root). Pure helpers used by the engine tests (`src/lib/cookView.ts`, `finish.ts`, `historyView.ts`,
     `sharedPlan.ts`, `timing.ts`, `update.ts`, `format.ts`, `rules.ts`, and the types in `cook.ts` and
     `history.ts`) stay in `src/lib/` (TECH-DESIGN section 3 rule 3); their Capacitor imports become interface
     calls filled in by T-009/T-015.
  3. Create the Expo app at the root (template files copied in, not a nested folder): SDK 58, Expo Router,
     TypeScript; `app.config.ts` with `APP_VARIANT` variants (TECH-DESIGN section 12), `scheme: 'pitplanner'`,
     versionCode from `package.json`, icon and splash from `assets/`.
  4. Prove the engine runs in Metro: the Plan placeholder shows the `buildPlan` fire time for the Saturday
     fixture. Fix `.ts` import resolution in Metro/Jest config if needed (D-2), never in `engine/`.
  5. Settle the TypeScript version (D-2) and record it in TECH-DESIGN.
  6. Rewrite SPEC.md section 2 and the CLAUDE.md lines that name Capacitor or Preferences.
- **Acceptance:** `npx expo run:android` installs "Pit Planner dev" (`...pitplanner.debug`) beside the release
  app and shows three tabs and the fire time; `npm run test:engine` unchanged and green; tag exists locally.
- **Tests:** engine suite unchanged; one Jest smoke test rendering the Plan placeholder.
- **Device testing (Jason):** none (Claude installs the dev build).
- **Notes (done 2026-11-12):**
  - Versions: `expo` ~58.0.24, `react-native` 0.88.1, `react` 19.3.0, `expo-router` ~58.0.31, TypeScript ~6.0.3
    (D-2 decided: `typescript7` dropped). Metro and Jest resolve the engine's `.ts` imports with no config, so
    no `metro.config.js` or `babel.config.js` yet (T-004 adds them for NativeWind).
  - Kept in `src/lib/` (copied; the originals stay in `legacy/src/lib/` with the rest of the old UI): the
    listed helpers plus `gear.ts` (pure, used by Setup and Gear). `cook.ts` `syncAlarms(cook, now, alarms,
    units)` now takes an `AlarmService` (`src/platform/types.ts`, TECH-DESIGN section 4) and the display units
    instead of calling the Capacitor plugin and Preferences. `history.ts` keeps `CookRecord` and `logsOf`; its
    file I/O stays in legacy (SQLite in T-009). `share.ts`, `storage.ts`, `store.tsx` and `src/platform/*.ts`
    (Capacitor bridges) are legacy only.
  - Moved whole: `tools/device/` to `legacy/tools/device/` (except `compose.py`, kept for T-006) and
    `tools/release.sh` to `legacy/tools/` (T-007 writes the Expo one).
  - Pulled forward from T-003 so `npm run check` passes now: Capacitor, Preact, Vite and Vitest deps and configs
    removed; minimal ESLint config (`@eslint/js` + typescript-eslint; T-003 adds expo, React Native and layer
    rules); minimal `jest.config.js` (jest-expo, TZ America/New_York for fixtures); `legacy/` and generated
    `android/` excluded from Semgrep/Snyk (SE-002 extended); `tools/test-android.sh` reports no native tests
    until `modules/` has some. T-003 still owns the prebuild step in `check.sh` and running module JUnit.
  - Added `expo-dev-client` (development builds) and `expo-system-ui` (dark root background).
  - The old Capacitor dev copy on the phone was backed up to
    `legacy/tools/device/out/dev-copy-backup-2026-11-12/data.tar` (git-ignored). The Expo dev build has the same
    package ID but a different debug key, so the old dev copy was uninstalled (release app untouched).
  - First Snyk scan of the Expo stack: two high npm findings in dev tooling (`braces` via Metro, `open` via
    dev-middleware), not in the app bundle; ignored path by path in `.snyk`, written up as SE-003 (pending
    Jason's approval).

### T-003 Quality gate on the new stack
- **Status:** todo
- **Goal:** `npm run check` runs all six steps against the Expo app (TECH-DESIGN section 11).
- **Files:** `tools/check.sh`, `tools/test-android.sh`, `eslint.config.js`, `.prettierignore`, `.semgrepignore`,
  `.snyk`, `jest.config.js`, `jest.setup.ts`, `package.json` scripts, `docs/design/SECURITY-EXCEPTIONS.md`
  (SE-002 extended to `legacy/`; SE-001 re-checked after the first prebuild).
- **Depends on:** T-002.
- **Approach:** ESLint flat config: `eslint-config-expo` + typescript-eslint + `eslint-plugin-react-native` +
  `no-restricted-imports` layer rules; Jest with `jest-expo` and React Native Testing Library; `test:all` =
  engine + Jest + Gradle module tests; `check.sh` prebuilds `android/` when missing or stale; Semgrep and Snyk
  paths per TECH-DESIGN; remove Vite, Vitest and Preact deps and configs.
- **Acceptance:** `npm run check` passes; a planted hardcoded secret fails Semgrep; a lint error fails ESLint;
  warm run under 4 minutes.
- **Tests:** the gate itself; a Jest test proving the setup (font and safe-area mocks).
- **Device testing (Jason):** none.

### T-004 Theme: tokens, NativeWind, Reusables, Roboto (spike)
- **Status:** todo
- **Goal:** the mockup look in React Native, and proof that NativeWind and React Native Reusables work on RN
  0.88 with the New Architecture (R-1).
- **Files:** `src/theme/tokens.ts`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`,
  `components.json` (Reusables), `src/components/ui/*` (first: text, button), `app/_layout.tsx` (fonts, dark
  theme, system bar colors), `app/dev/spike.tsx` (dev-only route).
- **Depends on:** T-002.
- **Approach:** token values from `legacy/src/ui/ui.css` (extracted from `docs/mockups/source`); type scale
  from the same file; Roboto 400/500/700 via `expo-font`; Reusables CLI init with NativeWind; spike screen with
  a card, chips and a stepper, screenshot next to mockup 05.
- **Acceptance:** spike at 115/130% matches the mockup colors and type. If NativeWind or Reusables fail on
  RN 0.88, record the fallback (StyleSheet with the same tokens) in TECH-DESIGN and continue.
- **Tests:** Jest: tokens equal the `ui.css` values; text variants use the right font.
- **Device testing (Jason):** glance at the spike screenshot.

### T-005 Kit components
- **Status:** todo
- **Goal:** the Pit Planner kit (TECH-DESIGN section 8), so screens never style ad hoc.
- **Files:** `src/components/kit/*` (Text variants, Num, Stack/Row, Card, Button, IconButton, Chips,
  Segmented, Stepper, Tile/Tiles, InfoBox, ResultCard, Banner, ListRow, StatusRow, CheckRow, Field, Sheet,
  EmptyState, icons via `react-native-svg`), `eslint-rules/num-text-size.js`, `app/dev/kit.tsx`, tests.
- **Depends on:** T-004.
- **Approach:** port the behavior of `legacy/src/ui/components.tsx` component by component; settle D-4
  (bottom sheet) first; Android back closes the top sheet; ripple on pressables; same accessibility roles and
  labels as the legacy kit (tests query by role and label).
- **Acceptance:** the kit gallery shows every component; the lint rule rejects `numberOfLines` and
  `adjustsFontSizeToFit` on `Num`.
- **Tests:** RNTL per component (Stepper handlers and disabled, Chips selection, Sheet back and close,
  CheckRow toggle); lint rule unit test.
- **Device testing (Jason):** none.

### T-006 Device test tooling (Maestro)
- **Status:** todo
- **Goal:** unattended device passes for the React Native app, replacing the WebView/CDP scripts.
- **Files:** `tools/device/run.sh` (rewritten), `tools/device/flows/*.yaml`, `tools/device/compose.py` (kept),
  `tools/device/db.sh` (back up and restore the dev build's SQLite via `run-as`), `tools/device/README.md`.
- **Depends on:** T-002; Jason has installed the Maestro CLI.
- **Approach:** keep today's safety in `run.sh`: wake and refuse if locked, back up data, heads-up banners off,
  font scale 1.15 then 1.3, restore everything on exit. Flows tap by accessibility label; `adb exec-out
  screencap` for images.
- **Acceptance:** `npm run device -- --only smoke` installs the dev build and captures the tabs at both scales,
  data restored afterwards.
- **Tests:** n/a (tooling); `shellcheck` clean.
- **Device testing (Jason):** phone unlocked and plugged in during the run.

### T-007 Release build: signing plugin, versionCode, release script
- **Status:** todo
- **Goal:** `npm run release` produces an APK signed with the existing key that Android accepts as an update to
  0.2.0.
- **Files:** `plugins/withReleaseSigning.js`, `keystore.properties.example` (repo root), `tools/release.sh`,
  `app.config.ts`.
- **Depends on:** T-002.
- **Approach:** the plugin reads the git-ignored root `keystore.properties` (path to `~/keys/pitplanner.jks`,
  alias, passwords) and writes the signing config into the generated Gradle at prebuild. `release.sh`: check,
  `APP_VARIANT=production npx expo prebuild --platform android --clean`, `assembleRelease`, `apksigner verify
  --print-certs` (SHA-256 must be `b6c32d12...0a29`), print versionCode.
- **Acceptance:** an internal `0.3.0-alpha.1` APK (not distributed) has the 0.2.0 cert and versionCode 300 and
  installs over `release/pitplanner-0.2.0.apk` on an emulator without uninstalling.
- **Tests:** node:test for the versionCode helper; release script dry run.
- **Device testing (Jason):** none (emulator).

---

## Phase 3: Storage

### T-008 SQLite: Db interface, migration runner, schema v1
- **Status:** todo
- **Goal:** `pitplanner.db` with versioned migrations from day one (TECH-DESIGN section 5).
- **Files:** `src/db/db.ts` (interface), `src/db/expoDb.ts` (expo-sqlite), `src/db/testDb.ts` (better-sqlite3),
  `src/db/migrate.ts`, `src/db/migrations/0001_init.ts`, `src/db/schema.snapshot.sql`, tests.
- **Depends on:** T-003.
- **Approach:** runner per TECH-DESIGN (user_version, one transaction per migration, rollback on error,
  foreign keys on, WAL); error screen hook for a failed migration.
- **Acceptance:** 0 -> 1 matches the snapshot; re-running is a no-op; a failing migration leaves version and
  data unchanged.
- **Tests:** Jest on better-sqlite3: snapshot, idempotence, rollback.
- **Device testing (Jason):** none.

### T-009 Repositories
- **Status:** todo
- **Goal:** typed reads and writes for kv, cookers, rate_overrides, active_cook and cook history.
- **Files:** `src/db/repos/*.ts`, `src/lib/history.ts` (keeps `CookRecord`; I/O through the repo), tests.
- **Depends on:** T-008.
- **Approach:** JSON columns validated and normalized on read (reuse `normalize` for ActiveCook); the history
  repo assembles `CookRecord` from the two tables; `logsOf` becomes a query with the same result.
- **Acceptance:** every repo round-trips; a corrupt JSON row reads as the default and never throws to the UI.
- **Tests:** Jest repo tests including corrupt rows; `engine/history.test.ts` green and unchanged.
- **Device testing (Jason):** none.

### T-010 App store over repositories
- **Status:** todo
- **Goal:** app state (gear, units, draft, rates, totals, locks, history, cook, flags, firstRun) loads from
  SQLite and writes through on every change (D-5).
- **Files:** `src/lib/store.tsx` (React context; port of `legacy/src/lib/store.tsx`), `src/lib/cook.ts` (types
  kept; platform via interfaces), tests.
- **Depends on:** T-009.
- **Acceptance:** killing the app after any change and reopening shows the change; `planInput(state)` returns
  the same shape as before.
- **Tests:** Jest store tests with the test DB and platform fakes.
- **Device testing (Jason):** none.

### T-011 `pit-legacy` module
- **Status:** todo
- **Goal:** read the 0.2.0 `CapacitorStorage` SharedPreferences from JS, once.
- **Files:** `modules/pit-legacy/` (`expo-module.config.json`, Kotlin module, TS API), JUnit tests.
- **Depends on:** T-003.
- **Approach:** `readCapacitorPrefs(): Record<string, string>` and `retireCapacitorPrefs()` (called only after
  the SQLite import commits; keeps a renamed copy until 0.4.0).
- **Acceptance:** returns the entries where they exist; an empty map otherwise.
- **Tests:** Robolectric: seeded prefs read back; none -> empty; retire keeps the copy.
- **Device testing (Jason):** none.

### T-012 Import from 0.2.0 and the fresh-start notice
- **Status:** todo
- **Goal:** the first launch of 0.3.0 keeps the user's data, or says plainly what could not be kept
  (TECH-DESIGN section 5).
- **Files:** `src/db/legacyImport.ts`, `src/screens/shared/ImportNotice.tsx`, tests, `docs/HANDOFF.md`.
- **Depends on:** T-009, T-010, T-011.
- **Approach:** parse each key with the existing validators; one transaction; history from `history.json` via
  expo-file-system; active cook kept only if its serve time is in the future (alarms rescheduled once T-015
  exists); notice copy per TECH-DESIGN; originals renamed `*.imported`.
- **Acceptance:** on an emulator: install `release/pitplanner-0.2.0.apk`, set up gear, a saved rate, a draft and
  two history cooks; install a 0.3.0-alpha over it; everything shows. A corrupted `gear` entry gives the partial
  notice; no readable data gives the fresh-start notice.
- **Tests:** Jest import tests with fixture JSON shaped like a real 0.2.0 install (no personal data); each
  failure path.
- **Device testing (Jason):** none yet (his phone upgrades at T-038).

---

## Phase 4: Alarm module

### T-013 `pit-alarms` Expo module (Kotlin port)
- **Status:** todo
- **Goal:** the 0.2.0 alarm plugin as an Expo module with the same behavior, plus `setQuiet`.
- **Files:** `modules/pit-alarms/android/src/main/java/io/github/mecheng70/pitplanner/alarms/*.kt`
  (AlarmScheduler, AlarmStore, Notifications, Receivers, PitAlarmsModule), module `AndroidManifest.xml`,
  `modules/pit-alarms/index.ts`.
- **Depends on:** T-003.
- **Approach:** copy the legacy Kotlin; replace the Capacitor `Plugin`/`PluginCall` layer with an Expo `Module`
  (`AsyncFunction`, `Events`); keep class names and package (in-flight intents, TECH-DESIGN section 5); add
  `setQuiet(until)`: nags due inside the window move to its end.
- **Acceptance:** the dev build rings a 10 s test alarm with the screen off; the JS API matches `AlarmService`
  and `PermissionService`.
- **Tests:** in T-014.
- **Device testing (Jason):** none (Claude runs the 10 s test).

### T-014 `pit-alarms` native tests
- **Status:** todo
- **Goal:** every alarm invariant (TECH-DESIGN section 6) has a JUnit/Robolectric test.
- **Files:** `modules/pit-alarms/android/src/test/...` (AlarmStoreTest, AlarmSchedulerTest, ReceiversTest,
  QuietTest), module `build.gradle` test dependencies.
- **Depends on:** T-013.
- **Approach:** Robolectric `ShadowAlarmManager`: replaceAll cancels and schedules exactly the new set with
  `setAlarmClock`; restore after boot; +15 snooze; Done queues an action and cancels the nag; Quiet defers nags
  (regression for the 0.2.0 gap).
- **Acceptance:** the tests run in `npm run check` step 4.
- **Tests:** as listed.
- **Device testing (Jason):** none.

### T-015 Alarm and permission services in JS
- **Status:** todo
- **Goal:** the `src/platform` implementations and app wiring: `syncAlarms` after every cook change, drain
  actions on start and resume, permission status, hidden debug screen (Gear version tapped 5 times).
- **Files:** `src/platform/alarms.ts`, `src/platform/permissions.ts`, `src/platform/fakes.ts`, `src/lib/cook.ts`,
  `app/debug.tsx`, tests.
- **Depends on:** T-010, T-013.
- **Acceptance:** an imported active cook (T-012) gets its alarms; the debug screen lists alarms and nags and
  fires any event in 10 s.
- **Tests:** Jest with fakes: one `replaceAll` per change (never patch); a drained Done applies once.
- **Device testing (Jason):** none.

### T-016 Device alarm tests on the Expo build
- **Status:** todo
- **Goal:** re-run `docs/alarm-testing.md` on the dev build: Doze, screen off, locked reboot, app update, time
  zone change, notification actions with the app dead.
- **Files:** `docs/alarm-testing.md` (Expo results), `tools/device/flows/alarms.yaml`.
- **Depends on:** T-015, T-006.
- **Acceptance:** every row passes, including a locked reboot ringing on time.
- **Tests:** any failure gets a regression test in T-014's files.
- **Device testing (Jason):** unlock after the reboot step when asked; leave the phone idle for the Doze step.

---

## Phase 5: Plan tab (mockups 04-08)

### T-017 Plan: empty and main (04, 05)
- **Status:** todo
- **Goal:** Plan tab as in mockups 04 and 05: Ready by / Start at with date and time pickers, smoker temp field
  with fire time, food cards, Add food, tiles (fire, pellets, conflicts), pinned Start cook, share icon.
- **Files:** `app/(tabs)/plan.tsx`, `src/screens/plan/PlanScreen.tsx`, `src/screens/plan/PlanEmpty.tsx`, tests,
  `docs/fidelity/rn-04-*.png`, `rn-05-*.png`.
- **Depends on:** T-005, T-010.
- **Acceptance:** at 115% three cards and Add food fit above Start cook, two at 130% (HANDOFF decision).
- **Tests:** RNTL: empty state actions; cards show start time and time on heat from `buildPlan`; tile values;
  Start cook disabled with no food.
- **Device testing (Jason):** compare with mockups 04-05 on the phone.

### T-018 Smoker temp menu, Add food, Issues sheet (06, 07)
- **Status:** todo
- **Goal:** temp menu with settable temps and fire times, Show all and the outside-200-300F warning; food
  picker with search and groups; conflicts sheet with fixes (move to griddle, change temp, finish earlier).
- **Files:** `src/screens/plan/TempMenu.tsx`, `FoodPick.tsx`, `IssuesSheet.tsx`, tests, fidelity PNGs.
- **Depends on:** T-017.
- **Acceptance:** only settable temps offered (failure mode 12); each fix changes the plan.
- **Tests:** RNTL per sheet (search filters, temps from `settableTemps`, a fix applies).
- **Device testing (Jason):** none beyond the screenshots.

### T-019 Food details (08, 09, 10)
- **Status:** todo
- **Goal:** quantity, cooker chips (missing cookers disabled with "Add in Gear"), method, options, rest, Timing
  (three models for by-weight foods, Standard/Total hours otherwise, "Use for future"), live result card that
  scrolls into view after changes.
- **Files:** `src/screens/plan/FoodEdit.tsx`, tests, fidelity PNGs 08-10.
- **Depends on:** T-017.
- **Acceptance:** the T-001 checklist (HANDOFF) holds on the new UI; 12 lb brisket at 0.75 hr/lb shows 9 hr
  and fire 6:20 AM for a 5:00 PM serve.
- **Tests:** RNTL versions of the nine legacy FoodEdit cases (three/two models, source line, saves, hint once,
  result card text).
- **Device testing (Jason):** add brisket, set 0.75, read the result card at his usual font size.

---

## Phase 6: Cook tab (mockups 12-15)

### T-020 `engine/cookState.ts`
- **Status:** todo
- **Goal:** the live-cook states (TECH-DESIGN section 7) as one pure function the new Cook UI is built on.
- **Files:** `engine/cookState.ts`, `engine/cookState.test.ts` (new files; existing engine files unchanged).
- **Depends on:** none.
- **Acceptance:** every row of the state table has a test, including allowed actions per state.
- **Tests:** as above.
- **Device testing (Jason):** none.

### T-021 Start cook and Live cook (12)
- **Status:** todo
- **Goal:** Start cook (permission check sheet, save, schedule alarms); the Cook tab with food and no cook does
  the same; Live cook: header, status chip, Next up with Done/Adjust, countdown, lane chart with now line and
  smoker-overlap band, next three steps, red permission banner re-checked on resume.
- **Files:** `app/(tabs)/cook.tsx`, `src/screens/cook/CookScreen.tsx`, `src/components/kit/Lanes.tsx`,
  `src/screens/plan/StartCheckSheet.tsx`, tests, fidelity PNG 12.
- **Depends on:** T-015, T-019, T-020.
- **Acceptance:** Start cook schedules alarms once; the banner appears when a permission is revoked mid-cook.
- **Tests:** RNTL: Next up wording for check steps; banner on resume (fake permissions); Start cook blocked
  until fixed or acknowledged.
- **Device testing (Jason):** none (Claude runs a short live cook flow).

### T-022 Cook options (13) and keep or move serve
- **Status:** todo
- **Goal:** Running behind/ahead (+-15, keep/move with the hold impact), Quiet 30 min, Pit went out / Back up to
  temp, Not yet, Start over, End cook; the keep/move sheet with "X: off heat N min after serve." and Move
  preselected when keep leaves a food late.
- **Files:** `src/screens/cook/CookOptions.tsx`, `KeepMoveSheet.tsx`, tests, fidelity PNG 13.
- **Depends on:** T-021.
- **Acceptance:** each action re-plans and replaces alarms once; Quiet calls `setQuiet`.
- **Tests:** RNTL per action with fakes; regression cases from the 2026-11-11 live test (HANDOFF list).
- **Device testing (Jason):** none.

### T-023 Notification actions, lock-screen alert, Cook finished (14, 15)
- **Status:** todo
- **Goal:** Done and +15 from the notification applied on resume; overdue counting; Cook finished with planned
  vs actual, rate update, notes, Save/Discard and the one-time support link.
- **Files:** `src/screens/cook/FinishScreen.tsx`, `src/lib/cook.ts`, tests, fidelity PNGs 14-15,
  `tools/device/flows/live.yaml`.
- **Depends on:** T-022.
- **Acceptance:** a short live cook on the dev build: alert Done and +15 from the shade; End cook > Save writes
  history and cancels all alarms.
- **Tests:** RNTL finish screen; Jest drain-and-apply.
- **Device testing (Jason):** optional: handle one alert from the lock screen.

---

## Phase 7: Setup (mockups 01-03, 17)

### T-024 Setup steps and smoker picker
- **Status:** todo
- **Goal:** first run: Welcome + units, cookers (picker with search and type chips; verified models fill specs,
  unverified stay blank; manual form), Add a cooker (17).
- **Files:** `app/setup/*`, `src/screens/setup/*`, `src/screens/shared/AddCooker.tsx`, tests, fidelity PNGs.
- **Depends on:** T-005, T-010.
- **Acceptance:** shown when no cookers are saved (not after a successful import); unverified catalog entries
  never prefill specs (CLAUDE.md).
- **Tests:** RNTL per step; picker groups from `data/cookers.json`.
- **Device testing (Jason):** none (dev build fresh install).

### T-025 Alerts step, test alert, battery help
- **Status:** todo
- **Goal:** permission rows with live status; "Send a test alert in 10 sec" through `pit-alarms`; a one-line
  battery help link for makers with aggressive battery killers (failure mode 10).
- **Files:** `src/screens/shared/AlertChecks.tsx`, `src/lib/maker.ts`, tests.
- **Depends on:** T-015, T-024.
- **Acceptance:** the test alert rings in Doze; a Samsung shows its help link, a Pixel shows none.
- **Tests:** maker mapping unit test; RNTL rows.
- **Device testing (Jason):** none on a Pixel; a friend's Samsung if available.

---

## Phase 8: Gear and history (mockups 16-20)

### T-026 Gear screen (16)
- **Status:** todo
- **Goal:** cookers list, Cook rates and history links, Alerts sheet, Units sheet, Home Assistant "Coming
  later", support link, version (tap 5 times for debug), update row.
- **Files:** `app/(tabs)/gear.tsx`, `src/screens/gear/GearScreen.tsx`, tests, fidelity PNG 16.
- **Depends on:** T-024.
- **Acceptance:** the units switch converts everywhere without changing stored values.
- **Tests:** RNTL rows and units switch.
- **Device testing (Jason):** none.

### T-027 Cooker sheets: griddle, oven, smoker (17-19)
- **Status:** todo
- **Goal:** edit and remove cookers (Remove only when another remains; changes saved only on Save).
- **Files:** `src/screens/gear/CookerSheets.tsx`, tests, fidelity PNGs 18-19.
- **Depends on:** T-026.
- **Acceptance:** edits persist in `cookers` and the plan updates.
- **Tests:** RNTL sheets.
- **Device testing (Jason):** none.

### T-028 History and cook rates (20), with editing
- **Status:** todo
- **Goal:** rate cards (rate used, source, cooks logged, total hours; edit; "Keep my rate exactly"); cook list;
  cook sheet with Cook again, Remove and Edit (failure mode 14: correct actual minutes, quantity, pit temp, notes,
  or exclude from rates).
- **Files:** `src/screens/gear/HistoryScreen.tsx`, `src/db/repos/history.ts`, tests, fidelity PNG 20.
- **Depends on:** T-026, T-009.
- **Acceptance:** editing a cook changes the blended rate shown; excluded cooks do not count.
- **Tests:** RNTL; repo tests for edit and exclude; `engine/history.test.ts` unchanged.
- **Device testing (Jason):** none.

---

## Phase 9: Share

### T-029 Share plan (export)
- **Status:** todo
- **Goal:** the share icon on Plan writes a `.pitplan` file (sender's rates and total hours dropped) and opens
  the Android share sheet.
- **Files:** `src/platform/share.ts`, tests (`src/lib/sharedPlan.ts` API unchanged).
- **Depends on:** T-017.
- **Acceptance:** Gmail and Drive appear in the share sheet; the file matches `toPitPlan`.
- **Tests:** Jest with the share fake; `engine/share.test.ts` unchanged.
- **Device testing (Jason):** none.

### T-030 Open a shared plan (11), with the conflict fix
- **Status:** todo
- **Goal:** `.pitplan` opens the app (VIEW/SEND intent filters by config plugin); the file is read from
  `content://` with a 256 KB cap; the Shared plan sheet lets the receiver pick a date and cookers and maps or
  flags missing ones; if mapping creates a pit conflict, the sheet shows it and offers the fixes.
- **Files:** `plugins/withPitplanIntents.js`, `src/platform/share.ts`, `src/screens/plan/SharedPlanSheet.tsx`,
  tests, fidelity PNG 11.
- **Depends on:** T-029, T-018.
- **Acceptance:** file:// and content:// opens work on the dev build; an oversized file shows an error.
- **Tests:** RNTL sheet; Jest size cap; regression test for an import-made conflict.
- **Device testing (Jason):** see T-031.

### T-031 Share between two phones (Gmail, Drive)
- **Status:** todo (Jason, hands-on)
- **Goal:** SPEC definition of done: a plan round-trips between two phones through Gmail and through Drive.
- **Files:** fixes only if a route fails; `docs/HANDOFF.md`.
- **Depends on:** T-030.
- **Acceptance:** both routes open the Shared plan sheet with the right menu.
- **Tests:** a regression test per failing intent shape.
- **Device testing (Jason):** share from his phone to his wife's via Gmail and via Drive.

---

## Phase 10: Beta 0.3.0

### T-032 Update check against GitHub Releases
- **Status:** todo
- **Goal:** Gear shows "Update available" for a newer release, prereleases included, compared by semver.
- **Files:** `src/lib/update.ts`, `engine/update.test.ts` (new cases added; existing ones unchanged),
  `GearScreen` test.
- **Depends on:** T-026.
- **Acceptance:** newer, same and network-error fixture cases; anonymous request at most daily.
- **Tests:** as above.
- **Device testing (Jason):** none here (see T-038).

### T-033 Release docs: notes, install guide, releasing checklist
- **Status:** todo
- **Goal:** friends can install or upgrade; Claude can release by checklist.
- **Files:** `docs/RELEASING.md`, `docs/INSTALL.md`, `docs/release-notes/0.3.0.md`, `README.md`.
- **Depends on:** T-007.
- **Acceptance:** Jason reviews; copy per CLAUDE.md; the notes explain the new look and the data import.
- **Tests:** none (docs).
- **Device testing (Jason):** follow INSTALL.md once on his wife's phone.

### T-034 Parity review
- **Status:** todo
- **Goal:** every SPEC screen and failure mode that 0.2.0 handled works in the Expo build.
- **Files:** `docs/parity.md` (checklist: SPEC 3 screens, SPEC 5 live rules, SPEC 7 failure modes 1-15, mockups
  01-20 with fidelity PNG links).
- **Depends on:** T-016, T-019, T-023, T-025, T-028, T-030.
- **Acceptance:** no unchecked row, or each one accepted by Jason in writing.
- **Tests:** a full Maestro pass at 115/130%.
- **Device testing (Jason):** approve the fidelity sheets.

### T-035 Security pass before release
- **Status:** todo
- **Goal:** the release build reviewed: exported components, backup rules (secure-store excluded),
  permissions, no debug flags, no secrets; Semgrep and Snyk clean.
- **Files:** `plugins/*` as needed, `docs/design/SECURITY-EXCEPTIONS.md`.
- **Depends on:** T-034.
- **Acceptance:** the release manifest (`aapt dump xmltree`) matches TECH-DESIGN section 10; check passes.
- **Tests:** a node:test that inspects the prebuilt `AndroidManifest.xml` for exported receivers and
  `debuggable`.
- **Device testing (Jason):** none.

### T-036 Data export
- **Status:** todo
- **Goal:** Gear > Export shares a JSON dump of cookers, rates and history (SPEC: history exportable); importing
  that file restores it.
- **Files:** `src/db/export.ts`, `src/screens/gear/GearScreen.tsx`, tests.
- **Depends on:** T-028, T-029.
- **Acceptance:** export on the dev build, import on a fresh install, rates and history match.
- **Tests:** Jest round trip; bad-file validation.
- **Device testing (Jason):** none.

### T-037 Saturday cook on the Expo build (SPEC definition of done)
- **Status:** todo (Jason, hands-on)
- **Goal:** a full cook (brisket, wings, breasts) on the dev build with every alarm on time with the screen off,
  including after a reboot mid-cook; Adjust, Pit went out, Not yet and End cook leave no duplicate alarms.
- **Files:** `docs/alarm-testing.md`, `docs/HANDOFF.md`.
- **Depends on:** T-034.
- **Acceptance:** each alarm within 1 min of plan; none lost on reboot.
- **Tests:** any bug gets a regression test.
- **Device testing (Jason):** the cook.

### T-038 Upgrade test and cut 0.3.0
- **Status:** todo
- **Goal:** 0.3.0 on GitHub Releases; Jason's 0.2.0 install upgraded in place with its data imported.
- **Files:** `package.json` (0.3.0), `docs/release-notes/0.3.0.md`, `docs/HANDOFF.md`.
- **Depends on:** T-012, T-033, T-035, T-036, T-037.
- **Approach:** emulator upgrade test with the real 0.2.0 APK, then `docs/RELEASING.md`. Publish 0.3.0 as a
  normal release (not a prerelease) so 0.2.0's update check (`/releases/latest`) sees it.
- **Acceptance:** release `v0.3.0` with APK and SHA-256; `snyk:monitor` ran; Jason's phone upgraded with gear,
  rates and history intact (or the notice says what was not kept).
- **Tests:** `npm run check` at the tagged commit.
- **Device testing (Jason):** optional safety copy first (HANDOFF backup route); install 0.3.0 over 0.2.0;
  check Gear, Cook rates and history.

### T-039 Remove `legacy/`
- **Status:** todo
- **Goal:** delete the Capacitor reference code once 0.3.0 has been out a week with no rollback.
- **Files:** `legacy/**`, `.semgrepignore`, `.snyk`, `.prettierignore`, docs that mention it.
- **Depends on:** T-038 plus one week.
- **Acceptance:** check passes; tag `v0.2.0` still has the old app.
- **Tests:** existing.
- **Device testing (Jason):** none.

---

## Phase 11: After the beta

### T-040 Lane chart full screen (Jason's idea)
- **Status:** todo (mockup first)
- **Goal:** tap the lane chart to open it full screen in landscape until closed.
- **Files:** `docs/mockups/source/LanesFull.dc.html` + PNG, `src/screens/cook/LanesFull.tsx`,
  `expo-screen-orientation`.
- **Depends on:** T-021; Jason approves the mock.
- **Acceptance:** opens and closes; back closes; times never truncate.
- **Tests:** RNTL open, close, back.
- **Device testing (Jason):** a 12-hour cook chart, rotated.

### T-041 Oven warming drawer: use it or drop it
- **Status:** todo (Jason decides)
- **Goal:** `OvenProfile.warmingDrawer` is stored but unused; either the planner offers it as a hold place
  (failure mode 15, at or above 140F) or the field goes.
- **Files:** `engine/plan.ts` (only if kept, with new tests), `src/screens/gear/CookerSheets.tsx`.
- **Depends on:** T-027.
- **Acceptance:** per decision.
- **Tests:** an engine unit test if kept.
- **Device testing (Jason):** none.

---

## Phase 12: Home Assistant (after 0.3.0)

Plan: `docs/HA-INTEGRATION.md` (Phase 0 done: `docs/ha-entities.md`).

### T-042 Mock the HA screens (HA-INTEGRATION 4.5)
- **Status:** todo
- **Goal:** six screens in the canvas style, approved before any code.
- **Files:** `docs/mockups/source/Ha*.dc.html`, `docs/mockups/21-26-*.png`.
- **Depends on:** none.
- **Acceptance:** Jason approves.
- **Tests:** none.
- **Device testing (Jason):** none.

### T-043 GitHub Pages `client_id` page
- **Status:** todo
- **Goal:** `https://mecheng70.github.io/pitplanner/` has `<link rel="redirect_uri" href="pitplanner://auth-callback">`
  in its first 10 kB.
- **Files:** `site/index.html`, Pages configuration.
- **Depends on:** D-9 (Jason enables Pages).
- **Acceptance:** a curl of the page finds the link in the first 10 kB.
- **Tests:** node:test on the file.
- **Device testing (Jason):** none.

### T-044 HA auth logic (pure)
- **Status:** todo
- **Goal:** address normalize, authorize URL with a state nonce, callback check, token exchange, refresh on 401,
  revoke, all with an injected `fetch`.
- **Files:** `src/lib/ha/auth.ts`, tests.
- **Depends on:** none.
- **Acceptance:** a mismatched nonce is rejected; refresh failure means signed out; no token reaches a logger.
- **Tests:** Jest.
- **Device testing (Jason):** none.

### T-045 HA sign-in on the phone
- **Status:** todo
- **Goal:** sign in to `ha.glithero.icu` as the `pitplanner` HA user; refresh token in `expo-secure-store`.
- **Files:** `src/screens/gear/HaConnect.tsx`, `src/lib/ha/session.ts`, `src/platform/links.ts`,
  `plugins/withNetworkSecurity.js` (LAN cleartext only when chosen), tests.
- **Depends on:** T-042, T-043, T-044.
- **Acceptance:** sign-in completes and survives a restart; Disconnect revokes and deletes; the non-admin
  registry-read result is recorded in `docs/ha-entities.md`.
- **Tests:** RNTL screen states; Semgrep secrets clean.
- **Device testing (Jason):** type the HA password into HA's own page; later disable the HA user and see
  "Signed out".

### T-046 HA WebSocket client
- **Status:** todo
- **Goal:** auth, `get_states`, `subscribe_entities`, registry lists, reconnect with backoff, REST fallback every
  15 s, stale after 2 min.
- **Files:** `src/lib/ha/ws.ts`, `src/lib/ha/rest.ts`, tests.
- **Depends on:** T-044.
- **Acceptance:** reconnects after a drop; refreshes the token before reconnecting.
- **Tests:** Jest with fake timers and a scripted socket.
- **Device testing (Jason):** none.

### T-047 Discovery and add a sensor
- **Status:** todo
- **Goal:** "Here's what we found" and the searchable add-sensor list (HA-INTEGRATION 4.3); save `haConfig`
  through a new migration.
- **Files:** `src/lib/ha/discovery.ts`, `src/screens/gear/HaFound.tsx`, `HaAddSensor.tsx`,
  `src/db/migrations/0002_ha.ts`, tests.
- **Depends on:** T-045, T-046.
- **Acceptance:** on Jason's HA: the PB850SPW2, its probes and the Chef iQ probes listed with live values or
  "asleep".
- **Tests:** discovery with fixtures from `docs/ha-entities.md`; migration test (1 -> 2 with data).
- **Device testing (Jason):** run discovery at home with probes awake and asleep.

### T-048 Gear > Home Assistant connected
- **Status:** todo
- **Goal:** address, user, status, probes, Rescan (marks missing entities), Disconnect.
- **Files:** `src/screens/gear/HaConnected.tsx`, tests.
- **Depends on:** T-047.
- **Acceptance:** a renamed entity shows "missing" after Rescan.
- **Tests:** RNTL.
- **Device testing (Jason):** rename a probe entity in HA, then Rescan.

### T-049 Probe per food at Start cook
- **Status:** todo
- **Goal:** a Probe dropdown per food, last choice remembered, no two foods on one probe.
- **Files:** `src/screens/plan/StartCheckSheet.tsx`, `src/lib/cook.ts` (probe map; `normalize` handles older
  cooks), tests.
- **Depends on:** T-047.
- **Acceptance:** two foods cannot pick the same probe; "None" allowed with a warning.
- **Tests:** RNTL; normalize test.
- **Device testing (Jason):** start a cook with two probes.

### T-050 `engine/probe.ts` and live temps on Live cook
- **Status:** todo
- **Goal:** pure `nextTempEvent` and `isStale`; Live cook shows probe and pit temps with "updated N s ago",
  grey when stale, never interpolated.
- **Files:** `engine/probe.ts`, `engine/probe.test.ts` (new), `src/screens/cook/CookScreen.tsx`,
  `src/lib/ha/live.ts`.
- **Depends on:** T-046, T-049, T-020.
- **Acceptance:** F/C per settings.
- **Tests:** engine tests with fake readings; RNTL stale rendering.
- **Device testing (Jason):** probe in hot water; unplug it; grey after 2 min.

### T-051 Publish `sensor.pit_planner_cook` (HA Phase 2)
- **Status:** todo
- **Goal:** HA-INTEGRATION 3.1: publish on Start cook, each change, End cook, app open, and every 10 min while
  open.
- **Files:** `src/lib/ha/publish.ts`, attributes builder in `engine/probe.ts`, tests.
- **Depends on:** T-050.
- **Acceptance:** no tokens or personal data in the attributes.
- **Tests:** builder unit tests; publish schedule with fake timers.
- **Device testing (Jason):** watch the sensor in HA during a short cook.

### T-052 HA blueprint
- **Status:** todo
- **Goal:** `blueprints/pit_planner_cook_watcher.yaml` (HA-INTEGRATION 3.2) and `docs/HA-BLUEPRINT.md`.
  Claude writes files only and never changes HA through MCP.
- **Files:** as named.
- **Depends on:** T-051.
- **Acceptance:** Jason imports it; the hot-water test notifies at the wrap target.
- **Tests:** a node:test that parses the YAML and checks inputs and triggers.
- **Device testing (Jason):** import and hot-water test.

### T-053 Probe suggestions and pit-drop prompt (HA Phase 3)
- **Status:** todo
- **Goal:** Next up offers "Brisket hit 166F" with Done (never auto-done); a pit drop offers "Pit went out?".
- **Files:** `engine/probe.ts` (`suggestion`), `src/screens/cook/CookScreen.tsx`, tests.
- **Depends on:** T-050.
- **Acceptance:** suggestions only for the mapped probe and the current check step.
- **Tests:** engine and RNTL.
- **Device testing (Jason):** hot-water test.

### T-054 Probe times feed rate learning
- **Status:** todo
- **Goal:** use the time the probe reached the pull target instead of the button tap when available.
- **Files:** `src/lib/finish.ts`, tests.
- **Depends on:** T-053.
- **Acceptance:** Cook finished says which time was used.
- **Tests:** new finish cases.
- **Device testing (Jason):** a real cook with a probe.

### T-055 Confirmed set-temp button (HA Phase 4, optional)
- **Status:** todo (Jason opts in)
- **Goal:** "Set smoker to 400F" on the wings step, confirm required, only while the grill is running; never
  ignition, power or automatic.
- **Files:** `src/lib/ha/control.ts`, `src/screens/cook/CookScreen.tsx`, tests.
- **Depends on:** T-053.
- **Acceptance:** refuses when the grill is off.
- **Tests:** guard unit tests; RNTL confirm.
- **Device testing (Jason):** with the grill running.

---

## Phase 13: iOS readiness (interfaces only)

### T-056 Keep native access behind the interfaces
- **Status:** todo
- **Goal:** iOS could be added by writing implementations only (a Swift `pit-alarms`; secrets and storage
  already cross-platform through Expo).
- **Files:** `eslint.config.js` (restricted imports for `expo-*` and `modules/*` outside `src/platform` and
  `src/db`), TECH-DESIGN section 4 table, `modules/pit-alarms/expo-module.config.json` (platforms).
- **Depends on:** T-015, T-030, T-045.
- **Acceptance:** lint enforces the rule; the iOS column lists a mapping for every service. No Xcode work.
- **Tests:** the lint rule.
- **Device testing (Jason):** none.

---

## Maintenance

### T-057 Clear the build-tool Snyk findings (SE-001)
- **Status:** todo, deadline 2027-02-01
- **Goal:** `snyk test --all-projects` with all Gradle configurations passes, so the scope limit can go.
- **Files:** `app.config.ts` / `expo-build-properties` (AGP and Gradle within what Expo SDK 58 supports),
  `tools/check.sh`, `docs/design/SECURITY-EXCEPTIONS.md`.
- **Depends on:** T-003 (the first prebuild shows which findings remain with SDK 58's AGP).
- **Acceptance:** full scan clean and the `--configuration-matching` flag removed, or SE-001 updated with the
  remaining findings, their cause and a new date Jason approves.
- **Tests:** existing suites; the release build installs.
- **Device testing (Jason):** none.

---

## Superseded Capacitor-era tasks (planned and replaced on 2026-11-12)

| Old | Topic | Now |
|---|---|---|
| T-002, T-005 | Release script, cut beta | T-007, T-033, T-038 |
| T-003 | Install guide | T-033 |
| T-004 | Update check | T-032 |
| T-006, T-007 | Native tests | T-014 |
| T-008, T-020 | Platform services | T-015, T-029, T-030, T-045 |
| T-009 | Quiet silences nags | T-013, T-014 |
| T-010 | Saturday cook with a reboot | T-037 |
| T-011 | Live-cook states | T-020 |
| T-012, T-013 | Permission banner, Cook UI tests | T-021, T-022 |
| T-014 | Lane chart full screen | T-040 |
| T-015, T-016 | Setup tests, battery help | T-024, T-025 |
| T-017, T-018, T-019 | History edit, export, oven drawer | T-028, T-036, T-041 |
| T-021, T-022 | Import conflict fix, two-phone share | T-030, T-031 |
| T-023..T-037 | Home Assistant | T-042..T-055 |
| T-038 | iOS readiness | T-056 |
| T-039 | AGP / SE-001 | T-057 |
| T-040 | TypeScript 6/7 split | T-002 (D-2) |
