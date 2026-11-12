# Pit Planner: technical design

Status: 2026-11-12, plan for the stack change (approved by Jason 2026-11-12). The app moves from Capacitor + Preact
(WebView; releases 0.1.0 and 0.2.0) to Expo + React Native. 0.2.0 is on Jason's and friends' phones; 0.3.0 is
the first Expo release and must upgrade it in place.

Companion documents: [TASKS.md](TASKS.md) (one entry per task), [WBS.md](WBS.md) (phases, critical path),
[SECURITY-EXCEPTIONS.md](SECURITY-EXCEPTIONS.md).

Read order for a fresh session: `CLAUDE.md` (rules and quality gate), `SPEC.md` (what the app does), this file
(how it is built), then your task in `TASKS.md`. `docs/HANDOFF.md` is the running log; `docs/HA-INTEGRATION.md`
is the Home Assistant plan. Where this file and SPEC.md disagree on behavior, SPEC.md wins; on structure, this
file wins. Fix the other document in the same task. SPEC.md section 2 (Architecture) and the Capacitor
mentions in CLAUDE.md are rewritten to match this file in T-002.

---

## 1. Stack

| Concern | Choice | Notes |
|---|---|---|
| App framework | Expo SDK 58 (current at planning: `expo` 58.0.x), React Native 0.88, TypeScript | Development builds (`npx expo run:android`), never Expo Go. New Architecture (default). Pin the exact SDK at T-002; SDK upgrades are their own tasks. |
| Navigation | Expo Router (file-based, `app/`) | Tabs: Plan, Cook, Gear. Setup as a stack shown on first run. Sheets as kit components. |
| Styling | NativeWind 4.2 (Tailwind classes) | Theme from the design tokens (section 8). Dark only. |
| Components | React Native Reusables (shadcn-style source copied into `src/components/ui/`, built on `@rn-primitives`) | Themed to the mockups; we own the copied code. |
| Storage | `expo-sqlite` | One database `pitplanner.db`; versioned migrations from day one (section 5). |
| Secrets | `expo-secure-store` | Android Keystore-backed. HA refresh token only. |
| Files and sharing | `expo-file-system`, `expo-sharing`, intent filters via config plugin | `.pitplan` export and open. |
| Fonts | `expo-font` + Roboto (`@expo-google-fonts/roboto`) | Bundled. |
| Native code | Expo Modules API (Kotlin) in `modules/` | `pit-alarms` (setAlarmClock, receivers, notifications), `pit-legacy` (one-time read of 0.2.0 data). iOS implementations later behind the same TS interfaces. |
| Engine | `engine/` pure TypeScript, unchanged | Runs in Metro and in `node --test`. |
| Build | Continuous Native Generation: `npx expo prebuild` generates `android/`; local Gradle signed release | No EAS. `android/` is generated and git-ignored; native config lives in `app.config.ts`, `plugins/` and `modules/`. |
| Server | none | No backend and no Redis: there is no server to run it on, and Redis does not run on a phone. All data is on the phone; Home Assistant is the user's own server and optional. |

## 2. Repository layout (target after T-002)

```
app/                    Expo Router routes: (tabs)/plan, (tabs)/cook, (tabs)/gear, setup/
src/
  components/ui/        React Native Reusables components (copied, themed)
  components/kit/       Pit Planner kit on top: Num, Stepper, Chips, Tile, ResultCard, Lanes, Sheet, ...
  screens/              screen bodies used by routes (routes stay thin; screens are tested)
  lib/                  app logic; pure helpers keep today's paths and exports (rule 3)
  db/                   SQLite: Db interface, migrations/, repositories, legacy import
  platform/             TS interfaces + Expo implementations (alarms, share, links, secrets)
  theme/                tokens.ts, fonts
modules/
  pit-alarms/           Expo module: alarm scheduler, receivers, notifications (+ JUnit tests)
  pit-legacy/           Expo module: reads the 0.2.0 Capacitor SharedPreferences once (+ JUnit tests)
plugins/                config plugins: release signing, intent filters, network security config
engine/  data/          unchanged
legacy/                 the Capacitor app (old src/ UI, android/ sources, capacitor.config.ts, vite config,
                        WebView device scripts) as reference until parity; not built, linted or tested;
                        deleted after 0.3.0 ships (T-039)
tools/                  check.sh, release scripts, device/ (Maestro flows + adb helpers)
```

