# Pit Planner: tasks

One entry per task, each sized for one session (under a day). Phases, order and the critical path are in
[WBS.md](WBS.md); architecture and rules in [TECH-DESIGN.md](TECH-DESIGN.md).

How to work a task (every task, no exceptions; see CLAUDE.md "Quality gate"):
1. Read CLAUDE.md, SPEC.md, TECH-DESIGN.md, `docs/HANDOFF.md`, then this entry. Look at the named mockups
   in `docs/mockups/` before touching a screen.
2. Check the dependencies are done (status line). If not, stop and say so.
3. Write the tests listed (failing first for bug fixes), then the code.
4. Run `npm run check` until it passes. Report its summary.
5. Update the task's status line here, `docs/HANDOFF.md`, and SPEC.md if behavior changed. Commit on `main`
   (push only when Jason asks).
6. List the device steps for Jason (the "Device testing" field) in the final message.

Status values: `todo`, `in progress`, `done (commit)`, `blocked (reason)`.

---

## Phase 1: Cook timing fix

### T-001 Close out the cook timing fix (HA-INTEGRATION "Do first")
- **Status:** done (see commit "T-001"), pending Jason's phone test. The code shipped in `f12b060` and
  `e86d930` (0.2.0); this task checked it against the "Do first" list, added the missing tests
  (`engine/timing.test.ts`, `FoodEdit.test.tsx`) and the screenshots. Checklist: `docs/HANDOFF.md`.
- **Goal:** every item of HA-INTEGRATION.md "Do first" is verifiably met, with the phone screenshots its
  "Done when" asks for.
- **Files:** `engine/plan.test.ts`, `engine/timing.test.ts`, `src/screens/plan/FoodEdit.test.tsx`,
  `src/test/setup.ts`, `tools/device/timing.mjs`, `tools/device/run.sh`, `docs/fidelity/timing-*.png` (new), `docs/HA-INTEGRATION.md` (mark done), `docs/HANDOFF.md`.
- **Depends on:** none.
- **Approach:**
  1. Walk items 1-7 of "Do first" against the code; list each with the file/test that meets it.
  2. Confirm the engine tests from item 4 exist by name: total hours used exactly and unaffected by temp;
     per-item rate beats saved rate; size-adjusted with zero history equals hr/lb at the reference weight;
     12 lb brisket at 0.75 hr/lb plans 9 hr. Add any that are missing.
  3. Confirm SPEC sections 1 and 4 describe the three models and the rate rule (item 7).
  4. Add a Vitest test for the FoodEdit timing section: three choices for brisket, two for ribs; the
     one-time hint text; the "Use for future Brisket on <smoker>" checkbox.
  5. `npm run device -- --only timing` on the dev copy; save screenshots of Brisket details in Hours per
     pound, Total hours and Size-adjusted, and the Plan with brisket at 0.75 hr/lb, at 115% and 130% font.
- **Acceptance:**
  - A table in HANDOFF (or the commit message) maps items 1-7 to code and tests; no item unmet.
  - `docs/fidelity/timing-*.png` exist: 3 modes + Plan; fire time about 6:20 AM for a 5:00 PM serve.
  - No number truncated at 130% in the screenshots.
  - `npm run check` passes.
- **Tests:** engine tests above (add missing); `src/screens/plan/FoodEdit.test.tsx` (new).
- **Device testing (Jason):** on the release app, set brisket to 0.75 hr/lb with "Use for future" checked,
  re-open the plan next day, confirm it is still 0.75 and the plan fires about 6:20 AM for 5:00 PM.

---

## Phase 2: Beta release

### T-002 Release script: gate, tag, GitHub Release, Snyk monitor
- **Status:** todo
- **Goal:** one command produces a signed, gated, tagged GitHub Release (TECH-DESIGN section 11).
- **Files:** `tools/release.sh`, `tools/publish.sh` (new), `package.json` (`publish` script),
  `docs/RELEASING.md` (new).
- **Depends on:** none (D-1 decided: GitHub Releases is primary). T-001 not required.
- **Approach:**
  1. `tools/release.sh`: replace the `npm test` call with `npm run check`; refuse to run on a dirty tree or
     off `main`; keep the cert SHA-256 print.
  2. `tools/publish.sh <notes-file>`: checks `release/pitplanner-<version>.apk` exists and tag `v<version>`
     does not; computes SHA-256; asks for confirmation (it publishes); `git tag v<version>`;
     `git push origin main v<version>`; `gh release create v<version> <apk> --prerelease --notes-file`;
     then `npm run snyk:monitor`.
  3. `docs/RELEASING.md`: the full checklist from TECH-DESIGN section 11, plus the backup route for the
     release app and how to verify the APK cert on a friend's phone.
