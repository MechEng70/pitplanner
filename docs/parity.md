# Parity review (T-034)

Every SPEC screen, live cook rule and failure mode against the Expo build: where it is built and which test
proves it. Reviewed 2026-11-15 (nineteenth session) by reading code and tests; nothing here was judged from a
file name. "OK" means the code is there and a test would fail if it broke.

Status words: **OK**; **No test** (built, nothing asserts it); **Part** (built or tested in part);
**Differs** (built another way than SPEC says); **Missing**.

Tests are named by file: Jest under `src/`, engine under `engine/`, Kotlin under
`modules/pit-alarms/android/src/test/`, device tests by name (`tools/device/README.md`).

## 1. Open rows

Everything that is not OK. T-034 is done when each row is fixed or accepted by Jason in writing (the
"Decision" column).

### 1a. Built differently than SPEC says

| # | SPEC | The build | Recorded OK? | Decision |
|---|---|---|---|---|
| D1 | Open shared plan: "the receiver picks ... their own cookers" (section 3) | Nothing to pick: "Your smoker" is read-only and foods are mapped onto the receiver's cookers (`SharedPlanSheet.tsx:91-107`, `mapToCookers`). Same as 0.2.0. | Screenshot approved (T-030), the difference itself not written down | Jason, 2026-11-16: closed, handled by Food details after import (T-070 moved to after 0.3.0) |
| D2 | Temp menu: "Show all" | The button reads "Show 180-500F", the cooker's range (`TempMenu.tsx:86-92`). Same as 0.2.0. | Screenshots approved (T-018), wording not written down | Jason, 2026-11-16: keep as built, the button stays "Show 180-500F" |
| D3 | Plan, empty: Cook a past plan again | Shown only when there is a past cook (`PlanEmpty.tsx:46-51`). | Yes: Jason 2026-11-13 (TASKS T-017, T-028) | SPEC edited 2026-11-15 |
| D4 | Live cook: lane chart "10 AM to serve" | The chart starts at the hour of the first step, "6 AM to serve" (`cookView.ts:94-101`). Same as 0.2.0. | **Jason, 2026-11-15: keep as built** | accepted; SPEC edited 2026-11-15 |
| D5 | Cook finished: Back to the cook "beside Discard this cook" | On its own line under Discard (`FinishScreen.tsx:94-101`). | Yes: Jason (TASKS T-063) | SPEC edited 2026-11-15 |
| D6 | Live rules: Not yet calls `shiftRemaining(now, +30, keepServe, itemId)` | Calls `postponeStep` (`cook.ts:125-133`, `live.ts:165-185`): the same result for the user. Same as 0.2.0. | No | SPEC edited 2026-11-15 (Jason: yes to wording edits) |
| D7 | "A Done 5 min or more early or late ... ask Keep serve or Move serve" | Asked for a Done on a step during the cook. A Done on a pull (food off the heat) never asks, and serve never moves, even when the food comes off after serve (`cook.ts:112-120`, `markPullDone`). The same for Done on an alert. Same as 0.2.0. | **Jason, 2026-11-15: leave as is, the rest absorbs it** | accepted; SPEC says so; test in `cook.test.ts` |
| D8 | Failure mode 8: after an adjustment that makes a new pit conflict, a "banner with fixes" | On Plan the Conflicts tile and sheet do this. During a cook nothing does: a conflict made by Running behind, Not yet, a Done or Back up to temp is worked out and never shown (`src/screens/cook` reads no warnings). Same as 0.2.0. | **Jason, 2026-11-15: show it on Live cook as a banner** | Done, T-069 (2026-11-16): one amber banner on Live cook with OK, for a conflict the plan did not have at Start cook (`liveWarnings`, `src/lib/cookView.ts`; `CookScreen.test.tsx`). No fixes on the banner (Jason: OK only). Not yet seen on a device |
| D9 | Failure mode 3: warn past the food's hold limit | Reported when planning (`HOLD_TOO_LONG`, an info line in Conflicts). A hold that grows during a cook is not flagged on Live cook. Same as 0.2.0. | No | Jason, 2026-11-16: add to T-069, the Live cook banner also shows a hold past the food's hold limit. Done, T-069 (2026-11-16): the same banner says "Long hold: ..." (`engine/cookview.test.ts`) |
| D10 | Failure mode 15: warn on cooler holds over 4 hr | Only the general hold note at 240 min for brisket and pork butt: not tied to a cooler, does not name the cooler or 140F, info level, Plan only. | No | Jason, 2026-11-16: wording only for 0.3.0, the hold note says to keep it above 140F once the hold passes 4 hours. Done 2026-11-16: `holdNote` in `data/foods.json` for brisket and pork butt ("Keep it above 140F.") |
| D11 | Failure mode 12: a warning if an imported plan has a temp the cooker cannot set | The import moves the temp to the closest one the smoker can set and says so in the sheet (`sharedPlan.ts:170-176`). Same as 0.2.0. | No | Jason, 2026-11-16: accept as built |
| D12 | Failure mode 6 and section 6: "reloads the active cook from storage" | The receiver puts back the alarms from the native alarm store; the app sets the whole list again from the cook when it next opens. | Yes: TECH-DESIGN sections on alarms | SPEC edited 2026-11-15 |
| D13 | Failure mode 10: troubleshooting link per maker | A plain line, no link. | Yes: Jason 2026-11-15 (SPEC section 3 item 3) | SPEC edited 2026-11-15 |
| D14 | Failure mode 4: suggests +25F | Not built. | Yes: Jason 2026-11-15 (SPEC section 5) | SPEC edited 2026-11-15 |

