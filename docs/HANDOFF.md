# Handoff (2026-11-12, fourth session)

Read SPEC.md and CLAUDE.md first. This note is what a fresh session needs on top of them.

## Done

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

## Cook timing (HA-INTEGRATION.md "Do first"): done

Food details Timing: Hours per pound (stepper, 0.05 steps, source shown) / Total hours (any food, used as-is,
`TOTAL_HOURS_FIXED` info when the temp changes) / Size-adjusted (no lock; anchored at the reference weight).
"Use for future [food] on [cooker]" saves `rates` or `totalHours`. Rate rule (Jason): a saved rate is exact
until 3 logged cooks, then blends with them unless locked (`rateLocks`, "Keep my rate exactly" in Gear >
Cook rates). Brisket-style tri-tip is perWeight (1.67 hr/lb, 3.5 hr floor). `npm run device -- --only timing`.

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

## Decisions from Jason

- Follow the Android system font size. Times, temps, weights and countdowns never truncate at any
  scale; only secondary text may. Test at 115% and 130% (normal is 115%).
- Engine rounds phase starts to 5-minute steps; off-heat stays exact (serve - slice - rest).
- Plan: only Start cook is pinned; at 115% three cards + Add food fit, at 130% two cards.
- Food details: result card scrolls into view after any change. Known tradeoff, raised with Jason
  and not yet answered: the stepper being tapped scrolls away; alternative is pinning the result card.
- Setup step 1 is Welcome + units (the canvas has no step 1). Add a cooker (17) built with Setup.
- Alerts stay in the notification shade until handled or swiped; nothing removes them silently.
- Cost: keep sessions short, screenshot only at checkpoints, use `npm run device` instead of step-by-step driving.

## Known open items

- Quiet alerts holds scheduled steps but native repeats of an already-overdue step still ring.
- History entries can be removed but not edited (SPEC failure mode 14 says editable).
- Oven `warmingDrawer` is stored but unused by the planner.
