# Handoff (2026-11-12, seventh session: T-006)

Read SPEC.md and CLAUDE.md first, then `docs/design/TECH-DESIGN.md` and the task you are given in
`docs/design/TASKS.md` (phases and order: `docs/design/WBS.md`). This note is what a fresh session needs on top.

## START HERE: scaffold, gate, theme, kit, device tests and release build in place (T-002..T-007 done), T-008 next

- Root is now the Expo app: `app.config.ts` (variants by `APP_VARIANT`, versionCode from package.json),
  `app/` routes (tabs Plan, Cook, Gear placeholders), `src/lib/` pure helpers, `src/platform/types.ts`
  (service interfaces), `src/screens/` (placeholders). The Plan placeholder plans the Saturday fixture and
  shows "Fire the smoker at 6:20 AM": the engine runs in Metro unchanged.
- The Capacitor app is in `legacy/` (reference only). Tag `v0.2.0` on `e86d930` exists locally (not pushed).
- Dev build: `npm run android` (prebuild + Gradle + install + Metro). It is `io.github.mecheng70.pitplanner.debug`,
  "Pit Planner dev", beside the release. JAVA_HOME must be temurin-21. Without Metro running (and
  `adb reverse tcp:8081 tcp:8081`) the dev build opens the dev launcher instead of the app.
