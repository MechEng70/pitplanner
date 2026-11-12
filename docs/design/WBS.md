# Pit Planner: work breakdown

Task details in [TASKS.md](TASKS.md); architecture in [TECH-DESIGN.md](TECH-DESIGN.md). Every task passes
`npm run check` before it is done (CLAUDE.md, Quality gate). "Jason" marks hands-on steps only he can do.

## Where things stand (2026-11-12)

Built and device-tested before this plan: Plan tab, engine, alarm plugin, Cook tab, Setup, Gear and history,
release signing, Share import (file:// only), cook timing models, HA Phase 0 survey. Release 0.2.0 is on
Jason's phone. Quality gate tooling added this session; the cleanup commit is `ef2107b`.

## Phases

| # | Phase | Tasks | Depends on | Done means |
|---|---|---|---|---|
| 1 | Cook timing fix | T-001 | none | Every "Do first" item maps to code and a test, and the phone screenshots of the three modes and the 0.75 hr/lb Plan are in `docs/fidelity/`. |
| 2 | Beta release | T-002, T-003, T-004, T-005 | phase 1; T-010 preferred | `v0.3.0` is a GitHub Release with a signed APK and checksum, the update row shows on a 0.2.0 phone, friends have an install guide, `snyk:monitor` ran. |
| 3 | Alarm plugin | T-006, T-007, T-008, T-009, T-010 | none (T-009 after T-007) | Native tests run in the gate, every alarm invariant has a test, Quiet silences repeats, and a real Saturday cook survived a reboot with no missed or duplicate alarm. |
| 4 | Cook tab | T-011, T-012, T-013, T-014 | T-008 for T-012/T-013; mock approval for T-014 | Live-cook states are one tested pure function, the revoked-permission banner works on resume, and the main Cook flows have UI tests. |
| 5 | Setup | T-015, T-016 | T-008 | Setup steps have UI tests, the test alert rings in Doze through setAlarmClock, and battery help shows for listed makers. |
| 6 | Gear and history | T-017, T-018, T-019, T-020 | T-008 for T-020; T-020 for T-018; Jason's decision for T-019 | History entries can be edited or excluded, history exports and imports, the oven drawer is used or gone, and storage/files/share sit behind interfaces. |
| 7 | Share import | T-021, T-022 | none | An import that creates a pit conflict offers a fix, and a plan round-trips between two phones through Gmail and Drive. |
| 8a | HA Phase 0 | done (`docs/ha-entities.md`) | none | Entity IDs recorded. Open item (non-admin registry reads) moves to T-027. |
| 8b | HA Phase 1 | T-023, T-024, T-025, T-026, T-027, T-028, T-029, T-030, T-031, T-032 | T-008, T-006, T-011; D-9 for T-024 | Jason signs in with the `pitplanner` HA user, discovery finds his smoker and probes, each food maps to a probe, and Live Cook shows live temps that go grey when stale. |
| 8c | HA Phase 2 | T-033, T-034 | 8b | `sensor.pit_planner_cook` is published during a cook and the imported blueprint notifies on a hot-water probe test. |
| 8d | HA Phase 3 | T-035, T-036 | 8c | Next up offers "Brisket hit 166F" with Done (never auto), a pit drop offers "Pit went out?", and probe times feed learning. |
| 8e | HA Phase 4 (optional) | T-037 | 8d; Jason opts in | A confirmed set-temp button works only while the grill runs. |
| 9 | iOS readiness | T-038 | T-008, T-020, T-025 | Lint forbids Capacitor imports outside `src/platform/`, and every service has an iOS mapping in TECH-DESIGN. No Xcode work. |
| M | Maintenance | T-039, T-040 | as listed | Full Snyk scan is clean with no Gradle scope limit, and one TypeScript version is used. |

## Dependency graph

```
T-001 ──────────────────────────────┐
T-002 ─┬─ T-004 ──────────────────┐ │
T-003 ─┘                          ├─┴─> T-005 (beta 0.3.0)
T-010 (Jason: Saturday cook) ─────┘ (preferred)

T-006 ─> T-007 ─> T-009
T-006 ─> T-025 ───────────────────────────────┐
T-008 ─┬─> T-012, T-013, T-015, T-016          │
       ├─> T-020 ─> T-018                      │
       ├─────────────────────────────┐         │
T-011 ─┼─────────────────────────────┼───┐     │
T-023 ─┤                             │   │     │
T-024 ─┼─> T-027 <── T-026 ─> T-028  │   │     │
       │      ^──────────────────────┼───┼─────┘
       │      └─> T-029 <── T-028    │   │
       │            ├─> T-030        │   │
       │            └─> T-031 ─> T-032 <─┘ (also T-028)
       │                          └─> T-033 ─> T-034
       │                          └─> T-035 ─> T-036, T-037
T-008 + T-020 + T-025 ─> T-038
T-021 ─> T-022 (Jason)
```

## Critical path

**To the beta:** T-001 -> T-002 -> T-004 -> T-005, with T-003 in parallel. About four sessions plus Jason's install. T-010 (a real cook with a reboot) is not code but
should pass before friends rely on alarms.

**To Home Assistant live temps (the longest chain):** T-008 -> T-011 -> (T-023 mock approval, T-024 Pages,
T-006 -> T-025 secure store, T-026 auth) -> T-027 sign-in -> T-028 WebSocket -> T-029 discovery -> T-031 probe
per food -> T-032 live temps -> T-033 publish -> T-034 blueprint. About 13 sessions; the gates outside
Claude's control are Jason approving the mocks (T-023), enabling GitHub Pages (D-9) and the device tests in
T-027, T-029 and T-034.

## Suggested order

1. T-001, then T-002/T-003/T-004 (beta prep) and T-006/T-007 (native tests) alternating.
2. T-005 beta once Jason has run T-010.
3. T-008, T-011, T-020 (structure for everything after).
4. T-009, T-012, T-013, T-015, T-021, T-017 (hardening, any order).
5. T-023 mocks early so approval does not hold up HA Phase 1; then 8b in order.
6. T-039 before 2027-02-01 (SE-001 deadline); T-040 when typescript-eslint allows.
