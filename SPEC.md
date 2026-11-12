# Pit Planner: v1 spec

Android app (sideloaded APK) that works backward from serve time to tell you when to fire the smoker, when to wrap, when to pull, and when to start the griddle, then rings a real alarm at each step and re-plans when the cook or the cook's human drifts.

Owner: Jason. Users: Jason, his wife, and friends with Android phones. Each phone runs its own cooks; nothing is shared live.

Mockups (source of truth for layout and look): https://claude.ai/artifact/HTLvrL9LnmkuoPLip1v9dz
PNG snapshots of every screen, numbered in flow order: `docs/mockups/`. Brand art: `assets/brand/`.

Reference implementation of the scheduling rules: `reference/cook-day-planner.html` (the HTML planner this app replaces). The engine in `engine/` supersedes it where they differ.

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Platform | Android only. Capacitor wrapping a web UI. No iOS. |
| Distribution | App ID io.github.mecheng70.pitplanner (permanent). Signed APK on GitHub Releases (MechEng70/pitplanner). In-app "new version available" check. No Play Store in v1. |
| Accounts / backend | None. All data on the phone. |
| Look | Dark only, stock Android feel (Material 3 patterns, Roboto, one ember-orange accent, blue for griddle). Must not look like a web page. |
| Name | Pit Planner. Support link label: "Buy me a bag of pellets", opening https://buymeacoffee.com/PitPlanner in the browser (rename "coffee" to "bag of pellets" on the Buy Me a Coffee page). |
| Scope | Everything in v1: all smoker types in the picker with their fuel alert models, Share plan, support link. Home Assistant is v2. |
| Scheduling | Plan to finish on time (no deliberate early cushion). The rest/hold is the only buffer. |
| Timing model | Per food, three choices: Hours per pound (default for by-weight foods), Total hours (any food: the user's time on heat, used as-is) and Size-adjusted (time ~ weight^0.67, open from the first cook). The rate or total can apply to one cook or be saved for future cooks (Gear, Cook rates). New users start on published rates with a one-time hint that most pellet smokers run faster. |
| Units | Fahrenheit and Celsius, pounds and kilograms. Stored as F and lb; converted at display. |
| Smoker temp | Dropdown in the cooker's own steps (5F on Jason's Pit Boss Sportsman 850), not three fixed buttons. Each option shows its fire time. |
| Pause | No "pause". Instead: Running behind/ahead, Quiet alerts, Pit went out, Start over, End cook. |

## 2. Architecture

- **UI:** Vite + TypeScript. Use a small component library or framework (Preact recommended for size). Plain CSS with tokens matching the mockups.
- **Engine:** `engine/` is pure TypeScript with no DOM, clock or storage access. The UI calls it and stores results. Keep it that way so it stays unit-testable.
- **Rules:** `data/foods.json` (foods, methods, phases, timing) and `data/cookers.json` (picker list). Adding a food should need no code change.
- **Storage:** `@capacitor/preferences` for settings and gear; cook history as a JSON file via `@capacitor/filesystem` (exportable, survives app updates).
- **Alarms:** a small custom Capacitor plugin (Kotlin) wrapping `AlarmManager.setAlarmClock()`. See section 6. Do not rely on `@capacitor/local-notifications` scheduling for step alarms unless you confirm it uses `setAlarmClock` (as of writing it does not appear to).
- **Time:** every instant is epoch milliseconds. Never store wall-clock strings for scheduled steps.

## 3. Screens

Artboard names refer to the mockup canvas.

### First launch
1. **Setup: what do you cook on** (`Setup`). Smoker model via the picker, hopper and grate filled from the model when verified. Griddle and Oven switches. "Add another cooker".
2. **Smoker picker** (`Picker`). Search plus type chips (All, Pellet, Kamado, Offset, Drum, Gravity, Electric). Grouped list from `data/cookers.json`. "Not listed? Enter it yourself" opens a manual form (type, min/max temp, temp step or preset list, hopper, grate).
3. **Setup: alerts** (`Perms`). Notifications (POST_NOTIFICATIONS, Android 13+), Alarms and reminders (exact alarm access), No battery limits (ignore battery optimizations). Live status per row. "Send a test alert in 10 sec" must use the real alarm path.