- **Acceptance:** dry run (`--dry-run` flag prints every command without running publish steps) on a clean
  tree shows the steps in order; `release.sh` fails on a dirty tree; no token or org ID in any file.
- **Tests:** `tools/release.test.mjs` (node:test) for the version/tag/name helpers if extracted to JS; else
  a bats-free shell check in the dry run. `npm run check` passes.
- **Device testing (Jason):** none.

### T-003 Friend install guide and release notes template
- **Status:** todo
- **Goal:** a friend with an Android phone can install the beta and get alarms working without help.
- **Files:** `docs/INSTALL.md` (new), `docs/release-notes/TEMPLATE.md` (new), `README.md` (link).
- **Depends on:** none.
- **Approach:** steps with plain words: download APK from the release, allow "Install unknown apps" for the
  browser, open, Setup, Alerts (all three allowed), send the test alert; Samsung/Xiaomi battery notes linking
  to dontkillmyapp.com per maker; how to update (install over, data kept); how to report a problem.
- **Acceptance:** guide reviewed by Jason; copy follows CLAUDE.md (plain, short, straight apostrophes).
- **Tests:** none (docs). `npm run check` passes.
- **Device testing (Jason):** follow the guide once on the wife's phone.

### T-004 Update check against a real GitHub Release
- **Status:** todo
- **Goal:** the Gear "Update available" row works now that the repo is public (SPEC 10).
- **Files:** `src/lib/update.ts`, `src/screens/gear/GearScreen.tsx`, `engine/update.test.ts`,
  `src/screens/gear/GearScreen.test.tsx` (new).
- **Depends on:** T-002 (a release must exist to test against; a throwaway prerelease is fine).
- **Approach:** check the latest-release call returns 200 anonymously; make sure prereleases are seen
  (`/releases/latest` skips prereleases: use `/releases?per_page=5` and pick the newest by semver if betas
  are prereleases); compare tags by semver, not string; test with fixture JSON.
- **Acceptance:** with installed 0.2.0 and a release `v0.3.0-beta.1` or `v0.3.0`, Gear shows the row linking
  to the APK; with the same version, no row; network error shows nothing and retries next day.
- **Tests:** `engine/update.test.ts` semver and prerelease cases (regression for "finds nothing");
  `GearScreen.test.tsx` row shown/hidden.
- **Device testing (Jason):** on 0.2.0, open Gear after the beta is published; tap the row; it downloads.

### T-005 Cut beta 0.3.0
- **Status:** todo
- **Goal:** friends can install a signed beta from GitHub Releases.
- **Files:** `package.json` (version), `docs/release-notes/0.3.0.md`, `docs/HANDOFF.md`.
- **Depends on:** T-001, T-002, T-003, T-004; ideally T-010 (real cook with reboot) passed on 0.2.0.
- **Approach:** follow `docs/RELEASING.md` exactly; Jason approves the push and publish.
- **Acceptance:** release `v0.3.0` exists with the APK and SHA-256; `npm run snyk:monitor` ran; Jason's phone
  updated over 0.2.0 with data kept; update row seen on another phone still on 0.2.0.
- **Tests:** `npm run check` passes at the tagged commit.
- **Device testing (Jason):** install over 0.2.0, open, confirm gear, rates and history are intact.

---

## Phase 3: Alarm plugin

The plugin is built and device-tested (`docs/alarm-testing.md`). These tasks add native tests, the
interface, and the known gap.

### T-006 Native test setup (Robolectric) and AlarmStore tests
- **Status:** todo
- **Goal:** `npm run test:android` runs real Kotlin unit tests, so native changes are covered by the gate.
- **Files:** `android/app/build.gradle` (testImplementation `org.robolectric:robolectric`,
  `androidx.test:core`, `testOptions.unitTests.includeAndroidResources = true`),
  `android/app/src/test/java/io/github/mecheng70/pitplanner/alarms/AlarmStoreTest.kt` (new), delete
  `ExampleUnitTest.java`.
- **Depends on:** none.
- **Approach:** Robolectric on JDK 21 with SDK 36 config (use `@Config(sdk = [35])` if 36 is not yet
  supported); test Alarm/Nag `toJson`/`fromJson` round trips, `queueAction` + `drainActions` (drains once),
  store survives a new `AlarmStore(context)` instance.
- **Acceptance:** at least 5 tests run under `npm run test:android`; check stays under 2 min total.
- **Tests:** as above.
- **Device testing (Jason):** none.

