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

Device tests run on the test emulator (`npm run device`, `tools/device/avd.sh`: Android 16, 360x792 dp like
the phone). Jason's phone is used only where a task says **Real phone** (Jason, 2026-11-12): real alarms in
Doze, after a reboot and on the lock screen, OEM battery behavior, Bluetooth and the HA probes, other people's
phones and accounts, and the real cook. Then `npm run device -- --phone` (data backed up and restored).

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
  shows "Fire the smoker at 6:20 AM" (`docs/fidelity/t002-expo-dev-build.png`). SE-003 approved with
  conditions (override tried, ignores kept, expire 2027-02-10).
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
    dev-middleware), not in the app bundle; ignored path by path in `.snyk`, written up as SE-003.

### T-003 Quality gate on the new stack
- **Status:** done (see `git log --grep T-003`)
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
- **Notes (done 2026-11-12):**
  - ESLint: `eslint-config-expo/flat` + typescript-eslint + `eslint-plugin-react-native` (color literals and
    inline styles banned, so the T-002 placeholders now use `StyleSheet`); layer rules per path from TECH-DESIGN
    section 3, plus no `Date.now()`/`new Date()`/`fetch`/`node:*` in `engine/`. The rule caught a real
    violation: `src/lib/cook.test.ts` imported the fixture from `screens/`; the fixture moved to
    `src/lib/fixtures/saturday.ts`. `Num` text-size rule stays with T-005.
  - Gate self-test `tools/gate.test.mjs` (`npm run test:gate`, part of `test:all`): 24 ESLint cases on virtual
    files (nothing written to the repo), the `--max-warnings 0` exit code, and planted Stripe, GitHub and PEM
    secrets in a temp dir outside the repo failing `tools/semgrep.sh`.
  - Semgrep gained `r/generic.secrets`: `p/secrets` alone did not flag a GitHub token. No new findings in the repo.
  - Jest: `jest.setup.ts` (safe-area and `expo-font` mocks); `src/test/jestSetup.test.tsx` fails without it.
    Added `expo-font` (T-004 uses it for Roboto).
  - `tools/prebuild-if-stale.sh` (stamp `android/.prebuild-stamp`) runs before step 4. `tools/test-android.sh`
    gets Gradle project names from Expo autolinking.
  - Follow-ups after review (2026-11-12, before T-004): a placeholder `modules/pit-alarms` (module name only,
    Kotlin package `io.github.mecheng70.pitplanner.alarms`) with one JUnit test, so the native path runs now
    (`:pit-alarms:testDebugUnitTest`, 18 s; a broken assertion fails the step). T-013 builds on it. Semgrep
    rules cached outside the repo (`tools/semgrep.sh`), so the gate no longer depends on semgrep.dev (it
    returned 503s while this was built). SE-001 rewritten for the SDK 58 count.
  - SE-001 re-checked on SDK 58 (AGP 9.2.1): 53 high/critical, all build-machine configurations; release
    classpath 0. Scope limit unchanged.
  - Warm `npm run check`: 1 to 2.5 minutes, mostly Snyk's cloud scan (under the 4 minute target).

### T-004 Theme: tokens, NativeWind, Reusables, Roboto (spike)
- **Status:** done (see `git log --grep T-004`); R-1 closed.
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
- **Notes (done 2026-11-12):**
  - Tokens: `src/theme/tokens.ts` (colors, type scale with line heights incl. countdown/nextTitle, radii, font).
    `tailwind.config.js` builds the theme from it and replaces Tailwind's palette; Reusables' shadcn names are
    aliases (our ember is `ember`/`primary`). `app.config.ts` and `src/theme/navTheme.ts` read it too.
  - Type is a style from the tokens in `Text` (Jest can assert it; follows font scale), color is a class.
    `Button` has the four 0.2.0 kinds with their label type via `TextContext`.
  - Roboto 400/500/700 registered natively by the `expo-font` plugin (one Android family); no runtime load.
  - Reusables CLI 0.7.1 with `cssVariables: false` writes `oklch()` literals and skips `cn`/deps: `text` and
    `button` were rewritten by hand; T-005 does the same per component.
  - Config: `babel.config.cjs` and `metro.config.cjs` (CommonJS because of `"type": "module"`), `@/` alias in
    tsconfig and Jest, Jest transforms `@rn-primitives`/NativeWind, `cn()` on tailwind-merge 2.
  - Spike `app/dev/spike.tsx` (dev builds only): `docs/fidelity/t004-spike-vs-05.png` (mockup 05, 115%, 130%).
    Changing the font scale while the app runs recreates the activity and the dev build logs "configured
    linking in multiple places" once; a fresh launch at 130% is clean. T-006 should relaunch after each scale.
  - Gate fixes found on the way: `prebuild-if-stale.sh` treated Gradle output in `modules/` (and folder times)
    as source changes and prebuilt on every run (regression test `tools/prebuild.test.mjs`, failing first);
    Snyk tried `modules/pit-alarms/android/build.gradle` as a standalone project and skipped it (`modules`
    now excluded from discovery; the module is scanned as an `android/` subproject, 22 projects, none skipped).
  - Follow-ups after Jason's review (2026-11-12, before T-005):
    - Gate: `tools/snyk.sh` (step 6) fails when Snyk skips a project or tests fewer than exist (21 Gradle + 1
      npm = 22 today); regression test `tools/snyk.test.mjs` failed on the old step first.
    - SE-003: `braces` is SNYK-JS-BRACES-19963945 / CVE-2026-93687 on `braces@3.0.3`, all versions affected,
      no fix; not CVE-2024-4068 (fixed in 3.0.3, already installed).
    - Font size changed with the app open, release build (dev variant, release build type): same process and
      React instance, but the activity is recreated and the React tree remounts: the app returns to the Plan
      tab and in-memory UI state is lost. No error is logged in release (the "configured linking" message is
      dev-only). Not fixed; see HANDOFF "Known open items".
    - T-002 screenshot cropped below the status bar; CLAUDE.md now requires it for every device screenshot.
    - Jason's review of the spike: requirements PR-1 (temp dropdown, no presets), PR-2 (food icons), PR-3
      (changing a value never moves the control) added to T-017, with the `stable-controls` device test in
      T-006. The temp presets were Claude's invention for the spike, against SPEC section 1, not 0.2.0 behavior.
  - Tests: tokens equal `ui.css` (colors, type, line heights, radii), Tailwind exposes exactly the token colors,
    text variants and button labels use Roboto at the token size/weight, no font-scale cap, `cn`, `withAlpha`.


### T-005 Kit components
- **Status:** done (see `git log --grep T-005`); D-4 decided.
- **Goal:** the Pit Planner kit (TECH-DESIGN section 8), so screens never style ad hoc.
- **Files:** `src/components/kit/*` (Text variants, Num, Stack/Row, Card, Button, IconButton, Chips,
  Segmented, Stepper, Tile/Tiles, InfoBox, ResultCard, Banner, ListRow, StatusRow, CheckRow, Field, Sheet,
  EmptyState, icons via `react-native-svg`), `eslint-rules/num-text-size.js`, `app/dev/kit.tsx`, tests.
- **Depends on:** T-004.
- **Approach:** port the behavior of `legacy/src/ui/components.tsx` component by component; settle D-4
  (bottom sheet) first; Android back closes the top sheet; ripple on pressables; same accessibility roles and
  labels as the legacy kit (tests query by role and label).
- **Acceptance:** the kit gallery shows every component; the lint rule rejects `numberOfLines` and
  `adjustsFontSizeToFit` on `Num`; `Num` renders tabular digits (`fontVariant: ['tabular-nums']`, Jest) so a value
  keeps its width as it changes (T-017 PR-3); `Avatar` shows the cooker icon (T-017 PR-2).
- **Tests:** RNTL per component (Stepper handlers and disabled, Chips selection, Sheet back and close,
  CheckRow toggle); lint rule unit test.
