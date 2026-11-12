# Security exceptions

Every high or critical Semgrep or Snyk finding is fixed, or written up here with a justification, an owner
and a review date. Nothing else may be ignored, excluded or scoped out of `npm run check`. When an entry is
resolved, mark it closed with the commit; do not delete it.

Format: ID, tool and rule, what was found, decision (false positive / not shipped / accepted risk),
justification, how it is excluded, follow-up task, review date.

---

## SE-001 Snyk Open Source: Android build-tool dependencies (AGP test runner)

- **Status:** open, scope limit approved by Jason 2026-11-12. T-057 removes the limit by 2027-02-01.
- **Tool:** `snyk test --all-projects` (Gradle projects: `android/app`, the Capacitor plugin modules).
- **Found (2026-11-12):** 28 unique high/critical issues, mostly `io.netty:netty-codec`, `netty-codec-http`,
  `netty-handler` 4.1.93-4.1.110 (for example SNYK-JAVA-IONETTY-17254120 and -19005879, critical), all
  introduced by `com.android.tools.utp:android-test-plugin-*@31.13.0` and
  `com.google.testing.platform:*@0.0.9-alpha03` (the Android Gradle Plugin 8.13.0 Unified Test Platform,
  `grpc-netty`).
- **Decision:** not shipped. These libraries are resolved into Gradle configurations used to drive emulator
  and instrumented tests on the build machine. They are not in the APK. The same scan limited to
  `releaseRuntimeClasspath` (exactly what is packaged) reports 0 vulnerable paths in all 9 projects.
- **Exposure:** the netty code would run only during `connectedAndroidTest` / managed-device runs on Jason's
  machine, which this project does not use (device testing goes through `tools/device/`, adb and CDP).
- **How it is excluded:** `tools/check.sh` passes `--configuration-matching='^releaseRuntimeClasspath$'` to
  `snyk test`. npm projects are scanned unchanged. `npm run snyk:monitor` still monitors all configurations,
  so the findings stay visible in the Snyk dashboard.
- **Follow-up:** T-057, upgrade AGP/Gradle within what Expo SDK 58 supports and re-run the full scan;
  if clean, remove the `--configuration-matching` flag and close this entry.
- **Approval:** approved by Jason 2026-11-12 (TECH-DESIGN D-3), on the condition that `snyk:monitor` keeps
  covering all configurations and T-057 removes the limit by 2027-02-01.

## SE-002 Snyk Code: "Hardcoded Non-Cryptographic Secret" in reference/cook-day-planner.html; reference and docs excluded

- **Status:** open (false positive, paths excluded). Review if anything under `reference/` or `docs/` is ever
  built, served or shipped.
- **Tool:** `snyk code test`, finding 63bb71cc-262e-4cdd-a928-e009eba2bb0c, line 463.
- **Found (2026-11-12):** `const KEY = 'cookDayPlanner.v2';`
- **Decision:** false positive and not shipped. The string is the name of a `localStorage` key, not a secret.
  `reference/` holds the archived single-file HTML planner the app replaces (SPEC header); it is kept for
  comparing scheduling rules, is not imported by `src/` or `engine/`, not bundled by Vite and not in the APK.
  `docs/` holds design documents, mockup sources (`docs/mockups/source/*.dc.html`) and screenshots: reference
  material, not shipped code.
- **How it is excluded:**
  - Snyk Code: `.snyk` `exclude.global`: `reference/**`, `docs/**` (plus `dist/**`, `release/**`, build output
    of scanned sources).
  - Semgrep: `.semgrepignore`: `reference/`, `docs/`.
  - `snyk test` (open source) is unaffected: neither folder has a manifest.
- **Shipped code still fully scanned (checked 2026-11-12):** of the 150 tracked or new files under `src/`,
  `engine/`, `data/` and `android/`, Semgrep scanned every text file (99); the 51 it skipped are binary
  (50 PNG resources, `gradle-wrapper.jar`). No file under those folders matches a `.snyk` exclude. Git-ignored
  local or generated paths under `android/` stay excluded from Semgrep on purpose: `build/` and `.gradle/`
  output, `app/src/main/assets/public/` (a copy of the Vite build of `src/`), `local.properties` (SDK path) and
  `keystore.properties` (signing passwords, never committed; scanning it would print them).