### T-007 Scheduler and receiver tests
- **Status:** todo
- **Goal:** the alarm invariants in TECH-DESIGN section 6 are tested natively.
- **Files:** `android/app/src/test/.../alarms/AlarmSchedulerTest.kt`, `ReceiversTest.kt` (new); small
  refactors in `AlarmScheduler.kt` only if needed to inject `now`.
- **Depends on:** T-006.
- **Approach:** use Robolectric `ShadowAlarmManager`: `replaceAll` cancels the old set and schedules exactly
  the new one via `setAlarmClock`; `restore` after a simulated boot reschedules only future alarms and
  overdue nags; `snooze` schedules +15 min; ActionReceiver Done queues an action and cancels the nag;
  RestoreReceiver handles each action in the manifest.
- **Acceptance:** each invariant 1-4 in TECH-DESIGN section 6 has a named test.
- **Tests:** as above.
- **Device testing (Jason):** none (behavior unchanged).

### T-008 Platform services: alarms, permissions, app links
- **Status:** todo
- **Goal:** `src/lib` and screens reach alarms, permissions and app lifecycle only through the interfaces in
  TECH-DESIGN section 3.
- **Files:** `src/platform/services.ts` (new), `src/platform/alarms.ts`, `src/platform/appLinks.ts` (new),
  `src/lib/cook.ts`, `src/lib/store.tsx`, `src/app.tsx`, `src/screens/**` that import `@capacitor/app`,
  `src/platform/fakes.ts` (web/test fakes).
- **Depends on:** none (T-020 does the storage half).
- **Approach:** define `AlarmService`, `PermissionService`, `AppLinks`; Android impl wraps `PitAlarms` and
  `@capacitor/app`; fakes record calls for tests; replace direct imports; no behavior change.
- **Acceptance:** `grep -r "@capacitor/app\|registerPlugin" src --include=*.ts*` hits only `src/platform/`;
  dev copy passes `npm run device` unchanged.
- **Tests:** Vitest tests using the fakes: Start cook with missing permission shows the sheet; syncAlarms
  calls `replaceAll` once per change (regression guard for "never patch one alarm").
- **Device testing (Jason):** none beyond the automated device run.

### T-009 Quiet alerts also silence repeats of an overdue step
- **Status:** todo
- **Goal:** fix the known gap: during Quiet (30 min), native nag repeats of an already-overdue step do not ring.
- **Files:** `src/lib/cook.ts` (`quiet`), `src/platform/alarms.ts`, `AlarmsPlugin.kt`, `AlarmScheduler.kt`
  (`quietUntil` stored natively; nags due inside the window move to its end), `docs/alarm-testing.md`.
- **Depends on:** T-007 (tests in place).
- **Approach:** add `setQuiet({ until })` to the plugin; `scheduleNag` and `restore` defer nags inside the
  window; the end-of-quiet summary stays as is.
- **Acceptance:** regression test: an overdue step's next nag inside quiet is rescheduled to `quietUntil`;
  after the window, repeats resume every 10 min.
- **Tests:** Kotlin test (regression) + engine/cook unit test for the JS side.
- **Device testing (Jason):** start a short live cook (`tools/device/live.mjs`), let a step go overdue, tap
  Quiet; phone stays silent 30 min, then one summary.

### T-010 Saturday cook with a reboot (SPEC definition of done)
- **Status:** todo (Jason, hands-on)
- **Goal:** SPEC 13: a full cook (brisket, wings, breasts) runs end to end with every alarm on time with the
  screen off, including after a reboot mid-cook.
- **Files:** `docs/alarm-testing.md` (results), `docs/HANDOFF.md`.
- **Depends on:** Jason re-picked the smoker as the Sportsman 850 (HANDOFF Next 1).
- **Approach:** Jason cooks; Claude prepares a checklist from the plan's events and, afterwards, reads
  `getScheduled` and the cook record over adb on the dev copy if the cook ran there, or Jason's notes.
- **Acceptance:** each alarm's fired time within 1 min of plan; reboot mid-cook loses none; Adjust, Pit went
  out, Not yet and End cook leave no duplicate alarms.
- **Tests:** any bug found gets a regression test in its own task.
- **Device testing (Jason):** the cook itself.

---

## Phase 4: Cook tab

Built and device-tested (mockups 12-15). These tasks harden it.