The Capacitor build stays reproducible from tag `v0.2.0` (created in T-002 on commit `e86d930`, the commit the
0.2.0 APK was built from). A 0.2.x hotfix, if ever needed, is built on a branch from that tag, the only
exception to "commit on main".

## 3. Layers and dependency rules

| Layer | Path | May import | Must not import |
|---|---|---|---|
| Rules data | `data/*.json` | nothing | n/a |
| Engine | `engine/` | `engine/*` | React, React Native, Expo, `src/*`, clock, storage, network |
| App logic | `src/lib/` | engine, `src/db` and `src/platform` interfaces | React Native UI, `expo-*` directly |
| Storage | `src/db/` | engine types, its `Db` interface | screens; `expo-sqlite` only in `src/db/expoDb.ts` |
| Platform | `src/platform/` | `expo-*`, `modules/*` JS APIs | screens, app state |
| UI | `app/`, `src/screens/`, `src/components/` | `src/lib`, engine pure helpers, platform via hooks | `expo-sqlite`, `modules/*` |
| Native | `modules/*/android` | Android SDK, Expo Modules API | JS state (bridge only) |

Rules:
1. **The engine stays pure and is not touched by the port.** Every function takes `now` and `rules` as
   parameters; `engine/*.test.ts` keep running with `node --test`.
2. **Rules are data** (`data/foods.json`, schema `engine/rules.ts`, checked by `engine/rules.test.ts`).
3. **Pure helpers keep their paths.** `engine/*.test.ts` import `src/lib/cookView.ts`, `finish.ts`,
   `historyView.ts`, `sharedPlan.ts`, `timing.ts`, `update.ts`, and types from `cook.ts` and `history.ts`. These
   stay at the same paths with the same exports, so the engine tests do not change; only their storage and
   platform imports are swapped (e.g. `history.ts` keeps `CookRecord`, its I/O moves to `src/db`).
4. **Platform access goes through `src/platform/`**; ESLint `no-restricted-imports` enforces it (T-003).
5. **Native holds only what must work with the app dead:** the alarm set, nags, queued notification actions.
6. **Units:** instants epoch ms; temps F; weights lb; convert at display (`engine/units.ts`, `src/lib/format.ts`).

## 4. Platform services

Same interfaces as planned before the stack change; implementations move to Expo.

```ts
// src/platform/types.ts
export interface AlarmService {
  replaceAll(alarms: AlarmSpec[]): Promise<{ scheduled: number; exact: boolean }>;
  cancelAll(): Promise<void>;
  acknowledge(keys: string[]): Promise<void>;
  setQuiet(until: number | null): Promise<void>;
  testAlarm(seconds: number, title?: string, body?: string): Promise<{ at: number; exact: boolean }>;
  scheduled(): Promise<{ alarms: AlarmSpec[]; nags: StoredNag[] }>;
  drainActions(): Promise<NotificationAction[]>;
  onFired(fn: (e: AlarmEvent) => void): Unsubscribe;
  onAction(fn: (e: AlarmEvent) => void): Unsubscribe;
}
export interface PermissionService {
  status(): Promise<AlarmStatus>; // notifications, exactAlarms, batteryUnrestricted, fullScreen
  requestNotifications(): Promise<AlarmStatus>;
  openSettings(which: 'exactAlarm' | 'battery' | 'fullScreen' | 'notifications'): Promise<void>;
}
export interface SecretStore {
  get(k: SecretKey): Promise<string | null>;
  set(k: SecretKey, v: string): Promise<void>;
  remove(k: SecretKey): Promise<void>;
}
export interface ShareService {
  sharePlanFile(name: string, text: string): Promise<void>;
  onPlanOpened(fn: (file: { text?: string; name?: string; error?: string }) => void): Unsubscribe;
}
export interface AppLinks {
  openExternal(url: string): Promise<void>;
  openAuthSession(url: string, redirect: string): Promise<string | null>;
  onResume(fn: () => void): Unsubscribe;
}
```

