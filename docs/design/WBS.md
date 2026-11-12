# Pit Planner: work breakdown

Task details in [TASKS.md](TASKS.md); architecture in [TECH-DESIGN.md](TECH-DESIGN.md). Every task passes
`npm run check` before it is done (CLAUDE.md, Quality gate). "Jason" marks hands-on steps only he can do.

## Where things stand (2026-11-12)

- Release 0.2.0 (Capacitor + Preact) is on Jason's phone and is what friends would install today. It has the
  Plan, Cook, Setup and Gear tabs, the setAlarmClock plugin (device-tested in Doze and through a locked reboot),
  Share import (file:// tested) and the timing models.
- T-001 (timing fix close-out) is done (`b524245`), pending Jason's phone check on 0.2.0.
- **Stack change planned (approved by Jason 2026-11-12):** rebuild on Expo SDK 58 + React Native +
  NativeWind + React Native Reusables + Expo Router + expo-sqlite + expo-secure-store. `engine/` and `data/`
  and their tests do not change. 0.3.0 is the first Expo release and upgrades 0.2.0 in place with its data.
- Rule until 0.3.0 ships: no new features, only the port (R-5). Friends stay on 0.2.0 meanwhile.

## Phases

| # | Phase | Tasks | Depends on | Done means |
|---|---|---|---|---|
| 1 | Cook timing fix | T-001 | none | Done in code and evidence; Jason's phone check confirms 0.75 hr/lb fires about 6:20 AM for a 5:00 PM serve and persists. |
| 2 | Scaffold and quality gate | T-002, T-003, T-004, T-005, T-006, T-007 | Jason approves the plan | The Expo dev build runs beside the release app with three tabs and the engine; `npm run check` passes all six steps on the new stack; the themed kit exists; Maestro captures at 115/130%; a release-signed alpha installs over 0.2.0 on an emulator. |
| 3 | Storage | T-008, T-009, T-010, T-011, T-012 | phase 2 (T-003) | SQLite schema v1 with tested migrations; repositories and app store write through; a 0.2.0 install's data (gear, rates, draft, active cook, history) imports on first launch, or the fresh-start notice says what did not. |
| 4 | Alarm module | T-013, T-014, T-015, T-016 | T-003; T-010 for T-015; T-006 for T-016 | `pit-alarms` Expo module rings on time in Doze and after a locked reboot, every invariant has a JUnit test, Quiet also holds native repeats, and the app reschedules after every change. |
| 5 | Plan tab | T-017, T-018, T-019, T-059, T-058 | T-005, T-010; T-006 for T-058 | Mockups 04-08 rebuilt in React Native, matching at 115/130%, with Food details timing behaving as the T-001 checklist says; a font-size change keeps the screen, and the tab, open screen and unsaved edits survive process death. |
| 6 | Cook tab | T-020, T-021, T-022, T-023 | phases 4 and 5 | Mockups 12-15: Start cook, Live cook, Cook options and Cook finished work on the dev build with real notifications, on top of a tested `engine/cookState.ts`. |
| 7 | Setup | T-024, T-025 | T-005, T-010, T-015 | First run (mockups 01-03, 17) sets up cookers and alerts; the test alert rings in Doze through setAlarmClock. |
| 8 | Gear and history | T-026, T-027, T-028 | phase 7, T-009 | Mockups 16-20, including editing or excluding a past cook (failure mode 14). |
| 9 | Share | T-029, T-030, T-031 | T-017, T-018 | `.pitplan` export and open (content URIs, 256 KB cap), with the conflict fix after import; a plan round-trips between two phones via Gmail and Drive (Jason). |
| 10 | Beta release 0.3.0 | T-032, T-033, T-034, T-035, T-036, T-037, T-038, T-039 | phases 3-9 | Parity with 0.2.0 confirmed, security pass done, Saturday cook passed on the Expo build, `v0.3.0` on GitHub Releases signed with the same key, Jason's phone upgraded with data kept, `snyk:monitor` ran; `legacy/` removed a week later. |
| 11 | After the beta | T-040, T-041 | phase 10 | Lane chart full screen (after mock approval) and the oven drawer decision are done. |
| 12a | HA Phase 0 | done (`docs/ha-entities.md`) | none | Entity IDs recorded; the non-admin registry check moves to T-045. |
| 12b | HA Phase 1 | T-042, T-043, T-044, T-045, T-046, T-047, T-048, T-049, T-050 | phase 10; D-9 for T-043 | Jason signs in as the `pitplanner` HA user, discovery finds his smoker and probes, each food maps to a probe, and Live cook shows live temps that go grey when stale. |
| 12c | HA Phase 2 | T-051, T-052 | 12b | `sensor.pit_planner_cook` published during a cook; the imported blueprint notifies on a hot-water probe test. |
| 12d | HA Phase 3 | T-053, T-054 | 12c | Next up offers "Brisket hit 166F" with Done (never automatic), a pit drop offers "Pit went out?", probe times feed learning. |
| 12e | HA Phase 4 (optional) | T-055 | 12d; Jason opts in | A confirmed set-temp button works only while the grill runs. |
| 13 | iOS readiness | T-056 | T-015, T-030, T-045 | Lint keeps native access behind `src/platform` and `src/db`; every service has an iOS mapping in TECH-DESIGN. No Xcode work. |
| M | Maintenance | T-057 | T-003 | Full Snyk Gradle scan clean and the scope limit gone by 2027-02-01 (SE-001). |

## Dependency graph

```
T-001 (done)

T-002 ─┬─ T-003 ─┬─ T-008 ─ T-009 ─ T-010 ─┬─ T-012 <── T-011 <── T-003
       │         │                          ├─ T-015 <── T-013 ─ T-014
       │         ├─ T-011, T-013            │      └─ T-016 <── T-006
       │         └─ T-057                   │
       ├─ T-004 ─ T-005 ─┬──────────────────┴─ T-017 ─┬─ T-018 ─┐
       ├─ T-006          │                            ├─ T-019 ─┤
       └─ T-007          │                            └─ T-029 ─┴─ T-030 ─ T-031 (Jason)
                         └─ T-024 ─┬─ T-025 (needs T-015)
                                   └─ T-026 ─┬─ T-027 ─ T-041
                                             ├─ T-028 ─ T-036 (needs T-029)
                                             └─ T-032
        T-020 ─┐
        T-015 ─┼─ T-021 ─ T-022 ─ T-023          T-021 ─ T-040
T-019 ─ T-058 ─┘   (T-058 also needs T-006, T-010)

T-016, T-019, T-023, T-025, T-028, T-030 ─ T-034 ─┬─ T-035 ─┐
                                                   └─ T-037 ─┼─ T-038 ─ T-039 (+1 week)
T-007 ─ T-033 ────────────────────────────────────────────── ┤
T-012, T-036 ─────────────────────────────────────────────── ┘

HA: T-042, T-043, T-044 ─ T-045 ─┐   T-044 ─ T-046 ─┤
                                 └─ T-047 ─┬─ T-048
                                           └─ T-049 ─ T-050 (needs T-046, T-020) ─┬─ T-051 ─ T-052
                                                                                  └─ T-053 ─ T-054, T-055
T-015 + T-030 + T-045 ─ T-056
```

## Critical path

**To 0.3.0 (the long pole):** T-002 -> T-003 -> T-008 -> T-009 -> T-010 -> T-013 -> T-015 -> T-021 -> T-022 ->
T-023 -> T-034 -> T-037 (Jason's Saturday cook) -> T-038. The Plan tab (T-004 -> T-005 -> T-017 -> T-019 ->
T-058) must also be done before T-021, so T-004/T-005 run alongside T-008..T-010. Roughly 25-30 sessions in
total for phases 2-10, plus Jason's hands-on steps: plan approval, Maestro install, fidelity approvals per tab,
the two-phone share test (T-031), the Saturday cook (T-037) and the upgrade on his phone (T-038).

**Biggest risks on the path:** NativeWind/Reusables on RN 0.88 (settled by the T-004 spike before any screen
is ported), the 0.2.0 data import (T-012, tested against the real 0.2.0 APK on an emulator), and alarm
regressions in the port (T-014 tests, T-016 device run, T-037 real cook).

**After 0.3.0:** Home Assistant follows its own chain T-042..T-052 (about 11 sessions), gated by mock approval
(T-042), GitHub Pages (D-9) and Jason's device tests.

## Suggested order

1. Jason reviews this plan; Jason checks T-001 on his phone.
2. T-002, then T-003 (gate first, so every later task is gated), then T-004 (spike: settles R-1).
3. In parallel threads of work: T-005/T-006/T-007 and T-008 -> T-009 -> T-010 -> T-011 -> T-012.
4. T-013 -> T-014 -> T-015 -> T-016 (alarms solid before the Cook tab).
5. Plan tab T-017 -> T-018 -> T-019 -> T-059 -> T-058, then T-020 -> T-021 -> T-022 -> T-023.
6. Setup T-024/T-025, Gear T-026..T-028, Share T-029..T-031.
7. Beta T-032..T-038; T-039 a week later.
8. T-040/T-041, then Home Assistant; T-057 before 2027-02-01 whenever a prebuild shows the AGP state.