### T-011 Explicit live-cook states (`engine/cookState.ts`)
- **Status:** todo
- **Goal:** the state machine in TECH-DESIGN section 7 exists as one pure function used by the UI.
- **Files:** `engine/cookState.ts` (new), `engine/cookState.test.ts` (new), `src/lib/cookView.ts`,
  `src/screens/cook/CookScreen.tsx`, `CookOptions.tsx`.
- **Depends on:** none.
- **Approach:** `cookState(cook, now)` returns `{ state: 'cooking' | 'pitDown' | 'finishing', quiet: boolean,
  overdue: KeyedEvent[], allowed: Action[] }`; move the scattered conditions here; the engine version takes
  the plain data (no imports from `src/`), so move the `ActiveCook` type to `engine/types.ts`.
- **Acceptance:** every row of the TECH-DESIGN state table has a test; CookOptions shows only allowed
  actions; no behavior change on the device run.
- **Tests:** `engine/cookState.test.ts`; Vitest for CookOptions buttons per state.
- **Device testing (Jason):** none beyond `npm run device -- --only cook`.

### T-012 Permission banner on Live Cook, re-checked on resume
- **Status:** todo
- **Goal:** SPEC failure mode 9: revoking a permission mid-cook shows the red banner as soon as the app resumes.
- **Files:** `src/screens/cook/CookScreen.tsx`, `src/screens/cook/CookScreen.test.tsx` (new).
- **Depends on:** T-008 (fake PermissionService).
- **Approach:** confirm the current behavior; if the banner only checks on mount, subscribe to `onResume`.
- **Acceptance:** Vitest: status flips to missing on resume, banner appears with the fix action; flips back,
  banner goes.
- **Tests:** as above (regression if it was broken).
- **Device testing (Jason):** during a short live cook, revoke "Alarms and reminders" in settings, return to
  the app; banner shows.

### T-013 Cook screen UI tests: Next up, Done, keep or move serve
- **Status:** todo
- **Goal:** the Cook tab's main flows are covered by Vitest so later HA work cannot break them unseen.
- **Files:** `src/screens/cook/*.test.tsx` (new), test fixtures in `src/test/fixtures.ts`.
- **Depends on:** T-008.
- **Approach:** render CookScreen with a fixture cook and a fixed `now`; Next up wording for check steps;
  Done early by 20 min opens the Keep/Move sheet with Move preselected when keep leaves a food late; Not yet
  +30 on a pull check; End cook > Save calls history save once and cancels alarms.
- **Acceptance:** at least 6 tests; all pass in check.
- **Tests:** as above.
- **Device testing (Jason):** none.

### T-014 Lane chart full screen (Jason's idea)
- **Status:** todo (needs a mockup approved first)
- **Goal:** tapping the lane chart opens it full screen in landscape so a long cook's short steps are readable.
- **Files:** `docs/mockups/source/LanesFull.dc.html` + PNG (mock first), `src/ui/components.tsx` (`Lanes`),
  `src/screens/cook/LanesFull.tsx` (new), `android/.../MainActivity.java` (orientation unlock for that view).
- **Depends on:** Jason approves the mock.
- **Approach:** mock in the canvas style; then a full-screen layer with close button; request landscape via
  `screen.orientation.lock` where supported, else rotate CSS.
- **Acceptance:** opens and closes; back button closes; times never truncate at 130%.
- **Tests:** Vitest open/close and back; screenshot at 115/130%.
- **Device testing (Jason):** open on a 12-hour cook, rotate, close.

---

## Phase 5: Setup

Built (mockups 01-03, 17). Hardening only.

### T-015 Setup UI tests and test alert on the real path
- **Status:** todo
- **Goal:** Setup's three steps are covered; the "Send a test alert in 10 sec" uses `PitAlarms.testAlarm`
  (setAlarmClock), never a web timer.
- **Files:** `src/screens/setup/Setup.test.tsx` (new), `SmokerPicker.test.tsx` (new).
- **Depends on:** T-008.
- **Approach:** step through Welcome + units, pick a verified smoker (hopper and grate filled), an unverified
  one (fields blank), manual entry validation, alerts step with fakes reporting missing permissions.
- **Acceptance:** tests cover each step; unverified catalog entries never prefill specs (CLAUDE.md rule).
- **Tests:** as above.
- **Device testing (Jason):** on a phone in Doze (`adb shell dumpsys deviceidle force-idle`), the test alert
  rings within 10 s (dev copy).

### T-016 Battery help per phone maker (failure mode 10)
- **Status:** todo
- **Goal:** phones with aggressive battery killers get a short how-to link in the Alerts step and Gear >
  Alerts.
