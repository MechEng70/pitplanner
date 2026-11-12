# Pit Planner: technical design

Status: 2026-11-12, app 0.2.0 (versionCode 200) on Jason's phone. Companion documents: [TASKS.md](TASKS.md)
(one entry per task), [WBS.md](WBS.md) (phases, critical path), [SECURITY-EXCEPTIONS.md](SECURITY-EXCEPTIONS.md).

Read order for a fresh session: `CLAUDE.md` (rules and quality gate), `SPEC.md` (what the app does),
this file (how it is built), then the task you are given in `TASKS.md`. `docs/HANDOFF.md` is the running log
of what the last session did; `docs/HA-INTEGRATION.md` is the Home Assistant plan.

Where this file and SPEC.md disagree on behavior, SPEC.md wins. Where they disagree on structure, this file
wins. Fix the other document in the same task.

---

## 1. System at a glance

Android app, sideloaded APK. Capacitor 8 wraps a Preact + TypeScript web UI built by Vite. No backend, no
accounts; all data lives on the phone. Native Kotlin plugins do what a WebView cannot: exact alarms that
survive Doze and reboots, and receiving opened `.pitplan` files. Home Assistant (v2) is optional and talks
straight from the phone to the user's own HA server.

```
+--------------------------------------------------------------------------------+
|  UI (src/screens, src/ui)        Preact components, kit in src/ui/components.tsx |
+--------------------------------------------------------------------------------+
|  App logic (src/lib)             store, cook (live state), views, format, share   |
|                                  ha/ (v2: auth, websocket, discovery)             |
+-----------------------------+--------------------------------------------------+
|  Engine (engine/)  PURE     |  Platform services (src/platform)                 |
|  plan, live, alarms, temps, |  alarms, storage, secure storage, files/share,    |
|  units, rules types, probe  |  permissions, app links. One interface each;      |
|                             |  Android impl now, web fake for dev/tests,        |
|                             |  iOS impl later.                                  |
+-----------------------------+-------------------------+------------------------+
|  Rules data (data/)         |  Capacitor core plugins | Native plugins (Kotlin) |
|  foods.json, cookers.json   |  preferences, filesystem,| PitAlarms, PitSharedPlan|
|                             |  share, app             | (v2: PitSecureStore)    |
+-----------------------------+-------------------------+------------------------+
```

## 2. Layers and dependency rules

| Layer | Path | May import | Must not import |
|---|---|---|---|
| Rules data | `data/*.json` | nothing | n/a |
| Engine | `engine/` | `engine/*`, types of the rules data | DOM, `Date.now()`, timers, `@capacitor/*`, `src/*`, storage, network |
| App logic | `src/lib/` | engine, `src/platform/` interfaces, rules data | screens, `@capacitor/*` directly (new code) |
| Platform services | `src/platform/` | `@capacitor/*`, engine types | screens, `src/lib/` state |
| UI | `src/screens/`, `src/ui/` | `src/lib/`, `src/platform/` (via lib where possible), engine (pure helpers) | `@capacitor/*` directly |
| Native plugins | `android/app/src/main/java/.../` | Android SDK, Capacitor | WebView JS state (talk only through the bridge) |

Rules:

1. **The engine stays pure.** Every engine function takes `now` (epoch ms) and `rules` as parameters. No
   clock reads, no I/O, no randomness without a seed. This is what lets `node --test` run it with no browser.
2. **Rules are data.** A new food, method, phase or option is a change to `data/foods.json` plus a test, not
   a code branch. The schema is `engine/rules.ts`; `engine/rules.test.ts` checks every field the planner reads
   without a fallback. If a rule needs a field the schema lacks, add it to the schema (optional) and the test.
3. **Pure helpers take rules as a parameter.** `src/lib/rules.ts` imports JSON, which `node --test` cannot
   load from inside `src/`; so helpers tested by node (`historyView.ts`, `sharedPlan.ts`, `finish.ts`) take
   `rules: Rules` as an argument.
4. **Platform access goes through `src/platform/`.** Existing code still imports `@capacitor/preferences`,
   `@capacitor/filesystem`, `@capacitor/app` and `@capacitor/share` from `src/lib/`; T-008 moves those behind
   the interfaces in section 3 and adds an ESLint `no-restricted-imports` rule so it stays that way.