| Service | Android (Expo) | Test fake | iOS (future, not in scope) |
|---|---|---|---|
| AlarmService, PermissionService | `modules/pit-alarms` (Kotlin port of the 0.2.0 plugin) | records calls | Swift module, same JS API: `UNUserNotificationCenter` time-sensitive alerts, AlarmKit where available; needs a Mac + Xcode and its own alarm review |
| SecretStore | `expo-secure-store` | in-memory | `expo-secure-store` (Keychain), no change |
| Storage (`Db`) | `expo-sqlite` | `better-sqlite3` in Jest | `expo-sqlite`, no change |
| ShareService | `expo-sharing` + `expo-file-system` (reads `content://`), intent filters by config plugin, 256 KB cap | in-memory | `expo-sharing`; `.pitplan` document type via config plugin |
| AppLinks | `expo-linking`, `expo-web-browser` (Custom Tab auth session), `AppState` | scripted | same packages |

## 5. Data model (SQLite)

Database `pitplanner.db` via `expo-sqlite`. Instants INTEGER epoch ms; temps REAL F; weights REAL lb. JSON
columns hold engine-owned shapes that evolve with the engine (validated and normalized on read).

```sql
-- 0001_init
CREATE TABLE kv (             -- small settings: units, one-time hint flags, update check, plan draft
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE cookers (        -- gear: one row per cooker the user owns
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('smoker','griddle','oven')),
  profile TEXT NOT NULL,      -- JSON SmokerProfile | GriddleProfile | OvenProfile
  position INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE rate_overrides ( -- Cook rates: saved hr/lb at 225F and/or saved total hours, per food
  food_id TEXT PRIMARY KEY, hr_per_lb REAL, total_hours REAL,
  locked INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE active_cook (    -- at most one running cook, rewritten on every change
  id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL,  -- JSON ActiveCook
  started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE cook_history (
  id TEXT PRIMARY KEY, served_at INTEGER NOT NULL, pit_temp_f REAL NOT NULL,
  late_min INTEGER, notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE TABLE cook_history_items (
  id INTEGER PRIMARY KEY, cook_id TEXT NOT NULL REFERENCES cook_history(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, name TEXT NOT NULL, food_id TEXT NOT NULL, method_id TEXT NOT NULL,
  smoker_id TEXT NOT NULL, quantity REAL NOT NULL, pit_temp_f REAL NOT NULL,
  minutes_on_heat REAL NOT NULL, planned_min REAL NOT NULL, actual_min REAL NOT NULL,
  options TEXT,               -- JSON Record<string, string>
  discarded INTEGER NOT NULL DEFAULT 0);
CREATE INDEX cook_history_items_learn ON cook_history_items(food_id, method_id, smoker_id);
```

Mapping from the 0.2.0 model: `gear` -> `cookers`; `settings`, `flags`, `update`, `draft` -> `kv`; `rates`,
`totalHours`, `rateLocks` -> `rate_overrides`; `activeCook` -> `active_cook`; `history.json` (`CookRecord[]`)
-> `cook_history` + `cook_history_items`. `logsOf(records)` becomes a query; `CookRecord` stays the type the
screens and `historyView.ts` use.

**Migrations, versioned from day one:**
- `src/db/migrations/NNNN_name.ts` exports `{ version: N, up(db) }`. The runner reads `PRAGMA user_version`,
  applies every higher migration in order, each in its own transaction, and sets `user_version`. A failed
  migration rolls back and the app shows an error screen with "Export my data", never a silent reset.
- Shipped migrations are never edited; fixes are new migrations.
- `PRAGMA foreign_keys = ON` and `journal_mode = WAL` at open.
- Tests (Jest, `better-sqlite3` behind the same `Db` interface): 0 -> latest matches a schema snapshot; for
  every version N, fixture data at N migrates to latest intact; every repository round-trips.
- Export: Gear > Export shares a JSON dump through the share sheet (T-036).