- Gate on the new stack (T-003): `npm run check` prebuilds `android/` when stale, lints with expo + React Native
  rules and the layer rules (TECH-DESIGN section 3; color literals and inline styles are errors, so use
  `StyleSheet` until T-004's tokens), and `npm run test:gate` proves the gate catches layer breaks, lint
  errors and planted secrets. Warm run 1 to 2.5 minutes (mostly Snyk). Native JUnit runs through Gradle for every
  `modules/*/android/src/test` (placeholder test in `modules/pit-alarms` until T-013/T-014). Semgrep reads
  rules cached in `~/.cache/pitplanner/semgrep-rules/` (refreshed weekly; `npm run semgrep:update`), so only
  Snyk needs the network.
- Destructive actions (uninstalling apps, deleting data, anything destructive on the phone or in the repo)
  need Jason's explicit yes (CLAUDE.md). Don't read consent into an unclear reply.
- TypeScript is 6.0.3 (D-2 decided); `typescript7` is gone.
- Theme (T-004): values only in `src/theme/tokens.ts`; style with token classes (`bg-surface`, `text-ink-2`,
  `rounded-card`) and the `Text`/`Button` components in `src/components/ui/`. Type comes from `Text`'s
  `variant`, never from classes. Spike: `pitplanner://dev/spike` in the dev build.
- The Expo dev build is on the phone (replaced the Capacitor dev copy; its data is backed up in
  `legacy/tools/device/out/dev-copy-backup-2026-11-12/`). To run it: `npm start`, then
  `adb reverse tcp:8081 tcp:8081` and open "Pit Planner dev". First launch shows the Expo dev menu intro.
- Kit (T-005): build screens from `@/components/kit` only (notes in TASKS T-005). Times, temps, weights and
  countdowns are `<Num>`; the lint rule `pitplanner/num-text-size` stops anything cutting one. Sheets are the
  kit `Sheet` on `Modal` (D-4). Tailwind spacing is now true dp (`inlineRem: 16`). Gallery
  `pitplanner://dev/kit`. Not ported until their screen needs them: AppBar/Screen, Lanes, Menu/SelectField
  and the Setup form pieces (list in TASKS T-005).
- Device tests (T-006): `npm run device` runs on the test emulator by default (`tools/device/avd.sh`; Maestro +
  uiautomator dumps, 115% and 130%, screenshots cropped). `--phone` only for tasks marked **Real phone** in
  TASKS. The device log is cleared before and after and kept only on failure, app lines, redacted. Maestro's
  own output (it holds the whole device log) is deleted after each flow. Read
  `tools/device/out/report.txt` first. `tools/device/README.md`.
  New screens add their controls to `tools/device/targets.tsv` (`stable-controls`, T-017 PR-3).
- D-4 confirmed by Jason on condition of the `sheet-keyboard` device test; it passes (Sheet lifts by the
  keyboard height, `FooterScroll` reveals the focused field above the footer). Kit `InputField` added.
- Release (T-007): `npm run release` (signing from git-ignored root `keystore.properties`; `--version
  x.y.z-alpha.N` for internal builds, `--dry-run`, `--verify <apk>`). `release/pitplanner-0.3.0-alpha.1.apk`
  installs over 0.2.0 on the emulator. About 20 minutes a run.
- T-017 has PR-4 (equal-width tiles, mockup 05; try `flex: 1` first) and two PR-3 fixes to make: selected
  chips reserve their bold width, and nothing jumps when content below shrinks while scrolled to the bottom.
- Tab bar is the kit `BottomNav` (0.2.0 icon pills); T-059 (whole turkey, cited FSIS numbers) follows T-019.
  fsis.usda.gov answers automated fetches with 403: read it in a browser.
- SE-003 (Snyk, `braces`/`open` in Metro and dev-middleware, not shipped): approved with conditions; override
  failed (open 11 is ESM-only), ignores expire 2027-02-10. Re-check triggers are in SECURITY-EXCEPTIONS.

## Stack change plan (approved 2026-11-12)

Jason decided (2026-11-12) to rebuild the app on **Expo SDK 58 + React Native + TypeScript + NativeWind + React
Native Reusables + Expo Router + expo-sqlite + expo-secure-store** (development builds, not Expo Go; no server,
no Redis). This session wrote the plan only, no code. `docs/design/TECH-DESIGN.md`, `TASKS.md` and `WBS.md`
are rewritten for it; Jason approved the plan on 2026-11-12.

Key points of the plan (details in TECH-DESIGN):
- `engine/` and `data/` and their tests stay unchanged. Pure helpers the engine tests import
  (`src/lib/cookView.ts`, `finish.ts`, `historyView.ts`, `sharedPlan.ts`, `timing.ts`, `update.ts`, types in
  `cook.ts`, `history.ts`) keep their paths and exports.
- The Capacitor app moves to `legacy/` in T-002 (reference until parity, deleted in T-039); tag `v0.2.0` on
  `e86d930` keeps it buildable.
- SQLite schema v1 (`kv`, `cookers`, `rate_overrides`, `active_cook`, `cook_history`, `cook_history_items`),
  migrations by `PRAGMA user_version` from day one, tested on better-sqlite3 in Jest.
- **0.2.0 data can be migrated:** same app ID + same key keeps the data dir. Capacitor Preferences is the
  SharedPreferences file `CapacitorStorage`; history is `files/history.json`. A small `pit-legacy` Expo module
  reads the prefs once; partial or failed import shows a one-time "fresh start" notice (T-011, T-012).
- Alarms: `modules/pit-alarms`, a near-verbatim Kotlin port of the 0.2.0 plugin to the Expo Modules API, same
  receiver class names, plus `setQuiet` (fixes the Quiet/nag gap). iOS later, same TS interface.
- UI: Reusables + kit themed from the mockup tokens (now in `src/ui/ui.css`, later `src/theme/tokens.ts`);
  font-scale rule unchanged (lint rule bans truncating `Num`).
- Gate unchanged in spirit: Prettier, ESLint (expo + React Native rules), typecheck, node:test (engine) + Jest/RNTL
  + JUnit, Semgrep, Snyk. Device tests move from Playwright/CDP to **Maestro** (Jason installs the CLI).
- Release: `npx expo prebuild` + Gradle signed with `~/keys/pitplanner.jks`, versionCode 300, GitHub Release
  `v0.3.0` (not prerelease, so 0.2.0's update check sees it). Upgrade tested on an emulator with the real
  `release/pitplanner-0.2.0.apk` first.
- Task IDs were renumbered: old Capacitor-era T-002..T-040 are superseded (mapping table at the end of
  TASKS.md). SE-001's follow-up is now T-057.

Open decisions in TECH-DESIGN section 13 (D-4 decided in T-005: kit Sheet on `Modal`):
D-5 state (keep context store), D-6 in-place port with `legacy/`, D-7 generated `android/`, D-8 Maestro.

## Engineering plan and quality gate (2026-11-12)

- `docs/design/`: TECH-DESIGN, TASKS, WBS, SECURITY-EXCEPTIONS. CLAUDE.md has the mandatory gate:
  `npm run check` = Prettier, ESLint (zero warnings), typecheck, all tests, Semgrep, Snyk (open source + code).
  A task is not done until it passes. Today it runs on the Capacitor stack (TS 7 typecheck, Vitest, Gradle JUnit);
  T-003 moves it to the Expo stack.
- Decisions (Jason): GitHub Releases is the primary channel, Drive an optional mirror (D-1). Snyk Gradle scan
  limited to `releaseRuntimeClasspath` until T-057 (by 2027-02-01; SE-001). `reference/` and `docs/` excluded
  from Snyk Code and Semgrep (SE-002).
- Commits: `ef2107b` format/lint cleanup (typed rules schema `engine/rules.ts`), `ed51a0f` tooling,
  `fc69f5d` plan docs (pushed; `npm run snyk:monitor` ran after the push), `b524245` T-001 (not pushed).
- `tools/device/run.sh` now turns heads-up notifications off during captures (restored on exit): chat
  banners from other apps had landed in screenshots, and the repo is public.

## Done in 0.2.0 (Capacitor; moves to `legacy/` in T-002, behavior is the spec for the port)

- **Scaffold:** Vite + Preact + TS in `src/`, Capacitor 8 Android in `android/`, app ID
  `io.github.mecheng70.pitplanner` (permanent). Launcher icon and splash generated from `assets/`.
- **UI kit** `src/ui/` (components.tsx, ui.css, icons, ripple, back button). Screens use only the kit;
  no per-screen CSS. Roboto bundled. Pinned footers float over the scroll area with a fade and
  matching bottom padding; `KeepVisible` keeps a block on screen after changes.
- **Plan tab** (mockups 04-08) complete. Fidelity audit and screenshots: `docs/fidelity-audit.md`, `docs/fidelity/`.
- **Engine** (36 tests, `npm test`): 5-minute rounding of starts, settable temps, `onHeatSpan`,
  alarms from plan events (`engine/alarms.ts`: grouping, stable step keys, done/reminders/quiet),
  live helpers (`markPullDone`, `extendCook`, `postponeStep`, `smokerOverlaps`).
- **Alarm plugin** (Kotlin, `android/app/src/main/java/.../alarms/`), JS bridge `src/platform/alarms.ts`.
  All device tests passed, including Doze and a locked reboot: `docs/alarm-testing.md`.
  Hidden test screen: Gear, tap the version 5 times.
- **Start cook** checks alert permissions (sheet with Allow rows), saves the cook, schedules alarms.
- **Device tools** `tools/device/` (see its README): `npm run device` does a full unattended pass.

## Cook tab (mockups 12-15): done

Built and device-tested (see git log for the build). Live test with real notifications on 2026-11-11:
alert Done / +15 drain, the "N min past the step." repeat, Quiet, Pit out / Back up to temp, Start over,
Save to history, pellets link all pass. `tools/device/live.mjs` drives a short live cook (start / state /
click / restore; backs up real data first).

Fixed from that test:
- Changes made without asking (alert Done / +15, Not yet) keep serve only if every food keeps its
  minimum rest (`holdsCover` in engine/live.ts, `keepServeIfCovered` in cook.ts); otherwise serve moves.
- Keep/Move sheet: "X: off heat N min after serve." when keep would leave a food late; preselects Move.
- Step alerts no longer auto-cancel when tapped (the body only opens the app); they stay in the shade
  until Done / +15 / swipe. A re-timed step's repeats stop but its notification stays.
- +15 on a fixed step (fire, refill) reminds from now, and not at all if its own alarm is later.
- Alert notices append instead of replacing each other.

Open: Banner "OK" sometimes reads as
not stable to Playwright (only matters for scripts).

## Setup (mockups 01-03, plus Add a cooker 17): done

`src/screens/setup/Setup.tsx` (3 steps: Welcome + units, cookers, alerts), `SmokerPicker.tsx` (picker
and the manual form, also used for unverified catalog models), `src/screens/shared/AddCooker.tsx`
(reuse in Gear). Shows when no `gear` is saved (`state.firstRun`); `finishSetup` saves gear + units.
`seedGear` is gone. Picker groups, chips and notes come from `smokerTypes` in data/cookers.json.
Kit: SetupPage, SetupActions, InputField, CheckRow, OptionCard, DashedButton, PickRow, GroupLabel
`note`, Chips `scroll`, oven avatar glyph. `npm run device` runs `tools/device/setup.mjs` -> `out/setup.png`,
`out/setup-b.png`; it wakes the screen and stops if the phone is locked (unlock it first).

## Gear (mockups 16-20): done

`src/screens/gear/`: `GearScreen` (16: cookers, Cook rates, Alerts sheet, Units sheet, support link,
version), `CookerSheets` (Griddle 18, Oven 19; save only on Save, Remove only when another cooker
remains), `HistoryScreen` (20: rate cards, cook list, cook sheet with Cook again / Remove). Pure helpers
in `src/lib/historyView.ts` take `rules` as a parameter (tests can't import `rules.ts`, it imports JSON);
tests in `engine/history.test.ts`. Records now keep `lateMin` (serve lateness); older ones show no status.
Kit: `ListRow` href/tone/wrap, `IconAvatar`, `Tile` sub, `Tiles inset`, `Screen onBack`, `.card-col`.
Beyond the mockups (told Jason): Units row on Gear, Remove buttons, Home Assistant row has no chevron.
`npm run device -- --only gear` runs just `tools/device/gear.mjs`; it backs up and restores history.json.

## Release signing: done

`npm run release` -> `release/pitplanner-<version>.apk`, signed with `~/keys/pitplanner.jks` via
git-ignored `android/keystore.properties` (template `.example`). Cert `CN=PitPlanner, O=PitPlanner`,
SHA-256 `b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29`. versionName/versionCode come
from package.json (0.1.0 -> 100): bump it before every release. `-PdebuggableRelease` builds a
release-signed debuggable APK, used once to move Jason's data off the debug install.

**Jason's phone runs the signed release (0.1.0) for real cooks.** Debug builds are a separate dev copy:
`io.github.mecheng70.pitplanner.debug`, label "Pit Planner dev", own data. `tools/device/` (attach.sh,
pending.sh, deploy.sh) only touches the dev copy. Never uninstall the release without backing up first.

Distribution (decided 2026-11-12, D-1): GitHub Releases on the public repo is primary; Google Drive is an
optional mirror. The in-app update check (`src/lib/update.ts`) has nothing to find until the first release
(T-004 checks it, including prereleases).

## Release 0.2.0: on Jason's phone

`release/pitplanner-0.2.0.apk` (versionCode 200), built from `e86d930`, has everything up to the Sportsman 850
entry. Jason installed it himself over 0.1.0 (2026-11-12; not checked over adb, the phone was disconnected).
He still needs to re-pick his smoker as the Pit Boss Sportsman 850 in Gear.

For a future backup of the real app: it is not debuggable (`run-as` refused), targets SDK 36 (`adb backup`
skips its data) and has no WebView DevTools socket. Route that works: install a `-PdebuggableRelease` build of
the same version with `adb install -r` without opening it, copy the data out with `run-as`, then install the
normal APK over it.
Shell note: in zsh, `A="adb -s 5ece07c1"; $A shell ...` does not word-split and prints nothing. Write the
full command or use the bash scripts in tools/device/.

The dev copy was rebuilt from the T-001 work tree on 2026-11-12 (has the Sportsman 850 entry and the
105C/205C fix).

## Cook timing (HA-INTEGRATION.md "Do first"): done, closed out as T-001

Food details Timing: Hours per pound (stepper, 0.05 steps, source shown) / Total hours (any food, used as-is,
`TOTAL_HOURS_FIXED` info when the temp changes) / Size-adjusted (no lock; anchored at the reference weight).
"Use for future [food] on [cooker]" saves `rates` or `totalHours`. Rate rule (Jason): a saved rate is exact
until 3 logged cooks, then blends with them unless locked (`rateLocks`, "Keep my rate exactly" in Gear >
Cook rates). Brisket-style tri-tip is perWeight (1.67 hr/lb, 3.5 hr floor). `npm run device -- --only timing`.

T-001 check against "Do first" (2026-11-12):

| Item | Where | Test |
|---|---|---|
| 1a Hours per pound, 0.05 steps, source shown, 0.3-2.5, soft warning outside 0.5-1.6 | FoodEdit `Timing`, `src/lib/timing.ts`, `sourceText` | `engine/timing.test.ts`; FoodEdit.test "hours per pound shows the rate, its source..." |
| 1b Total hours, as-is, TOTAL_HOURS_FIXED on temp change, any food | engine `plan.ts`; FoodEdit | plan.test "total hours are used exactly..."; FoodEdit.test "total hours..." and "Standard and Total hours" (ribs) |
| 1c Size-adjusted, no lock, anchored at reference weight, "Estimate..." line | engine `rateFor`/`buildItem`; FoodEdit | plan.test "size-adjusted works with no history..."; FoodEdit.test "size-adjusted..." |
| 2 Use for future [food] on [smoker], Gear Cook rates shows it | FoodEdit `save`, store `setRate`/`setTotalHours`, `historyView.rateRows` | FoodEdit.test "stepping the rate..." and "total hours..."; history.test |
| 3 Result card shows the method | FoodEdit `methodText` | FoodEdit.test "a saved 0.75 hr/lb plans 9 hr and the result card names the rate" |
| 4 Engine tests (4 named) | `engine/plan.test.ts` | lines "a 12 lb brisket at 0.75...", "total hours...", "a per-item rate beats...", "size-adjusted works..." |
| 5 One-time published-rate hint | FoodEdit `hint`, `flags.rateHintShown` | FoodEdit.test "shows the published-rate hint once" / "does not show the hint once it has been seen" |
| 6 No truncated numbers at 115/130% | device `timing.mjs` measure | `npm run device -- --only timing`: clipped [] at both scales |
| 7 SPEC 1 and 4 updated | SPEC.md "Timing model" row, section 4 Rates/Total hours/Size-adjusted | n/a |

Screenshots (Sportsman 850, 12 lb brisket, 5:00 PM Sat serve): `docs/fidelity/timing-modes-115.png`,
`timing-modes-130.png` (three modes, 9 hr, fire 6:20 AM), `timing-plan.png` (published 1.25 = 15 hr; Plan at
0.75 hr/lb, fire 6:20 AM, at 115% and 130%). The 115% Total hours panel has a blue system screen tint;
content is unaffected.

## Open shared plan (11): done

`.pitplan` VIEW/SEND intent filters, `share/SharedPlanPlugin.kt` reads the content URI (256 KB cap),
`src/platform/sharedPlan.ts`, pure `src/lib/sharedPlan.ts` (tests `engine/share.test.ts`), `SharedPlanSheet`.
Export drops the sender's rate and total hours. Tested via a file:// VIEW intent (`--only shared`); Gmail/Drive not yet.

Also: Cook tab with food on the plan and no cook = Start cook. Next up title includes the countdown
("Fire the smoker to 225F in 45 hr 50 min"). Lane chart runs from the first step's hour to serve.
`deploy.sh` now stops on a failed build (it used to install the old APK).

HA Phase 0 done: `docs/ha-entities.md` (read-only survey). Jason's smoker is a Pit Boss Sportsman 850
(PB850SPW2), new verified catalog entry `pitboss-sportsman-850`; he re-picks it in Gear. The `pitplanner` HA
user exists. Probe batteries were dead at the survey. Next: HA Phase 1 (needs the 6 mockups in HA-INTEGRATION 4.5 first).

Fixed 2026-11-12: Plan warns (info, orange Pellets tile) when a cook burns more pellets than the hopper holds;
refill alert reads "Top off the hopper. It runs low in about 30 min." (fires 30 min before 10%). Rules and
engine wording converts to C / kg on display (`localizeText` in engine/units.ts, `tx` in format.ts; alarms
via `AlarmOptions.text`). Live changes (Done early/late, Not yet, Pit went out, +15) round scheduled times to
5 minutes; actual past times (pulled at) stay exact.

Idea from Jason (not built): tapping the lane chart opens it full screen in landscape until tapped again
(or a close button), so a long cook's short steps are readable.

Device scripts added this session (all via `npm run device -- --only <name>`): `timing`, `shared`, `update`,
`units` (Celsius + kg pass over Plan, Conflicts, Cook, Full timeline).

## Next

1. Done 2026-11-12: Jason approved the stack-change plan; T-001 phone check on 0.2.0 passed.
2. Jason: push `main` when ready (plan docs and T-001 are local only).
3. Done: Maestro CLI installed (2.12.1, `~/.maestro/bin`).
4. T-002..T-007 done (R-1 closed, D-4 decided and confirmed). Next: T-008,
   per WBS "Suggested order" (T-058 now sits between T-019 and the Cook screen).
   Push the `v0.2.0` tag only when Jason says.
5. Still open from before (carried into the plan): real cook with alarms through a reboot (now T-037 on the Expo
   build), two-phone share via Gmail/Drive (T-031), lane chart full screen (T-040), import-made conflict fix
   (T-030), HA Phase 1 after 0.3.0 (T-042 onward).

## Decisions from Jason

- Follow the Android system font size. Times, temps, weights and countdowns never truncate at any
  scale; only secondary text may. Test at 115% and 130% (normal is 115%).
- Engine rounds phase starts to 5-minute steps; off-heat stays exact (serve - slice - rest).
- Plan: only Start cook is pinned; at 115% three cards + Add food fit, at 130% two cards.
- Changing a value never moves the control being tapped or shifts the layout (Jason, 2026-11-12; T-017
  PR-3): tabular digits, fixed-height rows for computed values, no warnings above the control, no automatic
  scrolling. This retires the 0.2.0 "result card scrolls into view after any change" behavior.
- Food details result (T-019): a fixed-height summary bar pinned at the bottom above the tab bar (fire, off
  heat, serve); the full result card stays in the scroll; tapping the bar scrolls to it; meets PR-3.
- Font size and process death (T-058, before the Cook screen): `configChanges` so a font-size change doesn't
  rebuild the screen (text still resizes live); the active cook, selected tab and unsaved edits survive
  process death. Device test with "Don't keep activities" on and a live font-size change mid-cook.
- No UI element that isn't in `docs/mockups` or SPEC without asking Jason first (CLAUDE.md).
- Smoker temp is the dropdown in the cooker's steps, never preset buttons (SPEC section 1; T-017 PR-1).
- Setup step 1 is Welcome + units (the canvas has no step 1). Add a cooker (17) built with Setup.
- Alerts stay in the notification shade until handled or swiped; nothing removes them silently.
- Cost: keep sessions short, screenshot only at checkpoints, use `npm run device` instead of step-by-step driving.

## Known open items

- Font size changed while the app is open (or in the background) recreates the Android activity: the React tree
  remounts, the app returns to the Plan tab, and open sheets, the selected tab and unsaved edits are lost.
  Checked on a release build 2026-11-12. Now task T-058 (Jason, 2026-11-12), done before the Cook screen.

- Quiet alerts holds scheduled steps but native repeats of an already-overdue step still ring.
- History entries can be removed but not edited (SPEC failure mode 14 says editable).
- Oven `warmingDrawer` is stored but unused by the planner.