- **Follow-up:** none. Do not edit `reference/` to satisfy the scanner. Re-check the coverage numbers if the
  exclude lists change: `semgrep scan --json --no-git-ignore ...` (`paths.scanned`) against
  `git ls-files --cached --others --exclude-standard src engine data android`.

- **Extended in T-002 (2026-11-12) to `legacy/`:** the Capacitor app (0.2.0 UI, Android sources, Vite
  config, WebView device scripts) moved there as reference until 0.3.0 reaches parity (TECH-DESIGN D-6), and
  is deleted in T-039. Nothing at the root imports it; it is not built, linted, tested or packaged from
  `main`. The shipped 0.2.0 code was scanned by this gate before the move (commits up to `b524245`); a 0.2.x
  hotfix is built on a branch from tag `v0.2.0`, where the old gate (and the old paths) apply.
  Excluded in `.snyk` (`legacy/**`), `.semgrepignore` (`legacy/`), and `snyk test --exclude=...,legacy`
  in `tools/check.sh` (its Gradle project would otherwise be scanned as a second app).
  Also excluded from Semgrep: the generated `android/` and `.expo/` (Continuous Native Generation,
  TECH-DESIGN D-7). Their sources (`app.config.ts`, and from later tasks `plugins/` and `modules/`) are
  scanned; `snyk test` still scans the generated Gradle project's dependencies (scope per SE-001).

## SE-003 Snyk Open Source: `braces` and `open` in Expo / React Native dev tooling

- **Status:** open, pending Jason's approval (written in T-002, 2026-11-12). Review by 2027-02-01 (the `.snyk`
  ignores expire then) or at the next Expo SDK upgrade, whichever is first.
- **Tool:** `snyk test --all-projects` (npm, `package-lock.json`).
- **Found (2026-11-12, first scan of the Expo stack):**
  - SNYK-JS-BRACES-19963945, high, Uncontrolled Recursion in `braces@3.0.3`, via `metro > metro-file-map >
    micromatch@4.0.8` (from `react-native` and from `expo > @expo/cli > @expo/metro`). No fixed `braces`
    release exists.
  - SNYK-JS-OPEN-22112123, high, Improper Encoding or Escaping of Output in `open@8.4.2`, via
    `@react-native/dev-middleware` (from `expo > @expo/cli` and from `react-native > community-cli-plugin`).
    Fixed in `open@11`, which is ESM-only; dev-middleware `require()`s it, so an override would break the dev
    server.
- **Decision:** not shipped. Metro (the bundler and its file watcher) and dev-middleware (the dev server that
  opens the JS debugger in a browser) run on the build machine only. Checked: the source map of the Android
  bundle (`npx expo export --platform android --source-maps`) lists 1116 modules, none from `braces`,
  `micromatch`, `open`, `metro-file-map` or `@react-native/dev-middleware`.
- **Exposure:** `braces` would need an attacker-controlled glob pattern fed to Metro's watcher; `open` would
  need an attacker-controlled URL passed to the dev server's "open debugger" endpoint, which listens on the
  local machine during development only.
- **How it is excluded:** `.snyk` `ignore` entries for exactly the four dependency paths above, with reasons and
  `expires: 2027-02-01`. Any other path to these packages (for example into shipped code) still fails the gate.
  `snyk monitor` keeps reporting them.
- **Follow-up:** re-run `snyk test` after each Expo SDK upgrade; remove the ignores when Metro and
  dev-middleware ship fixed versions. If the ignores expire first, re-check and re-approve here.
- **Approval:** pending Jason.

---

## Below the gate (for awareness, not exceptions)

- Snyk Code, low: "Path Traversal" in `tools/device/*.mjs` (now `legacy/tools/device/`) (backup, capture, cook, ...). These are
  developer-only scripts run by hand on Jason's machine with paths from their own arguments; not shipped.
  Revisit if any of them ever takes input from a file or network source.
