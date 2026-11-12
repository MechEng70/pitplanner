# Security exceptions

Every high or critical Semgrep or Snyk finding is fixed, or written up here with a justification, an owner
and a review date. Nothing else may be ignored, excluded or scoped out of `npm run check`. When an entry is
resolved, mark it closed with the commit; do not delete it.

Format: ID, tool and rule, what was found, decision (false positive / not shipped / accepted risk),
justification, how it is excluded, follow-up task, review date.

---

## SE-001 Snyk Open Source: Android build-tool dependencies (AGP test runner, lint, Robolectric)

- **Status:** open. Scope limit approved by Jason 2026-11-12 and kept by him on 2026-11-12 for the SDK 58 count
  below. T-057 removes the limit by 2027-02-01.
- **Tool:** `snyk test --all-projects` on the Gradle projects of the generated `android/` (`app`, the
  autolinked Expo modules and `pit-alarms`).
- **Found (2026-11-12, Expo SDK 58: AGP 9.2.1, Gradle 9.4.1; 21 Gradle projects):** 53 unique high/critical
  issues, 6 critical (SNYK-JAVA-IONETTY-17254120 and -19005879; SNYK-JAVA-ORGBOUNCYCASTLE-16075260,
  -18512779, -18512810, -18519194). All come from build-machine configurations:
  - the AGP Unified Test Platform 32.2.1 (`com.android.tools.utp:*`, `com.google.testing.platform:*@0.0.9-alpha04`):
    `grpc-netty` -> netty 4.1.93/4.1.110, `sdk-common` -> guava, bouncycastle 1.79;
  - `com.android.tools.lint:lint-gradle` 32.2.1;
  - Robolectric 4.16 test dependencies of `expo`, `expo-modules-core`, `expo-dev-launcher`, `expo-dev-menu`
    (bouncycastle 1.81).
- **Decision:** not shipped. These libraries are resolved into Gradle configurations that drive unit,
  instrumented and lint runs on the build machine. They are not in the APK. The same scan limited to
  `releaseRuntimeClasspath` (exactly what is packaged) reports 0 vulnerable paths in all 21 projects
  (re-run 2026-11-12).
- **Exposure:** the netty and bouncycastle code runs only on Jason's machine during Gradle test and lint tasks
  (`testDebugUnitTest` for our modules; no `connectedAndroidTest` or managed devices). Device testing goes
  through `tools/device/`: adb, and Maestro from T-006.
- **How it is excluded:** `tools/check.sh` passes `--configuration-matching='^releaseRuntimeClasspath$'` to
  `snyk test`. npm projects are scanned unchanged. `npm run snyk:monitor` still monitors all configurations,
  so the findings stay visible in the Snyk dashboard.
- **Follow-up:** T-057, upgrade AGP/Gradle within what the Expo SDK supports and re-run the full scan; if
  clean, remove the `--configuration-matching` flag and close this entry. Re-count after every Expo SDK upgrade.
- **Approval:** approved by Jason 2026-11-12 (TECH-DESIGN D-3), on the condition that `snyk:monitor` keeps
  covering all configurations and T-057 removes the limit by 2027-02-01. Scope confirmed unchanged by Jason
  2026-11-12 for the SDK 58 count (53).
- **History:**
  - 2026-11-12, Capacitor 0.2.0 build (AGP 8.13.0, 9 Gradle projects): 28 unique high/critical, all netty via
    the AGP 8.13.0 Unified Test Platform (`android-test-plugin-*@31.13.0`, `0.0.9-alpha03`).
  - 2026-11-12, first Expo prebuild (T-003): 53, as above (20 projects; `pit-alarms` added the 21st, same 53).

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

- **Status:** open, approved with conditions by Jason 2026-11-12. Expires 2027-02-10 (90 days); re-check
  earlier on any trigger below.
- **Tool:** `snyk test --all-projects` (npm, `package-lock.json`).
- **Found (2026-11-12, first scan of the Expo stack):**
  - SNYK-JS-BRACES-19963945, high, Uncontrolled Recursion in `braces@3.0.3`, via `metro > metro-file-map >
    micromatch@4.0.8` (from `react-native` and from `expo > @expo/cli > @expo/metro`).
  - SNYK-JS-OPEN-22112123, high, Improper Encoding or Escaping of Output in `open@8.4.2`, via
    `@react-native/dev-middleware` (from `expo > @expo/cli` and from `react-native > community-cli-plugin`).
- **Override tried first (Jason's condition), 2026-11-12, in a scratch copy of the project:**
  - `braces`: no fixed release exists (3.0.3 is the latest, and it is the vulnerable version; `micromatch`
    4.0.8 is also the latest). Nothing to override to.
  - `open`: the only fix is `open@11`, which is ESM-only. With `"overrides": { "open": "^11.0.4" }`,
    `require("open")` in `@react-native/dev-middleware` (`DefaultToolLauncher.js`) returns the module
    namespace, not a function: its fallback `await open(url)` throws `TypeError: open is not a function`
    whenever launching the debugger in Chrome fails. That breaks a dev-tool path, so the override was not
    applied.
- **Decision:** not shipped. Metro (the bundler and its file watcher) and dev-middleware (the dev server that
  opens the JS debugger in a browser) run on the build machine only. Checked: the source map of the Android
  bundle (`npx expo export --platform android --source-maps`) lists 1116 modules, none from `braces`,
  `micromatch`, `open`, `metro-file-map` or `@react-native/dev-middleware`.
- **Exposure:** `braces` would need an attacker-controlled glob pattern fed to Metro's watcher; `open` would
  need an attacker-controlled URL passed to the dev server's "open debugger" endpoint, which listens on the
  local machine during development only.
- **How it is excluded:** `.snyk` `ignore` entries for only these two issue IDs, each only on its two
  dependency paths (metro / dev-middleware from `expo` and from `react-native`), with a reason and
  `expires: 2027-02-10`. Any other path to these packages, or any other issue in them, still fails the gate.
  `snyk monitor` keeps reporting them.
- **Re-check (run `snyk test`, retry the override) when any of these happens:**
  - an Expo SDK, `react-native`, `@expo/cli` or Metro upgrade;
  - a `braces` release above 3.0.3, or a `micromatch` release that drops it;
  - `@react-native/dev-middleware` switching to `import()` of `open` or to `open` 11+;
  - Snyk reporting a new path to either package, or a new issue in either;
  - the ignores expiring on 2027-02-10 (the gate fails again then; re-approve or remove).
  If a re-check clears both, delete the `.snyk` ignores and mark this entry closed.
- **Approval:** Jason, 2026-11-12, with conditions: try npm overrides first (done, above); if they fail, ignore
  only these two packages on these paths, 90-day expiry, re-check triggers written down.

---

## Below the gate (for awareness, not exceptions)

- Snyk Code, low: "Path Traversal" in `tools/device/*.mjs` (now `legacy/tools/device/`) (backup, capture, cook, ...). These are
  developer-only scripts run by hand on Jason's machine with paths from their own arguments; not shipped.
  Revisit if any of them ever takes input from a file or network source.