**Can the 0.2.0 data be migrated? Yes.** Same app ID and signing key means Android keeps the app's data
directory across the upgrade. The Capacitor app stored:
- `@capacitor/preferences`: SharedPreferences file `CapacitorStorage` (`shared_prefs/CapacitorStorage.xml`),
  one JSON string per key (`gear`, `settings`, `draft`, `rates`, `totalHours`, `rateLocks`, `activeCook`,
  `flags`, `update`).
- `@capacitor/filesystem` `Directory.Data`: `files/history.json` (the directory Expo calls `documentDirectory`).
- Native alarm state: `AlarmStore` SharedPreferences in device-protected storage.

On first launch of 0.3.0, after migrations, `src/db/legacyImport.ts` runs once (guarded by
`kv.legacy_import`): `modules/pit-legacy` returns the `CapacitorStorage` entries as strings; JS reads
`history.json` with `expo-file-system`; both pass through the existing `normalize`/validation code and are
written to SQLite in one transaction. On success it sets `legacy_import = done` and renames the old files
(`*.imported`, kept until 0.4.0). A running cook is imported and its alarms rescheduled from `plan.events` if
its serve time is in the future; otherwise it is dropped.

**Fresh-start fallback:** if a part fails to parse, the app imports what it can, keeps the originals, and shows
a one-time notice, e.g. "Pit Planner has a new look. Your cookers, rates and 4 past cooks came along. Your plan
draft could not be moved." If nothing can be read: "Pit Planner has a new look and starts fresh. Set up your
cookers again." Tested on an emulator by installing the real `release/pitplanner-0.2.0.apk`, adding data, then
installing 0.3.0 over it (T-012, T-038).

Old alarms across the upgrade: alarms do not survive an app update (the 0.2.0 receivers already assume this and
reschedule on `MY_PACKAGE_REPLACED`). `pit-alarms` keeps the receiver class names
`io.github.mecheng70.pitplanner.alarms.*` so an in-flight `PendingIntent` still resolves, and the import
reschedules from the imported cook.

## 6. Alarm design (SPEC section 6), as an Expo module

`modules/pit-alarms` ports the 0.2.0 Kotlin (`legacy/android/.../alarms/`: `AlarmScheduler`, `AlarmStore`,
`Notifications`, `Receivers`, `AlarmsPlugin`) to the Expo Modules API. Behavior does not change:

```
plan.events --alarmsFromPlan(plan, now)--> AlarmSpec[] --AlarmService.replaceAll--> AlarmScheduler.replaceAll
   cancel every PendingIntent, then setAlarmClock() per alarm (the system leaves Doze for these)
AlarmReceiver -> Notifications.show (Done / +15 min / Open; full-screen when critical or at night)
              -> nag every 10 min, up to 6, then "Cook needs you"
ActionReceiver (Done / +15) -> AlarmStore.queueAction -> app drains on start/resume -> replan -> replaceAll
RestoreReceiver: LOCKED_BOOT_COMPLETED, BOOT_COMPLETED, MY_PACKAGE_REPLACED, TIME_SET, TIMEZONE_CHANGED,
                 SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED -> reschedule from AlarmStore
```

- The module's `AndroidManifest.xml` declares the receivers (`exported=false`, `directBootAware=true`) and
  permissions (`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`,
  `USE_FULL_SCREEN_INTENT`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `WAKE_LOCK`, as in 0.2.0); merged at
  prebuild.
- Events to JS (`onFired`, `onAction`) through the module's event emitter.
- New in the port: `setQuiet(until)` so Quiet also defers native nags (the known gap in 0.2.0).
- One notification owner: the module posts every step notification and requests `POST_NOTIFICATIONS` itself.
  `expo-notifications` and Notifee are not used (their schedulers do not use `setAlarmClock`).
- Invariants, each with a test: replace the whole set, never patch; stable step keys; notifications stay until
  handled; rings with the app dead after a locked reboot; time steps app-only, temperature events HA-only;
  missing permission blocks Start cook and shows the red banner.
- iOS: a future Swift implementation of the same `AlarmService`; out of scope.

## 7. Live-cook state machine

Behavior unchanged. `ActiveCook` (type exported from `src/lib/cook.ts`) is stored in `active_cook`. T-020
extracts the states into a new pure file `engine/cookState.ts` (existing engine files and tests untouched).