5. **Native code holds only what must survive with the app dead.** The alarm set, open nags and queued
   notification actions live natively (`AlarmStore`). Everything else (plans, history, settings) is owned
   by JS and stored through platform services.
6. **Units.** All stored instants are epoch milliseconds; temperatures F; weights lb. Convert only at display
   (`engine/units.ts`, `src/lib/format.ts` `tx`/`localizeText`).

## 3. Platform services interface

One TypeScript interface per capability in `src/platform/`, each with an Android implementation (now), a web
fake (browser dev and Vitest), and a documented future iOS implementation. Screens and `src/lib/` depend on
the interface only. Status column: what exists today.

```ts
// src/platform/services.ts (T-008). Shapes, not final code.
export interface AlarmService {            // exists as PitAlarms in src/platform/alarms.ts
  replaceAll(alarms: AlarmSpec[]): Promise<{ scheduled: number; exact: boolean }>;
  cancelAll(): Promise<void>;
  acknowledge(keys: string[]): Promise<void>;
  testAlarm(seconds: number, title?: string, body?: string): Promise<{ at: number; exact: boolean }>;
  scheduled(): Promise<{ alarms: AlarmSpec[]; nags: StoredNag[] }>;
  drainActions(): Promise<NotificationAction[]>;
  onFired(fn: (e: AlarmEvent) => void): Unsubscribe;
  onAction(fn: (e: AlarmEvent) => void): Unsubscribe;
}
export interface PermissionService {      // part of PitAlarms today
  status(): Promise<AlarmStatus>;          // notifications, exactAlarms, batteryUnrestricted, fullScreen
  requestNotifications(): Promise<AlarmStatus>;
  openSettings(which: 'exactAlarm' | 'battery' | 'fullScreen' | 'notifications'): Promise<void>;
}
export interface KeyValueStore {          // src/lib/storage.ts over @capacitor/preferences today
  get<T>(key: Key): Promise<T | null>; set(key: Key, v: unknown): Promise<void>; remove(key: Key): Promise<void>;
}
export interface FileStore {              // src/lib/history.ts over @capacitor/filesystem today
  readText(path: string): Promise<string | null>; writeText(path: string, text: string): Promise<void>;
}
export interface SecureStore {            // new in HA Phase 1 (T-025)
  get(key: SecretKey): Promise<string | null>; set(key: SecretKey, v: string): Promise<void>; remove(key: SecretKey): Promise<void>;
}
export interface ShareService {           // src/lib/share.ts + src/platform/sharedPlan.ts today
  sharePlanFile(name: string, text: string): Promise<void>;
  takeOpenedPlan(): Promise<{ text?: string; name?: string; error?: string } | null>;
  onPlanOpened(fn: () => void): Unsubscribe;
}
export interface AppLinks {               // @capacitor/app today; HA auth callback in T-026
  openExternal(url: string): Promise<void>;          // browser / Custom Tab
  onAppUrl(fn: (url: string) => void): Unsubscribe;  // pitplanner://auth-callback
  onResume(fn: () => void): Unsubscribe;
}
```

| Service | Android (now) | Web fake | iOS (future, not in scope) |
|---|---|---|---|
| AlarmService | `PitAlarms` Kotlin plugin, `AlarmManager.setAlarmClock()` | logs, schedules nothing, reports missing permissions | `UNUserNotificationCenter` time-interval/calendar triggers; time-sensitive or critical alerts (critical needs an Apple entitlement); no nag repeats while the app is dead beyond pre-scheduled copies (64 pending limit); iOS 26 AlarmKit if available |
| PermissionService | `PitAlarms.status` etc. | all false | notification authorization; no exact-alarm or battery concepts (report true) |
| KeyValueStore | `@capacitor/preferences` (SharedPreferences) | localStorage | `@capacitor/preferences` (UserDefaults) |
| FileStore | `@capacitor/filesystem` `Directory.Data` | in-memory | same plugin |
| SecureStore | new Kotlin plugin, Android Keystore AES-GCM key wrapping values in SharedPreferences (or Jetpack Security if still maintained at build time) | in-memory, never localStorage | Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) |
| ShareService | `@capacitor/share` + `PitSharedPlan` (VIEW/SEND intent filters, 256 KB cap) | download link | share sheet + UTI document type for `.pitplan` |
| AppLinks | `@capacitor/app` `appUrlOpen`, intent filter for `pitplanner://` | `window.open` | custom URL scheme, `ASWebAuthenticationSession` for HA login |