### 1b. Built, with no test or a thin one

| # | What | Where | What is missing |
|---|---|---|---|
| T1 | Quiet alerts: held alarms fire as one summary at the end | `engine/alarms.ts:82-96`, `cook.ts:202-208` | **Closed 2026-11-15:** `cook.test.ts` "Quiet alerts: a step inside the 30 min is held ..." |
| T2 | Quiet alerts: steps stay overdue | `CookScreen.tsx:127,180`, `cookView.ts` | **Closed 2026-11-15:** `CookScreen.test.tsx` "with Quiet alerts on, a step past its time still reads overdue and Behind" |
| T3 | The 5 minute line for asking Keep or Move | `cook.ts:16` (`ASK_SHIFT_MIN`) | **Closed 2026-11-15:** `cook.test.ts` "... from 5 min off, not at 4". The second copy of the number in `engine/cookState.ts` is still there |
| T4 | Not yet when the next step is a pull | `live.ts:180-181` (`extendCook`) | **Closed 2026-11-15** at lib level: `cook.test.ts` "Not yet at a pull ...". No screen test taps it |
| T5 | Smoker-overlap highlight on the lane chart | `Lanes.tsx:121-131`, `CookScreen.tsx:309` | **Closed 2026-11-15:** `CookScreen.test.tsx` "the lane chart gets the band ..." |
| T6 | Open on the alert opens the app | `Notifications.kt:55-59,85` | Only the label and "changes nothing" are tested. **Closed 2026-11-16:** `modules/pit-alarms/android/src/test/.../ParityTest.kt` "aTapOnTheAlertStartsThisAppsActivityInANewTask" and "aRepeatOfTheAlertAlsoOpensTheAppOnATap" (Robolectric, written without Gradle: first run at merge) |
| T7 | Cook history: a card for a food with only saved total hours | `HistoryScreen.tsx:105`, `historyView.ts:42` | Row logic test only. A food that is not by weight (ribs) with saved total hours also gets a card, which SPEC's "by-weight" does not say. **Closed 2026-11-16:** `src/screens/gear/HistoryScreen.parity.test.tsx` "ribs with saved total hours get a card with the total and no rate or cooks tiles" (records the card as built; Jason, 2026-11-16: fine as built, "by-weight" dropped from the SPEC wording) |
| T8 | Food details: result bar reads "On" for a cooker not lit ahead | `FoodEdit.tsx:176` | No test. **Closed 2026-11-16:** `src/screens/plan/FoodEdit.parity.test.tsx` "with no smoker set up, the bar reads On, the time the food goes on heat, instead of Fire". No food is cooked in the oven and a griddle food always gets a griddle-on time, so a smoker food with no smoker in Gear is the only way to reach "On" today |
| T9 | Food details: content never gets shorter while open | `FoodEdit.tsx:186-194` (`useNeverShorter`) | Device `stable-controls` covers rate and weight taps only; no Jest test. **Closed 2026-11-16:** `src/screens/plan/FoodEdit.parity.test.tsx` "the frame keeps the tallest height the form has had, and grows with it" |
| T10 | Food details: method chips | `FoodEdit.tsx:232-242,286-295` | No Jest test picks a method; device `food-details` checks the heading only. **Closed 2026-11-16:** `src/screens/plan/FoodEdit.parity.test.tsx` "ribs: every method on the smoker is a chip, and picking 3-2-1 changes the note and what is saved", "tri-tip: picking brisket-style takes that method's rest (45 min, from 10)" and "brisket has one method: no Method chips" |
| T11 | Setup alerts: Allow notifications | `AlertChecks.tsx:50-60` | Pressed only in `CookScreen.test.tsx`, through the shared component. **Closed 2026-11-16:** `src/screens/setup/AlertsStep.parity.test.tsx` "asks Android first; when the user says yes, Settings does not open and the row reads On" and "when Android does not grant it, Settings opens at notifications and the Allow button stays" |
| T12 | Setup alerts: the battery line has no link | `AlertChecks.tsx:89-95` | Nothing asserts it (a negative claim). **Closed 2026-11-16:** `src/screens/setup/AlertsStep.parity.test.tsx` "the line is there, as plain text: no link, no button, nothing to tap" (parity D13) |
| T13 | Undo is in Cook options, not on the Cook screen | `CookOptions.tsx` | Nothing asserts it (a negative claim). **Closed 2026-11-16:** `src/screens/cook/CookOptions.parity.test.tsx` "after a Done there is nothing to undo on the Cook screen; Undo is a row in Cook options" |
| T14 | Alarms put back after the clock is set (TIME_SET) | `AndroidManifest.xml:24` of `pit-alarms` | No unit test and no device row. **Closed 2026-11-16** (unit, no device row): `ParityTest.kt` "theRestoreReceiverIsRegisteredForEveryEventThatWipesOrMovesAlarms" and "aClockChangePutsTheStoredAlarmsBackAtTheSameInstants" (Robolectric, written without Gradle: first run at merge) |
| T15 | The receiver's manifest entries for BOOT_COMPLETED, MY_PACKAGE_REPLACED, TIMEZONE_CHANGED | the same manifest, lines 22-25 | Manual emulator rows in `docs/alarm-testing.md` only; the Kotlin manifest test asks for LOCKED_BOOT_COMPLETED alone. **Closed 2026-11-16:** `ParityTest.kt` "theRestoreReceiverIsRegisteredForEveryEventThatWipesOrMovesAlarms" and "aTimeZoneChangeOrAnAppUpdatePutsTheStoredAlarmsBack" (Robolectric, written without Gradle: first run at merge) |
| T16 | A live change that makes a new pit conflict | `engine/live.ts` (every change ends in `derive`) | Closed, T-069 (2026-11-16): `engine/live.test.ts` (Running behind, a late wrap, Not yet, a late pull) |
| T17 | Failure mode 7: the DST test | `engine/plan.test.ts` (Nov 1, 2026) | It is all UTC and the engine has no clock, so it cannot fail because of DST; it records the design. **Closed 2026-11-16** at the app layer, where wall time meets instants: `src/lib/dst.parity.test.ts` "steps on each side of the change read in their own offset", "the alarms the phone gets are the plan instants, and read the same wall times", "the default serve, Saturday 5:00 PM, is 5:00 PM the week after the change" and "a shared plan served Sat Oct 31 at 5:00 PM is offered for Sat Nov 7 at 5:00 PM", in America/New_York, with a first test that fails if the zone has no fall-back on Nov 1, 2026 |
| T18 | Oven hold setting at least 140F | `CookerSheets.tsx:148,165` | The stepper stops at 140F and is tested; a stored or imported number is not checked. **Open (finding, 2026-11-16):** nothing checks it. An oven saved with `lowestTempF: 120` loads as 120 (`cookersRepo.load`, `isOven` checks only that it is a number), a 0.2.0 gear entry with 120 imports with status "done" and nothing lost (`importLegacy` uses the same check), the plan's step reads "Oven to 120F for holding." with no warning, and the Oven sheet opens showing 120 (the floor applies only once a stepper button is tapped). No test committed: it would fail today. Jason, 2026-11-16: clamp to 140F on load and at the import, with a line in the import notice (T-077). **Closed, T-077 (2026-11-16):** the floor is `OVEN_HOLD_MIN_F` in `src/lib/gear.ts` (the stepper uses it too); `cookersRepo` reads and writes a hold below it as 140F, so a data-file restore ends at 140F as well. Tests: `src/db/repos/repos.test.ts` "a stored oven hold below 140F loads as 140F; 140F and above load as stored" and "saving an oven hold below 140F stores 140F"; `src/db/legacyImport.test.ts` "130F imports as 140F, nothing is lost, and the notice adds one line" (140F and 150F untouched, no line); `src/db/restore.test.ts` "a data file with an oven hold of 130F restores as 140F"; `src/screens/shared/ImportNotice.test.tsx` "the oven hold line" |
| T19 | Hold limit of 240 min for brisket and pork butt | `data/foods.json`, `engine/plan.ts:423-431` | No test holds either past 240 min. **Closed 2026-11-16:** `engine/plan.test.ts` "a hold past 4 hours says "Keep it above 140F." for brisket and pork butt, and for no other food" holds each for 300 min (past its 240 min limit) and brisket for exactly 240 (no warning) |