| State | Condition | Allowed actions | Alarm effect |
|---|---|---|---|
| Planning | no active cook | edit plan, Start cook | none |
| Cooking | cook, `pitDownAt == null` | Done, +15, Not yet, Running behind/ahead, Quiet, Pit went out, Start over, End cook | full set from `plan.events` |
| Cooking + Quiet | `quietUntil > now` | same | steps and nags inside the window held to its end; one summary |
| Cooking + overdue | pending step `dueAt < now` | Done (asks keep or move serve if off by >= 5 min) | nag every 10 min |
| PitDown | `pitDownAt != null` | Back up to temp, End cook | smoker steps held; `pitOutage` adds downtime + 15 min |
| Finishing | End cook | Save (logs to history), Discard | cancel all |

Every change: write `active_cook`, then `replaceAll` from the new plan. Scheduled times round to 5 min; actual
times stay exact. Changes made without asking keep serve only if every food keeps its minimum rest
(`holdsCover`).

## 8. UI, theme and text size

- **Source of truth:** mockup PNGs `docs/mockups/*.png` and sources `docs/mockups/source/*.dc.html`. Their
  token values were already extracted into the Capacitor kit (`legacy/src/ui/ui.css`: `--bg #131211`,
  `--surface #1f1d1b`, `--accent #ff8f4a`, `--accent-container #4a2e1c`, `--griddle #8ec2f0`, `--ok #9bd18b`,
  `--warn #ffd27a`, `--error #ff9a86`, four text levels, the type scale). T-004 moves them to
  `src/theme/tokens.ts`, used by `tailwind.config.js` (NativeWind) and the Reusables theme variables. Dark
  only; Roboto; one ember accent; griddle blue.
- **Components:** Reusables primitives (Button, Text, Switch, Checkbox, RadioGroup, Dialog, Select,
  Separator), themed; the Pit Planner kit on top (Num, Stepper, Chips, Tile/Tiles, ResultCard, InfoBox, Banner,
  ListRow, StatusRow, Lanes chart on `react-native-svg`, Sheet). Screens use the kit only, no one-off styles.
- **Bottom sheets:** `@gorhom/bottom-sheet` if it supports RN 0.88 at T-005; else a kit Sheet on React
  Native `Modal` (D-4).
- **Text size rule (Jason):** follow the system font scale (React Native's `allowFontScaling` default; no
  `maxFontSizeMultiplier` caps on content). Times, temps, weights and countdowns (`<Num>`) never truncate,
  shrink (`adjustsFontSizeToFit` is banned) or ellipsize at any scale; only secondary text may use
  `numberOfLines`. Layouts wrap instead. Checked at 100/115/130% on the phone in every UI task (Maestro +
  screencap) and by an ESLint rule that forbids `numberOfLines`/`adjustsFontSizeToFit` on `Num`.
- **Look:** a stock Android app (Material 3 patterns), not a web page: `android_ripple` on pressables, Android
  back closes the top sheet first, edge-to-edge with correct insets.

## 9. Home Assistant (v2)

Plan of record `docs/HA-INTEGRATION.md`, survey `docs/ha-entities.md`. Changes from the stack switch:
- Refresh token in `expo-secure-store` (no custom Keystore plugin). Access token in memory only.
- Login: `expo-web-browser` `openAuthSessionAsync` (Custom Tab) with redirect `pitplanner://auth-callback`;
  scheme in `app.config.ts` (`scheme: 'pitplanner'`). `client_id` page on GitHub Pages as planned.
- WebSocket: React Native's built-in `WebSocket`; REST via `fetch`. Network code in `src/lib/ha/`; pure logic in
  a new `engine/probe.ts`.
- LAN cleartext only per host, through a network security config written by a config plugin.

## 10. Security