iOS work needs a Mac with Xcode, an Apple developer account for device installs, and its own alarm design
review (iOS has no `setAlarmClock` equivalent for third-party apps before AlarmKit). Only the interfaces and
this table are in scope (WBS phase 9).

## 4. Data model and storage

Types live in `engine/types.ts` (plan) and `src/lib/*.ts` (app state). SPEC section 9 lists the stored
items; this is where each one lives.

| Key / file | Store | Type | Written when |
|---|---|---|---|
| `gear` | Preferences | `Cookers` (smoker, griddle, oven profiles) | Setup finish, Gear edits |
| `settings` | Preferences | `{ units }` | Setup, Gear > Units |
| `draft` | Preferences | `Draft` (mode, at, pitTempF, items) | every Plan edit |
| `rates` / `rateLocks` / `totalHours` | Preferences | `Record<foodId, ...>` | "Use for future", Gear > Cook rates |
| `activeCook` | Preferences | `ActiveCook` (`src/lib/cook.ts`) | Start cook and every live change; removed at End cook |
| `flags` | Preferences | one-time hints shown | when a hint is shown |
| `update` | Preferences | `UpdateInfo` (last release check) | at most daily |
| `history.json` | Filesystem `Data` | `CookRecord[]` | Save on Cook finished, Remove in history |
| native `AlarmStore` | SharedPreferences (device-protected storage, so it works before first unlock) | alarm set, nags, queued actions | every `setAlarms`, fire, action |
| `haConfig` (v2) | Preferences | address, smoker climate entity, probes (label, entity ID), per-food last probe | HA discovery Save |
| `ha.refreshToken` (v2) | SecureStore | string | sign-in, refresh; deleted at Disconnect |

Rules:
- `load()` returns `null` on missing or corrupt JSON; every reader supplies defaults. `normalize()` upgrades
  older `activeCook` shapes. Any change to a stored shape needs a normalize step and a test that loads the old
  shape.
- No schema version field on Preferences entries today. Add one only when a breaking change is needed
  (decision D-6).
- `.pitplan` (share file) is `{ app: 'pit-planner', version: 1, serveAt: iso, pitTempF, items }`. Export drops
  the sender's `hrPerLb`, `totalHours`, `totalHoursAtF`, `timingModel`. Import validates every field
  (`src/lib/sharedPlan.ts`) and never trusts sizes, ids or options.

## 5. Scheduling engine (summary)

Full rules: SPEC section 4. Entry points: `buildPlan(rules, input)` (from scratch) and `derive(rules, input,
items, serveAt)` (re-lay events and warnings after live edits). Output `Plan` has `items[].phases`,
`events[]` (each with `alarm`, `checkStep`, `critical`), `warnings[]`, fire/pit-off/griddle times, pellets,
footprint. Phase starts round to 5-minute steps; off-heat stays exact. `engine/live.ts` holds live edits
(`markStepDone`, `markPullDone`, `shiftRemaining`, `pitOutage`, `extendCook`, `postponeStep`,
`holdsCover`). `engine/alarms.ts` turns events into `AlarmSpec[]` with stable step keys, grouping alarms in
the same minute (failure mode 11).

## 6. Alarm design (SPEC section 6)

Implemented and device-tested (`docs/alarm-testing.md`, including Doze and a locked reboot).

```
plan.events --alarmsFromPlan(plan, now)--> AlarmSpec[] --PitAlarms.setAlarms--> AlarmScheduler.replaceAll
                                                                               |  cancel every PendingIntent
                                                                               |  setAlarmClock() per alarm
                                                                               v
AlarmReceiver (fires) -> Notifications.show (Done / +15 min / Open, full-screen when critical or at night)
                      -> Nag every 10 min, up to 6, then "Cook needs you"
ActionReceiver (Done / +15) -> AlarmStore.queueAction -> app drains on start/resume -> cook.ts applies -> replan
RestoreReceiver (LOCKED_BOOT_COMPLETED, BOOT_COMPLETED, MY_PACKAGE_REPLACED, TIME_SET, TIMEZONE_CHANGED,
                 SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED) -> AlarmScheduler.restore from AlarmStore
```

Invariants (each has or needs a test):
1. After any plan change: save the cook, then `rescheduleFromPlan` (cancel all, schedule the new set). Never
   patch one alarm.