### 1b-2. Proven only by hand, or needs a phone

| # | What | State |
|---|---|---|
| P1 | Failure mode 6: reboot with the phone locked, on the Expo build | **Failed on the dev build, OnePlus, 2026-11-16**: the app crashes at start while the phone is locked, so alarms come back only after unlock (`docs/alarm-testing.md`). Must-fix for 0.3.0 (Jason): T-072. A release build on the PIN emulator keeps its alarms (2026-11-16), so the crash is dev-build code. Jason, 2026-11-16: test only, no start-up guard; the locked-reboot device test is required before every release |
| P2 | Failure mode 1: repeats in Doze; six repeats then "Cook needs you" | One repeat proven on the phone in forced Doze (2026-11-16); the six-repeat count and "Cook needs you" proven in Robolectric. Accepted for 0.3.0 (Jason, 2026-11-16) |
| P3 | Failure mode 9: a permission taken away during a cook | Run on the phone, 2026-11-16: the Cook tab banner shows and goes, the alarms stay (`docs/alarm-testing.md`) |
| P4 | Failure mode 10: a Samsung | Not run; one tester has one. At T-037: the locked-reboot check once on the tester's Samsung, after the T-072 fix (Jason, 2026-11-16) |
| P5 | Reboot, app update, time zone change | Run by hand on the emulator (`docs/alarm-testing.md`); no device test function |

