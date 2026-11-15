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
  - Release builds (Jason, 2026-11-13): the screen opens only from the 5 taps, never from a
    `pitplanner://debug` link. `src/lib/debugPass.ts`: the taps call `grantDebugPass()` and then open the
    route; `DebugGate` takes the pass as the screen opens (used up, so a later link is refused) and
    otherwise sends the route to Plan. Dev builds keep the link. Tests: `DebugGate.test.tsx`.
  - Tests: `src/test/alarmSync.test.tsx` (store and wiring over a real database and the fake, including the
    0.2.0 import fixture), `src/screens/debug/DebugScreen.test.tsx`. Device: `legacy-import` checks the
    imported cook's alarms are stored on the phone and gone once the database without a cook is back; `alarm`
    opens the debug screen and rings its test alert.

### T-016 Device alarm tests on the Expo build
- **Status:** emulator half done (`b9b5d7d`); phone half blocked until Jason says his Saturday cook
  (2026-11-14) is done. Until then nothing runs against the phone: no adb commands, no installs, no reads
  (Jason, 2026-11-13). `tools/device/PHONE-BLOCKED` makes the device tools refuse it; only Jason lifts it.
  A task that needs the phone skips that step and notes it.
- **Goal:** re-run `docs/alarm-testing.md` on the dev build: Doze, screen off, locked reboot, app update, time
  zone change, notification actions with the app dead.
- **Files:** `docs/alarm-testing.md` (Expo results), `tools/device/flows/alarms.yaml`.
- **Depends on:** T-015, T-006.
- **Acceptance:** every row passes, including a locked reboot ringing on time.
- **Tests:** any failure gets a regression test in T-014's files.
- **Real phone:** yes: alarms through Doze and a locked reboot need the real phone and its OEM power management.
- **Device testing (Jason):** unlock after the reboot step when asked; leave the phone idle for the Doze step.
- **Emulator half, done 2026-11-13** (results table in `docs/alarm-testing.md`):
  - Upgrade with a live cook: real 0.2.0, a wings cook started with its Start cook button (six alarms),
    `0.3.0-alpha.3` installed over it. The alarms came back without opening the app, the opened app replaced
    the set with none doubled, and each step that came due rang once, at most 101 ms late.
  - With the app dead: Done and +15 min on the notification; both applied once when the app opened.
  - Time zone change, app update and reboot with alarms pending: all registered again at the same instants.
  - `USE_EXACT_ALARM`: `granted=true` in `dumpsys package` under 0.2.0, after the upgrade and on the dev build.
  - Doze: see "How Doze treats these alarms" in `docs/alarm-testing.md`. Android 16 will not enter deep idle
    within an hour of an alarm clock, so the forced-idle check works on the emulator only (window shortened
    as root). The `alarm` device test now includes it.
  - **Does `adb shell dumpsys deviceidle force-idle` reach deep idle despite the one-hour alarm-clock rule?
    No** (asked by Jason; emulator only, API 36, dev build off the battery allowlist, battery reported
    unplugged, screen off, `min_time_to_alarm=+1h0m0s0ms`, 2026-11-13):
    - No alarm clock pending: "Now forced in to deep idle mode", state `IDLE`, still `IDLE` 10 s later.
    - An alarm clock 65 minutes out (outside the window): forced in, `IDLE`, still `IDLE` 20 s later.
    - An alarm clock 2 minutes out: "Unable to go deep idle; stopped at INACTIVE". The alarm rang on time.
    - Forced idle first, then an alarm clock set 60 s out: the state went from `IDLE` to `INACTIVE` within
      5 s of setting it. The alarm rang on time.
    So inside the hour before an alarm clock the device cannot be put, or kept, in deep idle; the command
    obeys the same rule as the system. A forced-Doze check on the phone with a test alarm a minute out can
    only show "screen off, unplugged, off the allowlist". To have a step come due in deep idle it must be
    set more than an hour ahead and the phone left idle that long: the Saturday cook (T-037) does that.
    Not run on the phone.
  - Tools added: `upgrade020.sh live` and `alarms`; dev route `pitplanner://dev/alarm?cook=3` (a short test
    cook through the store, for the phone, where there is no Start cook screen yet) and `?cook=end`.
  - `tools/device/flows/alarms.yaml` (named in Files) was not written: the checks need adb and `dumpsys`,
    not screen taps, so they live in `upgrade020.sh` and the `alarm` test of `run.sh`.
  - The release test app was uninstalled from the emulator with Jason's yes (2026-11-13).
- **Phone list approved by Jason (2026-11-13), dev copy only:** read-only check that the real app has no
  alarms (it has: stop and ask); back up the dev copy's data; `adb install -r` the dev build twice (second
  time with alarms pending); heads-up off and stay-awake on during the run, the dev copy off the battery
  allowlist for the Doze step, each put back; forced Doze about 3 minutes with a test alarm 60 s out (on
  Android 16 this will not reach deep idle: see `docs/alarm-testing.md`); one `adb reboot` with a step about
  5 minutes out, Jason present and the phone left locked until asked; Jason taps Done and +15 min himself;
  the shade is never read; no time zone or font change; at the end the data restored, test alarms and
  notifications cancelled. The test cook comes from `pitplanner://dev/alarm?cook=3`.
- **Before the real phone is touched (Jason, 2026-11-13):** list exactly what will be done to it (Doze
  forcing, reboots, settings changes, installs) and what will be restored, and wait for his yes. Any reboot
  needs him present to unlock.
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
- **Status:** gate-complete 2026-11-14 (`npm run check` passed with Snyk back up, all six steps; anything below about
  Snyk being down is history). done (see `git log --grep T-017`); Jason's review fixes done 2026-11-13 (notes "Review fixes"
  below), new screenshots approved by Jason 2026-11-14 (the Add food fade at 100% included). 115% fit target set by
  Jason 2026-11-14: two cards whole, the third may end in the fade, Add food by scrolling; met (numbers
  below). Closed on the emulator. His phone check (compare with
  mockups 04-05) waits until the phone is free again (T-016 hold).
- **Goal:** Plan tab as in mockups 04 and 05: Ready by / Start at with date and time pickers, smoker temp field
  with fire time, food cards, Add food, tiles (fire, pellets, conflicts), pinned Start cook, share icon.
- **Files:** `app/(tabs)/plan.tsx`, `src/screens/plan/PlanScreen.tsx`, `src/screens/plan/PlanEmpty.tsx`, tests,
  `docs/fidelity/rn-04-*.png`, `rn-05-*.png`.
- **Depends on:** T-005, T-010.
- **Draft notice (Jason, 2026-11-12):** when `state.draftLost` is true (a saved plan could not be loaded) Plan
  shows the kit `Banner` (warn) "Your saved plan could not be loaded." (`DRAFT_LOST`, today in the T-002
  placeholder with its tests); it goes away when the plan is changed. Keep it and its tests in the real screen;
  it must not sit above a control in a way that breaks PR-3 when it disappears.