### Plan tab
- **Empty** (`Empty`): "What are we cooking?", Add food, Cook a past plan again.
- **Plan** (`Main`): Ready by / Start at toggle and time; smoker temp dropdown with fire time; one card per food (start time, time on heat); Add food; tiles for fire time, pellets, conflicts; Start cook. Tapping a card opens its details. Conflicts tile opens the fixes (move to griddle, change temp, finish earlier).
- **Smoker temp menu** (`TempMenu`): options in the cooker's steps across 200-300F by default with "Show all"; each row shows the resulting fire time. Temps outside 200-300F show the untrusted-estimate warning.
- **Add food** (`FoodPick`): searchable, grouped by Beef, Pork, Chicken.
- **Food details** (`FoodEdit`, `Ribs`, `Chicken`): quantity stepper, cooker chips (only cookers the user has; others disabled with "Add in Gear"), method and options from the rules file, rest stepper, Timing (Hours per pound / Total hours / Size-adjusted for by-weight foods, Standard / Total hours for others, with "Use for future [food] on [cooker]"), and a live result card ("On 6:40 AM, off 3:40 PM, fire the smoker at 6:20 AM").
- **Open shared plan** (`Shared`): shows the sender's menu; the receiver picks date and their own cookers; flags missing cookers and offers a fallback.
- **Share**: share icon on Plan exports a `.pitplan` JSON file through the Android share sheet. The app registers an intent filter to open it.

### Cook tab
- Tapping the Cook tab with food on the plan and no cook running does the same as Start cook (permission check, save, schedule alarms).
- **Live cook** (`Cook`): header with smoker temp and serve time, status chip (On plan / Behind / Ahead), Next up card worded as a check where the step is temperature or tenderness based ("Check at 11:35 AM: wrap once the bark is set"), "in 1 hr 12 min" (no seconds), Done and Adjust buttons, a lane chart (10 AM to serve) with a now line and smoker-overlap highlight, then the next three steps.
- **Cook options** (`Controls`): Running behind or ahead (-15/+15, Keep serve vs Move serve, with the hold impact spelled out); Quiet alerts for 30 min; Pit went out (stops the clock until "Back up to temp"); Start over; End cook (Save to history or Discard, cancels all alarms).
- **Lock-screen alert** (`Notify`): actions Done, +15 min, Open. Unacknowledged alerts repeat every 10 min.
- **Cook finished** (`EndCook`): planned vs actual per food, rate update, notes, Save / Discard, one-time support link.