### 1c. Mockups with no fidelity sheet in `docs/fidelity`

| Mockup | State |
|---|---|
| 08 brisket details | Older sheets only (`before-after-08`, `scales-08`, `130pct-08`), no `rn-08`. The device test writes `tools/device/out/food-details-115.png` (not kept in git) |
| 09 ribs details | None. In the same device picture |
| 10 chicken details | None. In the same device picture |
| 14 lock-screen alert | None. The alert's actions are tested in Kotlin (`ReceiversTest`); how it looks on a lock screen needs the phone |

All other mockups (01-07, 11-13, 15-20) have an `rn-NN-*.png` sheet there.

### 1d. Housekeeping found on the way

- SPEC section 7 row 8 says "banner"; section 3 describes the Conflicts tile and sheet.
- `docs/HANDOFF.md` ("Known open items") still says history entries cannot be edited; they can.
- `tools/device/README.md` has no row for the `cook-options` device test. It covers Pit went out, Back up to
  temp and Start over; Running behind, Quiet alerts, Not yet and Try again have no device test.
- `GearScreen.tsx:3-4` and its test's "those rows do nothing" comment are out of date: the route passes the handlers now.
- Two questions to Jason are still open in TASKS (T-022): the look of the -15/+15 control, and Keep staying
  selected in Running behind when a food would go under its minimum rest (backlog).

## 2. SPEC section 3: screens

Rows that are OK, with their proof. Open rows are in section 1 by number.

### First launch