| Asset | Rule |
|---|---|
| Release signing key `~/keys/pitplanner.jks` | The same key as 0.1.0/0.2.0 (required for the in-place upgrade). Never in the repo. `plugins/withReleaseSigning` reads a git-ignored `keystore.properties` at the repo root (moved from `android/`, which is now generated) at prebuild. The release script checks cert SHA-256 `b6c32d12...0a29`. |
| HA refresh token | `expo-secure-store` only; never in SQLite, logs, `.pitplan`, crash text or the repo. |
| SQLite database | App-private; no secrets. Android auto-backup stays on for it (cook history matters); T-035 checks that secure-store entries are excluded from backup. |
| `.pitplan` import | Untrusted: 256 KB cap, validated by `src/lib/sharedPlan.ts`, numbers clamped, unknown foods dropped. |
| Network | HTTPS only for remote HA; anonymous GitHub update check. |
| Exported components | Main activity only (launcher, `.pitplan` VIEW/SEND, `pitplanner://`); receivers `exported=false`. |
| Tool tokens | Snyk and GitHub tokens from the user's own CLI config only. |
| Static checks | Semgrep + Snyk in `npm run check`; exceptions only via `SECURITY-EXCEPTIONS.md`. |

## 11. Quality gate and test strategy

`npm run check` (`tools/check.sh`) runs in order and stops at the first failure. Same six steps; tools change
where the stack does:

1. **Prettier** write, then check (TS/TSX/JS/JSON/CSS; markdown, `data/`, `docs/`, `legacy/` and generated
   `android/` excluded).
2. **ESLint**, zero warnings: `eslint-config-expo` (flat) + `typescript-eslint` + React, React Hooks and React
   Native rules (`eslint-plugin-react-native`), `no-restricted-imports` for the layer rules, a local rule for
   `Num` text size.
3. **Typecheck** `tsc --noEmit` with the TypeScript version the Expo SDK supports (D-2).
4. **Tests** `npm run test:all`:
   - engine: `node --test engine/*.test.ts` (unchanged);
   - app logic, repositories, migrations, UI: Jest (`jest-expo`) + React Native Testing Library; SQLite code
     against `better-sqlite3`;
   - native: JUnit (+ Robolectric) in `modules/*/android/src/test`, run through Gradle in the prebuilt
     `android/`. `check.sh` runs `npx expo prebuild --platform android --no-install` first when `android/` is
     missing or older than `app.config.ts`, `plugins/` or `modules/`.
5. **Semgrep** `p/typescript p/kotlin p/secrets`, `--no-git-ignore`, over `app/ src/ engine/ data/ modules/
   plugins/ tools/`; generated `android/` and `legacy/` excluded (SE-002 extended in T-003).
6. **Snyk** `snyk test --all-projects --severity-threshold=high` (npm + the prebuilt `android/` Gradle
   projects; Gradle scope per SE-001), then `snyk code test --severity-threshold=high`. If the Gradle part
   fails, run `cd android && ./gradlew assembleDebug` once and retry.

`npm run snyk:monitor` runs after a release or a push to main (not in the gate).

| Level | Tool | Where |
|---|---|---|
| Engine | node:test | `engine/*.test.ts` (unchanged) |
| App logic, repositories, migrations | Jest + `better-sqlite3` | `src/**/*.test.ts` |
| UI components and screens | Jest + React Native Testing Library | `src/**/*.test.tsx` |
| Native | JUnit, Robolectric | `modules/*/android/src/test/` |
| Device | Maestro flows (`tools/device/flows/`) + adb screencap at 115/130%, heads-up banners off | dev build `io.github.mecheng70.pitplanner.debug` |
| Regression | any level | one per fixed bug, failing first |

The Playwright-over-CDP device scripts only work with the WebView; they move to `legacy/` and are replaced by
Maestro flows (T-006). The alarm device tests (Doze, locked reboot) are re-run on the Expo build (T-016)
following `docs/alarm-testing.md`. The Vitest tests from the Capacitor UI move to `legacy/` with it; the
behaviors they cover (e.g. Food details timing) are re-tested in Jest when each screen is ported.

## 12. Build and release

- **Variants** in `app.config.ts` by `APP_VARIANT`: `development` -> `io.github.mecheng70.pitplanner.debug`,
  "Pit Planner dev" (installs beside the release, own data); `production` -> `io.github.mecheng70.pitplanner`,
  "Pit Planner". The app ID is permanent.