### Gear tab
- **Gear** (`Pit`): Cookers list with Add a cooker; Your numbers (cook rates, history); App (Alerts status, Home Assistant "Coming later", Buy me a bag of pellets linking to https://buymeacoffee.com/PitPlanner); units setting; version.
- **Add a cooker** (`AddCooker`) then **Griddle** (`Griddle`) or **Oven** (`Oven`) or the smoker picker.
- **Cook history** (`History`): Cook rates per by-weight food on the user's smoker (rate used and its source, cooks logged, saved total hours; tap to edit the saved rate or total hours); list of cooks with Cook again.

## 4. Scheduling engine (implemented in `engine/`, tested in `engine/plan.test.ts`)

- **Backward scheduling.** For each food: off-heat time = serve - slice - rest. Phases are laid backward from there. Phases flagged `anchorToEnd` (e.g. tri-tip griddle sear) stay at the end.
- **Start-at mode.** Build as ready-by, then offset everything so the first action (fire the smoker or start the griddle) lands on the chosen time.
- **Pit temperature.** Time multiplier = 0.85 ^ ((T - 225) / 25). This fits the published 225/250/275 rates. Outside 200-300F, warn instead of showing a confident time.
- **Rates.** By-weight foods (brisket, pork butt, brisket-style tri-tip) use hr/lb at 225F. This cook's own rate (`ItemInput.hrPerLb`) wins. A saved rate (`rateOverrides`) is used as-is until 3 logged cooks of that food on that smoker; after that it is the prior the cooks blend with, unless the user locks it (`rateLocks`, "Keep my rate exactly" in Cook rates). With nothing saved, the published default blends with logged cooks. Blend: rate = (3 x prior + sum of observed) / (3 + n). Observed cooks are normalized to 225F and to the wrap choice. User rates are limited to 0.3-2.5 hr/lb; outside 0.5-1.6 shows a soft warning, never a block.
- **Total hours.** `timingModel: 'totalHours'` with `totalHours`: time on heat used exactly, with no temp or wrap scaling; phases keep their normal shares. Works for every food. If the pit temp later differs from `totalHoursAtF`, an info warning says the total did not change.
- **Size-adjusted.** Available from the first cook (anchored to the rate above at the reference weight; learning refines it): time = rate x Wref x (W / Wref)^0.67, where Wref is the food's reference weight (12 lb brisket, 8 lb pork butt). Heat conduction time scales with thickness squared, and thickness with weight^(1/3) for similar shapes, which gives ~0.67. Treat the exponent as a starting point to refit from history later.
- **Clear-pit rule** (default on). If any smoker phase is 50F+ above the set point (e.g. wings at 400F), every low-and-slow smoker item finishes before that phase starts, minus 15 min to climb (unless the phase itself is the climb). The difference goes into its hold.
- **Conflicts.** Two smoker phases from different foods overlapping with set points more than 25F apart = PIT_CONFLICT.
- **Holds.** Warn when a hold exceeds the food's limit (brisket/butt 240 min, ribs 60, breasts 20, wings 30) or falls under the food's minimum rest.
- **Settable temp.** Warn when the chosen temp is not in the cooker's steps or presets.
- **Grate load.** Peak footprint estimate vs main grate and upper rack; info when the upper rack is needed, warn when over.
- **Fuel.** Pellet/gravity: simulate burn at low/high rates; refill alert 30 min before the hopper is estimated under 10%; info warning (orange Pellets tile) when the cook burns more than the hopper holds. Offset/electric: interval fuel checks. Kamado/drum: none.
- **Events.** Every step becomes an event with `alarm`, `checkStep` and `critical` flags. The UI and the alarm scheduler both read `plan.events`.

## 5. Live cook rules (`engine/live.ts`)

| Action | Engine call | Result |
|---|---|---|
| Done on a check step, early or late | `markStepDone` | That food's later phases move by the difference. UI then asks: shift the rest, or keep serve time (hold absorbs it). |
| Running behind / ahead | `shiftRemaining(now, delta, keepServe)` | Every not-yet-finished phase moves; keepServe keeps serve time and shows the hold impact. |
| Not yet at a pull check | `shiftRemaining(now, +30, keepServe, itemId)` | That food only; suggests raising the smoker 25F to make up time. |
| Pit went out / Back up to temp | `pitOutage(down, up, recovery=15)` | Smoker foods lose the downtime plus recovery. |
| Quiet alerts 30 min | UI only | Alarms inside the window are held and fire as one summary at the end; steps stay overdue. |
| Start over | UI | Back to Plan with the same menu. |
| End cook | UI + history | Save logs actual minutes on heat per food (feeds rates) or Discard (logs nothing). Cancels all alarms. |

Scheduled times set by these changes round to 5 minutes (actual times, like when food came off, stay exact). After every change: re-run `derive`, cancel every scheduled alarm, schedule the new set from `plan.events`. Never patch alarms one at a time.

## 6. Alarms (the part that must not fail)

- Schedule each `alarm: true` event with `setAlarmClock()`. The system exits Doze before these fire. `setExactAndAllowWhileIdle()` is rate-limited to about once per 9 min per app in Doze, so it is not used for steps.
- Each alarm posts a high-priority notification with actions **Done**, **+15 min**, **Open**, and a full-screen intent for overnight steps (sideloaded app; note Play Store restricts full-screen intents).
- Unacknowledged step: re-alarm every 10 min, up to 6 times, then a final "Cook needs you" alert. The Live Cook screen shows the step as overdue and counting.
- **Reboot:** a BOOT_COMPLETED receiver reloads the active cook from storage and reschedules every future alarm. Also reschedule on app update (MY_PACKAGE_REPLACED) and on time or timezone change.
- **Permissions:** request POST_NOTIFICATIONS; send the user to exact-alarm settings when not granted; request battery-optimization exemption. Re-check on every app start and show a red banner on Live Cook if anything was revoked.
- **Test hooks:** a hidden debug screen to fire any event in 10 sec, plus documented adb commands to force Doze (`adb shell dumpsys deviceidle force-idle`) during testing.

## 7. Failure modes

| # | Failure | Effect | What the app does | Test |
|---|---|---|---|---|
| 1 | User misses an alert (asleep, outside, phone inside) | Step late, cook drifts | Repeat every 10 min, overdue counter, Done asks shift-or-keep-serve | Alarm repeat test on device in Doze |
| 2 | User does a step early | Plan out of sync | Done early re-plans with the same question | `markStepDone` unit test |
| 3 | Meat runs ahead (probe tender early) | Long hold | Hold grows; warn past the food's hold limit | Hold limit unit test |
| 4 | Meat runs behind (long stall) | Late dinner | Not yet +30, shows serve impact, suggests +25F | `shiftRemaining` unit test |
| 5 | Pit flames out or runs out of pellets | Meat stalls, cools | Pit went out stops the clock; downtime + 15 min recovery added | `pitOutage` unit test |
| 6 | Phone reboots or app is killed overnight | All alarms lost | BOOT_COMPLETED + package-replaced reschedule from stored cook | Device test: start cook, reboot, verify next alarm |
| 7 | Daylight saving change during an overnight cook | Alarms an hour off | Epoch-ms instants only | DST unit test (Nov 1, 2026) |
| 8 | An adjustment creates a new pit conflict | Food at wrong temp | Every change re-runs conflict check; banner with fixes | Clear-pit and conflict unit tests |
| 9 | Exact alarm or notification permission revoked | Silent failure | Check on start and before Start cook; red banner; block Start cook until fixed or acknowledged | Manual revoke test |
| 10 | Phone maker battery killer (e.g. Samsung) | Late alarms | Battery exemption in setup; troubleshooting link per maker | Test on a Samsung if available |
| 11 | Two alarms at the same minute | One hidden | Combine into one notification listing both steps | Unit test on event grouping |
| 12 | Temp chosen that the cooker cannot set | Plan unachievable | Dropdown only offers settable temps; warning if imported plan has one | `TEMP_NOT_SETTABLE` unit test |
| 13 | Shared plan uses cookers the receiver lacks | Broken plan | Map to receiver's cookers or offer fallback (breasts to smoker) | Import test with no griddle |
| 14 | One weird cook skews learned rate | Bad next plan | Blend with prior (weight 3); Discard option; history entries editable | Learning unit test |
| 15 | Hold drops below 140F (cooler hold) | Food safety | Warn on cooler holds over 4 hr; oven hold needs lowest setting >= 140F | Oven settings validation |

## 8. Food safety rules

- Poultry 165F. Thin (pounded) breasts pull at 163-165F because carryover is small; thick breasts may pull at 160-162F and must be confirmed at 165F after resting.
- Whole-muscle beef and pork: USDA 145F plus 3 min rest. Medium-rare tri-tip (130-135F) is offered but labeled as below the USDA minimum.
- Brisket, pork butt and rib targets (195-205F) are for texture, not safety.
- Hot holding at 140F or above.

## 9. Data model (on device)

- `gear`: smoker (SmokerProfile), griddle, oven, units.
- `rates`: per foodId user override in hr/lb at 225F.
- `rateLocks`: per foodId, the saved rate never blends with logged cooks.
- `totalHours`: per foodId saved default total hours; new items of that food start on Total hours.
- `history`: CookLog[] (see `engine/types.ts`), plus notes, date, planned vs actual per step.
- `activeCook`: PlanInput + Plan + acknowledgements; written on every change so a reboot can restore it.
- `.pitplan` share file: `{ "app": "pit-planner", "version": 1, "serveAt": iso, "pitTempF": n, "items": ItemInput[] }`. No personal data, no history.

## 10. Distribution and updates

- Signing keystore created on Jason's machine, never committed (see `.gitignore`), backed up outside GitHub. Losing it means every user must uninstall to update.
- GitHub Releases hosts each APK. The app checks the latest release tag on launch and on resume (at most daily, `src/lib/update.ts`, anonymous request to api.github.com) and shows an "Update available" row at the top of Gear's App group, linking to the release's `.apk` asset (else the release page) in the browser. Tag releases `v<version>` matching package.json. Users allow "Install unknown apps" for their browser once.
- Version shown on the Gear screen.

## 11. Roadmap (not v1)

- Home Assistant (v2): optional server URL and token in Gear. Read Chef iQ probe temps and Pit Boss pit temps; make check steps temperature-triggered ("Brisket at 165F, wrap it") instead of time-only; publish cook status to HA.
- Refit the size exponent and temp curve from history.
- Light theme.

## 12. Open items

- Confirm the GitHub repo name. Assumed: github.com/MechEng70/pitplanner (update check reads its latest release).
- Verified specs (hopper, grate, temp step or presets, range) for every picker entry except the Pit Boss Sportsman 850 and 820 (the 820's 5F step is not confirmed). Until verified, fields stay blank for the user to fill in.
- App icon.
- Pellet burn rates (1.5 and 3 lb/hr) are estimates; learn them from logged refills.

## 13. Definition of done for v1

- `npm test` passes (engine).
- On Jason's phone: a full Saturday cook (brisket, wings, breasts) runs end to end with every alarm firing on time with the screen off, including after a reboot mid-cook.
- Adjust, Pit went out, Not yet and End cook all re-plan and reschedule alarms with no duplicates.
- The test alert from setup fires in Doze.
- Share plan round-trips between two phones.
- F/C and lb/kg switch everywhere without changing stored values.