| Claim | Proof |
|---|---|
| Setup "What do you cook on", smoker by the picker, hopper and grate from a verified model, Griddle and Oven, Add another cooker | `Setup.test.tsx`; device `setup` |
| Picker: search, type chips, grouped list from `data/cookers.json` | `SmokerPicker.test.tsx` (the chip list follows the data: one chip per type that has a model; all six have one today) |
| "Not listed? Enter it yourself": type, min and max temp, step or presets, hopper, grate | `SmokerPicker.test.tsx`; device `setup` |
| Alerts: Alarms and reminders, No battery limits, live status per row | `AlertsStep.test.tsx` |
| Send a test alert in 10 sec through the real alarm path | `AlertsStep.test.tsx`; `ReceiversTest`, `AlarmSchedulerTest`; device `setup`, `alarm` |
| The battery line, word for word | device `setup` |
| Notifications row and its Allow button | T11 |

### Plan tab

| Claim | Proof |
|---|---|
| Empty: "What are we cooking?", Add food | `PlanScreen.test.tsx`, `PlanTab.test.tsx`; device `plan` |
| Cook a past plan again | D3 |
| Ready by / Start at and the time | `PlanScreen.test.tsx`; device `plan`, `stable-controls` |
| Smoker temp field with fire time; one card per food with start time and time on heat | `PlanScreen.test.tsx` |
| Two of the same food: the card's title is the label | `PlanScreen.test.tsx`, `engine/labels.test.ts` |
| Add food; tiles for fire time, pellets, conflicts; Start cook | `PlanScreen.test.tsx`, `StartCook.test.tsx`; device `plan`, `plan-sheets`, `cook` |
| A card opens its details | `PlanTab.test.tsx` |
| Conflicts tile: move to the griddle, change temp, edit the food | `PlanTab.test.tsx`; device `plan-sheets`, `turkey` |
| Temp menu: the cooker's steps across 200-300F, fire time per row, the warning outside 200-300F | `TempMenu.test.tsx`, `engine/temps.test.ts`; device `plan-sheets` |
| "Show all" | D2 |
| Add food: search, groups Beef, Pork, Chicken, Turkey | `FoodPick.test.tsx`; device `plan-sheets` |
| Food details: quantity stepper, cooker chips with "Add in Gear", options, rest stepper | `FoodEdit.test.tsx`; device `food-details`, `turkey` |
| Method chips | T10 |
| Timing: Hours per pound / Total hours / Size-adjusted, or Standard / Total hours; "Use for future ..." | `FoodEdit.test.tsx`; device `food-details` |
| Result card; a new food goes on the menu on Add to plan, not before | `FoodEdit.test.tsx`, `PlanTab.test.tsx`; device `food-details`, `plan-sheets` |
| Result bar pinned with fire, off heat, serve; keeps its place; a tap scrolls the card into view | `FoodEdit.test.tsx`, `ResultBar.test.tsx`; device `food-details` |
| "On" for a cooker not lit ahead | T8 |
| Nothing scrolls, takes focus or moves on a value change; the sheet is full height | `FoodEdit.test.tsx` (regression), `sheet.test.tsx`; device `stable-controls` |
| Content never gets shorter | T9 |
| Open shared plan: the sender's menu, the receiver picks a date, missing cookers flagged, a fallback | `SharedPlanSheet.test.tsx`, `engine/share.test.ts`; device `shared` |
| The receiver picks their own cookers | D1 |
| Share: icon, `.pitplan` JSON, the share sheet, "Couldn't share" | `PlanTab.test.tsx`, `share.test.ts`, `shareFile.test.ts` (the share sheet itself only in Jest; a real one is T-029 on the phone) |
| The app opens a `.pitplan` | `plugins/pitplanIntents.test.ts`, `OpenedPlan.test.tsx`; device `shared` (`file://`; `content://` from Files, Gmail, Drive is T-031) |

### Cook tab