2. Step keys are stable across replans (`keyedEvents`), so Done on a notification still finds its step after
   the plan moved.
3. Notifications stay in the shade until Done, +15 or swipe; nothing removes them silently.
4. Native state is enough to ring with the app dead and the phone just rebooted and locked.
5. Time steps are alarmed by the app only; temperature events by HA only (v2, no duplicates).
6. Missing notification, exact-alarm or battery permission blocks Start cook until fixed or acknowledged, and
   shows a red banner on Live Cook (failure mode 9).

Known gap: Quiet alerts holds scheduled steps, but native nag repeats of an already-overdue step still ring
(T-009).

## 7. Live-cook state machine

The running cook is `ActiveCook` (`src/lib/cook.ts`). Every operation is a pure function returning a new
`ActiveCook`; the caller saves it and calls `syncAlarms`. Today the states are implied by fields. T-012 makes
them explicit in `engine/cookState.ts` (pure, tested) so the UI and tests share one definition.

```
            Start cook (perms ok or acknowledged)
  [Planning] ------------------------------------> [Cooking]
      ^                                              |  ^   |  ^          |
      | Start over (keeps menu)                      |  |   |  | Back up  | End cook
      +----------------------------------------------+  |   |  | to temp  v
                                                        |   v  |       [Finishing] --Save--> history, idle
                              Quiet 30 min (UI hold) ---+ [PitDown]            \--Discard--> idle
                              ends at quietUntil         clock stopped (pitDownAt)
```

| State | Condition (fields) | Allowed actions | Alarm effect |
|---|---|---|---|
| Planning | `activeCook == null` | edit draft, Start cook | none scheduled |
| Cooking | cook set, `pitDownAt == null` | Done, +15, Not yet (+30 on pull checks), Running behind/ahead (+-15, keep/move serve), Quiet, Pit went out, Start over, End cook | full set from `plan.events` |
| Cooking + Quiet | `quietUntil > now` | same | steps in the window held; one summary at the end; steps stay overdue |
| Cooking + overdue step | a pending step's `dueAt < now`, not in `done` | Done (asks shift or keep serve if off by >= 5 min) | native nag every 10 min |
| PitDown | `pitDownAt != null` | Back up to temp, End cook | smoker steps cancelled until back up; `pitOutage` adds downtime + 15 min recovery |
| Finishing | End cook pressed | Save (logs actual minutes, feeds rates), Discard | cancel all |

Transitions that change times round scheduled times to 5 minutes; actual times (pulled at) stay exact.
"Changes without asking" (alert Done/+15, Not yet) keep serve only if every food keeps its minimum rest
(`holdsCover`); otherwise serve moves.

## 8. Home Assistant integration (v2)

Plan of record: `docs/HA-INTEGRATION.md`. Entity survey: `docs/ha-entities.md`. Design points:

- **Ownership:** the app owns the plan and the clock (its own alarms); HA owns temperatures (HA blueprint
  sends temperature alerts through the HA Companion app). No step is alerted by both.
- **Code layout:** all HA network code in `src/lib/ha/` (`auth.ts`, `ws.ts`, `rest.ts`, `discovery.ts`,
  `publish.ts`); pure decision logic in `engine/probe.ts` (`nextTempEvent`, `suggestion`, staleness) tested
  with fake readings. HA is never imported by the engine.
- **Auth:** HA's OAuth-style login for third-party apps. `client_id` = `https://mecheng70.github.io/pitplanner/`
  (GitHub Pages page whose `<head>` holds `<link rel="redirect_uri" href="pitplanner://auth-callback">`).
  Login opens in a Custom Tab; the app never sees the password. `state` carries the HA address and a random
  nonce; reject a mismatched nonce. Code exchange and refresh at `/auth/token`; Disconnect revokes at
  `/auth/revoke`.
- **Transport:** WebSocket `subscribe_entities` while open, REST polling every 15 s as fallback, exponential
  backoff on failure. Stale over 2 min shows grey, never a guessed value.
- **Publishing (Phase 2):** `POST /api/states/sensor.pit_planner_cook` on Start cook, every change, End cook,
  on open, and every 10 min while the app is open during a cook. The blueprint treats a missing sensor as no
  cook. Background re-publish with the app closed is not in scope (decision D-5).