- **Files:** `src/screens/shared/AlertChecks.tsx`, `src/lib/maker.ts` (new, pure), `src/platform/` (read
  `Build.MANUFACTURER` via Capacitor Device or the alarms plugin `status`).
- **Depends on:** T-008.
- **Approach:** map manufacturer to a dontkillmyapp.com page; show one line only for listed makers.
- **Acceptance:** Samsung shows the Samsung link; Pixel shows nothing.
- **Tests:** unit test for the mapping; Vitest for the row.
- **Device testing (Jason):** none on a Pixel; a friend's Samsung if available.

---

## Phase 6: Gear and history

Built (mockups 16-20). Remaining SPEC items.

### T-017 Edit a history entry (failure mode 14)
- **Status:** todo
- **Goal:** a weird cook can be corrected (actual minutes, quantity, pit temp, notes) or excluded from
  learning, not only removed.
- **Files:** `src/screens/gear/HistoryScreen.tsx`, `src/lib/history.ts`, `src/lib/historyView.ts`,
  `engine/history.test.ts`, mock of the edit sheet (ask Jason if the mockup canvas has none).
- **Depends on:** none.
- **Approach:** an Edit action in the cook sheet; editing writes the record and recomputes `logsOf`; an
  "Exclude from my rates" toggle sets `log.discarded`.
- **Acceptance:** after editing actual minutes, Cook rates shows the new blended rate; excluded cooks do not
  count toward "cooks logged".
- **Tests:** engine/history tests for the recomputed rates; Vitest for the sheet.
- **Device testing (Jason):** edit one real cook from history and check Cook rates.

### T-018 Export and import cook history
- **Status:** todo
- **Goal:** SPEC 2 says history is exportable; today it is only stored.
- **Files:** `src/screens/gear/HistoryScreen.tsx`, `src/lib/history.ts`, platform ShareService.
- **Depends on:** T-020.
- **Approach:** Export shares `history.json` through the share sheet; Import (from a file) validates like
  `.pitplan` and merges by record id.
- **Acceptance:** export from the dev copy, import into a fresh install, rates match.
- **Tests:** unit tests for validate/merge (bad file, duplicates).
- **Device testing (Jason):** export to Drive and back.

### T-019 Oven warming drawer: use it or drop it
- **Status:** todo (decision for Jason first)
- **Goal:** `OvenProfile.warmingDrawer` is stored but unused. Either the planner offers it as a hold place
  (SPEC failure mode 15: oven hold at >= 140F) or the field leaves the form.
- **Files:** `engine/plan.ts` (hold warnings), `src/screens/gear/CookerSheets.tsx`, tests.
- **Depends on:** Jason's decision.
- **Acceptance:** per decision; failure mode 15 test covers the drawer if kept.
- **Tests:** engine unit test for hold location warnings.
- **Device testing (Jason):** none.

### T-020 Platform services: storage, files, share
- **Status:** todo
- **Goal:** the second half of TECH-DESIGN section 3: `KeyValueStore`, `FileStore`, `ShareService`.
- **Files:** `src/platform/services.ts`, `src/platform/storage.ts` (move from `src/lib/storage.ts`),
  `src/lib/history.ts`, `src/lib/share.ts`, `src/platform/sharedPlan.ts`.
- **Depends on:** T-008.
- **Approach:** same pattern as T-008; fakes in memory; no behavior change.
- **Acceptance:** `@capacitor/preferences|filesystem|share` imported only under `src/platform/`.
- **Tests:** Vitest using in-memory fakes: store load with corrupt JSON falls back to defaults (regression
  guard for `load()` returning null).
- **Device testing (Jason):** none beyond `npm run device`.

---

## Phase 7: Share import

Built (mockup 11), tested only through a file:// VIEW intent.

### T-021 Conflict fix after an import moves a food
- **Status:** todo
- **Goal:** a griddle food moved to the smoker by an import can create a pit conflict; the Shared plan sheet
  must show it and offer the fixes (move, change temp, finish earlier).
- **Files:** `src/screens/plan/SharedPlanSheet.tsx`, `src/lib/sharedPlan.ts`, `engine/share.test.ts`.
- **Depends on:** none.
- **Approach:** after `mapToCookers`, run `buildPlan`; if `PIT_CONFLICT` appears, show the IssuesSheet fixes
  before Open.
- **Acceptance:** importing the test plan with breasts and wings and no griddle shows the conflict and a
  working fix.
- **Tests:** regression test in `engine/share.test.ts`; Vitest for the sheet.
- **Device testing (Jason):** see T-022.