| Claim | Proof |
|---|---|
| Only Start cook starts a cook: permission check, save, alarms, opens Cook | `StartCook.test.tsx`, `alarmSync.test.tsx`; device `cook` |
| "No cook running" and Go to Plan; Start cook greyed out while a cook runs; ending goes back to Plan | `CookScreen.test.tsx`, `StartCook.test.tsx`, `FinishScreen.test.tsx`; device `cook`, `cook-options`, `cook-finished` |
| Header, status chip, Next up as a check, the title with its countdown, days and hours a day out, Done and Adjust, the next three steps | `CookScreen.test.tsx`, `engine/cookview.test.ts`; device `cook` ("Ahead" is asserted in the engine test only) |
| Lane chart window | D4 |
| Now line | `Lanes.test.tsx` |
| Smoker-overlap highlight | T5 |
| "Alarms could not be set. Steps will not ring." and Try again | `CookScreen.test.tsx`, `alarmSync.test.tsx`, `AlarmSchedulerTest` |
| Start over asks first, saves nothing, leaves the menu and history alone | `CookOptions.test.tsx`; device `cook-options` |
| Keep serve or Move serve after an early or late Done | `CookOptions.test.tsx`; D7 for a pull, T3 for the 5 minute line |
| Back up to temp asks; Move is selected when a food would go under its minimum rest | `CookOptions.test.tsx`, `engine/cook.test.ts`; device `cook-options` |
| Cook options: Running behind or ahead with hold impact, Quiet alerts, Pit went out, Start over, End cook | `CookOptions.test.tsx`, `cook.test.ts`, `alarmSync.test.tsx` |
| Undo: names the step, the most recent Done only | `CookOptions.test.tsx`, `cook.test.ts`; device `followups` |
| Alert actions Done, +15 min, Open; repeats every 10 min | `ReceiversTest`, `AlarmSchedulerTest`, `alertActions.test.tsx` (T6 for Open) |
| Cook finished: planned and actual, rate update, notes, Save, Discard, the one-time support link | `FinishScreen.test.tsx`; device `cook-finished` |
| Back to the cook: takes the Serve Done back, only while it can | `FinishScreen.test.tsx`, `cook.test.ts`; device `followups` (D5 for where it sits) |

### Gear tab

| Claim | Proof |
|---|---|
| Cookers, Add a cooker, Cook rates, Alerts status, Home Assistant "Coming later", Buy me a bag of pellets (the URL), units, version | `GearScreen.test.tsx`; device `gear` |
| Add a cooker, then Griddle, Oven or the picker | `AddCooker.test.tsx`, `CookerSheets.test.tsx`; device `gear` |
| Cook history: rate cards, edit a saved rate or total hours, cooks with Cook again, the two-tap wording | `HistoryScreen.test.tsx`; device `history` (T7 for the total-hours-only card) |

## 3. SPEC section 5: live cook rules

| Rule | Proof |
|---|---|
| Done on a check step: later phases of that food move; then Keep or Move | `engine/plan.test.ts`, `engine/cook.test.ts`, `CookOptions.test.tsx` |
| Running behind / ahead: every unfinished phase moves; keep serve shows the hold impact | `engine/plan.test.ts`, `CookOptions.test.tsx` |
| Not yet: +30, that food only; serve stays while minimum rests hold, and the row says which; no "+25F" | `CookOptions.test.tsx`, `engine/cook.test.ts` (D6 for the call name, T4 at a pull) |
| Pit went out / Back up to temp: downtime plus 15 min | `CookOptions.test.tsx`, `engine/cook.test.ts`, `engine/plan.test.ts` |
| Undo: back to just before the tap, alarms too; a Done on an alert counts; later changes go with it; a due step rings again in 10 min | `engine/undo.test.ts`, `cook.test.ts`, `CookOptions.test.tsx`, `FinishScreen.test.tsx` |
| Quiet alerts: repeats of an overdue step are held | `ReceiversTest`, `AlarmSchedulerTest`, `QuietTest`, `alarmSync.test.tsx` (T1 for the summary, T2 for overdue) |
| Start over: Plan with the same menu | `CookOptions.test.tsx`; device `cook-options` |
| End cook: Save logs minutes on heat, Discard logs nothing, all alarms cancelled | `FinishScreen.test.tsx`, `store.test.tsx`, `alarmSync.test.tsx`, `AlarmSchedulerTest` |
| Scheduled times round to 5 minutes, actual times stay exact | `engine/rounding.test.ts`, `engine/cook.test.ts`, `CookScreen.test.tsx` |
| After every change: derive again, cancel all, schedule the whole set | `alarmSync.test.tsx`, `AlarmSchedulerTest`, `CookOptions.test.tsx` (+15 on an alert sets one alarm natively until the app opens and replaces the set; by design) |