- **Read-only toward the grill** until Phase 4; never `pitboss.start_grill`, never the power switch.
- **Phases:** 0 survey (done), 1 sign-in + discovery + live temps, 2 publish + blueprint, 3 suggestions and
  probe-based learning, 4 optional confirmed set-temp. WBS phase 8.

## 9. Security

| Asset | Rule |
|---|---|
| Release signing key `~/keys/pitplanner.jks` | Never in the repo (`.gitignore` covers `*.jks`, `*.keystore`, `keystore.properties`, `signing/`). Backed up off GitHub. Losing it forces every user to uninstall. Cert SHA-256 `b6c32d12...0a29` (HANDOFF). |
| `android/keystore.properties` | Local only; template `keystore.properties.example`. Semgrep ignores it via `.semgrepignore` so a local scan never prints the passwords. |
| HA refresh token | SecureStore only (Keystore-backed). Never in Preferences, logs, `.pitplan`, crash text or the repo. |
| HA access token | Memory only, about 30 min; refresh on expiry or 401. |
| HA password | Never seen by the app (Custom Tab login). |
| Snyk / GitHub tokens | Read by the CLIs from the user's own config (`snyk config`, `gh auth`). Never in the repo, scripts or CI files. |
| `.pitplan` import | Untrusted input: 256 KB cap natively, every field validated, unknown foods dropped, numbers clamped. |
| Network | HTTPS only for remote HA. Cleartext allowed only for a user-entered LAN IP via network security config, with a warning. GitHub update check is anonymous. |
| Exported components | Receivers `exported=false`; the activity is exported only for MAIN and the `.pitplan` VIEW/SEND filters (and `pitplanner://auth-callback` in v2). |
| Static checks | Semgrep (`p/typescript`, `p/kotlin`, `p/secrets`) and Snyk (open source + code) in `npm run check`; no high or critical finding left open; exceptions written up in `SECURITY-EXCEPTIONS.md`. |

The HA user is a non-admin HA account, but HA non-admins can still control every entity; the app limits
itself in code (read-only, 3.4 of HA-INTEGRATION) and the help text says so.

## 10. Quality gate and test strategy

`npm run check` (`tools/check.sh`) runs, in order, stopping at the first failure:

1. Prettier: `prettier --write .` then `prettier --check .` (config `.prettierrc.json`; markdown, `data/`,
   `docs/`, `android/` excluded by `.prettierignore`).
2. ESLint: `eslint --max-warnings 0 .` (`eslint.config.js`: eslint-config-preact + typescript-eslint
   recommended).
3. Typecheck: `tsc --noEmit` with TypeScript 7 (`typescript7` package alias).
4. Tests: `npm run test:all` = engine (node:test) + UI (Vitest) + Android (JUnit via
   `./gradlew testDebugUnitTest`).
5. Semgrep: `semgrep scan --error --severity ERROR --no-git-ignore` with `p/typescript p/kotlin p/secrets`
   (`.semgrepignore` excludes generated and local-secret files).
6. Snyk: `snyk test --all-projects --severity-threshold=high` (Gradle limited to `releaseRuntimeClasspath`,
   see SE-001) then `snyk code test --severity-threshold=high` (`.snyk` excludes `reference/`, `dist/`,
   `release/`; see SE-002).

`npm run snyk:monitor` (`snyk monitor --all-projects`) is not in the gate; run it after a release or a push to
main.

| Level | Tool | Location | What goes here |
|---|---|---|---|
| Engine unit | `node --test` (Node 22.18+, runs .ts) | `engine/*.test.ts` | every engine function; every failure mode in SPEC 7 with a unit test column; rules schema |
| Pure app helpers | `node --test` | `engine/*.test.ts` importing `src/lib/*` | helpers that take `rules` as a parameter |
| UI components | Vitest + Testing Library + jsdom | `src/**/*.test.tsx` | kit components, screen logic that is not pure (store wiring, sheets, button states); query by role and label like a user |
| Native | JUnit, Robolectric when Android classes are used | `android/app/src/test/java/...` | AlarmStore JSON, scheduler replaceAll/restore, receivers, SharedPlan size cap, SecureStore |
| Regression | any of the above | next to the code | one test per fixed bug, named for the symptom, written to fail before the fix |
| Device | `npm run device` (`tools/device/`) + manual | dev copy `...pitplanner.debug` | alarms in Doze, reboot, permissions, font scale 100/115/130%, mockup fidelity screenshots |

