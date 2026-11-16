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
| Platform | Android first: Expo + React Native (0.1.0 and 0.2.0 were Capacitor + Preact). iOS later, behind the same interfaces. |
| Distribution | App ID io.github.mecheng70.pitplanner (permanent). Signed APK on GitHub Releases (MechEng70/pitplanner). In-app "new version available" check. No Play Store in v1. |
| Accounts / backend | None. All data on the phone. |
| Look | Dark only, stock Android feel (Material 3 patterns, Roboto, one ember-orange accent, blue for griddle). Must not look like a web page. |
| Name | Pit Planner. Support link label: "Buy me a bag of pellets", opening https://buymeacoffee.com/PitPlanner in the browser (rename "coffee" to "bag of pellets" on the Buy Me a Coffee page). |
| Scope | Everything in v1: all smoker types in the picker with their fuel alert models, Share plan, support link. Home Assistant is v2. |
| Scheduling | Plan to finish on time (no deliberate early cushion). The rest/hold is the only buffer. |
| Timing model | Per food, three choices: Hours per pound (default for by-weight foods), Total hours (any food: the user's time on heat, used as-is) and Size-adjusted (time ~ weight^0.67, open from the first cook). The rate or total can apply to one cook or be saved for future cooks (Gear, Cook rates). New users start on published rates with a one-time hint that most pellet smokers run faster. |
| Units | Fahrenheit and Celsius, pounds and kilograms. Stored as F and lb; converted at display. Smoker and oven set points show in 5F steps (the cooker's own) or, in Celsius, in 2C increments. |
| Smoker temp | Dropdown in the cooker's own steps (5F on Jason's Pit Boss Sportsman 850), not three fixed buttons. Each option shows its fire time. |
| Pause | No "pause". Instead: Running behind/ahead, Quiet alerts, Pit went out, Start over, End cook. |

## 2. Architecture

How it is built in detail: `docs/design/TECH-DESIGN.md`. In short:

- **App:** Expo (SDK 58, development builds, never Expo Go) + React Native + TypeScript (strict), Expo Router for navigation (tabs Plan, Cook, Gear; Setup on first run). Styling with NativeWind; components from React Native Reusables themed to the mockup tokens. Dark only.
- **Engine:** `engine/` is pure TypeScript with no React Native, Expo, clock or storage access. The app calls it and stores results. Keep it that way so it stays unit-testable (`node --test`).
- **Rules:** `data/foods.json` (foods, methods, phases, timing) and `data/cookers.json` (picker list). Adding a food should need no code change.
- **Storage:** `expo-sqlite` (one database, versioned migrations) for settings, gear, rates, the active cook and cook history; `expo-secure-store` for secrets (Home Assistant token). 0.2.0 data (Capacitor Preferences and `history.json`) is imported once on upgrade.
- **Platform access:** only through the interfaces in `src/platform/` (alarms, permissions, share, links, secrets), so iOS can be added later behind the same API.
- **Alarms:** the `pit-alarms` Expo module (Kotlin) wrapping `AlarmManager.setAlarmClock()`. See section 6. Do not use `expo-notifications` scheduling for step alarms: it does not use `setAlarmClock`.
- **Time:** every instant is epoch milliseconds. Never store wall-clock strings for scheduled steps.
- **0.2.0 reference:** the Capacitor app lives in `legacy/` until 0.3.0 reaches parity; tag `v0.2.0` rebuilds it.

## 3. Screens

Artboard names refer to the mockup canvas.

### First launch
1. **Setup: what do you cook on** (`Setup`). Smoker model via the picker, hopper and grate filled from the model when verified. Griddle and Oven switches. "Add another cooker".
2. **Smoker picker** (`Picker`). Search plus type chips (All, Pellet, Kamado, Offset, Drum, Gravity, Electric). Grouped list from `data/cookers.json`. "Not listed? Enter it yourself" opens a manual form (type, min/max temp, temp step or preset list, hopper, grate).
3. **Setup: alerts** (`Perms`). Notifications (POST_NOTIFICATIONS, Android 13+), Alarms and reminders (exact alarm access), No battery limits (ignore battery optimizations). Live status per row. "Send a test alert in 10 sec" must use the real alarm path. Under the rows, a plain line for phones that delay alerts to save battery ("Alerts late or missing? Check the battery settings for Pit Planner in your phone's settings."); no link to an outside site (Jason, 2026-11-15).

### Plan tab
- **Empty** (`Empty`): "What are we cooking?", Add food, and Cook a past plan again once there is a past cook (Jason, 2026-11-13).
- **Plan** (`Main`): Ready by / Start at toggle and time; smoker temp dropdown with fire time; one card per food (start time, time on heat; with two or more of the same food the card's title is the food's label, section 4, "11.5 lb brisket"); Add food; tiles for fire time, pellets, conflicts; Start cook. Tapping a card opens its details. Conflicts tile opens the fixes (move to griddle, change temp, edit the food).
- **Smoker temp menu** (`TempMenu`): options in the cooker's steps across 200-300F by default with "Show all"; each row shows the resulting fire time. Temps outside 200-300F show the untrusted-estimate warning.
- **Add food** (`FoodPick`): searchable, grouped by Beef, Pork, Chicken, Turkey.
- **Food details** (`FoodEdit`, `Ribs`, `Chicken`): quantity stepper, cooker chips (only cookers the user has; others disabled with "Add in Gear"), method and options from the rules file, rest stepper, Timing (Hours per pound / Total hours / Size-adjusted for by-weight foods, Standard / Total hours for others, with "Use for future [food] on [cooker]"), and a live result card ("On 6:40 AM, off 3:40 PM, fire the smoker at 6:20 AM"). Choosing a food in Add food opens this screen for the new food; it goes on the menu on Add to plan, not before. A result bar is pinned at the bottom, above the buttons, with three times: fire (the smoker or the griddle; "On" for a cooker that is not lit ahead), off heat and serve. It keeps its height and place as the values change. Tapping it scrolls the full result card into view; that is the only scroll on the screen, and the user starts it. Nothing scrolls, takes focus or moves when a value changes: the sheet is always full height and its content never gets shorter while it is open.
- **Open shared plan** (`Shared`): shows the sender's menu; the receiver picks date and their own cookers; flags missing cookers and offers a fallback.
- **Share**: share icon on Plan exports a `.pitplan` JSON file through the Android share sheet. A share that fails says so ("Couldn't share"). The app registers an intent filter to open it.

### Cook tab
- Only Start cook on Plan starts a cook (permission check, save, schedule alarms), and it opens the Cook tab. With no cook running the Cook tab shows "No cook running" and Go to Plan, whatever is on the plan (Jason, 2026-11-15; 0.2.0 started a cook from the tab, so a discarded cook came back on the next look). While a cook is running, Start cook on Plan is greyed out. Ending a cook (Save, Discard or Start over) goes back to Plan.
- **Live cook** (`Cook`): header with smoker temp and serve time, status chip (On plan / Behind / Ahead), Next up card worded as a check where the step is temperature or tenderness based ("Check at 11:35 AM: wrap once the bark is set"), its title one sentence with the countdown, wrapped where it fits ("Check the brisket in 1 hr 12 min", no seconds; a day or more away "Fire the smoker to 225F in 1 day 22 hr", days and whole hours; Jason, 2026-11-15, in place of mockup 12's countdown on its own line), Done and Adjust buttons, a lane chart (from the hour of the first step to serve, "6 AM to serve", so the whole cook shows; Jason, 2026-11-15, in place of the mockup's "10 AM to serve") with a now line and smoker-overlap highlight, then the next three steps.
- **Alarms could not be set**: when the phone refuses the cook's alarm set, Live cook shows "Alarms could not be set. Steps will not ring." with Try again, which clears every alarm and sets the whole list again from the plan (Jason, 2026-11-15).
- **Start over** asks first ("Start over?", "This cook won't be saved.", Keep cooking / Start over); it drops the cook without saving, leaves the menu on Plan and never changes cook history. A Done 5 min or more early or late on a step during the cook, and Back up to temp, ask Keep serve or Move serve (a Done on food coming off the heat does not ask: the rest takes it up; Jason, 2026-11-15); Move is selected when keeping would leave a food short of its minimum rest.
- The mockups are a starting point, not a contract (Jason, 2026-11-15): where a built screen follows 0.2.0 and he has approved it, the screen wins.
- **Cook options** (`Controls`): Running behind or ahead (-15/+15, Keep serve vs Move serve, with the hold impact spelled out); Quiet alerts for 30 min; Pit went out (stops the clock until "Back up to temp"); Start over; End cook (Save to history or Discard, cancels all alarms). **Undo** (Jason, 2026-11-15; not in the mockup): after a step is marked Done, a row that names the step ("Undo: Brisket off the smoker") puts it back to not done. It is in Cook options, not on the Cook screen itself, and is offered for the most recent Done only, until the next step is marked done.
- **Lock-screen alert** (`Notify`): actions Done, +15 min, Open. Unacknowledged alerts repeat every 10 min.
- **Cook finished** (`EndCook`): planned vs actual per food, rate update, notes, Save / Discard, one-time support link. **Back to the cook** (Jason, 2026-11-15; not in the mockup): when Serve was marked Done by mistake, a text button on its own line under "Discard this cook" takes that Done back and returns to Live cook, with the alarms set again. It follows the Undo rule: shown only while Serve is the most recent Done and can still be taken back.

### Gear tab
- **Gear** (`Pit`): Cookers list with Add a cooker; Your numbers (cook rates, history); App (Alerts status, Home Assistant "Coming later", Buy me a bag of pellets linking to https://buymeacoffee.com/PitPlanner); units setting; version.
- **Add a cooker** (`AddCooker`) then **Griddle** (`Griddle`) or **Oven** (`Oven`) or the smoker picker.
- **Cook history** (`History`): Cook rates on the user's smoker, one card per by-weight food that is in a saved cook or has a saved rate or total hours (rate used and its source, cooks logged, saved total hours; tap to edit the saved rate or total hours); list of cooks with Cook again. Cook again replaces the plan; when the plan has food on it the first tap only says so ("This replaces the plan you have now. Tap Cook again to go on.") and the second tap does it.

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
- **Food temp floor** (T-059). A method can carry a lowest smoker temp (`minPitTempF` in `data/foods.json`; whole turkey 225F). With that food on the smoker below it, the plan reports TEMP_BELOW_FOOD_MIN ("Whole turkey needs the smoker at 225F or hotter. It is set to 220F.") in the Conflicts tile and sheet, with Change smoker temp and Edit. The temp is never changed for the user.
- **Whole turkey** (T-059). Unstuffed, on the smoker, by weight like brisket: 0.50 hr/lb at 225F to start, learned and adjustable like the other by-weight foods. Done at 165F in the innermost thigh, the innermost wing and the thickest part of the breast. Rest 30 min, 20 min minimum. Its food-safety numbers each cite a source in `foods.json` (`sources`); `engine/rules.test.ts` fails without one. No size warning in 0.3.0.
- **Grate load.** Peak footprint estimate vs main grate and upper rack; info when the upper rack is needed, warn when over.
- **Fuel.** Pellet/gravity: simulate burn at low/high rates; refill alert 30 min before the hopper is estimated under 10%; info warning (orange Pellets tile) when the cook burns more than the hopper holds. Offset/electric: interval fuel checks. Kamado/drum: none.
- **Events.** Every step becomes an event with `alarm`, `checkStep` and `critical` flags. The UI and the alarm scheduler both read `plan.events`.
- **Two of the same food** (`engine/labels.ts`; Jason, 2026-11-14). When the menu has two or more of one food, each gets a default label from its amount and food: "11.5 lb brisket", "3 racks St. Louis ribs", "4 chicken breasts". If two labels would still match, they are numbered in menu order ("6 lb brisket 1", "6 lb brisket 2"). Every step of a labelled food starts with its label ("11.5 lb brisket: Check tenderness: pull at 200-205F..."), so alarm text carries it too; the alarm's title is the label; and warnings use the label in place of the food name. On Plan the card's title is the label and its summary line leaves the amount out. A food that is the only one of its kind reads as before, with no label. The label is not stored: it follows the menu (change a weight and it changes), and it is written in lb and converted for display like all engine text. A name typed by the user is a later version (T-062).

## 5. Live cook rules (`engine/live.ts`)

| Action | Engine call | Result |
|---|---|---|
| Done on a check step, early or late | `markStepDone` | That food's later phases move by the difference. UI then asks: shift the rest, or keep serve time (hold absorbs it). |
| Running behind / ahead | `shiftRemaining(now, delta, keepServe)` | Every not-yet-finished phase moves; keepServe keeps serve time and shows the hold impact. |
| Not yet at a check | `postponeStep(key, now, +30, keepServe)` (a step during the cook: `markStepDone`; a pull: `extendCook`) | That food only. Serve stays while every food keeps its minimum rest, else serve moves; the row says which. (No "raise the smoker 25F" suggestion: dropped, Jason, 2026-11-15.) |
| Pit went out / Back up to temp | `pitOutage(down, up, recovery=15)` | Smoker foods lose the downtime plus recovery. |
| Undo (the most recent Done) | `undoDone` (`engine/undo.ts`) | The cook goes back to what it was just before the tap: the step is not done, and the plan, serve time, reminders and on / off heat times are as they were, so the alarm set is too. A Done tapped on an alert counts the same. A change made after the tap (Running behind, Not yet, +15, Back up to temp) is taken back with it, and the row says so. A step that was already due rings again 10 min after the undo and still reads as overdue. |
| Quiet alerts 30 min | UI only | Alarms inside the window are held and fire as one summary at the end; steps stay overdue. |
| Start over | UI | Back to Plan with the same menu. |
| End cook | UI + history | Save logs actual minutes on heat per food (feeds rates) or Discard (logs nothing). Cancels all alarms. |

Scheduled times set by these changes round to 5 minutes (actual times, like when food came off, stay exact). After every change: re-run `derive`, cancel every scheduled alarm, schedule the new set from `plan.events`. Never patch alarms one at a time.

## 6. Alarms (the part that must not fail)

- Schedule each `alarm: true` event with `setAlarmClock()`. The system exits Doze before these fire. `setExactAndAllowWhileIdle()` is rate-limited to about once per 9 min per app in Doze, so it is not used for steps.
- Each alarm posts a high-priority notification with actions **Done**, **+15 min**, **Open**, and a full-screen intent for overnight steps (sideloaded app; note Play Store restricts full-screen intents).
- Unacknowledged step: re-alarm every 10 min, up to 6 times, then a final "Cook needs you" alert. The Live Cook screen shows the step as overdue and counting.
- **Reboot:** a boot receiver (LOCKED_BOOT_COMPLETED and BOOT_COMPLETED) puts every stored alarm and repeat back from the alarm store on the phone, before the first unlock; the app sets the whole list again from the cook when it next opens. Also reschedule on app update (MY_PACKAGE_REPLACED) and on time or timezone change.
- **Permissions:** request POST_NOTIFICATIONS; send the user to exact-alarm settings when not granted; request battery-optimization exemption. Re-check on every app start and show a red banner on Live Cook if anything was revoked.
- **Test hooks:** a hidden debug screen to fire any event in 10 sec, plus documented adb commands to force Doze (`adb shell dumpsys deviceidle force-idle`) during testing.
- **Send to developer** (on the hidden debug screen; 5 taps on the version line on Gear open it, there is no visible switch): Send opens the phone's share sheet with one file, and the tester picks Gmail or whatever they use. The screen shows the developer's address as where to send the file, and it is offered as the recipient when the tester picks an email app. Tapping the address copies it, so it can be pasted into the email. The address is one constant (`DEVELOPER_EMAIL`, `src/lib/debugReport.ts`). The file holds what is needed to see what went wrong: app version and build, Android version, phone model, font size, time zone; the alert permissions as the phone reports them; the alarms the app has stored and their repeats; the app's data (cookers, plan, running cook, cook history, rates, settings and flags); and the app's own log of recent events (alarms set and fired, changes to a cook, errors; the last 300). No location, no accounts, no contacts, nothing from other apps, and nothing is sent until the tester taps Send.

## 7. Failure modes

| # | Failure | Effect | What the app does | Test |
|---|---|---|---|---|
| 1 | User misses an alert (asleep, outside, phone inside) | Step late, cook drifts | Repeat every 10 min, overdue counter, Done asks shift-or-keep-serve | Alarm repeat test on device in Doze |
| 2 | User does a step early | Plan out of sync | Done early re-plans with the same question | `markStepDone` unit test |
| 3 | Meat runs ahead (probe tender early) | Long hold | Hold grows; warn past the food's hold limit | Hold limit unit test |
| 4 | Meat runs behind (long stall) | Late dinner | Not yet +30, shows serve impact (no "+25F" suggestion: dropped, Jason, 2026-11-15) | `shiftRemaining` unit test |
| 5 | Pit flames out or runs out of pellets | Meat stalls, cools | Pit went out stops the clock; downtime + 15 min recovery added | `pitOutage` unit test |
| 6 | Phone reboots or app is killed overnight | All alarms lost | BOOT_COMPLETED + package-replaced reschedule from stored cook | Device test: start cook, reboot, verify next alarm |
| 7 | Daylight saving change during an overnight cook | Alarms an hour off | Epoch-ms instants only | DST unit test (Nov 1, 2026) |
| 8 | An adjustment creates a new pit conflict | Food at wrong temp | Every change re-runs conflict check. On Plan: the Conflicts tile and its sheet with the fixes. During a cook: a banner on Live cook (Jason, 2026-11-15; not built yet, wording to be approved) | Clear-pit and conflict unit tests |
| 9 | Exact alarm or notification permission revoked | Silent failure | Check on start and before Start cook; red banner; block Start cook until fixed or acknowledged | Manual revoke test |
| 10 | Phone maker battery killer (e.g. Samsung) | Late alarms | Battery exemption in setup; a plain line about battery settings, no link (Jason, 2026-11-15; section 3) | Test on a Samsung if available |
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
- `activeCook`: PlanInput + Plan + acknowledgements; written on every change so a reboot can restore it. It also holds the cook as it was before the most recent Done (for Undo), replaced at each Done.
- `.pitplan` share file: `{ "app": "pit-planner", "version": 1, "serveAt": iso, "pitTempF": n, "items": ItemInput[] }`. No personal data, no history.

## 10. Distribution and updates

- Signing keystore created on Jason's machine, never committed (see `.gitignore`), backed up outside GitHub. Losing it means every user must uninstall to update.
- GitHub Releases hosts each APK. The app checks for the newest release on the installed version's path on launch and on resume (at most daily, `src/lib/update.ts`, anonymous request to api.github.com): an install of a final release is offered final releases only; an install of a prerelease (alpha, beta, rc) is offered any newer version, prerelease or final. A check that fails (offline, rate limited, unreadable answer) does not count as the day's check: it is tried again the next time the app is opened or resumed, once each time. The app shows an "Update available" row at the top of Gear's App group, linking to the release's `.apk` asset (else the release page) in the browser. Tag releases `v<version>` matching package.json. Users allow "Install unknown apps" for their browser once.
- Version shown on the Gear screen.

## 11. Roadmap (not v1)

- Home Assistant (v2): optional server URL and token in Gear. Read Chef iQ probe temps and Pit Boss pit temps; make check steps temperature-triggered ("Brisket at 165F, wrap it") instead of time-only; publish cook status to HA.
- Refit the size exponent and temp curve from history.
- Low and slow for tough cuts (Jason, 2026-11-14; `docs/design/TASKS.md` T-060). On 0.2.0 an 11.5 lb brisket flat, about 1.5 inches thick, planned at 250F for 8 hr 50 min so it would make a 5:00 PM serve, read 205F on the probe at about 3 hr 25 min. The grill held its set temp; the plan was wrong for the cut. Candidates, none decided, each needing sourced numbers:
  1. The cut and its thickness (whole packer or flat, inches) as inputs to the time on heat, not weight alone.
  2. A recommended smoker temp per food, with a note or warning when the plan's temp is above it for a tough cut, shown where the temp is chosen and in Conflicts.
  3. A smoker temp change during the cook ("now at 225F") re-times what is left. Today the plan has one smoker temp for the whole cook.
  4. A food running ahead of its rate re-times from probe readings (with Home Assistant).
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