## 4. SPEC section 7: failure modes

| # | What the app does | Status | Proof |
|---|---|---|---|
| 1 | Repeat every 10 min, six times, then "Cook needs you" | OK in unit tests | `ReceiversTest`; `docs/alarm-testing.md` "Unanswered repeat" (P2) |
| 1 | Overdue counter; Done asks keep or move | OK | `CookScreen.test.tsx`, `engine/cookview.test.ts`, `CookOptions.test.tsx`; device `followups` (D7 for a pull) |
| 2 | Done early re-plans, with the same question | OK | `engine/cook.test.ts`, `engine/plan.test.ts`, `CookOptions.test.tsx` |
| 3 | Hold grows | OK | `engine/cook.test.ts` |
| 3 | Warn past the hold limit | Part | `engine/plan.test.ts`, `engine/share.test.ts` when planning (D9, T19) |
| 4 | Not yet +30, shows the serve impact | OK | `CookOptions.test.tsx`, `engine/cook.test.ts` (D6, D14) |
| 5 | Pit went out stops the clock; downtime plus 15 min | OK | `CookOptions.test.tsx`, `cook.test.ts`, `engine/plan.test.ts`, `engine/cook.test.ts`; device `cook-options` |
| 6 | Alarms back after a reboot, an update, a time or time zone change | Part | `AlarmSchedulerTest`, `ReceiversTest`; `docs/alarm-testing.md` (P1, P5, T14, T15, D12) |
| 6 | App killed overnight | OK | device `survive` (a force stop is not covered: Android clears alarms then) |
| 7 | Epoch-ms instants only | OK | `engine/` uses no `Date`; `engine/plan.test.ts` (T17) |
| 8 | Every change re-runs the conflict check | Part | `engine/plan.test.ts`, `engine/share.test.ts` (T16) |
| 8 | The fixes, on Plan | OK | `IssuesSheet.test.tsx`, `PlanTab.test.tsx`; device `plan-sheets` |
| 8 | The fixes, during a cook | Missing | D8 |
| 9 | Checked when Live cook shows and before Start cook; red banner; Start cook held until fixed or Start anyway | OK | `StartCook.test.tsx`, `CookScreen.test.tsx`; device `cook` (P3) |
| 9 | Exact alarms refused: an inexact alarm is set and the app says so | OK | `AlarmSchedulerTest`, `alarmSync.test.tsx` |
| 10 | Battery exemption in Setup | OK | `AlertsStep.test.tsx`; device `setup`, `gear` (D13, P4) |
| 11 | Two alarms in one minute become one alert listing both | OK | `engine/alarms.test.ts`, `ReceiversTest` |
| 12 | The menu offers only temps the cooker can set | OK | `TempMenu.test.tsx`, `engine/temps.test.ts` |
| 12 | An imported plan with a temp the cooker cannot set | Differs | `engine/share.test.ts`, `SharedPlanSheet.test.tsx` (D11) |
| 13 | Foods mapped to the receiver's cookers; missing cookers flagged; breasts to the smoker | OK | `engine/share.test.ts`, `SharedPlanSheet.test.tsx` |
| 14 | Blend with the prior at weight 3; Discard; history entries can be edited | OK | `engine/plan.test.ts`, `FinishScreen.test.tsx`, `HistoryScreen.test.tsx`; device `cook-finished`, `history` |
| 15 | Warn on cooler holds over 4 hr | Part | D10 |
| 15 | Oven hold setting at least 140F | OK | `CookerSheets.test.tsx`; stored, imported and restored values: `repos.test.ts`, `legacyImport.test.ts`, `restore.test.ts` (T18, T-077) |

## 5. Still to do in T-034

- Jason's decision on the rows still "open" in 1a: D2 ("Show 180-500F"), D9 (hold
  limit during a cook), D10 (cooler hold), D11 (imported temp).
- T-069 (conflict banner on Live cook) and T-070 (the receiver picks cookers): both new UI, approved first.
- 1b rows T6 to T19: which get a test before 0.3.0.
- Fidelity sheets for mockups 08, 09, 10 (1c); 14 with the phone.
- The task's "full device pass at 115% and 130%": not run in this review.