Device rules: scripts only touch the dev copy. Never uninstall the release without a backup (HANDOFF has the
route). Batch device runs; screenshot only at checkpoints.

## 11. Release process

GitHub Releases is the primary distribution channel (D-1, decided 2026-11-12); Google Drive is an optional
mirror only (upload the same APK after step 7 if friends use the Drive link). The repo `MechEng70/pitplanner` is public as of 2026-11-12, so anonymous
release downloads and the in-app update check can work.

1. All tasks in the release are done; `git status` clean on `main`.
2. Bump `version` in `package.json` (versionCode = major*10000 + minor*100 + patch; must go up).
3. `npm run check` passes.
4. `npm run release` builds `release/pitplanner-<version>.apk`, verifies the signing cert SHA-256 and prints
   versionCode/versionName.
5. Install on the dev copy path is not possible for release builds; install the release APK on Jason's phone
   with `adb install -r` only after a backup if data matters (HANDOFF route), or let Jason install it.
6. Commit the version bump; tag `v<version>`; push `main` and the tag (only when Jason says to push).
7. `gh release create v<version> release/pitplanner-<version>.apk --title ... --notes-file ...` with the
   APK's SHA-256 in the notes. Mark betas `--prerelease`.
8. `npm run snyk:monitor` (records the released dependency tree in Snyk).
9. Check the in-app update row on a phone running the previous version.
10. Update `docs/HANDOFF.md` (what shipped, versionCode, commit).

## 12. Open decisions and risks

| ID | Decision or risk | Recommendation |
|---|---|---|
| D-1 | Distribution channel. | Decided 2026-11-12 (Jason): GitHub Releases is primary; Google Drive is an optional mirror only. The repo is public, so release downloads and the in-app update check work anonymously. |
| D-2 | TypeScript 7 vs typescript-eslint (supports < 6.1). | Done this session: ESLint parses with `typescript` 6.0.3; typecheck runs TS 7 (`typescript7` alias). Revisit when typescript-eslint supports TS 7 (T-040); then drop the alias. Risk: syntax only TS 7 accepts would fail lint first; low for this codebase. |
| D-3 | Snyk Gradle scan reports 28 high/critical issues in AGP's test runner (UTP, netty, grpc), not in the APK. | Approved 2026-11-12 (Jason): gate on `releaseRuntimeClasspath` (what ships); `snyk:monitor` keeps all configurations; T-039 removes the limit by 2027-02-01. See SE-001. |
| D-4 | Snyk Code was not enabled for the org (403) at first. | Resolved 2026-11-12: Jason enabled it. One high finding, a false positive in `reference/` (SE-002), excluded via `.snyk`. `snyk code test` stays in the gate. |
| D-5 | HA re-publish every 10 min needs the app alive; Android may kill it overnight. | Accept for Phase 2 (blueprint treats missing sensor as no cook; the app re-publishes on open). If it proves a problem, re-publish from the native alarm receivers at each step (they already run with the app dead). |
| D-6 | No version field on stored Preferences JSON. | Keep `normalize()` per key; add `v` only on the first breaking change. |
| D-7 | Secure storage for HA tokens: Jetpack Security (`EncryptedSharedPreferences`) is deprecated. | Write a small Keystore AES-GCM wrapper in the SecureStore plugin (T-025), Robolectric-tested with a fake key provider; device-test on the real phone. |
| D-8 | Live-cook states are implicit in `ActiveCook` fields. | Extract `engine/cookState.ts` (T-012) before HA Phase 3 adds probe-driven transitions. |
| D-9 | GitHub Pages for HA `client_id` needs Pages enabled on the public repo. | Serve from `docs/ha-client/` or a `gh-pages` branch with one static `index.html` (T-024). Jason enables Pages. |
| R-1 | Maker battery killers (Samsung etc.) delay alarms (failure mode 10). | Battery exemption is in setup; add the per-maker help link (T-016). Test on a Samsung if a friend has one. |
| R-2 | Losing the signing key. | Keep two off-GitHub backups; check them at each release (release step 1). |
| R-3 | Untrusted `.pitplan` files from chat apps. | Already capped and validated; keep a regression test per parsing bug. |
| R-4 | `@capacitor/local-notifications` would not use `setAlarmClock`. | Do not adopt it for steps; any new alert type goes through PitAlarms. |