### T-022 Share between two phones through Drive and Gmail
- **Status:** todo (Jason, hands-on)
- **Goal:** SPEC 13: Share plan round-trips between two phones, opened from Drive or Gmail (content URIs,
  odd MIME types).
- **Files:** `AndroidManifest.xml` and `SharedPlanPlugin.kt` only if a case fails; `docs/HANDOFF.md`.
- **Depends on:** T-021 preferred.
- **Approach:** Jason shares from his phone to his wife's via Gmail and via Drive; Claude reads `adb logcat`
  on the receiver if it fails and adds a fixture for the failing intent.
- **Acceptance:** both routes open the Shared plan sheet with the right menu.
- **Tests:** Robolectric test for any intent shape that failed (regression).
- **Device testing (Jason):** the two shares.

---

## Phase 8: Home Assistant

Plan: `docs/HA-INTEGRATION.md`. Phase 0 (entity survey) is done: `docs/ha-entities.md`.

### T-023 Mock the HA screens (HA-INTEGRATION 4.5)
- **Status:** todo
- **Goal:** six screens mocked in the canvas style and approved before any HA UI code: Gear > HA not
  connected; address entry; "Here's what we found"; add a temperature sensor; Start cook probe per food; Gear
  > HA connected. (HA's own login page needs no mock.)
- **Files:** `docs/mockups/source/Ha*.dc.html`, `docs/mockups/21-26-*.png`, `docs/mockups/README.md`.
- **Depends on:** none.
- **Approach:** reuse kit components and tokens from existing `.dc.html` files; real entity names from
  `docs/ha-entities.md`; copy rules from CLAUDE.md; include the honest non-admin help text (4.1).
- **Acceptance:** Jason approves the six PNGs.
- **Tests:** none (design). `npm run check` passes.
- **Device testing (Jason):** none.

### T-024 GitHub Pages client_id page
- **Status:** todo
- **Goal:** `https://mecheng70.github.io/pitplanner/` serves a page whose `<head>` (first 10 kB) contains
  `<link rel="redirect_uri" href="pitplanner://auth-callback">`.
- **Files:** `site/index.html` (new; short description, link to releases and support), a Pages workflow or
  the `gh-pages` branch.
- **Depends on:** D-9 (Jason enables Pages).
- **Acceptance:** `curl -s https://mecheng70.github.io/pitplanner/ | head -c 10240 | grep redirect_uri`
  matches.
- **Tests:** a node:test that checks the file has the link in the first 10 kB.
- **Device testing (Jason):** none.

### T-025 SecureStore plugin (Keystore-backed)
- **Status:** todo
- **Goal:** `SecureStore` from TECH-DESIGN section 3 for the HA refresh token (D-7).
- **Files:** `android/.../secure/SecureStorePlugin.kt`, `KeystoreCipher.kt` (new), `MainActivity.java`
  (register), `src/platform/secureStore.ts`, tests.
- **Depends on:** T-006.
- **Approach:** AES-256-GCM key in AndroidKeyStore (non-exportable); values stored as base64 IV+ciphertext in
  a private SharedPreferences file excluded from backup; `remove` deletes; key loss (e.g. lock screen change
  on some devices) returns null and the UI asks to sign in again.
- **Acceptance:** round trip on device; value not readable as plain text in the prefs file; excluded from
  `android:fullBackupContent` / data extraction rules.
- **Tests:** Robolectric with a fake cipher provider for the storage logic; JS fake for Vitest.
- **Device testing (Jason):** none (Claude checks the prefs file on the dev copy with run-as).

### T-026 HA auth logic (pure)
- **Status:** todo
- **Goal:** everything in HA-INTEGRATION 4.2 that can be pure: address normalize (add https, strip path),
  authorize URL with `client_id`, `redirect_uri`, `state` (address + nonce), callback parse and nonce check,
  token exchange/refresh/revoke requests built from an injected `fetch`.
- **Files:** `src/lib/ha/auth.ts`, `src/lib/ha/auth.test.ts` (Vitest).
- **Depends on:** none.
- **Acceptance:** rejects mismatched nonce; refresh on 401 retries once; refresh failure returns
  `signedOut`; no token ever passed to a logger (test with a spy console).
- **Tests:** as above.
- **Device testing (Jason):** none.

### T-027 HA sign-in on the phone
- **Status:** todo
- **Goal:** sign in to `ha.glithero.icu` with the `pitplanner` HA user from the app.
- **Files:** `AndroidManifest.xml` (intent filter `pitplanner://auth-callback`), `res/xml/network_security_config.xml`
  (LAN cleartext per host, only if the user enters a LAN IP), `src/platform/appLinks.ts` (Custom Tab open),
  `src/screens/gear/HaConnect.tsx` (address screen, from T-023 mocks), `src/lib/ha/session.ts`.
- **Depends on:** T-023, T-024, T-025, T-026, T-008.
- **Approach:** address screen checks `/api/` reachability; Custom Tab login; callback via `appUrlOpen`;
  store refresh token in SecureStore, access token in memory. Then check registry reads as the non-admin
  user (Phase 0 open item) and record the result in `docs/ha-entities.md`.
- **Acceptance:** sign-in completes; app restart stays signed in; Disconnect revokes and deletes; the
  non-admin registry result is recorded.
- **Tests:** Vitest for the screen states (checking, unreachable, signed in); Semgrep secrets clean.
- **Device testing (Jason):** sign in with the `pitplanner` user (typing the password into HA's page), then
  disable that user in HA and confirm the app shows "Signed out".

### T-028 HA WebSocket client
- **Status:** todo
- **Goal:** `src/lib/ha/ws.ts`: auth, `get_states`, `subscribe_entities`, registry lists, reconnect with
  backoff, REST polling fallback every 15 s.
- **Files:** `src/lib/ha/ws.ts`, `src/lib/ha/rest.ts`, tests with a fake socket.
- **Depends on:** T-026.
- **Acceptance:** reconnects after drop; stale after 2 min marked stale; access token refreshed before
  reconnect when expired.
- **Tests:** Vitest with fake timers and a scripted socket.
- **Device testing (Jason):** none (covered in T-029).

### T-029 Discovery: "Here's what we found" and add a sensor
- **Status:** todo
- **Goal:** HA-INTEGRATION 4.3 with the T-023 mocks.
- **Files:** `src/lib/ha/discovery.ts` (pure grouping), `src/screens/gear/HaFound.tsx`, `HaAddSensor.tsx`,
  `src/lib/store.tsx` (`haConfig`), tests.
- **Depends on:** T-027, T-028.
- **Approach:** group by device (registry) or by entity prefix and platform if registry reads are refused;
  Pit Boss climate preselected; probes with live value or "not plugged in"/"asleep"; searchable add.
- **Acceptance:** on Jason's HA: smoker PB850SPW2 found, 2 grill probes, Chef iQ probes listed; Save writes
  only `haConfig`.
- **Tests:** discovery unit tests with fixtures from `docs/ha-entities.md`; Vitest for the screens.
- **Device testing (Jason):** run discovery at home with probes awake and asleep.

### T-030 Gear > Home Assistant connected screen
- **Status:** todo
- **Goal:** address, signed-in user, status, probes, Rescan, Disconnect (mock 7 of 4.5).
- **Files:** `src/screens/gear/HaConnected.tsx`, `GearScreen.tsx` (row now has a chevron), tests.
- **Depends on:** T-029.
- **Acceptance:** Rescan marks removed entities "missing"; Disconnect clears haConfig and token.
- **Tests:** Vitest.
- **Device testing (Jason):** rename a probe entity in HA, Rescan, see "missing".

### T-031 Probe per food at Start cook
- **Status:** todo
- **Goal:** HA-INTEGRATION 4.4: a Probe dropdown per food, defaulting to last choice, no sharing.
- **Files:** `src/screens/plan/StartCheckSheet.tsx`, `src/lib/cook.ts` (probe map in ActiveCook), tests.
- **Depends on:** T-029.
- **Acceptance:** two foods cannot pick the same probe; "None" allowed with a warning.
- **Tests:** Vitest; normalize test for an ActiveCook saved before this change.
- **Device testing (Jason):** start a cook with two probes.

### T-032 `engine/probe.ts` and live temps on Live Cook
- **Status:** todo
- **Goal:** pure `nextTempEvent(plan, itemId)`, `isStale(reading, now)`; Live Cook shows probe and pit temps
  with "updated N s ago", grey when stale.
- **Files:** `engine/probe.ts`, `engine/probe.test.ts`, `src/screens/cook/CookScreen.tsx`, `src/lib/ha/live.ts`.
- **Depends on:** T-028, T-031, T-011.
- **Acceptance:** never shows an interpolated value; F/C per settings.
- **Tests:** engine tests with fake readings; Vitest for stale rendering.
- **Device testing (Jason):** probe in hot water; watch the reading; unplug; grey after 2 min.

### T-033 Publish `sensor.pit_planner_cook` (HA Phase 2)
- **Status:** todo
- **Goal:** HA-INTEGRATION 3.1.
- **Files:** `src/lib/ha/publish.ts`, `engine/probe.ts` (attributes builder, pure), tests.
- **Depends on:** T-032.
- **Acceptance:** published on Start cook, each change, End cook (idle), open, every 10 min while open; no
  tokens or personal data in attributes.
- **Tests:** attributes builder unit tests; publish schedule with fake timers.
- **Device testing (Jason):** watch the sensor in HA developer tools during a short cook.

### T-034 HA blueprint and docs
- **Status:** todo
- **Goal:** `blueprints/pit_planner_cook_watcher.yaml` (HA-INTEGRATION 3.2) with import instructions.
- **Files:** `blueprints/pit_planner_cook_watcher.yaml`, `docs/HA-BLUEPRINT.md`.
- **Depends on:** T-033.
- **Approach:** triggers per 3.2; thresholds from sensor attributes; no per-cook edits. Claude writes the
  file only; it does not change HA through MCP.
- **Acceptance:** `yamllint` clean; Jason imports it; the hot-water test notifies at the wrap target.
- **Tests:** a node:test that parses the YAML and checks required inputs/triggers exist.
- **Device testing (Jason):** import, probe in hot water, receive "Brisket at 166F. Time to wrap."

### T-035 Probe-driven suggestions and pit-drop prompt (HA Phase 3)
- **Status:** todo
- **Goal:** Next up says "Brisket hit 166F" and offers Done (never auto-done); a pit drop offers "Pit went
  out?" which opens the existing flow.
- **Files:** `engine/probe.ts` (`suggestion`), `src/screens/cook/CookScreen.tsx`, tests.
- **Depends on:** T-032.
- **Acceptance:** suggestion appears only for the mapped probe and the current check step.
- **Tests:** engine tests; Vitest.
- **Device testing (Jason):** hot-water test.

### T-036 Probe times feed rate learning
- **Status:** todo
- **Goal:** when a probe reached the pull target, log that time instead of the button tap.
- **Files:** `src/lib/finish.ts`, `engine/plan.ts` (no change expected), tests.
- **Depends on:** T-035.
- **Acceptance:** Cook finished shows which time was used; learning unit tests unchanged otherwise.
- **Tests:** finish tests.
- **Device testing (Jason):** real cook with a probe.

### T-037 Confirmed set-temp button (HA Phase 4, optional)
- **Status:** todo (optional; Jason decides)
- **Goal:** "Set smoker to 400F" on the wings step calls `climate.set_temperature` after a confirm, only when
  the grill is already running.
- **Files:** `src/lib/ha/control.ts`, `src/screens/cook/CookScreen.tsx`, tests.
- **Depends on:** T-035.
- **Acceptance:** never ignition, never power, never automatic; refuses when the grill is off.
- **Tests:** unit tests for the guard; Vitest for the confirm.
- **Device testing (Jason):** with the grill running.

---

## Phase 9: iOS readiness (interfaces only)

### T-038 Keep platform access behind the interfaces
- **Status:** todo
- **Goal:** iOS could be added later by writing implementations only.
- **Files:** `eslint.config.js` (`no-restricted-imports` for `@capacitor/*` outside `src/platform/`),
  `TECH-DESIGN.md` section 3 table check.
- **Depends on:** T-008, T-020, T-025.
- **Acceptance:** lint enforces the rule; the iOS column in TECH-DESIGN lists a mapping for every service.
- **Tests:** lint itself.
- **Device testing (Jason):** none. No Xcode work.

---

## Maintenance

### T-039 Upgrade AGP to clear the build-tool Snyk findings (SE-001)
- **Status:** todo
- **Goal:** `snyk test --all-projects` (all configurations) passes, so the Gradle scope limit can go.
  Deadline 2027-02-01 (SE-001 approval condition).
- **Files:** `android/build.gradle`, `android/gradle/wrapper/gradle-wrapper.properties`, `android/variables.gradle`.
- **Depends on:** check Capacitor 8's supported AGP range first.
- **Approach:** bump AGP and Gradle within Capacitor's range; rerun the full Snyk scan; if UTP still pulls
  vulnerable netty, add a dependency constraint for the test-runner configurations only.
- **Acceptance:** full scan clean, or SE-001 updated with the remaining findings and a date; release APK
  builds and installs; `npm run device` passes.
- **Tests:** existing suites.
- **Device testing (Jason):** none.

### T-040 Revisit the TypeScript 6/7 split
- **Status:** todo (when typescript-eslint supports TS 7)
- **Goal:** one TypeScript version (D-2).
- **Files:** `package.json`, `eslint.config.js`.
- **Acceptance:** `typescript7` alias removed; check passes.