- **Version:** `package.json` `version` -> `expo.version`; `android.versionCode = major*10000 + minor*100 +
  patch` (0.3.0 -> 300 > 200, so 0.2.0 upgrades in place).
- **Release (local, no EAS):**
  1. All tasks for the release done; `git status` clean on `main`; `npm run check` passes.
  2. Bump `package.json` version (0.3.0 for the first Expo release).
  3. `npm run release`: `APP_VARIANT=production npx expo prebuild --platform android --clean`, then
     `cd android && ./gradlew assembleRelease` (signing from `plugins/withReleaseSigning`), then verify the cert
     SHA-256 with `apksigner` and print versionCode/versionName -> `release/pitplanner-<version>.apk`.
  4. Upgrade test on an emulator: install `release/pitplanner-0.2.0.apk`, add data, install the new APK over
     it, check the import (by hand in T-038; a Maestro flow after that).
  5. Commit the version bump; tag `v<version>`; push `main` and the tag (Jason approves).
  6. `gh release create v<version> <apk> --notes-file docs/release-notes/<version>.md` with the SHA-256
     (`--prerelease` for betas). Google Drive mirror optional (D-1).
  7. `npm run snyk:monitor`.
  8. Check the in-app update row on a phone on the previous version; update `docs/HANDOFF.md`.

## 13. Open decisions and risks

| ID | Decision or risk | Recommendation |
|---|---|---|
| D-1 | Distribution | Decided 2026-11-12: GitHub Releases primary, Google Drive optional mirror. |
| D-2 | TypeScript version | Use the version Expo SDK 58 supports. If below 7, drop the `typescript7` alias and the 6/7 split. The engine's explicit `.ts` imports need `allowImportingTsExtensions`; verify Metro and Jest resolve them in T-002 (resolver config if needed, never an engine change). |
| D-3 | Snyk Gradle scope (SE-001) | Approved: `releaseRuntimeClasspath` only until T-057, deadline 2027-02-01. Re-check after the first prebuild: SDK 58 brings its own AGP, so the findings may change. |
| D-4 | Bottom sheets | `@gorhom/bottom-sheet` if it supports RN 0.88 at T-005; else a kit Sheet on `Modal`. |
| D-5 | App state | Keep the current pattern (one context store, every change written through repositories); no new state library unless the Cook screen shows re-render cost. |
| D-6 | Port in place vs side by side | In place: the Capacitor app moves to `legacy/` in T-002; the Expo app lives at the root. 0.2.x hotfixes from a branch off tag `v0.2.0`. Friends stay on 0.2.0 until 0.3.0 reaches parity. |
| D-7 | Generated `android/` (CNG) | Yes: no hand edits; everything through `app.config.ts`, config plugins and modules. Keeps Expo SDK upgrades tractable. |
| D-8 | Device test tool | Maestro (YAML flows over adb, works with any RN build); Detox is heavier and needs instrumented builds. Jason installs the Maestro CLI. |
| D-9 | GitHub Pages for the HA `client_id` | Unchanged: Jason enables Pages when HA work starts. |
| R-1 | NativeWind 4.2 / Reusables vs RN 0.88 and the New Architecture | Spike in T-004/T-005 before porting screens; fallback: `StyleSheet` with the same tokens inside the kit components (screens unaffected). |
| R-2 | Import from 0.2.0 fails on a friend's phone | Partial import + fresh-start notice; originals kept as `*.imported` until 0.4.0; emulator upgrade test with the real 0.2.0 APK before release. |
| R-3 | Alarm regressions in the port | Port the Kotlin nearly verbatim; JUnit tests first; full device alarm test (Doze, locked reboot) before 0.3.0; Saturday cook (T-037). |
| R-4 | Visual drift from the mockups in a new toolkit | Fidelity screenshots per tab at 115/130% against `docs/mockups/*.png`; Jason approves each tab. |
| R-5 | The port rewrites the whole UI (about 7,500 lines of Preact) | Port tab by tab, reusing the pure `src/lib` helpers; no new features until parity; HA work starts after 0.3.0. |
| R-6 | Losing the signing key | Two off-GitHub backups, checked each release. |