- **Device testing (Jason):** none.
- **Notes (done 2026-11-12):**
  - D-4: kit Sheet on React Native `Modal`, not `@gorhom/bottom-sheet` (reasons in TECH-DESIGN section 13).
    Back goes to the top Modal, so stacked sheets close top first. Footer floats behind a 14 dp fade
    (`FooterScroll`, reused by `Screen` later).
  - Kit in `src/components/kit/` (`index.ts` re-exports `Text`/`Button`): Num, Stack/Row/Fill/Fixed/Spacer/
    Divider, Card, Avatar, IconAvatar, Tile/Tiles, InfoBox, ResultCard, Banner, EmptyState, GroupCard,
    IconButton, Chips (wrap, small, scroll), Segmented, Stepper, Field, ListRow, StatusRow, CheckRow, Sheet,
    `useSheet`, all 0.2.0 icons on `react-native-svg` (added, 15.16.0). Not ported yet (no task needs them
    before their screen): AppBar/Screen, Lanes, Menu/SelectField, ChoiceCards, SetupPage, InputField,
    OptionCard, PickRow, StatusChip, ActionRow, InfoRow, BandNote, TextArea, SearchField; each comes with
    the first screen that uses it.
  - `Num`: tabular digits, spaces to no-break spaces (RN has no `nowrap`), cutting props not in its type.
    Lint rule `pitplanner/num-text-size` (`eslint-rules/num-text-size.js`, RuleTester under node:test in
    `npm run test:gate`, plus a wiring case in `tools/gate.test.mjs`) rejects `numberOfLines`, `clamp`,
    `adjustsFontSizeToFit`, `ellipsizeMode`, `maxFontSizeMultiplier`, `allowFontScaling={false}` on a Num
    or any element around one.
  - `Text`: nested Text inherits the outer type and tone (so `Num` in a sentence matches); new `clamp` (one
    line) and `relaxed` (ui.css `.lh`, 1.4) props. `Button`: disabled primary is grey with a tertiary label
    (ui.css), `tone` accent (outline) and danger (text), icons take the label color.
  - Tokens: `statusColors` (ok/warn/gold/error containers, on-error-container: ui.css literals),
    `relaxedLineHeightRatio`, `chipHintSize`; tested against ui.css.
  - Bug found: NativeWind inlined `rem` as 14 dp, so every Tailwind spacing class was 12.5% short (T-004's
    button padding included). `inlineRem: 16` in `metro.config.cjs`; regression test
    `src/theme/spacing.test.ts` (failed first).
  - Accessibility: radiogroup/group containers are not accessibility elements (TalkBack reaches each
    option); tests find them by label. Icons are hidden from TalkBack. Banner's message is the alert.
  - Gallery: `app/dev/kit.tsx`, `pitplanner://dev/kit` (dev builds only).

