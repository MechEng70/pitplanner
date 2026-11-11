# Handoff (2026-11-11)

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

## In progress: Cook tab (mockups 12-15)

Done: engine helpers above; `src/lib/cook.ts` (ActiveCook state + doneStep / postpone / shift /
pitDown / pitUp / quiet / syncAlarms / stepText); `src/lib/history.ts` (history.json via Filesystem);
store has `cook`, `records`, `history`, `flags` + `setCook`, `addRecord`, `setFlags`; kit has
StatusChip, Banner, ActionRow, ChoiceCards, TextArea, Lanes (lane chart). Typecheck is clean.

Built 2026-11-11 (steps 1-3, device-checked at 115/130%): `src/screens/cook/CookScreen.tsx`, pure view
helpers `src/lib/cookView.ts` (tests in `engine/cookview.test.ts`), `applyActions` in cook.ts, drain wired in
app.tsx, Start cook uses `newCook`. Kit: AppBar/Screen `subtitle`, `BandNote`, `MoreVert`. `npm run device` now
also runs `tools/device/cook.mjs` (Start cook, Done x2, Keep/Move sheet) -> `out/cook.png`.
Then (same day): Cook options `CookOptions.tsx` (13), Cook finished `FinishScreen.tsx` + pure `src/lib/finish.ts` (15),
nag body "N min past the step." (14, native). Pit out holds step alarms and sets one 15-min "Pit back up?" reminder.
Kit: Sheet and Menu now portal to body (fixes sheets under the bottom nav on footer-less screens), InfoRow,
Divider, LinkButton, AppBar `overline`. Device pass covers options (incl. close + reopen), End cook, Discard.
Not device-tested yet: Save to history, pellets link, Pit went out / Back up to temp, Quiet, Start over,
notification Done/+15 drain, the new nag text.
Open: times after an early Done are not rounded (Check at 6:41 PM).

Original list (all built):
1. **CookScreen** (12): header "Cooking" + "Smoker 225F, serve 5:00 PM" + StatusChip from `driftMin`
   (Behind if overdue or >= 5 min late, Ahead if <= -5) + overflow button opening options.
   Next up card (ResultCard style): overline "CHECK AT 11:35 AM" for check steps, "AT ..." otherwise,
   "OVERDUE SINCE ..." when late; title/body from `stepText`, check steps add " Not ready? Tap Adjust.";
   countdown "in 1 hr 12 min" (no seconds, tick every 30 s) or "12 min overdue"; Done + Adjust.
   Lane chart from now's hour to serve (segments per phase, hold dashed, `smokerOverlaps` band + note).
   "After that": next three steps; Full timeline sheet. Red Banner when `allGranted` is false.
   Pit-out Banner with "Back up to temp". Empty state when no cook.
2. **Done flow:** `doneStep`; if it returns `ask`, a sheet with ChoiceCards Keep serve / Move serve
   (show hold impact), then `setCook` + `syncAlarms`. Serve step Done opens Cook finished.
3. **Notification actions:** on start, on App `resume`, and on the plugin's `alarmAction` event, call
   `PitAlarms.drainActions()`: `done` -> `doneStep(keepServe=true)`, `snooze15` -> `postpone(15, true)`;
   set `cook.notice` describing what changed; then `syncAlarms`. Open the Cook tab on start if a cook exists.
4. **CookOptions sheet** (13): running behind/ahead stepper (+-15) with Keep/Move ChoiceCards and the
   hold impact line from a preview `shift`, Apply button; Not yet +30 for the next step's food
   (`postpone`); Quiet alerts 30 min (`quiet`); Pit went out (`pitDown`); Start over (cancelAll, clear
   cook, Plan tab); End cook.
5. **Cook finished** (15): planned (`onHeatSpan` of `original`) vs actual (`onAt`/`offAt`, else plan
   times) per food; rate update card using engine `rateFor` before/after the new log; notes; Save to
   history (`addRecord`) or Discard; both cancelAll + clear cook. One-time "Buy me a bag of pellets"
   link (https://buymeacoffee.com/PitPlanner) using `flags.supportShown`.
6. Native nag text tweak for mockup 14: repeats read "N min past the step." before the body
   (`Notifications.show`, `repeat > 0`).

Next: Setup (01-03, reuse `AlertChecks`/`TestAlertButton`), Gear and history (16-20), Open shared
plan (11) + `.pitplan` intent filter, update check (GitHub Releases, MechEng70/pitplanner), signing.

## Decisions from Jason

- Follow the Android system font size. Times, temps, weights and countdowns never truncate at any
  scale; only secondary text may. Test at 115% and 130% (normal is 115%).
- Engine rounds phase starts to 5-minute steps; off-heat stays exact (serve - slice - rest).
- Plan: only Start cook is pinned; at 115% three cards + Add food fit, at 130% two cards.
- Food details: result card scrolls into view after any change. Known tradeoff, raised with Jason
  and not yet answered: the stepper being tapped scrolls away; alternative is pinning the result card.
- Cost: keep sessions short, screenshot only at checkpoints, use `npm run device` instead of step-by-step driving.

## Known open items

- Pellets can exceed the hopper with no Plan warning; refill label says "under 25%" but triggers at 10% (engine).
- Step labels in `data/foods.json` contain F temperatures that do not convert in Celsius mode.
- Quiet alerts holds scheduled steps but native repeats of an already-overdue step still ring.
- Gear tab is a stand-in; first-launch Setup does not exist (gear seeds the Pit Boss 820).
- Not a git repo yet: nothing is committed.