- **Acceptance:** at 115% and at 130% two cards fit whole above Start cook and its fade; at 115% the third
  card may end in the fade and Add food is reached by scrolling (Jason, 2026-11-14; it replaces "three cards
  and Add food at 115%", which a real-size display cannot hold now that summaries wrap). These apply on the
  real-size emulator with gesture navigation and with 3-button navigation.
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

- **Notes (2026-11-13):**
  - `src/screens/plan/PlanScreen.tsx` (a port of the 0.2.0 screen), `PlanEmpty.tsx`, route
    `app/(tabs)/plan.tsx`. The T-002 placeholder and its tests are gone; the draft-lost notice and its tests
    moved to the real screen.
  - **What opens from Plan arrives as a handler prop and is not wired yet**, so these controls show and do
    nothing until their task: the smoker temp field, Add food and the Conflicts tile (T-018), a food card
    (T-019), Start cook (T-021), Cook a past plan again (T-028), the share icon (T-029). Working now: Ready by
    / Start at (keeps the schedule), the date and time (system dialogs), everything computed from the plan.
  - Date and time: `@react-native-community/datetimepicker`, used only in `src/platform/dateTime.ts`
    (`PickDateTime` in `types.ts`; the screen gets it as a prop). The dev build must be rebuilt for it.
  - Kit added or changed: `Screen` and `AppBar` (`kit/screen.tsx`), `SelectField`, `FooterScroll fill`
    (a screen body; its footer uses 0.2.0's `.screen-foot` spacing), `Tiles equal`, each `Tile` one
    accessibility element read as "label value", and `Chips` sized by an unseen copy of the label in the
    selected weight.
  - PR-1: the smoker temp is one `SelectField` ("225F", "Fire 6:20 AM", chevron); a test checks the only
    radios on Plan are the mode toggle. PR-2: the cooker avatar is in every card (Jest by test id; seen in
    the screenshots at 100%, 115%, 130%). PR-3: values are `Num`; nothing shows above a control; the
    draft-lost notice keeps its space after it goes away; Plan targets added to `targets.tsv` (`plan`,
    `plan-bottom`). PR-4: `Tiles equal` (`flex: 1`, basis 0); device test `plan` measures the three widths.
  - Draft notice: it can only show on the empty plan (a lost draft starts empty). It sits under the date
    card; when the plan is changed it turns invisible but keeps its height while the tab stays open.
  - Acceptance on the emulator (`npm run device -- --only plan`): at 115% three cards and Add food end above
    Start cook; at 130% two cards do (in fact three: see the next point); tiles equal within 1 dp at 100%,
    115%, 130%; the date dialog and the time dialog open and return to Plan.
  - Font scale: Android scales large text less than small text above 100% (non-linear font scaling, Android
    14 and later), and React Native follows it; 0.2.0's WebView scaled everything by the same factor. So at
    130% the date line stays on one line and more fits than in 0.2.0's 130% screenshots.
  - Emulator: its gesture bar takes 24 dp at the bottom that Jason's phone does not lose (0.2.0 and T-002
    screenshots show the tab bar flush with the bottom). With it, Add food ended 7 dp under Start cook at
    115%, although every block measured the same as in 0.2.0. `avd.sh start` now makes the emulator's
    display taller by exactly that strip (`wm size`), so apps get the phone's 792 dp. **To confirm on the
    phone when it is free.**
  - Found and fixed on the way (each with a test that failed first): the selected tab's pill was a box
    (`rounded-2xl` is not in the theme; gate test `tools/radius-classes.test.mjs`); a saved item whose food
    or method the rules do not have crashed the screen (now its card shows the stored id and "Not in this
    version of Pit Planner", the plan error shows, Start cook is off); Start at with no first step (a smoker
    food, no smoker) set an invalid time.
  - Dev only: `pitplanner://dev/plan?seed=mockup` (mockup 05's menu) and `?seed=empty`; on the emulator the
    dev client's floating tools button is turned off (it covered the share icon).
  - Fidelity: `docs/fidelity/rn-05-plan.png` and `rn-04-plan-empty.png` (emulator, 100%, 115%, 130%).
  - Differences from mockup 05 that come from the rules data and the engine, not the screen: the breasts card
    reads "4, griddle, pounded" (mockup: "4, pounded, griddle") and Pellets reads "~17 lb" (mockup: "~18 lb").
    Cook a past plan again is dimmed while there is no past cook (as in 0.2.0; the mockup shows it lit).
  - Device tests changed for Plan: `stable-controls` targets that start at the bottom scroll up to a control
    that is off screen; the `alarm` test empties the plan before it opens the debug screen (a menu's steps
    pushed its buttons off screen). The whole device suite passes on the taller emulator display.
- **Review fixes (Jason's T-017 review, 2026-11-13):**
  - Approved: the line "Not in this version of Pit Planner" (`UNKNOWN_ITEM`).
  - Not approved: the emulator display made 24 dp taller. Undone: `avd.sh` never sets a display size (it
    resets the override the AVD still held; gate test `tools/device/avd.test.mjs`). The emulator is
    1080x2376 at 480 dpi (360x792 dp) with gesture navigation and its 24 dp bar. The notes above that
    mention the taller display are history.
  - Card summaries wrap to a second line instead of being cut (`Text clamp={2}`; a third line would be cut).
    Times and durations are `Num`, in a fixed column, never wrapped or shrunk. The time stays on the name's
    line and the duration on the summary's first line (the card's two columns start at the top).
  - Nothing half-shows behind the pinned button: the kit footer fade (`FOOT_FADE` in `kit/sheet.tsx`, every
    `Screen` and `Sheet` footer) is 32 dp, fading over its first 24 dp and solid for the last 8 dp before
    the button (it was 14 dp and the tile tops showed in it). Taps in the fade reach what is under it. The
    scroll content ends where the fade starts, so at the end of the list nothing is dimmed (the tiles end 34
    dp above Start cook; before 32). The tiles cannot fit whole above Start cook as in mockup 05: the mockup
    is 844 dp tall with no system bars; the display gives the app 725 dp at 100% (792 less a 43 dp status
    bar and the 24 dp gesture bar) and the content needs about 810 dp.
  - Found on the device: with no footer, the fade at the end of a body (24 dp) was taller than the space
    under the content (16 dp) and dimmed the bottom edge of the last control (Add food on the empty Plan
    once the button below it was hidden). It is 16 dp now.
  - Cook a past plan again: not shown with no past cook; the accent text button of mockup 04 with one. Noted
    in T-028, which wires it. Dev seed `pitplanner://dev/plan?seed=past` (one past cook with a fixed id;
    the other seeds take it away again).
  - Device tests: `plan` reports the room of each card and Add food above Start cook's fade and counts a
    control as fitting only when it ends above the fade; new `plan-3button` runs the same fit check with
    3-button navigation (48 dp bar; emulator only, the mode is put back).
    The whole device suite on the real-size display (2026-11-13): everything passes except `plan` and
    `plan-3button` at 115% (the fit target below).
  - Fidelity (emulator, real size): `docs/fidelity/rn-05-plan.png` (100%, 115%, 130%, tiles at 115%),
    `rn-05-plan-3button.png` (100%, 115%, 130%), `rn-04-plan-empty.png` (no past cook at 100%, 115%, 130%;
    with a past cook at 115%).
  - **Fit on the real-size emulator** (dp from the end of each part to the start of the fade over Start
    cook; minus = that far into the fade or under the button; the fade and its gap are 34 dp):

    | Scale | Navigation | Brisket | Wings | Breasts | Add food | Target | Met |
    |---|---|---|---|---|---|---|---|
    | 100% | gesture | 195 | 111 | 27 | -33 | none | |
    | 100% | 3-button | 171 | 87 | 3 | -57 | none | |
    | 115% | gesture | 175 | 74 | -10 | -70 | two cards (since 2026-11-14) | yes |
    | 115% | 3-button | 151 | 50 | -34 | -94 | two cards (since 2026-11-14) | yes |
    | 130% | gesture | 164 | 57 | -29 | -89 | two cards | yes |
    | 130% | 3-button | 140 | 33 | -53 | -102 | two cards | yes |

    Why the first 115% target (three cards and Add food) could not be met: the brisket and wings summaries wrap there, 17 dp each, so the menu is 33 dp
    taller than in the first build. Before the wrap, on this display, Add food already ended under
    Start cook by about 3 dp (the reason the display had been made taller). Three cards and Add food now need 70 dp more
    than the display has with gesture navigation and 94 dp more with three buttons; every block is the
    mockup's size, so there is nothing to take it from without changing the mockup's spacing. Jason set the
    new target on 2026-11-14 (two cards whole, the third may end in the fade, Add food by scrolling).

### T-018 Smoker temp menu, Add food, Issues sheet (06, 07)
- **Status:** gate-complete 2026-11-14 (`npm run check` passed with Snyk back up, all six steps; anything below about
  Snyk being down is history). built and tested on the emulator 2026-11-14 (notes below). Jason approved the screenshots and
  answered the three questions on 2026-11-14. Snyk has not run on it (down for maintenance on 2026-11-14,
  delayed to Monday 2026-11-16 by Jason): done once `npm run check` passes.
- **Goal:** temp menu with settable temps and fire times, Show all and the outside-200-300F warning; food
  picker with search and groups; conflicts sheet with fixes (move to griddle, change temp, edit the food).
- **Files:** `src/screens/plan/TempMenu.tsx`, `FoodPick.tsx`, `IssuesSheet.tsx`, tests, fidelity PNGs.
- **Depends on:** T-017.
- **Acceptance:** only settable temps offered (failure mode 12); each fix changes the plan; PR-1 and PR-3 (T-017)
  hold: the temp field stays put after a choice.
- **Tests:** RNTL per sheet (search filters, temps from `settableTemps`, a fix applies).
- **Device testing (Jason):** none beyond the screenshots.
- **Notes (2026-11-14):**
  - `src/screens/plan/TempMenu.tsx`, `FoodPick.tsx`, `IssuesSheet.tsx` (ports of the 0.2.0 files) and
    `PlanTab.tsx`, which holds the Plan screen and whatever is open over it; the route renders `PlanTab`.
    `PlanScreen` gained `tempFieldRef`: `PlanTab` measures the field (`measureInWindow`) to hang the menu.
  - Kit: `Menu` and `MenuRow` (`menu.tsx`; a Modal like the Sheet, the opened field drawn over the real one,
    the list opens with the selected temp as the third row), `SearchField`, `GroupLabel`, `Inset`. Theme:
    `statusColors.scrimMenu` (ui.css `.scrim-menu`). Fixed: an open `SelectField` had no fill (`bg-field-open`
    is not a theme class; it is `bg-field`), so the field under the scrim showed through; regression test in
    `menu.test.tsx`.
  - Item ids: `src/lib/itemId.ts` (from the time, pure; Hermes has no `crypto.randomUUID`).
  - Tests: `TempMenu.test.tsx` (11), `FoodPick.test.tsx` (6), `IssuesSheet.test.tsx` (12), `PlanTab.test.tsx`
    (6), `menu.test.tsx` (6), `itemId.test.ts`. Device test `plan-sheets` (emulator, 115% and 130%): passes.
    PR-3: after a temp choice the field and everything above it are where they were. Dev seed
    `pitplanner://dev/plan?seed=clash` (two batches of wings, 225F and 350F) gives one real conflict.
  - Fidelity: `docs/fidelity/rn-06-temp-menu.png`, `rn-07-add-food.png`, `rn-conflicts.png` (115%, 130%).
  - **Open, Jason decides:**
    1. Decided (Jason, 2026-11-14): a food chosen in Add food opens food details first, since the user
       may need to change it; it goes on the menu on Save (as in 0.2.0). That is T-019. Until T-019 is
       built the chosen food goes straight on the menu with the rules defaults, and the Conflicts sheet's
       "Edit [food]" buttons are left out; T-019 removes both stopgaps (`addFood` in `PlanTab.tsx`).
    2. Decided (Jason, 2026-11-14): "finish earlier" is dropped. SPEC section 3 now lists the fixes as
       they are in 0.2.0: move to griddle, change temp, edit the food.
    3. In Celsius the menu's rows repeat in pairs: `showTemp` (`engine/units.ts`) shows set points to the
       nearest 5C, and the smoker's 5F steps are 2.8C apart, so 220F (104.4C) and 225F (107.2C) both read
       105C, 235F and 240F both 115C, and so on. Same as 0.2.0. (An earlier note here said 230F also reads 105C:
       wrong, it is 110C.) Decided (Jason, 2026-11-14): Celsius set points show in 2C increments, Fahrenheit
       in the cooker's 5F steps. `showTemp` now rounds set points to the nearest 2C, so every 5F step is
       its own row (104C, 108C, 110C). The rows are 2C or 4C apart, because the smoker's real steps are
       2.8C; a menu in even 2C steps would need the smoker's Celsius steps from a source.
  - Not the mockup: the last row showing is cut by the menu's footer when the list is longer than the
    display (the list scrolls; mockup 06 is drawn on a taller canvas). The fire times differ from mockup 06
    by 5 minutes on some rows (215F: 5:40 AM, not 5:45); they are the engine's.

### T-019 Food details (08, 09, 10)
- **Status:** gate-complete 2026-11-14 (`npm run check` passed with Snyk back up, all six steps; anything below about
  Snyk being down is history). built 2026-11-14, emulator only; Jason approved the screenshots (115% and 130%) the same day:
  "look good. I like the results bar", "T-019 is good to go". Snyk (gate step 6) not run: Snyk was down
  (`SNYK-0099`), steps 1 to 5 pass. Not gate-complete until `npm run check` passes with Snyk. His thumb test
  on the weight stepper still needs the phone (hold on).
- **Notes (2026-11-14):**
  - Jason's three rulings: the sheet is always full height (kit `Sheet tall`; a content-tall sheet moves
    every control when its content's height changes), the result bar sits in the sheet footer above Save /
    Add to plan (a sheet has no tab bar under it), and the regression test was seen failing against a
    temporary copy of the 0.2.0 behavior (an effect revealing the card on every item change: `scrollTo` was
    called on each weight tap), which was then removed and never committed.
  - The form's content never gets shorter while the sheet is open (`useNeverShorter` in `FoodEdit.tsx`):
    scrolled to the end, shrinking content would make the view clamp and move the tapped control.
  - Bar cells: Fire (smoker or griddle; "On" when the cooker is not lit ahead), Off heat, Serve.
  - "Use for future" is the kit `CheckRow`, full width. Remove is a text button left of Save, as in 0.2.0,
    with no confirmation (also as in 0.2.0).
  - Dev seed: `pitplanner://dev/plan?seed=mockup&edit=b` opens an item, `?seed=empty&add=brisket` a new food.
  - Device: `food-details` (new) and the `food` / `food-bottom` targets of `stable-controls` pass at 115% and
    130%. Hours per pound is only in `food-bottom`: opened at the top it is behind the pinned bar, and the
    rig's `on_screen` does not know about a pinned footer (a tap there lands on the bar).
- **From T-018 (Jason, 2026-11-14):** choosing a food in Add food opens this screen for the new food; it
  goes on the menu on Save, not before. Take out the T-018 stopgap (`addFood` in `PlanTab.tsx` adds it at
  once) and pass `onEdit` to the Conflicts sheet so its "Edit [food]" buttons show.
- **Goal:** quantity, cooker chips (missing cookers disabled with "Add in Gear"), method, options, rest, Timing
  (three models for by-weight foods, Standard/Total hours otherwise, "Use for future"), live result card.
  PR-3 (T-017) applies to every stepper (quantity, hr/lb, total hours) and chip: no automatic scrolling after a
  change. Result (Jason, 2026-11-12): a fixed-height summary bar pinned at the bottom, above the tab bar, showing
  fire, off heat and serve; the full result card stays in the scroll; tapping the bar scrolls to the full card
  (the only scroll, and the user starts it). The bar meets PR-3: fixed height at each font scale, tabular
  digits, no layout shift when its values change.
- **0.2.0 bug to leave behind (Jason, 2026-11-14, seen on his phone during a real cook):** on Food details,
  tapping + or - on the weight makes the screen scroll by itself: the result text at the bottom is brought
  into view, the stepper moves away from the finger, and he has to scroll back and tap again. Cause in
  0.2.0: the result card is wrapped in `KeepVisible deps={[it]}` (`legacy/src/screens/plan/FoodEdit.tsx`
  line 286), which scrolls the card into view after every change to the item. Requirement (pass/fail): do
  not port `KeepVisible`; nothing on Food details scrolls, takes focus or moves on a value change. After
  any number of + or - taps on the weight (and on every other stepper and chip) the tapped control is at
  the same place on screen and the next tap lands on it. Fail: any tap after which the stepper's bounds
  have moved.
- **Files:** `src/screens/plan/FoodEdit.tsx`, `src/components/kit/ResultBar.tsx`, tests, fidelity PNGs 08-10,
  SPEC.md section 3 "Food details" (add the summary bar).
- **Depends on:** T-017.
- **Acceptance:** the T-001 checklist (HANDOFF) holds on the new UI; 12 lb brisket at 0.75 hr/lb shows 9 hr
  and fire 6:20 AM for a 5:00 PM serve; the T-006 `stable-controls` flow passes on Food details at 115% and
  130% (hr/lb + five times, - five times; weight + five times, - five times, from the top and scrolled so the
  weight stepper is the lowest thing showing: targets in `tools/device/targets.tsv`). The summary bar keeps its height and position while hr/lb changes, and tapping it brings
  the full result card into view.
- **Tests:** RNTL versions of the nine legacy FoodEdit cases (three/two models, source line, saves, hint once,
  result card text). Regression test for the 0.2.0 scroll bug, written failing first: a weight + tap calls no
  `scrollTo` or `scrollToEnd` on the screen's scroll view and moves focus nowhere.
- **Device testing (Jason):** add brisket, set 0.75, read the result card at his usual font size. Tap weight
  + and - several times in a row without lifting his thumb's position: judge that the stepper stays under
  the thumb and the screen does not scroll, compared with 0.2.0 on his phone, where it jumps.

### T-059 Whole turkey in `data/foods.json`
- **Jason (2026-11-15, 5:10 PM): whole turkey goes into 0.3.0**, with a note that the cook is responsible for
  cooking food to a safe temperature (wording and where it shows need his OK: it is new UI). He pasted two
  sets of numbers, neither with a link, so nothing goes into `data/foods.json` until each has its source
  (CLAUDE.md: no numbers without a source). Ask him for the two links, or read the pages in a browser:
  - Set 1 (source not given): at 275F to 325F a whole turkey takes 15 to 20 min per lb (0.25 to 0.33 hr/lb),
    spatchcocked 10 to 12 min per lb (0.17 to 0.20 hr/lb); at 225F to 250F closer to 30 min per lb (0.50
    hr/lb). Pull the breast at 160F (carries over to 165F in the rest), thigh and leg 175F to 180F. Cook to
    internal temperature, not time.
  - Set 2 (reads like the USDA page on smoking; source not given): smoker air 225F to 300F, checked with its
    own thermometer; 20 to 30 min per lb; safe at 165F in the innermost thigh, the innermost wing and the
    thickest part of the breast; pink smoked meat is safe at 165F.
  - They differ on the pull temperature (160F with carryover, or 165F in three spots). Use the 165F rule
    unless he says otherwise, and say so in the step text.
- **Jason (2026-11-15, 5:30 PM): unblocked, build it.** He went to the USDA FSIS site named in this task and
  got set 2 below from it himself, so cite it as "USDA FSIS (fsis.usda.gov), read by Jason 2026-11-15"; set 1
  is his own numbers for hotter smoker temps, cite it as "Jason, 2026-11-15". No more source links are needed
  and no food-safety note is wanted ("you're being very risk averse on this, and I'm okay with this"). Done
  temperature in the step text: 165F in the thigh, the wing and the thickest part of the breast (the FSIS
  rule), since he did not pick between the two.
- **Jason (2026-11-15, later the same session), two answers:**
  - **Size warning: left out of 0.3.0.** He gave no size limit and none may be invented. Not built: no limit in
    `foods.json`, no warning in Food details. The "Size warning" requirement and its engine test below do not
    apply to 0.3.0.
  - **Rest: 30 minutes default, 20 minutes minimum.**
  - Sources are cited as "USDA FSIS (fsis.usda.gov), read by Jason 2026-11-15" and "Jason, 2026-11-15"; no URL
    or quote is needed (this replaces the "Sources" requirement's URL, page title, date and quoted sentence).
- **Status:** built 2026-11-15, on `main` and gate-complete; device test not run
- **Built (2026-11-15):**
  - `data/foods.json`: food `turkey` ("Whole turkey", group "Turkey"), one method `smoked`, `perWeight`
    0.50 hr/lb at 225F, `rangeAt225` [0.33, 0.5], one smoke phase, pull check at 165F in the innermost thigh,
    the innermost wing and the thickest part of the breast, rest 30 / 20 min, `minPitTempF` 225, and a
    `sources` list. No options: no stuffed, no spatchcock. No turkey-specific code for timing.
  - `engine/rules.ts`: `minPitTempF` on a method, `sources` on a food (`RuleSource`: cite, covers, says).
  - `engine/plan.ts`: warning `TEMP_BELOW_FOOD_MIN` (level warn, the item's id) when a smoker phase of a food
    runs under its `minPitTempF`. The temp is left as chosen. `IssuesSheet` offers Change smoker temp for it;
    the Conflicts tile counts it like any warn.
  - Tests: `engine/plan.test.ts` (12 lb at 225F: 6 hr on heat, rest, fire time, pull at 165F; below 225F and
    at 225F; the shared temp model against the cited rates), `engine/rules.test.ts` (sources check, fails
    when a number loses its source), `IssuesSheet.test.tsx`, `FoodPick.test.tsx`, `surfaces.test.tsx`.
  - The shared temp model gives 30 min per lb at 225F, 25.5 at 250F, 21.7 at 275F, 18.4 at 300F, 15.7 at
    325F. Against Jason's 15 to 20 at 275F to 325F it is 1.7 min per lb slow at 275F; against FSIS 20 to 30
    at 225F to 300F it is 1.6 fast at 300F. No turkey temp model was added.
  - **Jason's answers on the build (2026-11-15, eighteenth session):**
    - Icon: turkey shows the smoker flame like every other food (he weighed a drumstick, a chicken, a cow,
      then "maybe we just show the smoker flame"). The drawn `TurkeyIcon` was taken out again.
    - Prep: "We're not really telling them how to prep their turkey or prep their ribs ... we're just doing
      anything that relates to the actual smoking process." Then (same session): "Take the how-tos out. Just
      say prep brisket, prep breasts." Every food's prep step is now a plain reminder at the same time as
      before: "Prep the brisket.", "Prep the tri-tip.", "Prep the ribs.", "Prep the pork butt.", "Prep the
      chicken breasts.", "Prep the turkey." (30 min ahead, not sourced); the two that come with a chosen option
      read "Brine the chicken breasts." and "Dry brine the wings." He also said "C" (take the prep steps out
      of every food), which does not match his words; built to the words, and asked him to confirm.
      `engine/plan.test.ts` checks every prep label has that form.
    - The numbers that relate to the smoking stay as built, not sourced: weight default 12 lb, min 8, max 24,
      step 0.5, reference weight 12 lb; carve time 15 min; hold limit 60 min; grate space 12 sq in per lb;
      group "Turkey"; smoke step "Turkey on the smoker. Probe in the thickest part of the breast."
    - "Unusual rate" note: turkey gets its own usual range starting at 0.33 hr/lb (`rateHint` on the food in
      `foods.json`, `rateHintFor` in `engine/plan.ts`, used by Food details and Cook rates), so a rate for a
      hotter smoker is not flagged. Other foods keep 0.5 to 1.6.
- **Gate (2026-11-15):** merged onto `main` with the changes above; `npm run check` passed all six steps. No
  device test yet (Food details with turkey, the issue below 225F, at 100/115/130%).
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

### T-061 Tell two of the same food apart (labels on the menu and in the steps)
- **Status:** built 2026-11-14 (engine, Plan cards, Conflicts buttons). Gate: `npm run check` passes, all six
  steps. Device run (emulator, 2026-11-14): `plan` and `plan-sheets` pass at 115% and 130%; `plan-sheets`
  reads the labelled Conflicts message and buttons on its two-wings seed (run before the summary and
  alarm-title changes, which no device test reads). Not run on the phone (hold). Waits for Jason's read
  of a two-brisket plan, set for Sunday 2026-11-15 (below). The Cook screen's cards and step list take the
  label when T-021 builds them.
- **Built (2026-11-14):**
  - `engine/labels.ts`, `itemLabels(rules, items)`: a label for each item that shares its food with another
    on the menu, nothing for the rest. Weight foods "11.5 lb brisket"; count foods "3 racks St. Louis ribs",
    "4 chicken breasts" (the unit is left out when the food's name already ends with it). Labels that would
    still match are numbered in menu order ("6 lb brisket 1", "6 lb brisket 2"). Written in lb;
    `localizeText` turns it into kg for display like any engine text. Not stored: it is worked out from the
    menu each time, so a changed weight changes the label.
  - `engine/plan.ts` `derive`: every event of a labelled item starts with "<label>: " (prep, each phase, the
    pull, the slice), so alarm bodies carry it with no change to `engine/alarms.ts`; step keys are
    unchanged (kind, item, phase), so Done, +15 and reminders are not affected. Warnings use the label in
    place of the food name ("11.5 lb brisket: total hours fixed..."). `PlannedItem.label` is set for
    labelled items (for the Cook screen, T-021). Live changes keep it, since they run `derive` again.
    `data/foods.json` is unchanged: no step wording was rewritten.
  - Plan (`PlanScreen.tsx`): a labelled food's card is titled with its label, and its summary line leaves
    the amount out ("11.5 lb brisket" over "Smoker, paper wrap"; Jason, 2026-11-14: the summary does not
    have to say it too). A food that is alone keeps "Brisket" over "12 lb, smoker, paper wrap". Conflicts (`IssuesSheet.tsx`): the fix buttons name each food by its label ("Edit 11.5 lb
    brisket", "Move 2 lb chicken wings 1 to the griddle"); before, two of the same food gave two buttons
    with the same text.
  - Tests: `engine/labels.test.ts` (11), `PlanScreen.test.tsx` (2 new), `IssuesSheet.test.tsx` (2 new, 5
    reworded for the labels), `PlanTab.test.tsx` (2 reworded). The device test `plan-sheets` reads the new
    button and message text on its two-wings seed.
  - SPEC: section 4 "Two of the same food", section 3 Plan.
- **Jason's answers (2026-11-14, while building):** same food at the same weight: number them, in menu
  order. Count foods: count, unit and food ("3 racks St. Louis ribs"). Step text: the label in front, then
  the step as written ("11.5 lb brisket: Check tenderness: pull at 200-205F when the probe slides in like
  butter."); the wording in `data/foods.json` stays.
- **Alarm title (Jason, 2026-11-14: "it has to have the title of it, the 11.5 pound brisket"):** a labelled
  food's alarm is titled with its label, in the user's units (`alarmsFromPlan` in `engine/alarms.ts`); the
  body lines keep the label in front, since one alarm can list steps of several foods.
- **Not done here:** the Cook screen and Full timeline (T-021, T-023) are not built yet; history and Cook finished rows
  (`src/lib/finish.ts`, `historyView.ts`) still say the food's name, as 0.2.0 did.
- **Why (Jason, 2026-11-14, from his cook with two briskets):** "in the plan there isn't a pull 11.5 lb off
  of the smoker in the tasks. need to name the briskets by either user name or name/weight."
- **What the app does today** (checked with the engine: an 11.5 lb and a 6 lb brisket plus tri-tip): both
  briskets give the same lines ("Brisket on the smoker, unwrapped...", "Check the brisket: wrap once the
  bark is set...", "Slice or plate the brisket."), and the pull step names no food at all ("Check
  tenderness: pull at 200-205F when the probe slides in like butter."). Nothing says which brisket a step
  is for. The menu cards do show the weight.
- **Decided (Jason, 2026-11-14):**
  - The label defaults to the weight and the food: "11.5 lb brisket".
  - It shows only when the menu has two or more of the same food. One brisket reads as today.
  - The user will be able to type a name of their own, but not in 0.3.0: that is T-062 (next version,
    `docs/design/BACKLOG.md`).
  - This is a new behavior during the port (WBS rule R-5 says none until 0.3.0): his call, from a real cook.
- **Goal:** with two or more of the same food on the menu, every step, alarm and card says which one it is
  for by its label, and the pull step names its food.
- **Files (expected):** `engine/plan.ts` (the label and the event text), `data/foods.json` (step wording
  that takes the label, if the wording is data), `engine/plan.test.ts`, Plan cards, SPEC sections 3 and 4.
  Cook steps and alarm text come from the same events (T-021, T-023).
- **Depends on:** T-019.
- **Tests:** engine: two briskets give steps that differ by their labels, and each pull step names its
  food; one brisket reads as today. Weights in kg when the user's unit is kg.
- **Device testing (Jason):** a plan with two briskets: read the steps and say which brisket each is for.
  Shown to him on 2026-11-15 from the emulator at 115% (dev seeds `pitplanner://dev/plan?seed=briskets`
  and `?seed=twins`, added for this; the Conflicts sheet from `?seed=clash`; the step text printed from the
  engine, since no screen lists the steps before T-021). Passed (Jason, 2026-11-15): the names, the 1 and 2
  and the Conflicts buttons are fine.
  Until the Cook screen exists (T-021) the steps show nowhere in 0.3.0, so for now: on Plan, add two
  briskets of different weights and judge the two card titles against the answers above ("11.5 lb brisket",
  "6 lb brisket") and the line under each, which should not repeat the weight; make them the same weight
  and look for "1" and "2"; open Conflicts with two of one food
  and read the buttons. Emulator or phone; no mockup shows this, the reference is this entry.

### T-058 Survive font-size changes and process death
- **Status:** built 2026-11-14 (emulator: `survive` passes at 115% and 130%). The mid-cook half of the
  acceptance (on Cook: same Next up and countdown) passes in `survive` at 115% on the emulator (2026-11-15, with T-021). Not run
  on the phone (hold). Gate: `npm run check` passes, all six steps (2026-11-14, Snyk back up).
- **Built (2026-11-14):**
  - Font size. `plugins/fontScaleConfigChange.ts` (pure, tested) through `plugins/withFontScaleConfigChange.ts`
    in `app.config.ts`: `fontScale` in the main activity's `configChanges`, and an `onConfigurationChanged`
    in `MainActivity.kt` that has React Native's DeviceInfo module run its font-scale check at once. Found on
    the emulator: with the activity kept, React Native 0.88 neither measures text already on screen again
    (the Plan tab label stayed 52 px for 5 s after 115% -> 130%, and became 59 px only when re-rendered) nor
    tells JavaScript the new scale before the next resume. So `Text` (`src/components/ui/text.tsx`) takes
    `useWindowDimensions().fontScale` as its key: each piece of text gets a new native view at the new size
    and nothing above it is rebuilt (regression test in `text.test.tsx`, seen red without the key).
    `TextInput` is not re-keyed (it would drop the keyboard); it takes the new size on its next render.
  - UI state. `src/lib/uiState.ts` (`UiState {tab, food}`; `parseUiState`, `restorableFood`), stored under kv
    key `ui` by `settings.ui()` / `setUi()` (no migration), reached through `store.ui.read()` / `.write()`
    (not React state: writing it re-renders nothing). `app/index.tsx` opens the saved tab; the tab bar saves
    the open tab. `PlanTab` writes the food being edited on every change (`FoodEdit` `onChange`) and opens
    Food details again from it; a saved food that is no longer on the menu (and is not new) is dropped.
    The Plan draft itself was already stored by the store and the cook is in `active_cook` (T-008).
  - Not built from the approach above: "the open route" beyond the tab and Food details (the other sheets,
    the temp menu, Add food and Conflicts, come back closed: they hold no unsaved input), and no splash hold
    (the saved state is read with the settings the app already waits for).
  - Rig: `survive` in `tools/device/run.sh`, emulator only. The "same activity" check compares the
    activity's window (`DecorView{...}` in `dumpsys activity <package>`), not `Running "main"` lines (the
    dev build's log had none to count). Alarms are compared by their clock time (`origWhen`): Android's
    `whenElapsed` moved by 1 ms when the app set the same alarms again. As the app now comes back where it
    was left, `launch` with no route closes a food sheet that an earlier test left open, and `wait_for_app`
    knows the sheet as the app being up.
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
- **Status:** gate-complete 2026-11-14 (`npm run check` passed with Snyk back up, all six steps; anything below about
  Snyk being down is history). built 2026-11-14 (13 tests); Snyk (gate step 6) not run, Snyk was down; steps 1 to 5 pass.
- **Decided (Jason, 2026-11-14):** entering Finishing cancels all alarms, as the table says ("follow the table
  for now"). No longer a question for T-023.
- **Notes (2026-11-14):**
  - `cookState(facts, now)` takes four facts (`pitDownAt`, `quietUntil`, `nextDueAt`, `finishing`; `null`
    for no cook) and returns the phase, `quiet`, `overdue`, the allowed actions, the alarm set (`none`,
    `full`, `pitCheck`, `cancelAll`), `heldUntil` and `nagEveryMin`. `can(state, action)`;
    `doneOffBy(dueAt, doneAt)` for the keep-or-move-serve question (5 min). The engine cannot import
    `ActiveCook` from `src/lib`, so the caller passes the facts (`nextDueAt` is `dueAt` of `pending()[0]`).
  - Read of the table, to confirm when the Cook UI is built: the overdue row lists only Done; it is taken
    as "Done is what clears it", with the other cooking actions still allowed (as in 0.2.0). With the pit
    out nothing counts as overdue (the clock is stopped).
  - For T-023: the table says Finishing cancels every alarm. 0.2.0 cancelled them only on Save or Discard,
    so alerts could still ring over the summary. `cookState` follows the table; ask Jason which he wants
    before wiring it.
- **Goal:** the live-cook states (TECH-DESIGN section 7) as one pure function the new Cook UI is built on.
- **Files:** `engine/cookState.ts`, `engine/cookState.test.ts` (new files; existing engine files unchanged).
- **Depends on:** none.
- **Acceptance:** every row of the state table has a test, including allowed actions per state.
- **Tests:** as above.
- **Device testing (Jason):** none.

### T-021 Start cook and Live cook (12)
- **Status:** done 2026-11-15. Gate: `npm run check` passes, all six steps (2026-11-15, on `main` with T-022
  and T-024 merged). Emulator at 115% only (Jason, 2026-11-15): `cook` and `survive` pass, including the
  mid-cook half of T-058 (font-size change and process kill on Cook: same Next up). Not run at 130% and not
  on the phone. Fidelity: `docs/fidelity/rn-12-live-cook.png` (live, scrolled to the end, no cook).
- **Jason (2026-11-15):** the Live cook screenshot is approved ("looks fine").
- **Built (2026-11-15):**
  - `src/screens/cook/CookScreen.tsx`: no cook: "No cook running" and Go to Plan, never starts one (T-064).
    Live cook: header with the smoker temp and serve time, status chip, Next up card (overline "Check at" for
    a check step, title, detail with "Not ready? Tap Adjust." on check steps, countdown, Done, Adjust), lane
    chart with the now line, the shared-smoker band and its note, After that (three steps), Full timeline.
    The clock is read every 30 s and when the app comes back to the front. Red banner "Alerts are off. Steps
    may not ring." with Fix (a sheet with the permission rows), re-checked on resume. The notice of what an
    alert changed (`cook.notice`) shows with OK.
  - Start cook: `PlanTab` checks the permissions (`StartCheckSheet`: "Alerts may not ring", Start anyway or
    Start cook once all are on), saves the cook through `setCook` (one alarm set) and opens the Cook tab. A
    status that cannot be read counts as missing. One tap starts one cook.
  - T-064 rules: Start cook is disabled while `state.cook` is set (`PlanScreen`, regression test written
    failing first) and `PlanTab` never replaces a running cook; the Cook tab never starts a cook.
  - Kit: `Lanes` (`src/components/kit/Lanes.tsx`; lane, track and tick heights grow with the font size),
    `StatusChip`, `BandNote`, `Button kind="small"` (40 dp pill, 48 dp target: Fix, OK, Allow), `Screen` and
    `AppBar` `subtitle`. Tokens `laneSmoke2`, `laneHot`. `src/screens/shared/AlertChecks.tsx` (the permission
    rows and `useAlarmStatus`; Setup's alerts step reuses it).
  - Dev seeds: `pitplanner://dev/plan?seed=tomorrow` (mockup menu for 5:00 PM tomorrow) and `?seed=cooking`
    (mockup 12 as a running cook, 6 hr 37 min before serve). Test fixture `src/test/cook.ts`.
- **Left for T-022 and T-023, on purpose:** the Cook options button, Adjust and Full timeline are drawn and
  do nothing (handler props `onOptions`, `onTimeline`, not passed by the route). A Done that is 5 min or
  more early or late keeps serve when the holds cover it, else moves serve (as a Done from an alert does),
  until the keep or move sheet. After the last step (Serve) the card goes away and the cook stays until Cook
  finished exists; `pitplanner://dev/alarm?cook=end` ends it in a dev build. No pit-out banner yet (pit out
  is set from Cook options).
- **Decided by Jason (2026-11-15, built the same day):**
  1. Next up title: one sentence with the countdown that wraps where it fits ("Fire the smoker to 225F in
     1 day 22 hr"), not mockup 12's countdown on its own line and never broken step / temp / countdown on
     three lines. SPEC "Cook tab".
  2. A countdown a day or more away reads in days and whole hours, to the nearest hour ("in 1 day 22 hr",
     "in 3 days"); under a day it is unchanged (`countdown` in `src/lib/cookView.ts`).
  3. The phone refuses the alarm set (`state.alarmSync === 'failed'`): banner "Alarms could not be set.
     Steps will not ring." with Try again, which sets the whole list again. `inexact` is covered by the red
     banner (exact alarms are off).

### T-064 A cook is never lost without the user choosing it
- **Status:** partly built. Done with T-021 (2026-11-15): Start cook greyed out while a cook runs and never
  replacing it; the Cook tab never starts a cook (regression tests in `PlanScreen.test.tsx`,
  `StartCook.test.tsx`, `CookScreen.test.tsx`). Done with T-022 (2026-11-15): Start over asks first and
  never changes `cook_history` (`CookOptions.test.tsx`). Left: Save and Discard on Cook finished never
  change other records (T-023).
- **Why (Jason, 2026-11-15):** his cook of 2026-11-14 is not in 0.2.0's history, and he sees no earlier
  cooks either. He believes he saved it. Afterwards he started a cook for 2026-11-21 and ended it with
  Start over. The phone's copy of `history.json` cannot be read over adb (release build), so what happened
  is not proven.
- **Read of the 0.2.0 code (`legacy/`, 2026-11-15):**
  1. Nothing in Start over, End cook or Discard removes a saved record. Records are removed only by Remove
     on the Cook history screen (`removeRecord`).
  2. A cook is written to history in one place only: End cook, then Save to history on Cook finished
     (`FinishScreen.finish`). Until that tap nothing is saved.
  3. Start over (`CookScreen.endCook`) drops the running cook at once: no save, no question.
  4. Start cook on Plan with a cook already running (`app.tsx beginCook`) replaces the running cook: no
     save, no question. Plan shows Start cook whenever the menu plans. So a finished cook that was never
     ended through End cook is lost when the next one is started. This fits what he did.
  5. `loadHistory` returns an empty list on any read or parse error, and `addRecord` / `removeRecord` write
     back what it returned. One failed read followed by a save leaves only the new record. This is the
     only path found that could remove older cooks. The 0.3.0 history is rows in SQLite (insert one row,
     never rewrite the list), so this path does not exist there.
- **Result from the phone (2026-11-15, Jason's yes to the five listed actions; files in the git-ignored
  `tools/device/out/t064-2026-11-15/`):** the cook was saved. `history.json` (written 2026-11-14 5:18 PM)
  holds one record: served 5:17 PM, 18 min late, 250F, five foods (chicken breasts 12 planned / 0 actual,
  wings 95 / 116, 11.5 lb brisket 530 / 532, tri-tip 85 / 178, 3 lb brisket 140 / 245 minutes). Nothing was
  deleted, and no older record exists. The normal 0.2.0 APK is back on the phone (versionCode 200, not
  debuggable).
  - Why he could not find it: in 0.2.0 the history is under Gear, Cook rates, below the rate cards
    ("Cooks"). On Plan, "Cook a past plan again" has no action in 0.2.0 (a TODO in
    `legacy/src/screens/plan/PlanScreen.tsx`): it lights up once a cook is saved and does nothing when
    tapped. 0.3.0 wires it to history (T-028); check the way to history is plain there.
  - What the record shows for learning: the 11.5 lb brisket reads 532 minutes, "on plan", because Done was
    tapped by mistake at 3:30 PM while it stayed on (T-063); the chicken breasts logged 0 minutes on heat.
    Both go into the rates as real cooks. For T-023 and T-063: a wrong Done should not teach a rate.
  - Paths 3, 4 and 5 above are still real ways to lose a cook, though none of them happened here.
  - Also in the copied prefs: a cook for Sat 2026-11-21 5:00 PM is running in 0.2.0, started Sun
    2026-11-15 10:49 AM, after Jason had ended the one before. Likely cause, not proven: in 0.2.0 tapping
    the Cook tab with food on the plan and no cook running starts a cook (SPEC "Cook tab", T-021 goal), so
    looking at the Cook tab started it again. That is why "there is no way to remove a planned cook".
    Asked Jason on 2026-11-15 whether 0.3.0 keeps that rule; it gates the Start cook half of T-021. The two
    installs of this task may have cleared that cook's alarms on the phone; not checked (needs a phone read).
- **Goal (0.3.0):** a running cook cannot be replaced or dropped without the user saying so; a saved cook
  is only removed by Remove.
- **Decided (Jason, 2026-11-15):**
  - While a cook is running, Start cook on Plan is greyed out (disabled): "once you do one cook, you can't
    start another until it's ended". Applies at T-021.
  - Start over asks before it drops the cook. Applies at T-022; the wording of the question needs his OK.
  - He does not know whether older cooks were in the history before 2026-11-14; he thinks a save was missed.
  - Proof from the phone: a release-signed debuggable 0.2.0 (built from tag `v0.2.0` in a scratch worktree,
    not from `legacy/`) installed over the release app to copy `history.json` out, then the normal APK back.
    Phone actions listed for his yes first.
  - Debug switch and send to developer: in 0.3.0, since he will hand 0.3.0 to a tester (T-065).
  - The Cook tab no longer starts a cook: "you actually have to physically hit start cook", then the app
    jumps to the Cook tab; ending the cook there erases it and goes back to Plan (SPEC "Cook tab", T-021).
    Taken to mean the cook is erased and the menu stays on Plan, as in 0.2.0; ask if he meant the menu too.
  - Checked on the phone after his End cook, Discard (2026-11-15, read-only `dumpsys alarm`): 0.2.0 has no
    alarms pending.
- **Tests:** regression tests, written failing first: Start cook with a cook running does not replace it;
  ending or starting over never changes `cook_history`; a history read error never leads to a write that
  drops rows.

### T-065 Debug switch and send to developer
- **Tap to copy, gate and device test (2026-11-15, eighteenth session):** merged onto `main`; prebuild and a
  dev build rebuild with `expo-clipboard` 58.0.4; `npm run check` passed all six steps; device test
  `followups` passes on the emulator at 115%: the address is tapped and the screen says "Address copied."
  (`docs/fidelity/rn-debug-copied.png`, for Jason to judge: the address is now on its own line as a text
  button; "Address copied." stays until the screen closes, his choice 4A). The clipboard's contents are not
  read by the test. Not checked on a phone.
- **Jason's answers to the build's questions (2026-11-15, 4:15 PM):** (1) Fill in his address: a few lines
  of Kotlin in one of our own modules so the email app opens with the address as the recipient (no new
  dependency; needs a dev build rebuild and a device test). **To build.** SPEC section 6 already says so.
  (2) Rings while the app is closed: a later task for a native ring log (T-068). (3) Cook history notes stay
  in the file. (4) The section stays under the test alert button.
- **Built (follow-up, 2026-11-15):** the recipient is filled in. Jest, ESLint and typecheck pass in the
  task's worktree. The Kotlin was NOT compiled or run there (no Gradle): `npm run check` (JUnit) and a device
  test are still to do.
  - `modules/pit-share`: `sendFile(fileUri, mimeType, recipient, subject, title)`. Kotlin `SendFile.kt`
    (path check, fields, the `ACTION_SEND` intent with `EXTRA_STREAM`, `EXTRA_EMAIL`, `EXTRA_SUBJECT`, a read
    grant, wrapped in the system chooser) with `SendFileTest.kt`; `PitShareModule.kt` starts it. Only a
    `file://` URL inside the app's cache or files folder is taken (`..` and symlinks out are refused).
  - No new provider, plugin or dependency: the `content://` URI comes from expo-file-system's
    `<applicationId>.FileSystemFileProvider`, already in the manifest (not exported, files and cache folders
    only, one read grant for the one file).
  - `src/platform/shareFile.ts`: `reportSharer` writes the file once and calls `sendFile`; if the native
    function is missing or throws, the same file goes through expo-sharing as before (address in the sheet's
    title). Subject: "Pit Planner debug file" (`REPORT_SUBJECT`).
  - Debug screen: "Tap Send and pick your email app. The file goes to <address>" and "If the address isn't
    filled in, type it."
  - Needs a device (after a rebuild): Send, pick Gmail: To holds the address, the subject is set, the JSON is
    attached and opens. Pick a non-email app (Drive): the file still arrives.
- **Jason's answers (2026-11-15, 5:00 PM):** the subject "Pit Planner debug file" stays; the line "If the address isn't filled in, type it." stays. He asked whether the file could go to GitHub instead of his email: not built (the repo is public and the file holds a tester's cooks and notes; it would also need a token in the app). "Things we can always upgrade later."
- **Gate, follow-up (2026-11-15):** the recipient code is on `main`; `npm run check` passed (the Kotlin compiles, 13 new JUnit tests pass). Not on a device: needs a dev build rebuild and an email app with an account to judge the To field.
- **Gate (2026-11-15):** merged onto `main` and `npm run check` passed all six steps. No device test yet.
- **Jason's look (2026-11-15, 5:20 PM):** `rn-debug-send.png` approved. **To build:** tapping the address copies
  it, and the screen says so ("Tap the address to copy it."), so a tester can paste it into the email when it
  is not filled in. Use `expo-clipboard` (Jason, 2026-11-15: the app will be on iPhone too, so no
  Android-only module; `expo-clipboard` works on Android and iOS), behind an interface in `src/platform/` with
  a fake for tests. It is a new native dependency: prebuild, dev build rebuild, gate (Snyk reads the new
  package).
- **Built (tap to copy, 2026-11-15):** `expo-clipboard` ~58.0.4 behind `CopyText` (`src/platform/types.ts`),
  `copyText` in `src/platform/clipboard.ts` (its only import), fake `fakeClipboard`. On the debug screen the
  address is its own line, a text button (label "Copy <address>", 48 dp tall, wraps, never cut), so the line
  above it now ends "The file goes to". Under it: "Tap the address to copy it." and, after a tap that worked,
  "Address copied."; a clipboard that fails shows nothing. `followups` checks the new line, taps the address
  and looks for "Address copied." (written, not run). Jest, ESLint, Prettier and typecheck pass in the task's
  worktree. Still to do: prebuild, a dev build rebuild, `npm run check` (the gate) and the device test.
- **Device test (2026-11-15):** in `followups` the debug screen shows Send to developer, where the file goes and
  what it holds (emulator, 115%; `docs/fidelity/rn-debug-send.png`). Send is not tapped by the test. Not
  checked anywhere: the share sheet, the To field in an email app, the file's contents from a real phone.
- **Status:** built 2026-11-15, unit-tested on a worktree branch; `npm run check` and device test not run.
  0.3.0 (Jason, 2026-11-15: "since I'm going to send 0.3.0 to somebody, I'm going to need
  that debug switch and the send to developer thing").
- **Built:**
  - `src/lib/debugReport.ts` (pure): `buildDebugReport` makes the file (`pitplanner-debug-<date>-<time>.json`):
    `app`, `phone`, `permissions`, `alarms` (alarms and repeats), `data` (the tables `active_cook`,
    `cook_history`, `cook_history_items`, `cookers`, `kv`, `rate_overrides`), `log`, `leftOut`, `problems`.
    Every field is copied by name. Any other table is left out by name. `DEVELOPER_EMAIL` is the one constant.
  - Secrets: the app stores none today (no secure store yet, nothing secret in kv or settings). As a guard,
    a kv row, column or JSON field whose name says token, secret, password, credential, api key or
    authorization is left out and named in `leftOut`. Bytes columns are left out too.
  - `src/lib/eventLog.ts` (pure) and the store: the event log is one kv row, `eventLog`, the last 300 events
    (`at`, `kind`, `text`; text cut at 400 characters). No migration. The store notes: each change to the
    running cook (started, ended, done, not done, reminder, pit out or back, quiet, plan changed), each alarm
    set given to the phone (count, exact or not) or cancelled, Done / +15 taps read from alerts, and alarm
    errors. `src/lib/eventLogWiring.ts` (root layout) notes each alarm that rings while the app is open and
    errors nothing caught (`src/platform/errors.ts`). A failed log write never stops a cook change.
  - Platform: `DeviceFacts`, `ShareReport`, `OnUncaughtError` in `src/platform/types.ts`;
    `src/platform/device.ts` (expo-constants and React Native only: no serial, fingerprint or device name);
    `shareReport` in `src/platform/shareFile.ts`; fakes `fakeDevice`, `fakeReportShare`.
  - Debug screen: a "Send to developer" section under the test alert button: where to send it, what the
    file holds, the Send button, and a line when sharing fails. Store: `logEvent`, `debugData`;
    `repos.dump`.
  - SPEC section 6 has the approved line.
- **Open:**
  - Recipient: built, see "Built (follow-up)" above. (Was: expo-sharing cannot hand an email app a
    recipient, it has no EXTRA_EMAIL.)
  - Alarms that ring while the app is closed are not in the log (the native side keeps no log); Done / +15
    taps made then are logged when the app next reads them. A native ring log would be a new task.
  - The event log is a kv row, so Export my data includes it too.
  - Not checked on a phone: `build` (versionCode from the embedded config), `Platform.constants` Release and
    Model, the share sheet title, and the look at 100/115/130% font size.
- **Jason's answers (2026-11-15):** it stays hidden: the existing 5 taps on the version line on Gear open the
  debug screen, and he tells testers to do that (no visible switch; "keep it as is", not the tab's icon). Send opens the phone's share sheet with
  one file; the tester picks Gmail or whatever they use. The address is
  jason@medtechcto.com (his decision, knowing the repo is public and the address ships in the app; the name
  he wanted for a dedicated one was taken, he may change it later): the debug screen shows it as where to
  send the file, and it is offered as the recipient when the tester picks an email app. Keep it in one
  constant so it is one line to change.
  The file holds what is needed to see what went wrong, nothing from other apps, nothing sent until the
  tester taps send: app version and build, Android version, phone model, font size, time zone; the alert
  permissions as the phone reports them; the alarms the app has stored and their repeats; the app's data
  (cookers, plan, running cook, cook history, rates, settings and flags); and the app's own log of recent
  events (alarms set and fired, changes to a cook, errors). No location, no accounts, no contacts.
  This is the approved SPEC line for the UI; write it into SPEC with the task.
- **Why:** on 2026-11-15 nothing on his phone could show what 0.2.0 had saved without installing a
  debuggable build over it (T-064). A tester's phone cannot be reached that way at all.
- **What exists:** the hidden debug screen (`/debug`, 5 taps on the Gear version, T-015 and T-026); Export
  my data on the migration error screen (`src/db/export.ts`, `src/platform/shareFile.ts`).
- **Goal (to settle with him):** a way to turn debugging on that a tester can be told about, and one action
  that sends the app's data and its own log to the developer through the share sheet or email. No personal
  data beyond what the app stores; nothing sent without the user tapping send; the address is not a secret
  but comes from him.
- **Depends on:** T-026.
- **Tests:** unit tests for what goes into the file; RNTL for the action.

### T-068 A log of every alarm ring, kept on the Android side
- **Status:** todo, after 0.3.0 unless Jason moves it up (Jason, 2026-11-15: agreed as a task for later).
- **Why:** the app's event log (T-065) only has rings seen while the app is open, plus Done and +15 taps read
  afterwards. A missed or late alarm with the app closed is the case the debug file is most wanted for.
- **Goal:** `pit-alarms` records each ring (step key, planned time, actual time, repeat number) in a small
  capped store of its own; the debug file includes it.
- **Files:** `modules/pit-alarms` (Kotlin, JUnit), `src/platform/alarms.ts`, `src/lib/debugReport.ts`.
- **Depends on:** T-065.
- **Acceptance:** a ring with the app killed shows in the next debug file with its times.
- **Tests:** JUnit (Robolectric) for the store and its cap; Jest for the report section.
- **Real phone:** yes, one ring with the app closed.

### T-066 User README with screenshots
- **Status:** todo; after the screens are built (Jason, 2026-11-15: "we're definitely going to have to
  create a README once we get done with everything and create screenshots for everything").
- **Goal:** how to use the app, screen by screen, with screenshots (status bar cropped), including where the
  cook history is and how to reach the debug screen.
- **Depends on:** the 0.3.0 screens, T-065.

### T-022 Cook options (13) and keep or move serve
- **Jason (2026-11-15, 5:05 PM):** the 15 min stepper stays as built ("I've already approved that one"). Closed.
- **Status:** built 2026-11-15, unit-tested (Prettier, ESLint, typecheck, Jest and the engine tests pass in
  the task's worktree). `npm run check` and the device run were NOT run (another session had the emulator):
  run `npm run check`, then look at Cook options on the device and save fidelity PNG 13
  (`docs/fidelity/rn-13-cook-options.png`). Not done until that passes.
- **Goal:** Running behind/ahead (+-15, keep/move with the hold impact), Quiet 30 min, Pit went out / Back up to
  temp, Not yet, Start over, End cook; the keep/move sheet with "X: off heat N min after serve." and Move
  preselected when keep leaves a food late.
- **Built (2026-11-15):**
  - `src/screens/cook/CookOptions.tsx` (a port of the legacy sheet): Running behind or ahead (stepper in
    15 min steps to 3 hr either way; once a shift is picked, Keep serve at / Move serve to with the hold
    impact line, and Apply), Not yet (only when the next step is a check: that food 30 min; serve stays
    while every food keeps its minimum rest, else moves, and the row says which), Quiet alerts for 30 min
    (while quiet: Alerts back on), Pit went out, Start over, End cook. Each row closes the sheet, then acts.
  - `src/screens/cook/KeepMoveSheet.tsx` (the legacy `AskSheet`): Keep serve / Move serve with what each
    does to the hold or to serve; "Brisket: off heat 1 hr after serve." when keeping would leave the food
    on past serve, and Move serve selected whenever the holds do not cover the change (`holdsCover`).
    Used by a Done 5 min or more early or late (nothing is saved until Apply; closing leaves the step not
    done) and by Back up to temp. The interim `keepServeIfCovered` in the screen's Done is gone.
  - `CookScreen.tsx`: the Cook options button and Adjust open the sheet (state in the screen; `onOptions`
    is gone). Warn banner "Pit out since 10:23 AM. Steps are on hold." with Back up to temp.
    Start over asks first (`StartOverSheet`: "Start over?", "This cook won't be saved.", Keep cooking /
    Start over), then `setCook(null)` and `onGoPlan`; the draft and `cook_history` are not touched
    (regression test, T-064). End cook closes the sheet and calls `onEnd`, which the route does not pass
    yet (Cook finished is T-023).
  - Every change goes through the store's `setCook`: one save and one alarm set per action (asserted per
    action with `fakeAlarms`); Quiet reaches the phone as `setQuiet`.
  - Kit: `ChoiceCards`, `ActionRow`, `Nums` (the times and durations inside a sentence as `Num`s), with
    tests in the kit's test files.
  - Regression tests for the 2026-11-11 live-test fixes that touch this screen: Not yet moves serve when
    the hold no longer covers it; the keep or move sheet says "off heat N after serve" and selects Move.
- **Left, on purpose:** End cook does nothing visible until T-023 passes `onEnd`. Done on the last step
  (Serve) still only marks it done (the legacy went on to Cook finished: T-023). No device test added.
- **Questions for Jason:**
  1. Running behind with Keep serve: the impact line names only the food whose hold changes most
     ("Brisket hold drops from 1 hr to 45 min. Still OK.") and Keep serve stays selected, even when another
     food would then come off after serve (+15 on the mockup-12 cook: wings 10 min and breasts 7 min after
     serve). Same as 0.2.0. Should it select Move serve and name the late food, as the keep or move sheet does?
  2. Mockup 13 shows the stepper buttons as "-15" and "+15" and the serve choice at once; built as 0.2.0:
     minus and plus icons, and the choice appears once a shift is picked. Keep that?
  3. SPEC section 5 says Not yet "suggests raising the smoker 25F to make up time"; 0.2.0 never did and
     this does not either. Drop it from SPEC or build it?
  4. The Start over question is a sheet with Keep cooking (text button) left of Start over (primary). OK?
- **Files:** `src/screens/cook/CookOptions.tsx`, `KeepMoveSheet.tsx`, tests, fidelity PNG 13.
- **Depends on:** T-021.
- **Acceptance:** each action re-plans and replaces alarms once; Quiet calls `setQuiet`.
- **Tests:** RNTL per action with fakes; regression cases from the 2026-11-11 live test (HANDOFF list).
- **Device testing (Jason):** none.
- **Jason's answers (2026-11-15):** (1) Running behind with Keep serve naming only the most-changed food:
  leave as 0.2.0 for now; backlog a clearer version (`docs/design/BACKLOG.md`). (3) The "raise the smoker
  25F" suggestion on Not yet is dropped from SPEC section 5. (4) Start over sheet (Keep cooking left as text,
  Start over right, filled): OK. (2) The -15/+15 control: "keep it for now"; asked again whether he means
  the built stepper or mockup 13's two buttons.
- **Device (2026-11-15):** `cook-options` on the emulator at 115%: see the status line.

### T-023 Notification actions, lock-screen alert, Cook finished (14, 15)
- **Status:** built 2026-11-15, unit-tested (Prettier, ESLint, typecheck, Jest, the engine tests and the gate
  tests pass in the task's worktree). `npm run check` (Semgrep, Snyk, Android tests) and the device run were
  NOT run (other sessions had the main checkout and the emulator): run `npm run check`, then look at Cook
  finished on the device against mockup 15 and save fidelity PNG 15. No device flow was added
  (`tools/device/flows/live.yaml` is still to write). Not done until that passes.
- **Device test (2026-11-15):** `cook-finished` passes on the emulator at 115% (Full timeline, Cook finished,
  the Use / Keep rate card, Save, Remove, Discard). It found one app bug, fixed: Save to history was narrow on
  every cook after the first (`FinishScreen.tsx`; the check is in the device test). Fidelity PNGs
  `docs/fidelity/rn-15-cook-finished.png` and `rn-15-cook-finished-rate.png`. Jason approved both on 2026-11-15 ("I like the wording, use 0.74 or keep 0.75").
- **Built (2026-11-15):**
  - `src/screens/cook/FinishScreen.tsx` (a port of the legacy screen, mockup 15): the day as an overline,
    "Cook finished", "Served at 5:00 PM, on time." (or "Ended at 10:23 AM, before serve."), one row per food
    with planned vs actual and On plan / N ahead / N behind / Not logged, a card per food whose rate this cook
    moves ("Your brisket rate updates"), Notes for next time, Save to history, Discard this cook and, the
    first time the screen is ever reached, Buy me a bag of pellets (opens the browser; `flags.supportShown`
    is set by Save or Discard).
  - `src/screens/cook/CookFlow.tsx`: what the Cook tab route renders. Live cook, then Cook finished after
    End cook in Cook options or Done on the Serve step. Save writes one history record (`addRecord`), then
    both Save and Discard end the cook with `setCook(null)` (one `cancelAll`) and go to Plan. Until one of
    them is tapped the cook and its alarms stay. Leaving the app on Cook finished keeps the cook; it comes
    back as Live cook.
  - `CookScreen.tsx`: Full timeline opens a sheet with every step, done ones dimmed with the time they were
    done (`onTimeline` is gone; the sheet lives in the screen). Done on Serve marks it done and calls `onEnd`.
  - Kit, additive: `InfoRow`, `LinkButton` (rows), `TextArea` (input), `Screen` / `AppBar` `overline`.
  - Notification actions: nothing rebuilt. `src/screens/cook/alertActions.test.tsx` runs `useAlarmWiring`
    and Live cook over one store: Done and +15 min queued while the app was closed are applied at start, and
    on resume when it was in the background; the notice shows on Live cook until OK; one alarm set per
    change; +15 then Done on one step apply in tap order; Open and an empty queue change nothing.
  - Overdue counting: nothing was missing against the legacy screen ("Overdue since 11:35 AM", "Check the
    brisket, 12 min overdue" in the warn color, Behind; counted on by the 30 s clock, tested). "N min past
    the step." is the text of the repeat notification (native, `Notifications.kt`, already built and tested);
    neither 0.2.0 nor SPEC puts it on Live cook, so it is not on the screen.
  - T-064 regression tests: Save adds one row and leaves the earlier row as it was; Discard leaves the
    history exactly as it was (`FinishScreen.test.tsx`).
- **What a saved record does today (for T-063, no UI built):** a food counts as logged as soon as its pull
  step is marked Done, from the app or from an alert, and its minutes on heat are that Done minus the Done of
  its first step (the planned start when that one was never tapped). There is no check on the number: a pull
  marked Done by mistake, or on and off marked together (0 min), is saved as a real cook and goes into the
  rate. Only a food whose pull was never marked Done is saved as not logged and teaches nothing.
- **Questions for Jason:**
  1. Rate card wording. Mockup 15: "0.75 to 0.73 hr/lb at 225F. 1 of 3 cooks toward size-adjusted timing."
     Built as 0.2.0: "0.75 to 0.73 hr/lb at 225F, from 1 cook.", and with a saved rate "Plans keep your
     0.75 hr/lb. 1 of 3 logged cooks before it adjusts. Lock it in Gear, Cook rates." Keep the 0.2.0 wording?
  2. Mockup 15 has no tab bar. Built as 0.2.0: Cook finished takes the place of Live cook inside the Cook
     tab, so the tab bar stays. Hide it?
  3. Ending early with nothing off the heat still offers Save to history and saves a record with every food
     not logged (as 0.2.0). Keep?
  4. Leaving Cook finished for another tab or app and coming back shows Live cook again, notes gone (as
     0.2.0). Should it come back to Cook finished?
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
- **Jason's answers (2026-11-15):** coming back to the app mid-cook shows Live cook (as built). Ending a
  cook with nothing off the heat still offers Save to history: keep (the record holds what was cooked, to
  reuse later). The rate card wording question was asked again in plainer words.
- **Rate card (Jason, 2026-11-15):** plain words and a choice. "Brisket finished early" (or late), "Next time
  the plan uses 0.73 hr/lb instead of 0.75.", then Use 0.73 / Keep 0.75. Keep saves the cook with that food
  left out of rates (`toRecord(..., keepRate)`). No change: "Brisket finished on time" / "Your rate stays
  0.75 hr/lb." A saved rate still held reads "Your brisket rate stays". Built to his words; he has not seen
  the screen yet.

### T-024 Setup steps and smoker picker
- **Status:** built 2026-11-15 on branch `t024`, unit-tested (Jest). NOT run on a device or emulator, and
  `npm run check` was NOT run (the session that built it was not allowed to): prettier, ESLint, typecheck,
  Jest, engine and gate tests pass; Android tests, Semgrep and Snyk are still to run. No fidelity PNGs yet
  (01, 02, 17 need the emulator). Not done until the gate passes and Jason has seen the screens.
- **Device test (2026-11-15):** `setup` passes on the emulator at 115% (on `main`, on an empty database).
  Fidelity PNGs `docs/fidelity/rn-01-setup-cookers.png`, `rn-02-smoker-picker.png`, `rn-17-add-cooker.png`.
  Noted: at 115% Add another cooker is half behind Back and Continue until scrolled. Jason approved 01 to 03 on
  2026-11-15. On 17 he asked what Add a cooker adds when it only says Oven: someone may have two smokers or
  two griddles. More than one of a kind is for the next version (BACKLOG.md).
- **Built (2026-11-15):**
  - Kit (`src/components/kit/setup.tsx`, tests in `setup.test.tsx`): `SetupPage` (step bar, title, intro,
    pinned actions), `SetupActions` (Back 1 : main 2), `OptionCard`, `DashedButton`, `PickRow`; `GroupLabel`
    takes a `note` (`rows.tsx`). Chips `scroll`, the oven avatar, `CheckRow` and `InputField` were there already.
  - `src/screens/setup/Setup.tsx`: step 1 Welcome and units, step 2 cookers (smoker card with Model, Hopper,
    Main grate; Griddle and Oven for holding; Add another cooker). Nothing is saved until the end
    (`finishSetup`). The step bar shows 3 steps. The alerts step is a slot: `Setup` takes `alertsStep`
    (`({ onBack, onFinish }) => node`, a `SetupPage` with step 3 of `SETUP_STEPS`); without it Continue on step 2
    finishes Setup. T-025 passes it from `app/setup.tsx`. The phone's back button goes one step back
    (`onBackPress`, wired to BackHandler in the route); on step 1 it is the system's.
  - `src/screens/setup/SmokerPicker.tsx`: search, type chips (All and each type that has a model), groups and
    notes from `data/cookers.json`. A verified model returns its catalog specs. An unverified model, or
    "Not listed? Enter it yourself", opens the manual form with every spec blank (name, type, lowest and
    highest temp, temp step or dial settings, main grate, hopper); temps typed in the user's unit, stored in F,
    hopper stored in lb.
  - `src/screens/shared/AddCooker.tsx` (mockup 17): Smoker, Griddle, Oven; `hide` leaves kinds out; the caller
    decides what each opens, so Gear can reuse it (T-026).
  - Routing: `app/setup.tsx` (Setup behind `SetupGate`: shown while `state.firstRun`, else redirects to `/`);
    `app/index.tsx` and `app/(tabs)/_layout.tsx` redirect to `/setup` on a first run. A 0.2.0 import that
    saved cookers ends the first run, so Setup does not show after it. The `app/dev/*` routes are outside the
    tabs and still open on a first run (the plan seeds save cookers).
- **Differs from 0.2.0, for "nothing moves when a value changes" (Jason to confirm):**
  - The smoker card keeps its Model, Hopper and Main grate fields when the smoker is switched off (0.2.0
    collapsed the card, which moved the rows under it).
  - The picker and the manual form are full-height sheets. In the form, Main grate is left and Hopper right
    (the grate keeps its half when the type has no hopper), and Dial settings is the last field (it shows only
    while Temp step is blank).
- **Left:** run `npm run check` in a checkout that may; a device check of a fresh install (keyboard over the
  hopper and grate fields on step 2, system back, font sizes 100/115/130%); fidelity PNGs 01, 02, 17; any
  device test that opens a tab on a fresh install without a seed now lands on Setup (check `tools/device`).
- **Questions for Jason:** see "Differs from 0.2.0" above; step 1 (Welcome and units) has no mockup and is
  built from the 0.2.0 screen; Continue stays off until there is a smoker or a griddle (0.2.0 rule: an oven
  alone is not enough), with no line saying why.
- **Goal:** first run: Welcome + units, cookers (picker with search and type chips; verified models fill specs,
  unverified stay blank; manual form), Add a cooker (17).
- **Files:** `app/setup/*`, `src/screens/setup/*`, `src/screens/shared/AddCooker.tsx`, tests, fidelity PNGs.
- **Depends on:** T-005, T-010.
- **Acceptance:** shown when no cookers are saved (not after a successful import); unverified catalog entries
  never prefill specs (CLAUDE.md).
- **Tests:** RNTL per step; picker groups from `data/cookers.json`.
- **Device testing (Jason):** none (dev build fresh install).
- **Jason's answers (2026-11-15):** the smoker card keeping its fields when switched off: OK. The manual
  form's field order: OK. Step 1 built from 0.2.0: OK. Continue on step 2 now says why it is off: "Add a
  smoker or a griddle to continue" above the buttons (its line keeps its space when hidden); built the same
  day.

### T-025 Alerts step, test alert, battery help
- **Status:** built 2026-11-15 on branch `t025`, unit-tested (Jest). NOT run on a device or emulator, and
  `npm run check` was NOT run (the session that built it was not allowed to): prettier, ESLint, typecheck,
  Jest, engine and gate tests pass; Android tests, Semgrep and Snyk are still to run. The battery help link is
  NOT on the screen (no approved wording or links, see Left). Not done until the gate passes, the link is
  settled and the real-phone checks are run.
- **Device test (2026-11-15):** the alerts step and its test alert pass in `setup` on the emulator at 115%.
  Fidelity PNG `docs/fidelity/rn-03-setup-alerts.png`. Jason approved it on 2026-11-15. Open: the test alert in Doze on the phone.
- **Built (2026-11-15):**
  - `src/screens/setup/AlertsStep.tsx` (mockup 03; a port of the legacy AlertsStep): title, intro, the
    permission rows (`AlertChecks`, read again on resume through `useAlarmStatus`), the test alert, Back and
    Finish setup. Finish works with permissions off. `app/setup.tsx` passes it to `Setup` as `alertsStep` with
    `permissionService`, `alarmService` and `onResume`.
  - `TestAlertButton` in `src/screens/shared/AlertChecks.tsx`: "Send a test alert in 10 sec" calls
    `alarms.testAlarm(10)` (the real alarm path) and then shows "Test alert set for <time>. Lock the phone to
    check it rings." under the button, last on the page, so nothing above it moves. A refused test alert
    shows nothing (the legacy has no wording for it).
  - `src/lib/maker.ts` (pure): `batteryHelpLink(manufacturer, links)` gives the maker's help link or null
    (trimmed, case-blind). `BATTERY_HELP_LINKS` is empty: the test uses stand-in links to show a Samsung gets
    one and a Pixel (Google) none.
  - Tests: `AlertsStep.test.tsx` (7), `src/lib/maker.test.ts` (5).
  - 2026-11-15: `src/lib/maker.ts` and its test are removed (Jason: the battery note is a plain line, no link).
- **Left:**
  - The battery help row: SPEC failure mode 10 says "troubleshooting link per maker" but no document, mockup
    or legacy screen has its wording, its place on the screen or the links. Needs from Jason: the makers, the
    URL for each, the row's copy and where it sits. Then: fill `BATTERY_HELP_LINKS`, add a manufacturer reader
    in `src/platform` (React Native `Platform.constants.Manufacturer`), pass it from `app/setup.tsx` and open
    the link with `AppLinks.openExternal`. None of that is built.
  - Real phone: the test alert in Doze; the OEM help link (OnePlus; a Samsung if available).
  - Emulator: fidelity PNG against mockup 03, font scale 100/115/130%.
  - The rows appear once the first status read answers (as in the legacy), so the test button sits a row
    group lower a moment after the step opens; to look at on the emulator.
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
- **Jason (2026-11-15):** no link to an outside site for battery help. A plain line instead, on this step
  and on Gear's Alerts sheet: "Alerts late or missing? Check the battery settings for Pit Planner in your
  phone's settings." (`BatteryNote`). `src/lib/maker.ts` and its empty link table are unused now.

### T-026 Gear screen (16)
- **Status:** built 2026-11-15 on branch `t026`, unit-tested (Jest). NOT run on a device or emulator, and
  `npm run check` was NOT run (the session that built it was not allowed to): prettier, ESLint, typecheck,
  Jest, engine and gate tests pass; Android tests, Semgrep and Snyk are still to run. No fidelity PNG yet
  (16 needs the emulator). Not done until the gate passes and Jason has seen the screen.
- **Device test (2026-11-15):** `gear` passes on the emulator at 115% (rows, Alerts, Units, Cook rates).
  Fidelity PNG `docs/fidelity/rn-16-gear.png`. Jason approved it on 2026-11-15.
- **Built (2026-11-15):**
  - `src/screens/gear/GearScreen.tsx` (a port of the 0.2.0 screen) and `app/(tabs)/gear.tsx`: Cookers (one
    row per cooker the user has; Add a cooker when one is missing, with the T-024 `AddCooker` sheet showing
    only the missing kinds), Your numbers (Cook rates with the `ratesSummary` line), App (Update available
    from `state.update` as a link to the download, Alerts with live status and the Alerts sheet of
    `AlertChecks`, Units with the Units sheet, Home Assistant "Coming later" with no chevron, Buy me a bag
    of pellets), then the version. Five taps on the version call `grantDebugPass()` and open `/debug`.
  - Props the route does not pass yet: `onCooker(kind)` (T-027: a cooker row, and the kind chosen in Add a
    cooker) and `onHistory` (T-028). Until then those rows do nothing. The route passes `version`
    (`Constants.expoConfig.version`), `permissions`, `onResume` and `onDebug`.
  - Units: the sheet calls `setUnits`; the hopper weight, the oven's holding temp and the cook rate are shown
    in the chosen units and stored as before (F, lb), which the test checks in the repos.
  - Kit (additive): `FootLine` (`rows.tsx`: the quiet centered line at the end of a screen, a 48 dp button)
    and the `bare` tone of `IconAvatar` (`surfaces.tsx`: no circle, accent icon, for the plus of Add a cooker).
- **Left:** `npm run check`; fidelity PNG 16; a look on the emulator at 100/115/130% font. T-027 passes
  `onCooker`, T-028 `onHistory`, T-032 writes `state.update`.
- **Questions for Jason:**
  - The 0.2.0 Alerts sheet had "Send a test alert in 10 sec" under the rows. It is left out here: its
    "Test alert set for ..." line appears after the tap and makes the sheet taller. Add it (with the line's
    space kept from the start), or leave the test alert to Setup and the hidden test screen?
  - Tapping the smoker row: 0.2.0 opened the smoker picker. Here it is `onCooker('smoker')` for T-027 to
    decide (there is no smoker sheet mockup; 17-19 are Add a cooker, griddle and oven).
  - Mockup 16 shows a chevron on Home Assistant; the screen follows 0.2.0 (no chevron, not tappable).
- **Goal:** cookers list, Cook rates and history links, Alerts sheet, Units sheet, Home Assistant "Coming
  later", support link, version (tap 5 times for debug), update row.
  The 5 taps call `grantDebugPass()` (`src/lib/debugPass.ts`) and then open `/debug`: in a release build
  that pass is the only way in (T-015).
- **Files:** `app/(tabs)/gear.tsx`, `src/screens/gear/GearScreen.tsx`, tests, fidelity PNG 16.
- **Depends on:** T-024.
- **Acceptance:** the units switch converts everywhere without changing stored values.
- **Tests:** RNTL rows and units switch.
- **Device testing (Jason):** none.
- **Jason's answers (2026-11-15):** the Alerts sheet gets "Send a test alert in 10 sec" (built: the line that
  says when it rings has its space reserved, so the sheet does not grow). Home Assistant row with no chevron:
  OK (Home Assistant is a later version).

### T-027 Cooker sheets: griddle, oven, smoker (17-19)
- **Status:** built 2026-11-15 on branch `t027`, unit-tested (Jest). NOT run on a device or emulator, and
  `npm run check` was NOT run (the session that built it was not allowed to): prettier, ESLint, typecheck,
  Jest, engine and gate tests pass; Android tests, Semgrep and Snyk are still to run. No fidelity PNGs yet
  (18, 19 need the emulator). Not done until the gate passes and Jason has seen the sheets.
- **Device test (2026-11-15):** the Griddle and Oven sheets, Add a cooker and the picker pass in `gear` on the
  emulator at 115%. Fidelity PNGs `docs/fidelity/rn-18-griddle.png`, `rn-19-oven.png`. Noted: the oven's
  default is Ask each time (mockup 19 shows Oven). Jason approved both on 2026-11-15.
- **Built (2026-11-15):**
  - `src/screens/gear/CookerSheets.tsx` (a port of the 0.2.0 file): `GriddleSheet` (mockup 18: Name, Cooking
    surface 17/22/28/36 in, Burners 1-4, Dome or cover), `OvenSheet` (mockup 19: Lowest oven setting in 5F
    steps from 140F to 250F, or 5C steps in Celsius, stored in F; Hold food in; Warming drawer, stored and
    still unused, T-041), and `CookerSheets({ kind, onClose })`, which reads the store and shows the sheet for
    that kind. For the smoker it is the T-024 `SmokerPicker` with its manual form, not a copy: a verified
    model replaces the smoker, a model without checked specs opens the blank form.
  - Nothing is saved until Save (`setGear`, so the `cookers` table and the plan input change together);
    Close, the scrim and back discard. A sheet opened from Add a cooker starts from `defaultGriddle()` /
    `defaultOven()` and adds nothing unless saved.
  - Remove: the griddle only when it is saved and there is a smoker (0.2.0); the oven only when it is saved
    and a smoker or griddle remains (0.2.0 let the oven go even as the only cooker, which here would send
    the app back to Setup). The smoker has no Remove: it is replaced through the picker.
  - `app/(tabs)/gear.tsx` keeps which cooker is open and passes `onCooker`; `GearScreen.tsx` is unchanged
    (its header comment still says the route does not pass `onCooker`: left alone because T-028 edits the
    same lines; fix it when the two are merged).
  - Tests (`CookerSheets.test.tsx`, 18): over the Gear screen wired as the route wires it and a real
    database: edit and Save persists in `cookers`, close discards, Remove rules, Add a cooker, Celsius and
    kg, and the plan built from the store (oven-on step and temp, missing-griddle warning).
- **Left:** `npm run check`; fidelity PNGs 18-19; a look on the emulator at 100/115/130% font.
- **Questions for Jason:**
  - In Celsius the oven stepper moves in 5C steps and shows 170F as 75 C, while the Gear row shows the same
    oven as "Holding at 76C" (set points show in 2C steps). This is how 0.2.0 did it. Keep, or step by 2C?
  - Remove oven is hidden when the oven is the only cooker (see above). OK?
- **Goal:** edit and remove cookers (Remove only when another remains; changes saved only on Save).
- **Files:** `src/screens/gear/CookerSheets.tsx`, tests, fidelity PNGs 18-19.
- **Depends on:** T-026.
- **Acceptance:** edits persist in `cookers` and the plan updates.
- **Tests:** RNTL sheets.
- **Device testing (Jason):** none.
- **Jason's answers (2026-11-15):** in Celsius the oven setting steps by 2C like smoker set points (built;
  stored in whole F; it now reads 76C where Gear reads 76C). Remove oven hidden when it is the only cooker:
  he asked for a recommendation; kept hidden (removing it would empty the gear and restart Setup).

### T-028 History and cook rates (20), with editing
- **Status:** built and unit-tested on branch `t028` (2026-11-15); not run on a device, and `npm run check`
  (Android tests, Semgrep, Snyk) not run on it yet. Fidelity PNG 20 not taken.
- **Device test (2026-11-15):** `history` passes on the emulator at 115% (rate sheet, cook sheet, Edit, Cook
  again, Remove). Fidelity PNG `docs/fidelity/rn-20-cook-history.png`. Noted: the card reads "chicken wings
  2 lb" (mockup 20: "wings 2 lb"), and a rate card shows for every by-weight food (mockup: brisket only).
  Jason looked on 2026-11-15: "wings 2 lb" or "chicken wings 2 lb" are both fine to him ("we know wings are
  chicken"). Open: the seven questions below; whether the rate cards for other foods stay.
- **Built:**
  - `src/screens/gear/HistoryScreen.tsx` (a port of the 0.2.0 screen): a rate card per by-weight food
    ("Brisket on Pit Boss 820": rate used and its source, cooks logged, saved total hours), the rate sheet
    (saved rate, "Keep my rate exactly", Clear my rate, total hours), the cooks newest first, and the cook
    sheet (planned vs actual per food, notes, Cook again, Edit, Remove from history with a second tap).
  - Edit (failure mode 14): smoker temp, each food's weight or count and time on heat (an hours stepper
    and a 5 min stepper), "Leave <food> out of rates" per by-weight food, notes. Save replaces that cook
    only; the rates on the screen follow at once.
  - No migration: "left out of rates" is the item's `discarded` flag (`cook_history_items.discarded`),
    the one a food that never came off heat already has; the engine and `logs()` already skip it. An
    edit is `historyRepo.update` (replace in place, never an insert) through the store's `updateRecord`.
  - Way in: Gear, Cook rates and Plan, Cook a past plan again both open it inside the Gear tab (the tab
    bar stays, as in the mockup) through the `history` param of `app/(tabs)/gear.tsx`; no new route file.
    Back (the arrow or the phone's button) goes to Gear, or to Plan when it was opened from there. Cook
    again sets the plan (Ready by, the cook's smoker temp, its foods) and opens Plan.
  - Kit: `Screen` and `AppBar` `onBack` (the back arrow of mockup 20).
- **Tests:** `HistoryScreen.test.tsx` (19: the screen, rate sheet, cook sheet, Cook again, Remove, edit,
  left out, kg, and the T-064 regression: looking at history writes nothing, and an edit or Remove leaves
  every other cook's rows as they were), `repos.test.ts` (update: edit, left out, missing cook),
  `store.test.tsx` (`updateRecord`), `PlanTab.test.tsx` (Cook a past plan again), `screen.test.tsx`.
- **Not built or not checked:** the route (`app/(tabs)/gear.tsx`: the `history` param, the phone's back
  button) has no unit test and was not run on a device. No fidelity PNG, no device test.
- **Found, not changed (outside this task's files):** `PlanScreen.tsx` shows Cook a past plan again when
  `state.history.length > 0` (the learned logs). A user whose only cooks are all left out of rates (or
  ended before any food came off) has past cooks and no button; `state.records.length > 0` is the rule
  Jason gave.
- **Questions for Jason:**
  1. Rate card tiles are the 0.2.0 ones (hr/lb with its source, Cooks, Total), not mockup 20's (Rate,
     Cooks, Timing "Per lb, 2 more cooks": size-adjusted no longer waits for cooks). Keep?
  2. Lines kept from 0.2.0 that mockup 20 does not show: "Rates are hours per lb at 225F. Tap a food to
     set your own rate or total hours." and "No cooks saved yet. Save a cook when it ends and your rates
     start to learn from it." Keep?
  3. New wording, all in the edit flow: the "Edit" button, the sheet title "Edit cook", "Smoker temp",
     the steppers' units "hr on heat" and "min", the note "Planned 9 hr on heat.", "Leave brisket out of
     rates" with "Rates learn from it." / "Rates do not learn from it.", "Notes", "Save". OK?
  4. Leaving out is per food, not per cook (a wrong Done on the brisket should not throw away the wings).
     A food left out reads "Not logged" on the cook sheet, as a food that never came off does. OK, or one
     switch for the whole cook?
  5. Cook again replaces whatever is on the plan without asking (as 0.2.0 did). Ask first when the plan
     is not empty?
  6. Back from history opened from Plan goes back to Plan. OK?
- **Jason's answers (2026-11-15, 4:40 PM):** (1) the 0.2.0 tiles stay (rate with its source, Cooks, Total).
  (2) The two helper lines stay. (4) Leaving out of rates stays per food. (6) Back from history opened from
  Plan goes to Plan. **To build:** a rate card shows only for a food that has been cooked or has a saved rate
  or total hours, not for every by-weight food; Cook again asks first when the plan is not empty ("Replace
  the plan you have now?"). Still open: (3) the Edit cook wording, to be judged from a screenshot.
- **Built from those answers (2026-11-15, gate-complete):** a rate card shows only for a food that is in a
  saved cook or has a saved rate or total hours; with no cards the "Rates are hours per lb" line is hidden
  too (it says "Tap a food"). Cook again with food on the plan: the first tap shows "This replaces the plan
  you have now. Tap Cook again to go on." under the buttons, the second tap does it; an empty plan is
  replaced at once. SPEC "Cook history" updated. Not on a device yet; the `history` device test still fits
  (its seed has a saved brisket rate).
- **Jason's look (2026-11-15, 5:20 PM):** `rn-20-cook-history.png` and the Edit cook wording
  (`rn-20-edit-cook.png`, question 3) approved. No questions left on this task.
- **Device test rerun (2026-11-15, 5:03 PM):** `history` passes at 115% with the rate-card change.
  `docs/fidelity/rn-20-cook-history.png` retaken; `rn-20-edit-cook.png` is the Edit cook sheet for Jason's
  look at its wording (question 3). Cook again asking first is covered by Jest only.
- **Goal:** rate cards (rate used, source, cooks logged, total hours; edit; "Keep my rate exactly"); cook list;
  cook sheet with Cook again, Remove and Edit (failure mode 14: correct actual minutes, quantity, pit temp, notes,
  or exclude from rates).
- **Files:** `src/screens/gear/HistoryScreen.tsx`, `src/db/repos/history.ts`, tests, fidelity PNG 20.
- **Depends on:** T-026, T-009.
- **Acceptance:** editing a cook changes the blended rate shown; excluded cooks do not count.
- **Tests:** RNTL; repo tests for edit and exclude; `engine/history.test.ts` unchanged.
- **Device testing (Jason):** none.
- **Plan's Cook a past plan again (Jason's T-017 review, 2026-11-13):** on the empty Plan (mockup 04) the
  button is not shown while there is no past cook, and is the bright accent text button of the mockup when
  there is one (never dimmed). That part is built (`PlanEmpty.tsx`, tests in `PlanScreen.test.tsx`, device
  test `plan` with `pitplanner://dev/plan?seed=past`). This task wires its handler (`onCookAgain` in
  `app/(tabs)/plan.tsx`) to the history list and Cook again, and keeps both states working.

---

## Phase 9: Share

### T-029 Share plan (export)
- **Status:** built and unit-tested on branch `t029`; not run on a device, and `npm run check` (Android tests,
  Semgrep, Snyk) not run on it yet.
- **Built:** `toPitPlan` was not in the Expo app (only in `legacy/src/lib/share.ts`), so it is ported as
  `src/lib/pitPlanFile.ts` (pure: `toPitPlan`, `pitPlanText`, `PLAN_FILE_NAME`). It keeps only `id`,
  `foodId`, `methodId`, `quantity`, `options` and `restMin` of each item, so the rate, total hours and timing
  model are dropped, as in 0.2.0. `src/platform/share.ts` exports `sharePlanFile` (cache file through
  `shareFile.ts`, then the share sheet: `application/json`, dialog title "Share plan"). `PlanTab` takes it as
  the `sharePlanFile` prop from `app/(tabs)/plan.tsx` and shares `cook.pitplan` (the 0.2.0 name), JSON
  indented by two. A share that fails shows nothing, as in 0.2.0. `fakeShare()` is in `src/platform/fakes.ts`.
- **Left:** the device check of the acceptance line (Gmail and Drive in the share sheet, the attachment
  arrives as `cook.pitplan`). `onPlanOpened` is T-030: `share.ts` exports no whole `ShareService` until then.
  Open question: move `pitPlanFile.ts` to `src/lib` (it is app logic, placed in `src/platform` only to stay
  inside this task's files).
- **Goal:** the share icon on Plan writes a `.pitplan` file (sender's rates and total hours dropped) and opens
  the Android share sheet.
- **Files:** `src/platform/share.ts`, `src/lib/pitPlanFile.ts`, tests (`src/lib/sharedPlan.ts` API unchanged).
- **Depends on:** T-017.
- **Acceptance:** Gmail and Drive appear in the share sheet; the file matches `toPitPlan`.
- **Tests:** Jest with the share fake; `engine/share.test.ts` unchanged.
- **Device testing (Jason):** none.
- **Jason (2026-11-15):** a failed share says so: sheet "Couldn't share" / "The plan was not shared. Try
  again." / OK (built).

### T-030 Open a shared plan (11), with the conflict fix
- **Status:** built, merged onto `main` and gate-complete 2026-11-15 (the Kotlin module compiles, its 16 JUnit
  tests pass, Snyk covers the new Gradle project). Device test `shared` passes on the emulator at 115%: a
  `.pitplan` opened with a `file://` VIEW intent shows the sheet, Use this plan fills Plan, a 300 KB file says
  it is too big, a text file says "This file is not a Pit Planner plan." Fidelity PNG
  `docs/fidelity/rn-11-open-shared-plan.png`. Not checked: a `content://` open from Files, Gmail or Drive
  (T-031), the conflict after an import on a device, the phone. Open: Jason's questions below and his look.
- **Jason's look (2026-11-15, 5:20 PM):** `rn-11-open-shared-plan.png` approved. He does not want built
  screens pulled back to the mockups: "I don't want to go back to the mock-up. You've got some good ideas."
- **Built (2026-11-15, branch `worktree-agent-a666a162b7613bda9`; unit-tested, not built or run on a device,
  Kotlin tests not run, `npm run check` not run):**
  - Intent filters: `plugins/pitplanIntents.ts` (pure) + `plugins/withPitplanIntents.ts` (TypeScript, as the
    other plugins), on the main activity only: VIEW of `content://`/`file://` typed `application/json`,
    `application/octet-stream` or `application/x-pitplan`; VIEW of a path ending `.pitplan`; SEND of the three
    types. The 0.2.0 filters without BROWSABLE.
  - Reading: new Expo module `modules/pit-share` (Kotlin `OpenedPlan`, `PitShareModule`; Robolectric tests).
    It takes the URI from the launch intent or a new intent (VIEW data or SEND `EXTRA_STREAM`, `content`/`file`
    only), reads at most 256 KB + 1 byte, and hands JS `{ text, name? }` or `{ error: 'tooBig' | 'unreadable' }`
    once. Not `expo-file-system`: it cannot see a SEND intent's file and reads a file whole.
  - `src/platform/share.ts`: `shareService` (`sharePlanFile` + `onPlanOpened`), the cap checked again in JS
    (`checkOpened`, bytes not characters). `src/screens/shared/OpenedPlan.tsx` holds the file at the root and
    opens the Plan tab; `app/+native-intent.ts` (`src/lib/systemPath.ts`) keeps Expo Router from treating the
    file URI as a route. No new route.
  - `SharedPlanSheet` (port of 0.2.0): menu, Serve on (offered day or the date and time pickers), the
    receiver's smoker (read-only: one smoker per phone), "No griddle set up." notes, "Replaces the plan you
    have now.". A file that cannot be opened shows the reason in the `ImportNotice` sheet with OK.
  - Conflict fix: `importPlan` / `importConflicts` in `src/lib/sharedPlan.ts`. After Use this plan, if a food
    that changed cooker is named in a warning (two temps at once, or a hold past its limit), the existing
    Conflicts sheet opens with its fixes. Neither the mockup nor 0.2.0 shows a conflict inside the Shared plan
    sheet, so nothing was added there (question for Jason below).
  - **Questions for Jason:** (1) where the conflict shows: as built (Conflicts opens after Use this plan), or
    inside the Shared plan sheet before Use this plan (needs a design), or only the orange Conflicts tile;
    (2) first line says "Someone shared a Saturday plan." as 0.2.0 did (the file has no name in it; the
    mockup says "Jason shared his Saturday plan."); (3) the too-big wording "That file is too big to be a Pit
    Planner plan." (0.2.0 said "Could not read that file." for every failure); (4) the smoker field is
    read-only with no chevron (the mockup shows one).
  - **Jason's answers (2026-11-15, 4:40 PM): all as built.** (1) The Conflicts sheet opens after Use this plan.
    (2) "Someone shared a Saturday plan." (no sender name in the file). (3) "That file is too big to be a Pit
    Planner plan." (4) The smoker field stays plain, no chevron.
  - **Device test:** see the T-030 report: a `file://` VIEW intent to a file in the app's own cache, and a
    `content://` open from the Files app.
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
- **Status:** built, merged onto `main` and gate-complete 2026-11-15 (`npm run check`, all six steps). Not run on a
  device; the real check against GitHub is part of T-038.
- **Goal:** Gear shows "Update available" for a newer release, prereleases included, compared by semver.
- **Files:** `src/lib/update.ts`, `engine/update.test.ts` (new cases added; existing ones unchanged),
  `GearScreen` test.
- **Depends on:** T-026.
- **Acceptance:** newer, same and network-error fixture cases; anonymous request at most daily.
- **Tests:** as above.
- **Device testing (Jason):** none here (see T-038).
- **Built (2026-11-15, on a worktree branch, `npm run check` not run there):**
  - `src/lib/update.ts`: full semver compare (a prerelease sorts below its final release, alpha.2 < alpha.10 <
    beta.1 < rc.1); the check reads the release list (`/releases?per_page=30`, not `/releases/latest`, which
    leaves prereleases out) and takes the highest version, skipping drafts and tags that are not versions.
    The request is passed in (`GetJson` in `src/platform/types.ts`, `src/platform/http.ts`: one GET, an Accept
    header, no credentials, 15 s timeout).
  - `src/lib/updateWiring.ts` (`useUpdateCheck`), mounted in `app/_layout.tsx`: at launch and on resume, only
    when the saved `checkedAt` is a day old or more. Overlapping calls make one request.
  - Release path (Jason, 2026-11-15): it comes from the installed version, with no control for it. A final
    install is offered final releases only, never an alpha, beta or rc. A prerelease install is offered any
    newer version, prerelease or final (0.3.0-beta.1 is told about 0.3.0-beta.2, 0.3.0-rc.1 and 0.3.0).
    `newestRelease(list, current)` picks on that path and `availableUpdate` applies the same rule to a saved
    result.
  - Failed check (Jason, 2026-11-15): offline, rate limited or an unreadable answer does not count as the
    day's check. `fetchLatest` returns null, nothing is saved (the last result and its time stay), and the
    next launch or resume tries again: one attempt each, no retry on a timer. Only an answer starts the 24
    hour wait. This differs from 0.2.0, where a failure waited a day.
  - SPEC section 10 reworded to match both.
  - The dev build ("Pit Planner dev") checks too, once a day, as built (Jason, 2026-11-15). Nothing to change.

### T-033 Release docs: notes, install guide, releasing checklist
- **Jason's review and answers (2026-11-15, 5:05 PM):** the four files are approved, no comments ("good to
  go"). Testers' phones: one has the latest Samsung; test Android 14, 15 and 16 (his own phone is 16). Testers
  get betas too (he sends a beta; the app then offers later betas and the final). A failed install: contact
  him at the address the debug screen uses. The version bump is committed before the build (as RELEASING.md
  says). 0.2.0 is only on Google Drive: GitHub has one tag and no release with an APK, and he has not made a
  GitHub release before, so the first one is done with him, step by step, from RELEASING.md. Left: INSTALL.md
  followed once on his wife's phone; update the docs where these answers change them (the contact line, betas).
- **Status:** written, merged onto `main` and gate-complete 2026-11-15. Not done until Jason has reviewed the
  four files, answered the six questions (HANDOFF) and followed INSTALL.md once on his wife's phone.
- **Goal:** friends can install or upgrade; Claude can release by checklist.
- **Files:** `docs/RELEASING.md`, `docs/INSTALL.md`, `docs/release-notes/0.3.0.md`, `README.md`.
- **Depends on:** T-007.
- **Acceptance:** Jason reviews; copy per CLAUDE.md; the notes explain the new look and the data import.
- **Tests:** none (docs).
- **Real phone:** yes: the install guide on his wife's phone.
- **Device testing (Jason):** follow INSTALL.md once on his wife's phone.
- **Notes (2026-11-15):** the four files are written, not yet reviewed by Jason. The release notes are a
  draft with a "Check before release" list. RELEASING.md commits the version bump before `npm run release`
  (the script needs a clean tree; TECH-DESIGN section 12 lists the commit after the build). The Android
  install prompts in INSTALL.md are written from stock Android, not checked on a phone.

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

### T-067 Fast test cook: a whole cook in minutes
- **Status:** built 2026-11-15 (eighteenth session); device test `fast-cook` passes on the emulator at 115%.
  Not run on the phone (needs Jason's yes to the listed actions). Asked for by Jason, 2026-11-15: "we should
  run a test cook, using minutes as hours and seconds as minutes to simulate".
- **Built:**
  - `src/lib/fastCook.ts` (pure, 8 Jest tests): `squeezeCook(input, plan, startAt, factor = 60)` moves every
    instant of a built plan toward `startAt` and shrinks the lengths the engine reads again on a live change
    (rest, slice, hold, prep lead, cooker preheat). The result is an ordinary cook: the store saves it and sets
    its alarms as for any cook. Nothing in `engine/` changed.
  - Dev link `pitplanner://dev/plan?seed=fast` (`app/dev/plan.tsx`, dev builds only): the mockup menu
    (brisket, wings, chicken breasts) on the mockup cookers, first step 20 seconds after the link opens, Serve
    about 12 minutes later; opens the Cook tab. `&x=<n>` picks another speed (`x=5`: about 2 hr 20 min).
  - Device test `fast-cook` (emulator, `x=240`, about 5 minutes with the test's own delays): Next up starts
    on Fire the smoker with alarms on the phone, every step is marked Done as it comes due, alerts show in the
    shade, no keep-or-move question, Serve opens Cook finished, ending the cook leaves no alarms.
- **Found while building (tell Jason):**
  - Steps that land in the same clock minute share one alert (`engine/alarms.ts`, one alarm per minute, as in
    any cook). At 60 times faster the 14 steps make about 4 alerts; the last one lists 8 steps, and Done on
    that alert marks all of them. For one alert per step the speed must be 5 or less (`x=5`).
  - A Done more than 2 and a half real minutes after a step counts as late (the engine rounds to 5 minutes)
    and the app asks keep or move serve, in real minutes. +15 and Not yet are also real minutes.
  - "N min past the step" repeats are every 10 real minutes, so a fast cook sees at most one per step: no
    flood.
  - Three kinds of step hang on engine constants in real minutes (Oven for holding, Set the smoker, hopper
    top-off). They ring at their squeezed times; after a change to the cook that re-times it they move to the
    real-minute lead or drop out. Followed step by step they have rung by then.
  - Saving a fast cook to history would feed a 9 minute brisket into the brisket rate: Discard it at the end
    (or `pitplanner://dev/alarm?cook=end`).
  - Not done: a full 60 times run watched on the emulator (it is longer than one tool run), and the phone
    run with the screen off.
- **Gate (2026-11-15):** `npm run check` passed all six steps on `main` with this task.
- **Goal:** a real menu's cook runs on the phone 60 times faster, so an 11 hr 25 min cook takes 11 min 25 s:
  every step, alarm, notification action and the Cook finished screen can be seen in one sitting before the
  real Saturday cook (T-037).
- **Not this:** a change to how real cooks are timed. Dev builds only; nothing of it in a release build.
- **Jason (2026-11-15):** "can be just a dev activity": a dev-only route like the other seeds, no user-facing
  control. So: started by a dev link (`pitplanner://dev/...`), the Saturday fixture as the menu, and the
  screen shows the squeezed real times (the cook really runs over the next minutes). Nothing left to settle.
- **To settle with Jason:** how it is started (a dev link like the other seeds, or a row on the hidden debug
  screen); whether the screen shows the scaled clock (5:00 PM) or real time; which menu (the Saturday
  fixture, or the plan on screen).
- **Notes for the build:** the engine takes time as an input, so the scaling belongs outside `engine/`: the
  plan's instants squeezed toward now by 60 before the cook is saved, alarms set from that. Steps 5 minutes
  apart become 5 seconds apart, so check what `setAlarmClock` and the notification grouping do with alarms
  seconds apart, and that "N min past the step" repeats do not flood.
- **Depends on:** T-021, T-023. Before T-037.
- **Acceptance:** the test cook runs start to Cook finished on the emulator with every alarm in order;
  then on the phone with the screen off.
- **Jason (2026-11-15, eighteenth session):** "that dev thing is just for testing. So maybe we only run that on
  an emulator then": no phone run. He wants to step through it and see how things happen; how is open (a
  visible emulator window he drives, or screenshots of every step from the device test).
- **Jason (2026-11-15, later):** "You drive it, and then I read it." Built: the `fast-cook` device test saves
  the Cook tab at every step as it comes due and the notification shade at every new alert, side by side in
  time order: `tools/device/out/fast-cook-1.png` to `-4.png` (not committed; `out/` is git-ignored). Passes
  at 115%. On the emulator the full-screen alert permission is off, so every picture shows "Alerts are off.
  Steps may not ring." (the alerts do ring).
- **Tests:** unit test for the scaling (pure); a device test on the emulator.
- **Real phone:** no (Jason, 2026-11-15: emulator only).

### T-037 Saturday cook on the Expo build (SPEC definition of done)
- **Android versions (Jason, 2026-11-15):** run the `alarm` device test on emulator images for Android 14 and
  15 as well as 16 (one tester has the latest Samsung; none known below 14).
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

### T-062 A name of the user's own for a food
- **Status:** todo (next version; `docs/design/BACKLOG.md`)
- **Why (Jason, 2026-11-14):** "user should be able to name it but default it to '11.5 lb brisket'
  initially"; "save ability to enter a username until next version."
- **Goal:** a name field on Food details that replaces the default label of T-061 everywhere it shows.
- **First step:** a mockup of the field for Jason's yes (new UI), then `ItemInput.name`, Food details, tests.
- **Depends on:** T-061, T-038 (0.3.0 out).

### T-060 Food cooking faster than the plan: brisket thickness and the starting smoker temp
- **Status:** todo (next version, after 0.3.0; needs Jason's answers and a decision on the behavior first)
- **Why (Jason, 2026-11-14):** on his 0.2.0 cook an 11.5 lb brisket, planned at 250F for 8 hr 50 min on
  heat, heated far faster than the plan. The equipment was not running hot: the grill held its set temp
  (his first report read that way; he corrected it after the chart was read). In his words: the initial
  temp was wrong, "we should have started lower"; "brisket has a thickness that we are not accounting for
  in the smoking process"; "the meat is heating faster and that is not what we want for a brisket. Slow
  and steady for tough meats." He turned the controller down at 1 hr 15 min because the meat was heating
  too fast. "We need to remember that behavior for the next version."
- **What the app does today:** time on heat comes from weight (hr/lb, or the size-adjusted model, time ~
  weight^exponent) scaled by smoker temp (`tempModel` in `data/foods.json`). Nothing knows how thick the
  cut is; the plan has one smoker temp for the whole cook; every settable temp from 200 to 300F is offered
  for brisket without comment; a cook that is turned down part way keeps its 250F timing.
- **Not this:** a grill missing its set temp, and not the Plan tab's "finish earlier" conflict fix dropped
  from SPEC on 2026-11-14.
- **Goal (to be settled with Jason):** a plan that keeps a tough cut low and slow, and a cook that follows
  what actually happens. Candidates, none decided:
  1. Thickness as an input for brisket (and other cuts where it matters), feeding the time on heat.
  2. A recommended smoker temp per food, with a note or warning when the plan's temp is above it for a
     tough cut (data in `data/foods.json`, not code).
  3. A smoker temp change during the cook (the user says "now at 225F") re-times what is left.
  4. A food running ahead of its rate re-times from probe readings (Home Assistant: T-050, T-054).
  Any cooking number (a temp ceiling, a thickness rule) needs a source, as for T-059; ask Jason which
  sources he trusts before choosing numbers.
- **Jason's answers (2026-11-14, during the cook):**
  - The cut: bought as a whole packer and cut down to a flat; about 1.5 inches thick in most places. The
    app's "brisket" is one food timed by weight, with no packer or flat choice and no thickness.
  - The probe: at about mid level at first; when he wrapped it he moved it to the end, pushed in about 5
    inches.
  - Why 250F: chosen so the brisket would be done for a 5:00 PM serve. The same cook has a smaller brisket,
    tri-tip and wings. So the serve time and the other foods drove the smoker temp up, and nothing in the
    app said that was a poor trade for a brisket.
  - End of the cook (Jason, later on 2026-11-14): the 11.5 lb brisket was pulled at 1:00 PM, because its
    temp had been stable at 210F for a few hours. He then turned the smoker back up to 250F "for the
    brisket and then tritip" (taken to be the smaller brisket still on; to confirm). Against the plan: 8 hr
    50 min on heat planned; the chart's cook time at 1:01 PM was 6 hr 36 min, about three of them level at
    205 to 210F.
- **What that adds to the candidates:** (1) is a cut choice (packer or flat) as well as, or instead of, a
  thickness number; (2) matters most when the temp is raised to make a serve time, so the note belongs
  where the temp is chosen (the temp menu rows already show the fire time) and in Conflicts.
- **Evidence:** `docs/screenshots/pitboss_001.jpg` (Jason, 2026-11-14): the Pit Boss app's chart for the
  cook, 4 hr 58 min, in F. Read off the image, so within about 5F and 5 minutes; only the set temp line is
  named in the image, the other lines are taken to be the grill (blue) and two probes (green, yellow):
  - Set temp: about 250F for the first 1 hr 15 min (the plan's temp), then about 220 to 225F until about
    3 hr 35 min, then about 205F to the end.
  - Grill: 20 to 25 minutes to come up, with one dip of about 20F on the way; after that within a few
    degrees of the set temp at every stage.
  - Green probe: 165F at about 1 hr 20 min, a slow climb through 165 to 185F until about 2 hr 55 min, 205F
    at about 3 hr 25 min, then level at 205F. Yellow probe: 45F rising to 65F (not in the food).
  - Against the plan: 205F on the probe at about 3 hr 25 min, with 8 hr 50 min planned on heat, even though
    the smoker was turned down below the plan's temp after 1 hr 15 min.
- **Evidence, second chart:** `docs/screenshots/pitboss_002.jpg` (Jason, 2026-11-14, taken at 1:01 PM; not
  committed yet: the phone's status bar with other apps' icons lies over the chart, and the repo is public).
  The whole cook to the pull, 6 hr 36 min. Read off the image, so rough; its times come out about 10%
  earlier than the first chart's for the same events, so take times within about 20 minutes:
  - Set temp: about 250F for the first hour or so, about 220F, a short step up to about 235F, then about
    208 to 210F for the rest, until the last 10 minutes, where it goes back up toward 250F.
  - Grill: on the set temp throughout.
  - Green probe: about 165F at 1 hr 10 to 1 hr 20 min, a slow climb to about 185F, about 205 to 210F from a
    little after 3 hr, then level to the end; it starts to drop in the last minutes (the pull).
  - Yellow probe: 45 to 65F throughout (not in the food).
- **Jason's note, mid-afternoon 2026-11-14 (dictated, so some words are unclear; ask before relying on a
  number):** the tri-tip and the small brisket are not reaching 185-200F. The Chef iQ probes read about 160F
  and have not reached 180F. The Pit Boss app had shown the same food much higher than it shows now: P1 reads
  165 and 170, P2 reads 170 (the tri-tip is the yellow line on a chart he took earlier at 255F). Chef iQ says
  47 minutes to reach the target temps; that differs a lot from the Pit Boss temps, which worries him ("for
  some reason... the app just isn't showing correctly"). The smoker is at 250F. The wings are not started: he
  put them off until 3:20 PM because of the tri-tip and the small brisket. He will add screenshots of both
  apps as `docs/screenshots/pitboss_003.jpg`, `_004` and probably `_005` (that folder is git-ignored), and
  write up more. Probes (Jason, same afternoon, from memory: "I believe that's the way it is"): each food has
  two probes, one from each maker, close to the same spot: Pit Boss P1 and Chef iQ probe 1 in the brisket,
  Pit Boss P2 and Chef iQ probe 2 in the tri-tip. Disregard "I've got those pulled right now" (Jason: he cannot recall what it was
  about). What it adds here: two thermometers in the same food disagreeing by 10F or more, and a
  later food (wings) pushed back by hand because earlier food ran long: the opposite of the brisket that
  finished early.
- **Jason's note, about 3:30 PM 2026-11-14 (dictated; ask before relying on a number):** the app's brisket
  "done" step came up at 3:30 PM and he hit Done by accident; 0.2.0 has no way to take that back. The brisket
  was not done: it was not at 200F and not tender, so he left it on, put the wings on, and is turning the
  smoker up to about 280F ("I should have turned it up to 300. I missed that setting"). His ask: "if
  there's things that are missed, we should be able to go back and set... on the full timeline, I should be
  able to click on the timeline and readjust it if something happened" (in BACKLOG.md; whether an undo for
  Done belongs in 0.3.0's Cook screen is a question for him). Probes, corrected: the charts are in
  `docs/screenshots/pitboss_003.jpg` to `_005.jpg` and `pitboss_006.png` (git-ignored; read on 2026-11-14,
  see "Evidence, charts 3 to 6" below). In `pitboss_006.png` the Pit Boss app's lines are probe 3 ambient,
  probe 3 food and probe 1 food;
  the small brisket went on first and is probe 3 in that image, and he thinks Pit Boss probe 3 pairs with
  Chef iQ probe 1 and Pit Boss probe 1 with Chef iQ probe 2 (Jason, later the same day: the image has the
  Pit Boss probe 1 and probe 2 readings, and under them lines named "probe 3 food temp" and "probe 1 food
  temp"; "small brisket = probe 3" means that probe 3 food temp line in `pitboss_006.png`. Read the image
  to settle the pairing). The brisket had only reached about 170F.
- **2026-11-15 (Jason):** the cook is done. The chart files `pitboss_002.jpg` to `_005.jpg` and
  `pitboss_006.png` are deleted (his yes); what they showed stays below in words, so the pairing can no
  longer be settled from an image: only Jason can say. `pitboss_001.jpg` stays in the repo (his call).
  Phone reads for this task (read-only, his yes; files in the git-ignored
  `tools/device/out/t060-2026-11-15/`): `dumpsys package` (0.2.0, versionCode 200, updated 2026-11-12),
  `dumpsys alarm` (the app's entries only), and the app's own logcat lines, which came back empty: the
  phone's log buffer held nothing from the app's uid, so there is no log of the 2026-11-14 cook. The alarm
  dump shows 18 exact alarms of 0.2.0 pending for Saturday 2026-11-21, 6:30 AM to 5:00 PM: a cook started
  for next Saturday. Nothing about the 2026-11-14 cook is left in it. The stored cook data can only come
  out through the app.
- **Evidence, charts 3 to 6** (`docs/screenshots/pitboss_003.jpg` to `_005.jpg`, `pitboss_006.png`; read
  by a session on 2026-11-14, described in words only: they are git-ignored and never go into the repo).
  Read off the images, so temps within about 5F and times within about 20 minutes.
  - **`pitboss_003.jpg`** (Pit Boss app, portrait, phone clock 2:55 PM, cook time 8 hr 19 min). Its legend
    names all four lines, which settles what the first two charts left as a guess: grey is the set temp,
    blue the grill, **green is Probe 1, yellow is Probe 2**. The tiles under the chart read: grill 247F,
    "Heating to 250", P1 165F, P2 170F, each with a target that looks like 180F (half hidden).
  - **`pitboss_004.jpg`** (the same chart full screen, landscape, cook time 8 hr 31 min). The clearest
    one. Set temp: about 250F to about 1 hr 15 min, about 222F to about 2 hr 15 min, a step up to about
    235F until about 2 hr 40 min, about 222F again to about 3 hr 30 min, then about 208 to 210F until
    about 6 hr 35 min, then back to 250F to the end. Grill: starts warm (135 to 175F on the two charts),
    up in about 25 minutes, then on the set temp at every stage. Probe 1 (green, the 11.5 lb brisket):
    about 45F at the start, climbing from about 30 minutes, about 165F at about 1 hr 30 min, a slow climb
    to about 185F at about 3 hr 20 min, about 208F at about 3 hr 45 min, then level at about 208 to 210F
    for about three hours; it falls to about 75F at about 6 hr 50 min (the pull at 1:00 PM, probe out)
    and stays there until about 8 hr 10 min, when it jumps to about 165F. Probe 2 (yellow): 45F rising
    slowly to about 65F for the whole cook (not in food), then the same jump at about 8 hr 10 min to
    about 170F. So both Pit Boss probes went into the food still on the smoker only at about 2:35 to
    2:55 PM; before that the Pit Boss app had no reading of the small brisket or the tri-tip at all.
  - **`pitboss_005.jpg`** (Chef iQ app, phone clock 2:57 PM). Probe 1: 159F of a 180F target,
    "Calculating...", ambient 168F. Probe 2: 158F of a 180F target, "Remove in 48m", ambient 204F. Both
    on Manual.
  - **`pitboss_006.png`** (a Home Assistant dashboard, not the Pit Boss app; no clock in the image, the
    file is from 3:29 PM). Grill card "PitBossSmoker Grill temperature": target 270F, reading 217F,
    "Fan". Then five sensors with small history lines: PitBossSmoker Probe 1 172.0F (rise, long level
    stretch, a drop, back up: the big brisket, the pull, the move to another food); PitBossSmoker Probe 2
    177.0F (low for the whole cook, one step up at the end); Probe 3 Ambient temperature 183.7F (flat,
    then up late and jumpy); Probe 3 Food temperature 166.6F and Probe 1 Food temperature 161.6F (both
    flat, then a climb late). The three "Probe N food/ambient" sensors have the Chef iQ shape (food and
    ambient per probe), so they are taken to be the Chef iQ probes under Home Assistant's names; the
    Chef iQ app itself calls its probes 1 and 2.
  - **What the four add:**
    - Two thermometers in the same food: at 2:55 to 2:57 PM Pit Boss read 165F and 170F where Chef iQ
      read 159F and 158F (6F and 12F apart); at about 3:30 PM, 172F and 177F against 166.6F and 161.6F
      (5F to 15F apart, depending on the pairing). Pit Boss was the higher one every time.
    - **The pairing is not settled by the images, and only Jason knows it** (Jason, 2026-11-14: he
      knows it only because he placed the probes himself, with many probes across the meats). Nothing
      in `pitboss_006.png` ties a Pit Boss probe to a Chef iQ probe or a probe to a food; "small brisket
      = probe 3" is his memory. **When this task is picked up again, ask him for the pairing before
      comparing any two probe lines**, and have him write it down at the start of the next cook (which
      probe, which maker, which food, where in the food). Home Assistant's entity names (T-050) say
      which sensor is which, not which food it is in. What this means for the app: any feature that
      re-times from probes (candidate 4) needs the user to say which probe is in which food.
    - Chef iQ's ambient sensors read 168F and 204F with the grill at 247F: the air next to the meat was
      40 to 80F under the grill's own reading. A plan timed from the set temp does not see that.
    - The grill read 217F against a 270F target at about 3:30 PM (just turned up, or the lid open for
      the wings; Jason's 3:30 PM note says he was turning it up to about 280F).
    - The big brisket's level stretch at 208 to 210F ran with the set temp at 208 to 210F: the meat had
      reached the smoker's temp and could not go higher, so the level line alone does not show doneness.
      It was done all the same: Jason checked it with a probe before pulling and "it was good to go"
      (Jason, 2026-11-14). So the 11.5 lb flat was probe tender at 6 hr 36 min against 8 hr 50 min
      planned.
- **Logs (Jason, 2026-11-14):** pull the logs from the phone once his cook plan is complete, for this
  analysis. Not before he says the cook is done; the phone hold and the list-and-yes rule apply.
- **First step:** the answers above, then a SPEC section and mockups for any new UI (no UI element without
  his yes), then the data and engine work with tests.
- **Files (expected):** SPEC.md sections 3 and 4, `data/foods.json`, `engine/plan.ts`, `engine/live.ts`,
  Food details, the Cook screen.
- **Depends on:** T-021 (Cook screen), T-038 (0.3.0 out). Related: T-050, T-053, T-054 (Home Assistant
  probes), T-059 (sourced food numbers).
- **Acceptance:** per the decision. Nothing re-times without the user's tap.
- **Tests:** engine unit tests for whatever is decided; RNTL for any prompt.
- **Device testing (Jason):** a real brisket cook.

---

## Phase 12: Home Assistant (after 0.3.0)

Plan: `docs/HA-INTEGRATION.md` (Phase 0 done: `docs/ha-entities.md`).

### T-063 Take back a step marked Done by mistake
- **Jason's answers to the build's questions (2026-11-15, 4:15 PM):** (1) Undo also takes back changes made
  to the cook after the Done, and the row says so (as built). (2) The row names the step as Next up words it,
  "Undo: Check the brisket" (as built). (3) An overdue step taken back rings again 10 min later (as built).
  (4) Add a proper undo arrow icon to the kit; the row stops using Start over's icon. **Built.** (5) Cook
  finished gets a way back to the cook for a Serve marked Done by mistake ("Back to the cook"; approved as a
  new control on that screen; write the SPEC line with it). **Built.**
- **Jason's answers (2026-11-15, 5:00 PM):** Back to the cook stays in the accent colour; it always gets its own line under Discard this cook (built; he confirms from the screenshot).
- **Gate, follow-up (2026-11-15):** the undo arrow icon and Back to the cook are on `main`; `npm run check` passed. Not on a device. Two small questions for Jason: the button's colour (accent as built, or grey) and whether it gets its own line when the row wraps.
- **Gate (2026-11-15):** merged onto `main` and `npm run check` passed all six steps. No device test yet.
- **Jason's look (2026-11-15, 5:20 PM):** `rn-13-cook-options-undo.png` and `rn-15-cook-finished-back.png`
  approved (Back to the cook on its own line, the colours as they are).
- **Device test (2026-11-15):** `followups` passes on the emulator at 115%: Done on the next step, the Undo row
  is first in Cook options and names the step, Undo puts Next up back and the row is gone; Done on Serve,
  Back to the cook on its own line on Cook finished, tapping it shows Live cook on Serve. Fidelity PNGs
  `docs/fidelity/rn-13-cook-options-undo.png`, `rn-15-cook-finished-back.png`. Open: Jason's look at both
  (on a first cook the footer holds Save and three lines, so less of the screen scrolls above it).
- **Status:** built 2026-11-15, unit-tested on a worktree branch; `npm run check` and device test not run.
  (0.3.0; Jason, 2026-11-14: "there needs to be somewhere to undo it in version 0.3.0. I don't want to wait
  till the next version")
- **Why:** on his cook of 2026-11-14 the brisket's done step came up at 3:30 PM and he hit Done by accident.
  0.2.0 has no way back; the brisket was at about 170F and stayed on.
- **Jason's answers (2026-11-15):** the undo is a row in Cook options that names the step ("Undo: Brisket off
  the smoker"), not on the Cook screen itself. It is offered for the most recent Done only, until the next
  step is marked done. He thought about tying it to the same food's steps and chose the simple rule: "let's
  go with your recommendation. We can always change it later." This is the approved SPEC line for the UI;
  write it into SPEC (Live cook, Cook options) with the task.
- **Goal:** a step marked Done on the Cook screen can be put back to not done, with its alarms and the
  steps after it as they were before the tap.
- **Not this:** editing any step on the full timeline (next version, BACKLOG.md).
- **First step:** how it looks and for how long it is offered (a mockup or a SPEC line) is Jason's to
  approve before any UI: nothing in `docs/mockups` shows it.
- **Files (expected):** SPEC.md section for Live cook, `engine/live.ts` or `engine/cookState.ts`, the Cook
  screen (T-021 on), tests.
- **Depends on:** T-021. Do it with the Cook screen tasks, before T-038 (release).
- **Acceptance:** per the approved design; after undo, the next alarm and Next up are what they were before
  Done was tapped.
- **Tests:** engine unit tests (done then undone equals never done); RNTL for the control.
- **Device testing (Jason):** mark a step Done in a test cook, take it back, judge Next up and the alarm
  against what showed before the tap.
- **Built (2026-11-15):**
  - `engine/undo.ts` (pure, `engine/undo.test.ts`): `rememberDone` keeps the cook's progress as it is just
    before a Done (plan, reminders, on / off heat times, notice); `undoDone` puts it back and takes the step
    out of `done`; `ringTimes` merges reminders and ring-agains for the alarm set. Done then undone equals
    never done, for a pull and for a Done that moved later steps and serve.
  - `src/lib/cook.ts`: `ActiveCook.undo` (the snapshot, set by every `doneStep`, so the next Done replaces
    it) and `ActiveCook.ringAgain`; `undoable`, `undoStep`. Both live in the saved cook JSON: no schema
    change, no migration. A cook saved before this loads with nothing to undo (`normalize`).
  - `src/screens/cook/CookOptions.tsx`: the row "Undo: Check the brisket" (the step's title as Next up
    words it), first in the list, with "Done at 11:33 AM. Puts the step and its alerts back." It closes the
    sheet and saves through `setCook` (one save, one alarm set). SPEC sections 3, 5 and 9 updated.
  - Rules built:
    - Done from an alert with the app closed is a Done like any other: it can be taken back the same way.
      When one alert holds two steps, only the last of them can be.
    - Serve: Done on Serve goes to Cook finished, where "Back to the cook" takes it back (follow-up below).
      If the app is left and reopened, Live cook shows again and Cook options offers "Undo: Serve".
    - A Done that re-timed later steps or moved serve: all of it goes back (the whole plan from before the
      tap is restored).
    - A change made between the tap and the undo (Running behind, Not yet, +15, Back up to temp) is taken
      back too; the row then reads "Done at 11:33 AM. Also takes back the changes made since." Quiet and
      Pit went out are left as they are.
    - A step that was already due when it was marked done had its alert and repeats stopped by the Done.
      Taken back, it rings again 10 min after the undo; its time on Cook does not move ("Overdue since").
  - Not done: the live-cook state table (`engine/cookState.ts`, TECH-DESIGN section 7) does not list undo as an action; nothing
    reads it for Cook options. No device test, no fidelity PNG.
- **Built (follow-up, 2026-11-15):**
  - `src/components/kit/icons.tsx`: `UndoArrow`, drawn like the other kit icons (24 dp grid, 2 dp stroke, no
    new dependency). The Undo row in Cook options uses it; Start over keeps `Restart`.
  - Cook finished: "Back to the cook", a text button in the row with "Discard this cook", under Save to
    history (which stays full width). Shown only while Serve is the most recent Done and its undo snapshot is
    kept (`serveUndoable` in `src/lib/cook.ts`), so also after End cook in that state. `CookFlow` takes the
    Done back with `undoStep`, saves through `setCook` (one save, one alarm set) and shows Live cook. If
    Serve was already due it rings again 10 min later, like any overdue step taken back. SPEC section for Cook
    finished updated.
  - Still open: no device test, no fidelity PNG. On the first cook the bottom row holds three items
    (Discard, Back to the cook, the support link) and wraps to two lines; to judge on the device.
- **Questions for Jason (answered above):**
  1. You mark a step Done by mistake, then shift the cook (say Running behind 15 min), then tap Undo.
     (a) Undo also takes the shift back and the row says so (built), or (b) once you change the plan, the
     Undo row goes away.
  2. The row's name is the step as Next up words it: "Undo: Check the brisket". (a) Keep that, or (b) a
     shorter name per kind of step, like your "Undo: Brisket off the smoker" (needs wording for each kind).
  3. An overdue step you take back: (a) it rings again 10 min later (built), or (b) it rings again right
     away.
  4. The Undo row has the same icon as Start over. (a) Fine for now, or (b) add an undo arrow icon.
  5. Serve marked Done by mistake lands on Cook finished with no Undo there. (a) Leave it (reopen the app
     to get back to the cook), or (b) add a way back from Cook finished.

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