### T-006 Device test tooling (Maestro)
- **Status:** done (see `git log --grep T-006`)
- **Goal:** unattended device passes for the React Native app, replacing the WebView/CDP scripts.
- **Files:** `tools/device/run.sh` (rewritten), `tools/device/lib.sh`, `tools/device/check.mjs`, `ui.mjs`,
  `ui.test.mjs`, `targets.tsv`, `crop.py`, `tools/device/compose.py` (kept), `tools/device/db.sh` (back up and
  restore the dev build's data via `run-as`), `tools/device/README.md`.
- **Depends on:** T-002; Jason has installed the Maestro CLI.
- **Approach:** keep today's safety in `run.sh`: wake and refuse if locked, back up data, heads-up banners off,
  font scale 1.15 then 1.3, restore everything on exit. Flows tap by accessibility label; `adb exec-out
  screencap` for images.
- **Acceptance:** `npm run device -- --only smoke` installs the dev build and captures the tabs at both scales,
  data restored afterwards. Screenshots are cropped below the status bar (CLAUDE.md). After each font-scale
  change the app is relaunched (changing it with the app open recreates the activity; see T-004 notes).
- **Device test `stable-controls` (T-017 PR-3):** at 115% and 130%, record the on-screen bounds (`uiautomator
  dump`) of the control being tapped and of every element above it, tap it N times (stepper + five times then -
  five times; a temp choice; a mode toggle), dump again, and fail listing any element whose bounds changed.
  Targets: the `app/dev/spike` stepper now (it jumps per Jason's T-004 review, so the flow must fail there:
  that proves it detects a jump), then Plan (T-017) and Food details (T-019).
- **Device test `sheet-keyboard` (D-4 condition, Jason 2026-11-12):** a kit Sheet with a text field and the
  keyboard open keeps the focused field and the pinned footer visible, at 115% and 130%. If `Modal` cannot
  pass it, stop and tell Jason.
- **Tests:** n/a (tooling); `shellcheck` clean.
- **Device testing (Jason):** none since the emulator is the default; for `--phone`, the phone unlocked and
  plugged in.
- **Notes (done 2026-11-12):**
  - `npm run device -- [--no-build] [--only smoke,sheet-keyboard,stable-controls]`; full pass with build about
    8.5 minutes. Starts Metro if it is not running (and stops it after), cold-starts the dev build through the
    dev-client link (a plain deep link on a cold start opens the dev launcher) and then opens the route.
  - Maestro 2.12 quirks: it reads stdin (it swallowed the rest of `targets.tsv`), `repeat: times: ${N}` runs
    "indefinitely" for N=1, and `takeScreenshot` ignores the path. So tap and scroll flows are written per
    step into `out/`, Maestro gets `/dev/null` as stdin, and screenshots are adb screencap, cropped below the
    status bar. Maestro's debug output goes to `out/maestro`.
  - Privacy guard: in one early run at 130% the notification shade was open after a tap and the dump held
    other apps' notifications. `dump` now refuses any window that is not the app (collapses the shade, fails
    the step, writes nothing). Not seen again in two full runs.
  - `sheet-keyboard` failed first, as expected for Modal edge-to-edge: keyboard top at 2056 px, focused Weight
    field at 2512-2720 and Save at 2880-3104, both under the keyboard. Fix in the kit: the Sheet lifts itself
    by the keyboard height (`Keyboard` events; regression test in `sheet.test.tsx`), then the field sat behind
    the floating footer, so `FooterScroll` reveals the focused field above the footer (`reveal.ts`, unit
    tested). Now passes at both scales (Weight at the bottom, then Name at the top with the keyboard open).
    Kit `InputField` ported for it (legacy InputField, ui.css `.input`); gallery `pitplanner://dev/kit?sheet=form`.
  - `stable-controls` checks the control, its row and everything above it (any node starting above the
    control's bottom edge). Spike result at both scales: the temp chips and the Ready by / Start at toggle
    move 5 to 7 px when selected (the selected label is bolder, so wider): detected, so the detector self-test
    passes. The spike stepper itself did not move: Roboto's digits are already equal width, so "0.75 hr/lb"
    and "1.00 hr/lb" have the same bounds. Targets live in `targets.tsv` (T-017 and T-019 add theirs with
    `expect stays`).
  - `db.sh restore` only replaces the dirs the backup holds and refuses an empty or unreadable tar; round trip
    checked on the phone.
  - Follow-ups after Jason's review (2026-11-12):
    - Tab bar icons were empty boxes: T-005 never ported the 0.2.0 `BottomNav`, so the default tab bar drew a
      missing glyph. Now kit `BottomNav` (icon pill over the label, at least 80 dp, grows with the font) is the
      tab bar. The old default bar had a fixed height and its labels ended at the screen's bottom edge
      (uiautomator bounds), so they were likely cut at 130%; now whole at both scales. Smoke checks the
      selected tab by its label.
    - `stable-controls` targets can start scrolled to the bottom (`start` column). The spike shows the 0.2.0
      "Unusual rate" warning under its stepper (brisket's usual range from `foods.json`); scrolled to the end,
      More x5 removes it and the screen jumps 188 px at 130%: `spike-bottom` fails as Jason asked (detector
      self-test). Moved nodes are matched by class and label first, so the list names what really moved.
    - Screenshots never show the keyboard: it is closed first, or for `sheet-keyboard` the image ends at its
      top edge (no IME banners like "Emoji size updated", no clipboard suggestions).
    - `run.sh` keeps only the two newest data backups in `out/`.
    - Privacy fix: Maestro's debug and test output hold the phone's whole logcat (every app's log). Semgrep
      found another app's access token in one such copy under `out/maestro` (git-ignored, never committed).
      Each Maestro call now writes to a temp dir outside the repo that is deleted when the flow ends; nothing
      from Maestro but its step lines is kept. Semgrep keeps scanning `tools/device/out/` as a safety net.
  - Second round (Jason, 2026-11-12):
    - `~/.maestro/tests/` deleted (Jason's yes). The device log is cleared before and after each run and
      saved only when a test fails: the app's own lines (`logcat --uid`), redacted (`redact.mjs`, tested).
    - Default target is the test emulator (`avd.sh`, API 36, 360x792 dp, KVM; boots headless in about 35 s);
      `--phone` for tasks marked **Real phone**. Install goes to the target only (`assembleDebug` + `adb
      install`; `installDebug` would install on every attached device). The phone's data is backed up and
      restored; the emulator's is not (nothing of Jason's on it).
    - The emulator found two things the phone could not: React Native's keyboard height leaves out the
      navigation bar inset (the phone's gesture bar is 0 dp), so the sheet lifted 24 dp short and Save sat
      under the keyboard (fixed, regression test in `sheet.test.tsx`); and the LogBox toast for a
      NativeWind warning ("ImageBackground is deprecated", from react-native-css-interop) covered the tab
      bar (that one warning is ignored in `app/_layout.tsx`).
    - `launch` closes the dev menu's first-launch intro; `launch` and every screenshot wait for the
      "Refreshing..." banner to clear (and retake if it came up during the capture).

### T-007 Release build: signing plugin, versionCode, release script
- **Status:** done (see `git log --grep T-007`)
- **Goal:** `npm run release` produces an APK signed with the existing key that Android accepts as an update to
  0.2.0.
- **Files:** `plugins/withReleaseSigning.ts`, `releaseSigning.ts`, `version.ts` (+ tests, fixture), `keystore.properties.example` (repo root), `tools/release.sh`,
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
- **Notes (done 2026-11-12):**
  - `plugins/withReleaseSigning.ts` (TypeScript, applied in `app.config.ts`) uses the pure
    `plugins/releaseSigning.ts`: Gradle reads the root `keystore.properties` at build time (no secret is
    written into `android/`), release builds use `signingConfigs.release`, and a release build without the
    file fails instead of falling back to the debug key. Tested on a copy of the generated `build.gradle`
    (`plugins/fixtures/app-build.gradle`); a template change it does not recognize fails at prebuild.
  - `plugins/version.ts`: versionCode with prereleases (`0.3.0-alpha.1` -> 300), shared by `app.config.ts` and
    `release.sh`; `APP_VERSION` sets the version for an internal prerelease.
  - `npm run release [-- --version x.y.z-alpha.N] [--dry-run] [--verify <apk>]`. A real release (no
    `--version`) needs clean `main`; `--version` only takes prereleases. It never overwrites an APK in
    `release/`, verifies cert, app ID, versionCode and versionName, prints the APK's SHA-256, and generates
    the development `android/` again on exit.
  - Root `keystore.properties` created from the legacy one (store path made absolute; Gradle does not expand
    `~`), git-ignored, mode 600. `keystore.properties.example` documents it.
  - Bug found: the first full run died after the build at `aapt2 dump badging | head -1` (SIGPIPE under
    pipefail, exit 141); the cleanup then removed the APK. Fixed with `sed -n 1p`; regression test with stub
    build tools that print a long dump (`tools/release.test.mjs`, failed first).
  - Result: `release/pitplanner-0.3.0-alpha.1.apk` (internal, not distributed), cert SHA-256
    `b6c32d12...0a29`, versionCode 300, SHA-256 `43f6ef64...5110`. On the emulator over
    `release/pitplanner-0.2.0.apk` (run once first): `adb install -r` succeeded, versionCode 200 -> 300,
    firstInstallTime unchanged (same install, same data dir), the app opens on Plan, no crash.
  - A full release run takes about 20 minutes here (the release JS bundle was 8.5 minutes cold). The emulator
    crashed once during a build under memory load (23 of 30 GB in use); it restarts with its data.
  - Follow-ups after Jason's review (2026-11-12, before T-008):
    - versionCode scheme changed so prereleases sort below their release: (major*10000 + minor*100 + patch) *
      1000 + stage, stage N for alpha.N, 300 + N for beta.N, 600 + N for rc.N, 999 for the final release
      (TECH-DESIGN section 12; tests in `plugins/version.test.ts` failed first). The acceptance line's
      "versionCode 300" is now 300001 for 0.3.0-alpha.1 and 300999 for 0.3.0.
    - `release.sh` stops the test emulator before anything else (`avd.sh stop` now waits until it is gone).
    - What to back up for signing: HANDOFF "Release signing: what to back up" (names only).

---

## Phase 3: Storage

### T-008 SQLite: Db interface, migration runner, schema v1
- **Status:** done (see `git log --grep T-008`)
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
- **Notes (done 2026-11-12):**
  - `Db` (`src/db/db.ts`) is synchronous: `exec`, `run`, `all`, `get`, `transaction(fn)`, `close`. A
    transaction is one uninterrupted block of JS, so nothing can interleave with it, and the store (T-010) can
    load before the first render. `expoDb.ts` uses expo-sqlite's sync API (`openDatabaseSync`, `execSync`,
    `runSync`, `getAllSync`, `getFirstSync`); `testDb.ts` is better-sqlite3 (dev dependency, tests only).
    Both share `runTransaction` (BEGIN IMMEDIATE, COMMIT, ROLLBACK on a throw, no nesting).
  - `migrate.ts`: `migrate(db, migrations)` applies every migration above `PRAGMA user_version`, each in one
    transaction with its version bump. `openMigrated(db, migrations)` sets WAL and foreign keys, migrates, and
    returns `{ ok: true, db, from, to }` or `{ ok: false, error }` (the error screen hook: `MigrationError`
    with `kind` `failed` or `newer` and the version). A database from a newer app is refused, not touched.
    The list is in `src/db/migrations/index.ts`; a misnumbered list throws.
  - `schema.snapshot.sql` holds the schema as SQLite stores it, by object name. A new migration updates it in
    the same commit.
  - Tests (16): snapshot, the six tables, no-op re-run, rollback (throwing migration, bad SQL), earlier
    migrations kept, newer database, foreign-key cascade, WAL on a file, CHECK constraints, transactions,
    and `expoDb` against a stand-in for expo-sqlite on better-sqlite3 (same method names and result shapes).
  - Not done here: nothing in the app opens the database yet (T-010 wires it into startup), so `expoDb` has not
    run on a device. The error screen itself ("Export my data") is in T-010 (Jason's yes, 2026-11-12).
  - T-009 changed this migration before it shipped: `cook_history.late_min` is REAL and `ended_early` is new
    (see T-009 notes). From the first release that contains it, 0001 is never edited again.
  - Added `expo-sqlite` ~58.0.17, `better-sqlite3` and `@types/better-sqlite3` (dev).

### T-009 Repositories
- **Status:** done (see `git log --grep T-009`)
- **Goal:** typed reads and writes for kv, cookers, rate_overrides, active_cook and cook history.
- **Files:** `src/db/repos/*.ts`, `src/lib/history.ts` (keeps `CookRecord`; I/O through the repo), tests.
- **Depends on:** T-008.
- **Approach:** JSON columns validated and normalized on read (reuse `normalize` for ActiveCook); the history
  repo assembles `CookRecord` from the two tables; `logsOf` becomes a query with the same result.
- **Acceptance:** every repo round-trips; a corrupt JSON row reads as the default and never throws to the UI.
- **Tests:** Jest repo tests including corrupt rows; `engine/history.test.ts` green and unchanged.
- **Device testing (Jason):** none.
- **Notes (done 2026-11-12):**
  - `repos(db)` in `src/db/repos/index.ts` returns `kv`, `settings`, `cookers`, `rates`, `activeCook`,
    `history`. All synchronous; every write takes `now`.
    - `settings` (over `kv`): `units`/`setUnits` (default F, lb), `flags`/`setFlags`, `update`/`setUpdate`,
      `draft`/`setDraft` (null when missing: the store makes the default draft).
    - `cookers`: `load(): Cookers`, `save(cookers, now)` replaces the set, `count()` (0 = gear never saved,
      the store's `firstRun`). Row id is `kind:profileId`.
    - `rates`: `load()` returns `{ rates, totalHours, rateLocks }` (the store's three maps), `setRate`,
      `setTotalHours` (null removes), `setLock`; a row with nothing left is deleted.
    - `activeCook`: `load()`, `save(cook, now)`, `clear()`; read through `normalize` (`src/lib/cook.ts`).
    - `history`: `list(): CookRecord[]` in the order saved, `logs()` (a query; equals `logsOf(list())`),
      `save(record, now)` (same id replaces in place, for T-028's edit), `remove(id)`.
  - Corrupt data never throws on read: bad JSON or a wrong shape in `kv` reads as the default; a corrupt
    cooker row is skipped and the others load; an unusable rate is ignored; an unreadable cook is no cook;
    corrupt item `options` read as none and the cook still counts. A draft with one bad item is dropped whole.
  - **Schema v1 changed (not shipped yet, so 0001 was edited, with the snapshot and TECH-DESIGN section 5):**
    `late_min INTEGER` alone could not tell "ended before serve" (`lateMin: null`, shown as "Ended early")
    from "saved before lateness was kept" (`lateMin` absent, no status shown), so every imported 0.2.0 record
    without `lateMin` would have read "Ended early". Now `late_min REAL` plus `ended_early INTEGER NOT NULL
    DEFAULT 0`; a test checks the three cases through `serveStatus`.
  - New `src/lib/draft.ts`: the `Draft` type (from the legacy store) and `parseDraft`. T-010's store imports
    it. `src/lib/history.ts` is unchanged apart from its comment; `engine/history.test.ts` untouched, green.
  - Tests: `src/db/repos/repos.test.ts` (31 cases).

### T-010 App store over repositories
- **Status:** done (see `git log --grep T-010`)
- **Goal:** app state (gear, units, draft, rates, totals, locks, history, cook, flags, firstRun) loads from
  SQLite and writes through on every change (D-5).
- **Files:** `src/lib/store.tsx` (React context; port of `legacy/src/lib/store.tsx`), `src/lib/cook.ts` (types
  kept; platform via interfaces), `app/_layout.tsx` (open and migrate the database before the first screen),
  `src/screens/shared/MigrationError.tsx`, `src/db/export.ts` (the JSON dump; T-036 adds the Gear row and
  import on top of it), `tools/device/flows/` + `targets`/`run.sh` entries for the two device tests, tests.
- **Depends on:** T-009.
- **Migration error screen (Jason's yes, 2026-11-12):** shown instead of the app when `openMigrated` returns
  `ok: false` (a failed migration, or a database from a newer app); never a silent reset. Built only from
  existing kit components, no new UI patterns:
  - one plain sentence: the update failed and your data is safe;
  - an "Export my data" button (kit `Button`): shares a JSON dump of what can still be read (the database is
    at its old version, untouched) through the share sheet;
  - expandable error details (collapsed by default): migration version and the error message.
  If an existing kit component cannot do the expandable part, stop and ask Jason before adding one.
- **Acceptance:** killing the app after any change and reopening shows the change; `planInput(state)` returns
  the same shape as before. On the emulator (`npm run device`), with the real expo-sqlite database:
  - a fresh install opens and migrates `pitplanner.db` (`user_version` 1, the six tables, WAL), and a change
    made in the app is still there after the app is killed and reopened;
  - a forced migration failure (dev build only, for example a dev-client link that adds a throwing migration
    on the next start) shows the error screen at 115% and 130%; `user_version` and the data are unchanged;
    Export my data opens the share sheet; after the forced failure is removed the app opens normally with
    its data.
- **Tests:** Jest store tests with the test DB and platform fakes; RNTL for the error screen (sentence, export
  called once, details hidden until expanded, both failure kinds); export dump unit test. The forced-failure
  switch cannot exist in a production build (test).
- **Device testing (Jason):** none (emulator). Jason judges the error screen screenshots at 115% and 130%
  against the kit gallery: same components, plain copy, nothing cut.
- **Notes (done 2026-11-12):**
  - Before the task (Jason's T-009 review; commit "T-009 follow-ups"): migrations frozen by checksum
    (`tools/migrations.test.mjs`, `npm run migrations:freeze`, CLAUDE.md rule); `cook_history` CHECK
    (`ended_early = 1` requires `late_min IS NULL`); quarantine (`src/db/repos/quarantine.ts`, TECH-DESIGN
    section 5); `Db.transaction` inside a transaction joins the outer one.
  - Store: `src/lib/store.tsx` (`StoreProvider repos clock`, `useStore`, `loadState`, `planInput`,
    `defaultServe`). Writes are synchronous, then state updates; writers read the latest state from a ref, so
    two changes in one event build on each other. New against 0.2.0: `draftLost`, `setUpdate`; `setGear` ends
    the first run when it saves gear (as a restart would). Not in the store yet: alarm sync after a cook
    change (T-015) and the update check on launch and resume (its own task; `setUpdate` is ready for it).
    Its test is `src/test/store.test.tsx` (src/lib may not import React Native test tools); helpers
    `src/test/store.tsx` (`testRepos`, `storeWrapper`) for screen tests.
  - Startup: `app/_layout.tsx` -> `openAppDb(__DEV__)` (`src/db/appDb.ts`, opened once) -> `StoreProvider`,
    or `MigrationErrorScreen`. A database that cannot be opened at all is the same screen with Export off.
  - Error screen `src/screens/shared/MigrationError.tsx` (rebuilt after Jason's review): the kit
    `EmptyState` with the `Warn` icon, title "Pit Planner couldn't update", body "Your data is safe. Tap
    Export my data and send the file to Jason.", the primary `Button` "Export my data", then the text `Button`
    "Show details" / "Hide details" centered like the body, with the details in an `InfoBox`. A failed export
    shows the kit `Banner` "The export did not work. Try again." The same screen for a failed migration, a
    database from a newer app and a database that cannot be opened; the details say which.
  - Export: `src/db/export.ts` (`exportDump`, `exportFileName`), shared by `src/platform/shareFile.ts`
    (expo-file-system cache file + expo-sharing; both added, `~58.0.x`).
  - Draft notice: `state.draftLost` shows the kit `Banner` (warn) "Your saved plan could not be loaded." on
    the Plan placeholder; T-017 carries it into the real screen.
  - Dev only: `pitplanner://dev/db` (`app/dev/db.tsx`, redirects to Plan outside dev builds) shows
    `user_version`, journal mode, tables and units; `?set=C|F` saves units through the store; `?fail=1` arms
    one failing start (`startupMigrations`: the flag is deleted, a throwing migration is appended). A release
    build never reads the flag (`appDb.test.ts`).
  - Emulator (`npm run device -- --only db,migration-error`, real expo-sqlite, 115% and 130%): all pass.
    `db`: `user_version 1`, `journal wal`, the six tables; units saved as C then F are there after a kill and
    restart. `migration-error`: armed, next start shows the sentence, Export my data and Show details, no
    tabs; details show after the tap; Export my data opens the share sheet; the start after is normal with
    the same version, tables and units. Screenshot `docs/fidelity/t010-migration-error.png`. The grey gear
    at the top right is the Expo dev client's own button (dev builds only), not part of the screen.
  - Fixes after Jason's review (2026-11-12, before T-011):
    - A database that cannot be opened at all: Export my data shares the database files themselves as one
      tar (`pitplanner-database-<date>.tar`: `pitplanner.db`, `-wal`, `-journal`; `src/lib/tar.ts`, checked
      against the system `tar`; `shareFilesAsTar`). Not the `.db` file alone: on the emulator the `.db` file
      was 4 KB and its write-ahead log 190 KB, so the file alone would have held almost none of the data.
      Device test `db-unopenable` (emulator only; swaps the file for a text file and puts it back).
    - Nested `Db.transaction` calls are SAVEPOINTs: an inner step that throws undoes only its own writes,
      also when the caller catches the error (tests in `migrate.test.ts` and through `expoDb`).
    - The `db` device test failure at 115% (first T-010 run): cause found. `launch` returned as soon as the
      app's window existed; for some seconds that window shows only the dev client's Tools button while the
      bundle loads (measured: window at 8.6 s, tabs at 14.4 s on a cold Metro). The link was not lost (sent
      during loading it was acted on 3 times out of 3, later), but the test's next `launch` force-stopped the
      app before the save had run. It was never a database problem. Fix: `wait_for_app` waits for the app's
      own UI (the tab bar or the error screen), and `db` sends its link once and fails if the saved value
      does not show (no retry). `npm run device -- --no-build --only db --repeat 10`: 20 of 20 passed (10 at
      115%, 10 at 130%; 40 save, kill, restart cycles).
    - `--repeat N` added to the device runner.
  - Device runner fixes found on the way: a just-booted emulator could still show its keyguard, so the run
    stopped with "locked" (now asks up to 15 s; the phone is never unlocked); the first start after an
    install could still be loading when the `set` link arrived, so `db` now waits for the saved units on
    screen before the kill.

### T-011 `pit-legacy` module
- **Status:** done (see `git log --grep T-011`); device check passed 2026-11-12.
- **Goal:** read the 0.2.0 `CapacitorStorage` SharedPreferences from JS, once.
- **Files:** `modules/pit-legacy/` (`expo-module.config.json`, Kotlin module, TS API), JUnit tests.
- **Depends on:** T-003.
- **Approach:** `readCapacitorPrefs(): Record<string, string>` and `retireCapacitorPrefs()` (called only after
  the SQLite import commits; keeps a renamed copy until 0.4.0).
- **Acceptance:** returns the entries where they exist; an empty map otherwise.
- **Tests:** Robolectric: seeded prefs read back; none -> empty; retire keeps the copy.
- **Device testing (Jason):** none.
- **Notes (2026-11-12):**
  - `modules/pit-legacy`: `LegacyPrefs` (Kotlin; `read()`, `retire()`, `retired()`) and `PitLegacyModule`
    (`PitLegacy`: synchronous `readCapacitorPrefs`, `retireCapacitorPrefs`), package
    `io.github.mecheng70.pitplanner.legacy`. TS API `modules/pit-legacy/index.ts`; the app uses
    `legacyStore` (`src/platform/legacy.ts`, interface `LegacyStore` in `src/platform/types.ts`, so T-012's
    import takes a fake in tests).
  - `read` returns the string entries of the `CapacitorStorage` preferences and changes nothing; other value
    types and other preference files are left out. `retire` copies every entry to
    `CapacitorStorage.imported`, and only when that copy is committed empties the original; it returns false
    when there is nothing to retire, and a second call keeps the copy.
  - Tests: `LegacyPrefsTest` (Robolectric 4.16.1, the version expo-modules-core tests with; 9 cases), run by
    `npm run check` step 4 as `:pit-legacy:testDebugUnitTest`.
  - Device check (emulator, `npm run device -- --only db`, 115% and 130%): passed. The dev database screen
    shows `legacy prefs none`; with a `CapacitorStorage.xml` shaped like the Capacitor app's written into the
    dev build's data, a restart shows `legacy prefs gear, settings`; the file is removed again. Nothing calls
    `retire` on a device until T-012.
  - Memory (Jason, 2026-11-12; the first device run for this task was stopped by the system for low memory):
    - Cause: the emulator (4 GB guest) was open during the Gradle build, with a Gradle daemon at 5.8 GB and a
      Kotlin daemon at 2.1 GB. Gradle's heap was already capped at 2 GB; the rest was outside the heap (20
      workers on 20 cores, GC threads, code cache, direct buffers).
    - `plugins/withGradleMemory.ts` (pure `gradleMemory.ts`, tested) writes into the generated
      `gradle.properties`: `org.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=768m -XX:ReservedCodeCacheSize=256m
      -XX:MaxDirectMemorySize=512m -XX:ParallelGCThreads=4 -XX:ConcGCThreads=2`,
      `kotlin.daemon.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m` (same GC thread limits),
      `org.gradle.workers.max=6`, `org.gradle.daemon.idletimeout=600000` (10 minutes). Gradle is started with
      `MALLOC_ARENA_MAX=2` by the device runner, the Android tests and the release script.
    - Emulator: `avd.sh` starts it with `-memory 3072` every time (and creates new AVDs with 3072).
    - `npm run device` builds the APK first with no emulator running, runs `tools/stop-gradle.sh` (Gradle
      `--stop` and the Kotlin daemon; also with `--no-build`), then boots the emulator and installs.
    - Measured on the passing run (full debug build, then the test): Gradle daemon peak 2.6 GB, Kotlin daemon
      1.8 GB, emulator 4.4 GB, Metro 1.4 GB; the four together never above 5.6 GB (build and emulator no
      longer overlap); lowest available memory 8.8 GB of 30 with the desktop apps open (they held about 13 GB).
  - GPU (2026-11-13): `-gpu host` tried and dropped. The emulator picked the Intel Iris Xe (Mesa), not the
    NVIDIA RTX 4060. The app never opened ("did not open within 90s" on every launch): 0 passes, every test
    failed, over 45 minutes for one run. Software graphics (SwiftShader): all 14 results pass in 16 min 24 s.
    `avd.sh` stays on `swiftshader_indirect` (`EMU_GPU` overrides it for another try).
  - Re-run 2026-11-13 after a rebuild, emulator font scale reset to 100%: `npm run device -- --only db` passed
    at 115% and 130% (6 min 55 s with the build).

### T-012 Import from 0.2.0 and the fresh-start notice
- **Status:** done (see `git log --grep T-012`); upgrade from the real 0.2.0 APK passed on the emulator 2026-11-13.
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
- **Notes (2026-11-13):**
  - `src/db/legacyImport.ts`: `importLegacy(db, legacyStore, now)` runs in `app/_layout.tsx` after migrations
    and before the store loads, once (report saved in `kv.legacy_import`: `none`, `done`, `partial`, `fresh`).
    One transaction. Each key goes through the repositories' own validators; cookers are checked one by one,
    rates value by value. Anything unreadable is quarantined (`quarantine:legacy:<key>:<time>`) and named in
    the notice; unreadable `flags` and `update` are quarantined without a notice. A running cook is kept only
    when its serve time is ahead (alarms are rescheduled once T-015 exists).
  - Old files: retired only when everything came along (`done`): `CapacitorStorage` to
    `CapacitorStorage.imported`, `files/history.json` to `history.json.imported` (`LegacyStore` gained
    `readHistoryFile`, `retireHistoryFile`). On `partial` or `fresh` they stay where they are. If the write
    fails nothing is imported and nothing saved, so the next start tries again.
  - Notice: `ImportNotice` (kit Sheet, title "Pit Planner has a new look", one sentence, OK), shown once
    (`noticeSeen`). Copy from Jason (2026-11-13), in `NOTICE_BODY`: full import "Your smokers, cook rates,
    plan and history came over."; partial "Some of your old settings couldn't be read. Check Gear before your
    next cook."; fresh start "Your old data couldn't be brought over. Set up your smoker in Gear to start."
    A new install (no 0.2.0 data) shows nothing.
  - Tests: `src/db/legacyImport.test.ts` (fixture `src/db/fixtures/legacy020.ts`, plus a cook exactly as the
    0.2.0 app wrote it: `lateMin: null`, the save time as id), `ImportNotice.test.tsx`. The device fixtures in
    `tools/device/fixtures/legacy-020` are generated from the same fixture and checked by
    `legacy020.device.test.ts`.
  - Acceptance on the emulator: `tools/device/upgrade020.sh setup` installed the real
    `release/pitplanner-0.2.0.apk` and made the data in the app itself (Setup with Pit Boss 820, griddle and
    oven; brisket at 0.75 hr/lb saved for future and added to the plan; two cooks started, ended and saved to
    history; `tools/device/webview.mjs` drives the WebView over DevTools). `upgrade020.sh check
    release/pitplanner-0.3.0-alpha.2.apk` installed the alpha (versionCode 300002) over it: the
    app opened on its tabs with no notice; import `done`; three cookers, smoker Pit Boss 820; rate brisket
    0.75; one plan item; units F lb; two past cooks; nothing quarantined; both `.imported` copies kept. There
    are no Gear or History screens yet, so "everything shows" was checked in the database.
  - Notices: device test `legacy-import` (dev build, fixture files): everything readable, a corrupted gear
    entry and nothing readable each show their sentence, once.
  - The upgrade run above was made before the full-import notice existed (the app then opened with no
    notice). `upgrade020.sh check` now expects that notice; that line first runs in T-038.
  - Emulator leftovers removed with Jason's yes (2026-11-13): the release app with its test data, the data
    kept from T-007's alpha.1 install, and the files of the canceled `legacy-import` run.

---

## Phase 4: Alarm module

### T-013 `pit-alarms` Expo module (Kotlin port)
- **Status:** done (see `git log --grep T-013`); test alarm rang with the screen off on the emulator 2026-11-13.
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
- **Notes (2026-11-13):**
  - `AlarmStore`, `AlarmScheduler`, `Notifications` and `Receivers` are the 0.2.0 files with these changes
    only: the module cannot name the app's `MainActivity` or `R`, so the open and alarm-clock intents use the
    package's launch intent (`Notifications.launchIntent`) and `ic_stat_pit` lives in the module's own
    `res/drawable`; events go through `PitAlarmsModule.emit`; `drainActions` returns a list. Package, receiver
    class names and the `FIRE` / `NAG` / `DONE` / `SNOOZE` action strings are unchanged.
  - `PitAlarmsModule` (Expo `Module`, name `PitAlarms`): `setAlarms`, `cancelAll`, `acknowledge`, `setQuiet`,
    `testAlarm`, `getScheduled`, `drainActions`, `status`, `requestNotifications` (through Expo's permission
    manager; resolves with the status), `openSettings(which)` (one function for the four 0.2.0 settings
    calls); events `alarmFired`, `alarmAction`.
  - `setQuiet(until)`: see TECH-DESIGN section 6. The rule is pure (`Quiet.kt`: `active`, `defer`,
    `release`) with a JUnit test now (`QuietTest`, replaces the placeholder test); the scheduler, store and
    receiver tests are T-014.
  - Manifest: the module's `AndroidManifest.xml` has the three receivers and the permissions exactly as 0.2.0
    declared them (`USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` up to API 32, `VIBRATE`; TECH-DESIGN listed
    `WAKE_LOCK`, which 0.2.0 never had; TECH-DESIGN corrected).
  - JS: `modules/pit-alarms/index.ts` exports `pitAlarms`; `src/platform/alarms.ts` assigns it to
    `AlarmService` and `PermissionService`, so the typecheck proves the API matches. T-015 adds the wiring.
  - Device: dev route `pitplanner://dev/alarm` (`?test=20:x`; dev builds only, not an app screen) and
    device test `alarm` (emulator only): the alarm is stored, the screen is turned off, the
    notification is posted on `steps_v1`, and afterwards nothing is stored or repeating. Sound is not checked
    (the emulator runs without audio); the real phone is T-016.

### T-014 `pit-alarms` native tests
- **Status:** done (see `git log --grep T-014`)
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
- **Notes (2026-11-13):**
  - 41 tests in `modules/pit-alarms/android/src/test` (Robolectric 4.16.1, SDK 35), run by `npm run check`
    step 4 as `:pit-alarms:testDebugUnitTest`. `TestSupport.kt` (`AlarmTestBase`) reads what AlarmManager
    holds, delivers a scheduled alarm to its receiver through its own PendingIntent, and reads the shade.
  - `AlarmStoreTest`: round trip, actions drained once in order, `quietUntil`, unreadable text reads as
    nothing, device-protected storage, the one-time move from normal storage.
  - `AlarmSchedulerTest`: `replaceAll` sets exactly the new set with `setAlarmClock` and never patches
    (also the same set twice gives one alarm per step); past steps not scheduled; test alarms left alone;
    a step scheduled again stops repeating; `cancelAll`; restore after boot (stored alarms and repeats, a
    missed step rings at once and repeats, an overdue repeat rings 5 s after boot); Done for some keys of
    an alarm; +15; exact alarms denied gives an inexact alarm and `exact = false`; Quiet moves, holds and
    releases repeats.
  - `ReceiversTest`: a step rings with Done / +15 min / Open on `steps_v1` and starts repeating; the
    notification is not auto-cancel; six repeats 10 minutes apart with "N min past the step.", then "Cook
    needs you" once; test alarms do not repeat; a stale alarm does nothing; Done and +15 from the
    notification queue their action; a boot broadcast restores; the three receivers are in the manifest,
    not exported, direct-boot aware; a repeat that fires inside Quiet is held without ringing or counting
    (regression for the 0.2.0 gap); ids with odd characters survive the intent.
  - One production change for testability: the alarm code reads the time from `Clock.now()` (`Clock.kt`;
    the tests set `Clock.source`). Robolectric does not control `System.currentTimeMillis()`.
  - Robolectric's AlarmManager never refuses `setAlarmClock`, so the denied case uses a test shadow
    (`ExactAlarmsDenied`) that throws the `SecurityException` Android documents.
  - Not covered here (device only, T-016): sound, full-screen takeover at night, Doze, a real locked reboot.
    "Time steps app-only, temperature events HA-only" and "missing permission blocks Start cook" are JS
    invariants (engine tests, T-015, T-021).

### T-015 Alarm and permission services in JS
- **Status:** done (see `git log --grep T-015`)
- **Goal:** the `src/platform` implementations and app wiring: `syncAlarms` after every cook change, drain
  actions on start and resume, permission status, hidden debug screen (Gear version tapped 5 times).
- **Files:** `src/platform/alarms.ts`, `src/platform/permissions.ts`, `src/platform/fakes.ts`, `src/lib/cook.ts`,
  `app/debug.tsx`, tests.
- **Depends on:** T-010, T-013.
- **Acceptance:** an imported active cook (T-012) gets its alarms; the debug screen lists alarms and nags and
  fires any event in 10 s.
- **Tests:** Jest with fakes: one `replaceAll` per change (never patch); a drained Done applies once.
- **Device testing (Jason):** none.
- **Notes (2026-11-13):**
  - Sync is in the store (`src/lib/store.tsx`; `StoreProvider` takes `alarms`): `setCook` saves the cook and
    then replaces the phone's whole alarm set through `syncAlarms` (`cancelAll` when the cook ends). Syncs run
    one at a time and each reads the cook as it is when its turn comes, so the phone never ends on an older
    set. A units change with a cook running re-syncs (alert text follows the units). `state.alarmSync`
    (`ok`, `inexact`, `failed`) is there for the Cook screen's warning (T-021); nothing shows it yet.
  - `syncAlarms` now also calls `setQuiet` (the cook's `quietUntil`, or off), so Quiet holds native repeats.
  - `drainAlerts(resync)` (store) applies queued Done / +15 taps with `applyActions`; the phone hands them
    over once and a step already done is skipped, so a tap applies once. `useAlarmWiring`
    (`src/lib/alarmWiring.ts`, mounted in `app/_layout.tsx`) runs it at start (with `resync`: a cook gets
    its alarms back, e.g. one imported from 0.2.0), on resume (`src/platform/resume.ts`) and on a tap while
    the app is open; a change opens the Cook tab.
  - Beyond the task text: at start with no cook running, step alarms or repeats still on the phone are
    cleared (test alarms stay). Without it, a cook the import could not bring across would keep ringing
    from 0.2.0's stored alarms.
  - `src/platform/alarms.ts` (`alarmService`), `permissions.ts` (`permissionService`), `fakes.ts`
    (`fakeAlarms`, `fakeResume`). `scheduled()` in `AlarmService` now carries the `test` mark.
  - Debug screen: `src/screens/debug/DebugScreen.tsx`, route `app/debug.tsx` (`pitplanner://debug`): alert
    status, Send a test alert in 10 sec, every step of the cook (or the draft plan) with a 10 sec button,
    what is stored on the phone, notification taps (Read and clear), Cancel all alarms. The 0.2.0 screen's
    Allow rows (`AlertChecks`) come with T-025. **Not done here: the 5 taps on the Gear version.** Gear is
    still a placeholder with no version line; T-026 adds the line and the taps.
  - Tests: `src/test/alarmSync.test.tsx` (store and wiring over a real database and the fake, including the
    0.2.0 import fixture), `src/screens/debug/DebugScreen.test.tsx`. Device: `legacy-import` checks the
    imported cook's alarms are stored on the phone and gone once the database without a cook is back; `alarm`
    opens the debug screen and rings its test alert.

### T-016 Device alarm tests on the Expo build
- **Status:** todo
- **Goal:** re-run `docs/alarm-testing.md` on the dev build: Doze, screen off, locked reboot, app update, time
  zone change, notification actions with the app dead.
- **Files:** `docs/alarm-testing.md` (Expo results), `tools/device/flows/alarms.yaml`.
- **Depends on:** T-015, T-006.
- **Acceptance:** every row passes, including a locked reboot ringing on time.
- **Tests:** any failure gets a regression test in T-014's files.
- **Real phone:** yes: alarms through Doze and a locked reboot need the real phone and its OEM power management.
- **Device testing (Jason):** unlock after the reboot step when asked; leave the phone idle for the Doze step.
- **Added by Jason (2026-11-13):**
  1. **Upgrade with a live cook.** Start a cook in 0.2.0 with alarms pending, install the new build over it,
     and confirm each alarm fires once, on time, with no duplicates from the old alarms plus the rescheduled
     ones. Emulator first (`tools/device/upgrade020.sh`: start a cook and leave it running, read
     `dumpsys alarm` before and after the install, then let the steps ring); the real phone in T-038. What
     to look at: 0.2.0's `pit_alarms` store is read by the same `AlarmStore` (same name, device-protected
     storage); `MY_PACKAGE_REPLACED` reschedules from it; the import (T-012) brings the cook across and T-015
     reschedules from `plan.events` with `replaceAll`, which cancels the stored set first. The alarm ids and
     PendingIntents are the same in both builds, so a second schedule should replace, not add: the test proves it.
  2. **Exact-alarm permission: findings and proposal (no manifest change made).**
     - Now: target SDK 36, min 24. The merged manifest declares `USE_EXACT_ALARM` and `SCHEDULE_EXACT_ALARM`
       with `android:maxSdkVersion="32"`, the same as 0.2.0, so a fresh install and an upgrade from 0.2.0
       hold the same permissions.
     - `SCHEDULE_EXACT_ALARM` on Android 14 and later: "is no longer being pre-granted to most newly installed
       apps targeting Android 13 and higher (will be set to denied by default)"; on a device upgrade "If an
       existing app already has this permission, it'll be pre-granted when the device upgrades to Android
       14."; after backup and restore "the permission will still be denied."
       (https://developer.android.com/about/versions/14/changes/schedule-exact-alarms). The pages read say
       nothing about an in-place app update, and nothing specific to Android 15 or 16.
     - `setAlarmClock` needs it: "apps targeting SDK level 31 or higher need to request the
       `SCHEDULE_EXACT_ALARM` permission to use this API"
       (https://developer.android.com/reference/android/app/AlarmManager); without it a `SecurityException`
       (the scheduler already falls back to `setAndAllowWhileIdle` and reports `exact: false`).
     - `USE_EXACT_ALARM` (API 33+): "will be granted on install" (same Android 14 page); the alarms guide
       lists it as "Granted automatically" and "Cannot be revoked by the user", "Subject to an upcoming
       Google Play policy", "Limited use cases"
       (https://developer.android.com/develop/background-work/services/alarms/schedule). The reference says
       "This is only intended for use by apps that rely on exact alarms for their core functionality", "only
       one of `USE_EXACT_ALARM` or `SCHEDULE_EXACT_ALARM` should be requested on a device", and shows
       `SCHEDULE_EXACT_ALARM` with `android:maxSdkVersion="32"` beside it
       (https://developer.android.com/reference/android/Manifest.permission). Nothing in the docs covers apps
       distributed outside Google Play; the limit named is a Play policy, which does not apply to a sideloaded APK.
     - So on Android 14, 15 and 16, fresh install or upgrade, the app holds `USE_EXACT_ALARM` from install and
       the user cannot turn it off; the denied-by-default rule for `SCHEDULE_EXACT_ALARM` never applies
       because that permission stops at API 32. On Android 12 and 12L the app uses `SCHEDULE_EXACT_ALARM`,
       which the user can revoke (the red banner and the settings link cover that).
     - Seen on the emulator (API 36, fresh install of the dev build): `exact alarms on`, `setAlarmClock`
       accepted. The docs do not say what `canScheduleExactAlarms()` returns with only `USE_EXACT_ALARM`.
     - **Proposal: keep the manifest as it is.** It is the pattern the reference shows, and Pit Planner's
       core function is timed alarms. If it ever goes on Play, `USE_EXACT_ALARM` needs a policy review.
       To check in this task: `dumpsys package` shows `USE_EXACT_ALARM` granted after a fresh install and
       after the upgrade from 0.2.0 (emulator API 36, then the phone).
     - **Approved by Jason (2026-11-13):** keep the manifest; confirm with `dumpsys package` in this task.
       No Android 14 or 15 images for now (see T-037 for the testers' versions).

---

## Phase 5: Plan tab (mockups 04-08)

### T-017 Plan: empty and main (04, 05)
- **Status:** todo
- **Goal:** Plan tab as in mockups 04 and 05: Ready by / Start at with date and time pickers, smoker temp field
  with fire time, food cards, Add food, tiles (fire, pellets, conflicts), pinned Start cook, share icon.
- **Files:** `app/(tabs)/plan.tsx`, `src/screens/plan/PlanScreen.tsx`, `src/screens/plan/PlanEmpty.tsx`, tests,
  `docs/fidelity/rn-04-*.png`, `rn-05-*.png`.
- **Depends on:** T-005, T-010.
- **Draft notice (Jason, 2026-11-12):** when `state.draftLost` is true (a saved plan could not be loaded) Plan
  shows the kit `Banner` (warn) "Your saved plan could not be loaded." (`DRAFT_LOST`, today in the T-002
  placeholder with its tests); it goes away when the plan is changed. Keep it and its tests in the real screen;
  it must not sit above a control in a way that breaks PR-3 when it disappears.
- **Acceptance:** at 115% three cards and Add food fit above Start cook, two at 130% (HANDOFF decision).
- **Tests:** RNTL: empty state actions; cards show start time and time on heat from `buildPlan`; tile values;
  Start cook disabled with no food.
- **Device testing (Jason):** compare with mockups 04-05 on the phone.
- **Requirements (pass/fail; Jason's T-004 review, 2026-11-12):**
  - **PR-1 Smoker temp is the dropdown.** One field showing the temp and the fire time (mockup 05), opening the
    temp menu (T-018) in the cooker's own steps: 5F on the Sportsman 850 (SPEC section 1 "Smoker temp", section
    3 "Plan"). Fail: any preset temp buttons or chips anywhere on Plan.
  - **PR-2 Every food card has its cooker icon.** The avatar shows the icon (mockup 05: flame on ember for the
    smoker, griddle on blue) at 100%, 115% and 130%. Fail: an empty or missing avatar at any scale.
  - **PR-3 Changing a value never moves what you are tapping.** A stepper tap, temp choice, chip or mode toggle
    leaves the tapped control and everything above it where it was. Computed values (times, durations, temps,
    weights, pellets) use `Num` with tabular digits; rows that show computed values reserve a fixed height per
    font scale; warnings and info appear below the control or in the Conflicts tile, never above it; no
    automatic scrolling after a change. Fail: the T-006 `stable-controls` flow reports a moved bound at 115% or
    130%.
    - Selected chips and toggles reserve their bold width (Jason, 2026-11-12): the T-006 run found the spike's
      temp chips and Ready by / Start at toggle shift 5 to 7 px when selected, because the selected label is
      medium weight and wider. Each chip is as wide as its label in the selected weight whether selected or not
      (for example an invisible medium-weight copy of the label sizing the chip, the visible label over it), so
      selecting one moves nothing.
    - Scrolled to the bottom, content that shrinks below a control (a warning going away) makes the view clamp
      and jump (Jason's T-004 review; T-006 `spike-bottom` reproduces it: 188 px at 130%). Add Plan targets
      with start `bottom` to `tools/device/targets.tsv`; the fix keeps the content from getting shorter while
      the user is changing values (for example reserve the warning's line, or keep a minimum content height).
      Fail: a `bottom` target reports a move.
  - **PR-4 The tiles are equal width.** Fire smoker, Pellets and Conflicts share the row in equal thirds
    (mockup 05) at 100%, 115% and 130%, whatever their values. Try `flex: 1` (with `flex-basis: 0`) on each
    tile before measuring anything. Fail: any two tiles in the row differ in width by more than 1 dp
    (`uiautomator dump` bounds), or a tile value is cut (Jason, 2026-11-12).

### T-018 Smoker temp menu, Add food, Issues sheet (06, 07)
- **Status:** todo
- **Goal:** temp menu with settable temps and fire times, Show all and the outside-200-300F warning; food
  picker with search and groups; conflicts sheet with fixes (move to griddle, change temp, finish earlier).
- **Files:** `src/screens/plan/TempMenu.tsx`, `FoodPick.tsx`, `IssuesSheet.tsx`, tests, fidelity PNGs.
- **Depends on:** T-017.
- **Acceptance:** only settable temps offered (failure mode 12); each fix changes the plan; PR-1 and PR-3 (T-017)
  hold: the temp field stays put after a choice.
- **Tests:** RNTL per sheet (search filters, temps from `settableTemps`, a fix applies).
- **Device testing (Jason):** none beyond the screenshots.

### T-019 Food details (08, 09, 10)
- **Status:** todo
- **Goal:** quantity, cooker chips (missing cookers disabled with "Add in Gear"), method, options, rest, Timing
  (three models for by-weight foods, Standard/Total hours otherwise, "Use for future"), live result card.
  PR-3 (T-017) applies to every stepper (quantity, hr/lb, total hours) and chip: no automatic scrolling after a
  change. Result (Jason, 2026-11-12): a fixed-height summary bar pinned at the bottom, above the tab bar, showing
  fire, off heat and serve; the full result card stays in the scroll; tapping the bar scrolls to the full card
  (the only scroll, and the user starts it). The bar meets PR-3: fixed height at each font scale, tabular
  digits, no layout shift when its values change.
- **Files:** `src/screens/plan/FoodEdit.tsx`, `src/components/kit/ResultBar.tsx`, tests, fidelity PNGs 08-10,
  SPEC.md section 3 "Food details" (add the summary bar).
- **Depends on:** T-017.
- **Acceptance:** the T-001 checklist (HANDOFF) holds on the new UI; 12 lb brisket at 0.75 hr/lb shows 9 hr
  and fire 6:20 AM for a 5:00 PM serve; the T-006 `stable-controls` flow passes on Food details at 115% and
  130% (hr/lb + five times, - five times). The summary bar keeps its height and position while hr/lb changes, and tapping it brings
  the full result card into view.
- **Tests:** RNTL versions of the nine legacy FoodEdit cases (three/two models, source line, saves, hint once,
  result card text).
- **Device testing (Jason):** add brisket, set 0.75, read the result card at his usual font size.

### T-059 Whole turkey in `data/foods.json`
- **Status:** todo
- **Goal:** whole turkey on the smoker, planned and learned like every other food (Jason, 2026-11-12).
- **Files:** `data/foods.json`, `engine/rules.ts` (schema: sources, a minimum smoker temp per method, a size
  warning), `engine/plan.ts` (issues), `engine/rules.test.ts`, `engine/plan.test.ts`, kit icon in
  `src/components/kit/icons.tsx` (or the food-icon set PR-2 uses), SPEC.md section 3 if behavior is added.
- **Depends on:** T-019 (Food details shows the rate, warnings and the icon).
- **Requirements (pass/fail):**
  - **Sources.** Every food-safety number (done temp, smoker temp floor, size limit, any time or rate)
    cites a primary source: the current USDA FSIS page, by URL, page title and its "last updated" date, with
    the sentence quoted, in a `sources` entry on the food in `foods.json`. No blogs. `rules.test.ts` fails if
    turkey has a food-safety number without a source. The starting rate also cites its source; if FSIS gives
    no smoking rate, ask Jason which source to use before picking one.
  - **Smoker temp no lower than 225F** for turkey. A plan with turkey on the smoker below 225F reports an
    issue (Conflicts tile and Issues sheet, as other conflicts do); the temp is never changed silently.
  - **Done at 165F.** No stuffed option (no choice for it anywhere).
  - **Size warning, not a block.** Above the FSIS size limit for smoking a whole turkey, Food details shows a
    warning and the plan still builds. Sources conflict (12 or 16 lb), so the limit comes from the FSIS page
    itself, quoted and cited in `sources`; the warning text names the limit.
  - **Rate.** A starting hr/lb at 225F with its cited source; adjustable in Food details like every other food
    (stepper, total hours, "Use for future") and learned from logged cooks the same way (`learning` in
    `foods.json`). No turkey-specific code paths for timing.
  - **Icon** in the 0.2.0 style (PR-2): line icon, 24 dp grid, 2 dp stroke, on the food avatar; checked on the
    phone at 100%, 115% and 130%.
  - **Engine tests:** turkey on the smoker below 225F gives the issue and at 225F does not; above the size
    limit gives the warning and still builds a plan; a 12 lb turkey plan at 225F has the expected time on heat
    (rate x 12, plus rest), fire time and pull at 165F.
  - Any UI element not in the mockups (for example a new kind of warning row) needs Jason's yes first. The
    existing patterns to reuse: the warn-tone caption under a control (0.2.0 "Unusual rate") and the Issues
    sheet.
- **Note (2026-11-12):** fsis.usda.gov refuses automated fetches (HTTP 403 for "Turkey: Alternate Routes to
  the Table", "Smoking Meat and Poultry" and "Let's Talk Turkey"). Open the pages in a browser (Claude in
  Chrome or Jason pastes them) and quote from there. No turkey numbers are in this plan on purpose: none could
  be cited yet.
- **Tests:** engine (above), `rules.test.ts` sources check, RNTL for the warning and the icon.
- **Device testing (Jason):** add a 12 lb turkey and an 18 lb turkey at 225F; read the warning wording and
  the icon at 100/115/130%; compare with the FSIS quote in `foods.json`.

### T-058 Survive font-size changes and process death
- **Status:** todo
- **Goal:** changing the system font size never rebuilds the screen, and the active cook, the selected tab and
  unsaved edits survive the app being killed in the background (Jason, 2026-11-12, after the T-004 finding: a
  font-size change recreated the activity and the app came back on Plan with its UI state lost).
- **Files:** `plugins/withFontScaleConfigChange.js` (+ test), `app.config.ts`, `src/lib/uiState.ts` (+ tests),
  `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, the Food details and Plan draft screens, `tools/device/flows/
  survive.yaml`, `docs/HANDOFF.md`.
- **Depends on:** T-006, T-010, T-019. **Before:** T-021 (the Cook screen).
- **Approach:**
  - (a) A config plugin adds `fontScale` to the main activity's `android:configChanges`, so Android hands the
    change to the running activity instead of recreating it. Text must still resize live: confirm React Native
    picks up the new scale (`useWindowDimensions().fontScale`); if it does not, re-render the root on a
    fontScale change, never recreate the activity.
  - (b) The active cook is already in SQLite (`active_cook`, T-008). The selected tab, the open route (including
    which food Food details is editing) and unsaved edit drafts (Food details form, Plan draft) are written to
    `kv` on every change and restored before the first render (splash held until loaded). A draft whose food
    no longer exists is dropped.
- **Acceptance (pass/fail):**
  - Font size changed in Settings with the app open on Gear, and mid-cook on Cook: same activity (no new
    `Running "main"` in logcat), same tab and screen, Next up and countdown unchanged, text visibly resized
    within 1 s; nothing truncated at 130%.
  - "Don't keep activities" on (Developer options): leave Food details with an unsaved hr/lb change, open
    another app, come back: same tab, same screen, the unsaved value still there.
  - Process killed in the background (`adb shell am kill`): the active cook comes back with the same Next up;
    `dumpsys alarm` for the app is the same before and after; the selected tab is restored.
- **Tests:** Jest: `uiState` save/restore round trip against `better-sqlite3`; a draft for a deleted food is
  dropped; the config plugin adds `fontScale` (manifest fixture). Device flow `survive.yaml` runs the three
  acceptance checks at 115% and 130% and turns "Don't keep activities" back off at the end.
- **Device testing (Jason):** (1) With Developer options > "Don't keep activities" on, change hr/lb on Food
  details, switch to another app and back. Judge: same screen, same tab, the changed value still shown, compared
  with what was on screen before switching. Turn the option off afterwards. (2) During a test cook on Cook,
  change Settings > Display > Font size to the largest and back. Judge: the app stays on Cook with the same Next
  up and countdown and the text resizes, compared with a screenshot taken before the change.

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
- **Depends on:** T-015, T-019, T-020, T-058.
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
- **Real phone:** yes: the alert on the real lock screen and its notification actions.
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
- **Real phone:** yes: the test alert in Doze and the OEM battery help (OnePlus; a Samsung if available).
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
- **Real phone:** yes: two real phones and real Gmail/Drive accounts.
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
- **Real phone:** yes: the install guide on his wife's phone.
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
- **Files:** `src/db/export.ts` (the dump exists since T-010: every table, raw, including quarantine rows; this
  task adds reading it back), `src/screens/gear/GearScreen.tsx`, tests.
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
- **Real phone:** yes: the real Saturday cook with alarms.
- **Before 0.3.0 ships (Jason, 2026-11-13):** run the `alarm` device test once on an emulator image matching
  each Android version the testers actually use, if any is below 16. Jason gives the list of versions;
  `tools/device/avd.sh` needs an image and AVD per version (it is fixed to API 36 today).
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
  The emulator upgrade test checks the imported cookers, rates, plan and history on the actual Gear, Plan and
  History screens, not only in the database (Jason, 2026-11-13; T-012 could only check the database).
  Upgrade with a live cook on the real phone (Jason, 2026-11-13; emulator run in T-016): a cook started in
  0.2.0 with alarms pending, 0.3.0 installed over it, each alarm fires once and on time, none twice; and
  `USE_EXACT_ALARM` is still granted after the upgrade.
- **Tests:** `npm run check` at the tagged commit.
- **Real phone:** yes, after the emulator: 0.3.0 over 0.2.0 with Jason's real data.
- **Device testing (Jason):** optional safety copy first (HANDOFF backup route); install 0.3.0 over 0.2.0;
  check Gear, Cook rates and history.

### T-039 Remove `legacy/`
- **Status:** todo
- **Goal:** delete the Capacitor reference code once 0.3.0 has been out a week with no rollback.
- **Files:** `legacy/**`, `.semgrepignore`, `.snyk`, `.prettierignore`, docs that mention it,
  `src/theme/tokens.test.ts` (it reads `legacy/src/ui/ui.css`: freeze the expected values in the test first).
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
- **Real phone:** yes: HA sign-in on the phone on the home network.
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
- **Real phone:** yes: Bluetooth probes through HA, awake and asleep.
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
- **Real phone:** yes: two real probes.
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
- **Real phone:** yes: a real probe in hot water.
- **Device testing (Jason):** probe in hot water; unplug it; grey after 2 min.

### T-051 Publish `sensor.pit_planner_cook` (HA Phase 2)
- **Status:** todo
- **Goal:** HA-INTEGRATION 3.1: publish on Start cook, each change, End cook, app open, and every 10 min while
  open.
- **Files:** `src/lib/ha/publish.ts`, attributes builder in `engine/probe.ts`, tests.
- **Depends on:** T-050.
- **Acceptance:** no tokens or personal data in the attributes.
- **Tests:** builder unit tests; publish schedule with fake timers.
- **Real phone:** yes: a real cook publishing to HA.
- **Device testing (Jason):** watch the sensor in HA during a short cook.

### T-052 HA blueprint
- **Status:** todo
- **Goal:** `blueprints/pit_planner_cook_watcher.yaml` (HA-INTEGRATION 3.2) and `docs/HA-BLUEPRINT.md`.
  Claude writes files only and never changes HA through MCP.
- **Files:** as named.
- **Depends on:** T-051.
- **Acceptance:** Jason imports it; the hot-water test notifies at the wrap target.
- **Tests:** a node:test that parses the YAML and checks inputs and triggers.
- **Real phone:** yes: the blueprint with a real probe.
- **Device testing (Jason):** import and hot-water test.

### T-053 Probe suggestions and pit-drop prompt (HA Phase 3)
- **Status:** todo
- **Goal:** Next up offers "Brisket hit 166F" with Done (never auto-done); a pit drop offers "Pit went out?".
- **Files:** `engine/probe.ts` (`suggestion`), `src/screens/cook/CookScreen.tsx`, tests.
- **Depends on:** T-050.
- **Acceptance:** suggestions only for the mapped probe and the current check step.
- **Tests:** engine and RNTL.
- **Real phone:** yes: hot-water test with a real probe.
- **Device testing (Jason):** hot-water test.

### T-054 Probe times feed rate learning
- **Status:** todo
- **Goal:** use the time the probe reached the pull target instead of the button tap when available.
- **Files:** `src/lib/finish.ts`, tests.
- **Depends on:** T-053.
- **Acceptance:** Cook finished says which time was used.
- **Tests:** new finish cases.
- **Real phone:** yes: a real cook with a probe.
- **Device testing (Jason):** a real cook with a probe.

### T-055 Confirmed set-temp button (HA Phase 4, optional)
- **Status:** todo (Jason opts in)
- **Goal:** "Set smoker to 400F" on the wings step, confirm required, only while the grill is running; never
  ignition, power or automatic.
- **Files:** `src/lib/ha/control.ts`, `src/screens/cook/CookScreen.tsx`, tests.
- **Depends on:** T-053.
- **Acceptance:** refuses when the grill is off.
- **Tests:** guard unit tests; RNTL confirm.
- **Real phone:** yes: the real grill running.
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
