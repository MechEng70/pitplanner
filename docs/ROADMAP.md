# Pit Planner: roadmap after 0.3.0

**0.3.0 was released on Thursday 2026-11-19** (https://github.com/MechEng70/pitplanner/releases/tag/v0.3.0).
Nothing of 0.3.0 is open: what was left is done or is an item below.

One page of what comes after 0.3.0, for Jason to triage after Sunday's readout. Written 2026-11-17.
`docs/design/TASKS.md` stays the source of truth: if this page and TASKS disagree, TASKS wins. No task numbers
were created for this page.

Each item: task ID (or "no task"), what, why, blocked on.

## 0.3.x

Bug fixes, plus the two exceptions Jason set (T-078 and the Celsius work).

**Goal:** bug fixes, and the looks and device checks carried from 0.3.0.

Not on this page: T-066 (the user guide) is 0.3.0 (Jason, 2026-11-17). Its text is merged; the screenshots come
from the fidelity PNGs after the device checks. If they are not ready for Monday's release they go to 0.3.1.

- **T-102** Google Play readiness: **done, shipped as 0.3.1-beta.1 on 2026-11-20** (a GitHub prerelease, and
  on Google Play's closed track, US only, in Google's review). The battery permission Play restricts is
  removed and "No battery limits" opens Pit Planner's App info; full-screen alerts off is a row only, never
  a fault; `tools/release.sh --bundle` builds the bundle Play takes. Details: TASKS T-102.
- **T-103** Alerts survive "Manage app if unused" (Android app hibernation) (Jason, 2026-11-20; 0.3.x,
  after T-102; not in 0.3.1-beta.1). A spike first: do alarms firing or notifications count as use, or only
  opening the app? Then, only if needed, a row in the Alerts sheet with a button to the setting (a row only,
  like full-screen alerts). With it: remember each alert permission's last state and, on app open, say
  once when one that was on is now off, with the fix buttons. Why: the setting is on by default on his OnePlus and on the emulators, and a
  smoker app can sit unused all winter. Blocked on: the spike's report; then a SPEC line, a mockup and his
  wording.
- **T-104** Google Play: portrait is not a required feature (Jason, 2026-11-20; 0.3.1, small; not before
  Tuesday 2026-11-24; goes into 0.3.1-beta.2, with T-105). A config plugin adds `uses-feature
  android.hardware.screen.portrait` with `required="false"`; the app stays portrait; a regression test.
  Why: Play warns that the feature is required (from `orientation: 'portrait'`), which blocks
  landscape-only devices. Blocked on: nothing.
- **T-105** Step alerts ring out loud on OxygenOS (Jason, 2026-11-21; **in 0.3.1-beta.2, with T-104**:
  Jason, 2026-11-23). On his OnePlus a step alert makes no sound (the system alarm tone is unset) and buzzes
  once (OxygenOS swaps the vibration). Fix: a foreground service while a step rings, a looping bundled tone
  at alarm volume (rings in silent and Do Not Disturb), a repeating buzz, a silent channel for the text and
  buttons, 1 minute per ring, and "Alarm volume is low" with Raise once at Start cook when the alarm volume
  is under half (Jason, 2026-11-23). Why: the alarm is the part that must not fail. Blocked on: Jason's
  go-ahead on the beta.2 plan (HANDOFF); Play's foreground service declaration filled in before the upload.
- **No task.** Celsius step: store the smoker temp step's unit so a units switch cannot change its meaning,
  and give the engine a real Celsius grid.
  With it (Jason, 2026-11-17, left out of T-082): a Celsius user who types a step such as 20C under Other
  sees it on the card ("Sets in 20C steps."; today it is stored as 36F on the F grid and the card shows
  nothing selected and no line); and the Cook screen, the shared plan sheet and Cook history show a C-step
  smoker's exact C values instead of the 2C rounding (today they can read 86C where the temp menu reads 85C).
  The same places also round a dial smoker's marks to 2C in Celsius (the Cook screen header, lane notes, the
  shared plan sheet, Cook history, and alert and warning text such as "Fire the smoker to ..."); T-082 fixed
  the card, the temp menu and Plan only.
  Why: a step set in C must stay a C step. Blocked on: nothing for the engine; see the next item.
  Source: Jason, 2026-11-17 (T-082 entry in TASKS).
- **No task.** Celsius step choices: 1C / 2C / 5C / 10C / Other. Fahrenheit stays 5 / 10 / 15 / 25 / Other.
  Why: Celsius grills set in other steps than Fahrenheit ones. Blocked on: a mockup first, and sources for the
  steps (1C is sourced: Z Grills Australia wireless controller, https://help.zgrills.com.au/?p=3624; the
  others are not). Depends on the item above.
- **No task.** The 1C to 4C manual-form bug: the manual smoker form stores a Celsius step as a whole number of
  F, so 1C to 4C steps drift off the grid (1C as 2F, 2C as 4F).
  Why: wrong steps on a Celsius smoker. No tester uses Celsius. Blocked on: nothing. Two `test.failing` cases
  are in `src/screens/setup/SmokerPicker.test.tsx` and should pass after the fix.
- **No task.** Wings at 400F on a smoker that tops out lower: offer the method only when the smoker's max
  reaches its temp, greyed with the reason otherwise, as tri-tip's smoker sear does (T-075).
  Why: today the plan can ask for 400F on a smoker that cannot reach it.
  Blocked on: Jason's wording for the grey reason (T-075's "Needs {sear}F" is the model). Source: BACKLOG,
  Jason 2026-11-16. This is the wings item Jason named on 2026-11-17.
- **No task.** Smaller APK: per-ABI APKs instead of one fat APK (proposal, Jason 2026-11-17). 0.3.0-beta.1 is
  101.2 MB: x86 25.7, x86_64 25.0, arm64-v8a 24.4, armeabi-v7a 16.9, the JS bundle 3.6, dex 2.6. An arm64
  APK for phones is about 34 MB; an x86_64 APK from the same build is kept for the test rig (the upgrade and
  locked-reboot tests install the release APK on x86_64 emulators). The release script, its verify step, the
  update check's download link (it takes the first `.apk` asset today) and INSTALL.md change together.
  Dropping x86 is safe; dropping 32-bit ARM waits on his testers' phone models. R8 minify is on; resource
  shrinking is off and worth under 1 MB. Why: download size. Blocked on: the testers' phone models; nothing
  before the freeze.
- **Carried from 0.3.0 (Jason, 2026-11-19).** 0.3.0 shipped with every task done; twelve were merged and
  gated with a look or a device check still open, and each of those is now its own item:
  - **T-094** See T-074's alert and label wording on a device. Why: shipped not seen on a device.
  - **T-095** See T-079 (a lock-screen tap never lost from the queue) on a device. Why: the same.
  - **T-096** His look at the two re-shot Live cook pictures (T-081).
  - **T-097** His look at the tri-tip smoke-then-sear pictures (T-075).
  - **T-098** A picture of the "Serve moved" notice and his look (T-076).
  - **T-099** User guide: the open wording, and the alarm ring log in section 11 (T-066). Blocked on: his
    wording.
  - **T-100** Device rig fixes: the 2026-11-17 pass, the button rule, the locked-reboot guard. Why: `setup`
    and `gear` fail at 130% on rig faults, not on the app. T-086 waits on it.
  - **T-101** Device test: update the release app with a cook running, and the 0.2.0 window.
- **No task.** Plural food names, the rest (Jason, 2026-11-17; 0.3.1): a plural flag on the planned item so
  the lane and hold notes agree ("Chicken wings hold 20 min", "Chicken wings come off before the pit climbs");
  it changes what a running cook saves, so cooks saved before keep the old wording. With it: singular forms
  for a count of 1 ("1 chicken breast needs a griddle"), and "their" where the hold note says "its" if that
  could not be done in 0.3.0. The plan and shared-plan warnings and the Cook screen's "are behind" are fixed
  for 0.3.0 on a branch. Why: grammar. Blocked on: nothing.
- **No task.** Sheet footer buttons in the kit (Jason, 2026-11-17; 0.3.1): a block button inside a sheet
  footer row shares the row, fixed once in `src/components/ui/button.tsx`; the three local fixes of 0.3.0
  ("Replace your data?", "Start over?", "Alerts may not ring") then use it. Why: one rule instead of three
  copies. Blocked on: nothing.
  With it (Jason, 2026-11-17): the kit's stepper lower-cases its whole label for the screen-reader labels
  "Less ..." and "More ..." (`src/components/kit/controls.tsx:251`), so a screen reader says "Less st. louis
  ribs count" in Cook history's edit sheet; keep a food name's own capitals there too. Not shown on screen.
- **No task.** Lane chart label (Jason, 2026-11-17; 0.3.1, cosmetic): a short bar shows a cut label, for
  example the tri-tip's smoke bar reads only "s". Drop a label that does not fit, or shorten it. Why: it
  reads as a glitch. Blocked on: nothing.
- **No task.** Buttons hidden under the pinned footer at 130% (Jason, 2026-11-18; 0.3.1): change the layout
  so Setup's "Send a test alert in 10 sec" and Cook finished's Use / Keep buttons are not under the pinned
  buttons when the screen opens (`tools/device/out/1.3/setup-alerts.png`, `cook-finished-rate.png`). On Cook
  finished the cook can be saved today without the rate choice being seen. The parked sheet-buttons branch
  (`a8c0f87e3e0ab96ed`) covers neither screen. Why: a button the user cannot see. Blocked on: the new layout
  shown to Jason first.
- **No task.** A failed start says so (Jason, 2026-11-18; 0.3.1): "Couldn't start the cook. Try again."
  Why: today nothing is shown. The other half is not 0.3.1: after a failed start the double-tap guard stays
  set and Start cook does nothing until the app is restarted; that fix (and the "cook started" log line
  written only after the save) goes into 0.3.0 in Sunday's fix window with the share guard (Jason,
  2026-11-18; `docs/after-readout-checklist.md`, "A start that fails shows nothing"). Blocked on: nothing
  after that fix; the words are his.
- **T-084** Plan edited while a cook runs (Jason, 2026-11-18; 0.3.1): the running cook does not change and
  nothing says so; a prompt, his wording. Why: he changed the smoker temp on Plan and expected the cook to
  follow. Blocked on: his words.
- **T-085** Done records the tap, not when the step happened (Jason, 2026-11-18; 0.3.1 or later): a late
  tap on "on the smoker" or on the pull skews the learned rate. Proposal: Cook finished shows the times the
  rate is based on, flags a rate-feeding step tapped more than about 15 min after it rang, and lets the user
  fix the time or Keep the old rate. Why: the rate should come from what happened. Blocked on: a mockup and
  his wording; the first read of the code is in TASKS.
- **T-078** Lock-screen taps re-plan with the app closed (headless JS).
  Why: other alarms keep old times until the app opens (T-076 limit).
  Blocked on: a half-day spike on the emulator, then a report to Jason before any build. Also his answer on
  whether the app still jumps to the Cook tab after a tap.
- **T-086** Rig tests on the emulator for Not yet, Back up to temp with Move serve, and the Adjust tap
  (Jason, 2026-11-18; 0.3.1). Why: the rehearsal did not tap them and only Jest covers them. Blocked on: the
  rig fixes of the 2026-11-17 full pass.
- **T-089** Remove the brine options that change nothing (Jason, 2026-11-19; 0.3.1). Why: "Dry brine
  ahead" and "Wet brine 1-2 hr" add no time, step or alert, and no brine or prep reminders are planned (prep
  stays out of the app); the 0.3.0 notes say they will be removed in the next update. Blocked on: what
  happens to saved and shared plans that carry an option, and whether the engine's prep entries go too.
- **T-091** Public roadmap on GitHub, after 0.3.0 ships (Jason, 2026-11-19; docs only): a Mermaid timeline
  at the top of this file or the README (he picks), order not dates, only the next release dated. Content
  agreed word for word in TASKS T-091.
- **T-092** StartCook's double-tap tests await properly (Jason, 2026-11-19; 0.3.1; tests only). Why: they
  print six "overlapping act() calls" errors while passing. Blocked on: nothing; the tests must keep proving
  one cook and one alarm set from two quick taps.
- **T-093** The gate counts console.error lines and shows the count with the totals (Jason, 2026-11-19;
  0.3.1; tooling). Why: a captured gate log holds no console output from passing suites, so such warnings
  are never read. A count, not a failure; in the terminal and in a captured log alike.
- **T-088** A smoker conflict made mid-cook by Not yet: the banner offers a fix, pull early into the hold
  or turn up later (Jason, 2026-11-19; 0.3.1). Why: the banner names the conflict and offers only OK.
  Blocked on: his wording and a mockup.
- **T-031** (the two-phone part) Share a plan between two real phones, both ways (Jason, 2026-11-18; moved
  from 0.3.0 to 0.3.1: no other phones were tested for 0.3.0). Blocked on: which second phone; his wife's
  phone is not part of any test (Jason, 2026-11-19).
- **The Samsung tester's locked-reboot check** (parity P4, T-072; Jason, 2026-11-18; moved to 0.3.1). Why:
  alarms after a restart with the phone still locked are proven on a OnePlus and the emulator only.
  Blocked on: asking the tester.
- **Risk:** Play review may question the `systemExempted` ring service of T-105 (Google calls the type
  reserved for system apps; alarm apps are allowed it). A different type means a new build.
- **Risk:** Google's docs do not say what happens to beta.1's review if beta.2 is uploaded while beta.1 is
  still in review.
- **Risk:** nothing here has a date. 0.3.x is for fixes; Home Assistant (0.4.0) starts after it by Jason's rule.
- **Risk:** half of the items wait on Jason's wording or look, so the order depends on when he has time.

## 0.4.0

Home Assistant phase 1: read-only, a pasted token. Nothing here starts before 0.3.0 ships.

**Goal:** the app reads Jason's Home Assistant probes and shows live temperatures on the Cook screen. Read
only, with a pasted token.

- **T-042** Mock the six Home Assistant screens. Why: new UI needs an approved look. Blocked on: Jason's OK on
  the mockups.
- **T-044** Home Assistant auth logic (pure). Why: the sign-in rests on it. Blocked on: the token call checks
  in `docs/ha-entities.md`.
- **T-045** Sign-in on the phone with a pasted token. Why: connects the app to his Home Assistant. Blocked on:
  T-042, T-044 (its entry also lists T-043, which is dropped).
- **T-046** Home Assistant WebSocket client. Why: live data. Blocked on: T-044.
- **T-047** Discovery and add a sensor. Why: finds his smoker and probes. Blocked on: T-045, T-046.
- **T-048** Gear: Home Assistant connected. Why: shows and manages the link. Blocked on: T-047.
- **T-049** A probe per food at Start cook. Why: each food needs its probe. Blocked on: T-047.
- **T-050** `engine/probe.ts` and live temps on Live cook. Why: the point of the phase. Blocked on: T-046,
  T-049, T-020 (done). Jason's device tests.
- **Risk:** the pitplanner user is not an admin. If Home Assistant refuses it any call the app needs, the
  design changes before code is written. Step 0 finds this out.
- **Risk:** the token is a long-lived secret on the phone. It must stay in secure storage and out of backups
  and logs.
- **Risk:** the last task needs a real cook with real probes to test, so it needs a Saturday of Jason's.

## After 0.4.0: a small release of its own

- **T-087** Light theme with a setting that follows the phone (Jason, 2026-11-18: "after 0.4.0, as its own
  small release"). Why: the app is dark only. Blocked on: 0.4.0 shipping, then light mockups and his OK.
  Size and counts in its TASKS entry.

## 0.5.0

**Goal:** fish on the menu, the receiver of a shared plan picks their own cookers, and Chef iQ probes work
without Home Assistant.

- **T-070** Open shared plan: the receiver picks their cookers.
  Why: parity D1 as 0.2.0 offered it; 0.3.0 handles it in Food details after import.
  Blocked on: Jason's OK on the design (new UI).
- **T-071** Fish: salmon, sea bass, catfish.
  Why: asked by Jason 2026-11-15; his answers of 2026-11-16 are in the entry.
  Blocked on: a thickness input proposed to him first, and the recipe sources he will keep for times.
- **T-080** Chef iQ probes direct over Bluetooth, no Home Assistant.
  Why: probe temps without Home Assistant. Blocked on: an approved mockup (the scan permission row in Setup
  alerts), T-050, T-049, and a real probe.
- **T-090** Request a catalog addition (Jason, 2026-11-19; 0.5.0): after a cooker entered by hand is saved,
  "Send this model to the developer" opens the share sheet with only that cooker's fields. Blocked on: a
  mockup first; his wording; once or kept in Gear; griddles and ovens too or not.
- **T-106** Alerts sheet: alert volume (alarm or ringer) and how long a step rings (Jason, 2026-11-21;
  0.5.0). Why: T-105 ships alarm volume and 1 minute as fixed defaults (Jason, 2026-11-23). Blocked on: T-105, a SPEC line, a
  mockup and his wording.
- **Risk:** no source for timing fish by thickness has been found. Cooking numbers need a source before they
  go in the data.
- **Risk:** the Bluetooth task cannot start until 0.4.0 has the probe screens, so any 0.4.0 slip moves it.
- **Risk:** it needs a real Chef iQ probe, which only Jason has.
- **Risk:** the docs say "0.5.0 or later" for five more tasks. The version of those is not decided.

## Later

No version yet, or "0.5.0 or later".

- **T-057** Clear the build-tool Snyk findings (SE-001). Why: the Snyk scope limit must go. Blocked on:
  nothing, but held until 0.3.0 ships (Jason, 2026-11-17). Deadline 2027-02-01 (SE-001 agrees).
- **T-039** Remove `legacy/`. Why: dead reference code. Blocked on: T-038 plus one week with no rollback.
- **T-051** Publish `sensor.pit_planner_cook` (HA phase 2). Why: automations outside the app. Blocked on: T-050.
- **T-052** Home Assistant blueprint. Why: ready-made notification. Blocked on: T-051.
- **T-053** Probe suggestions and pit-drop prompt (HA phase 3). Why: Next up offers Done, never automatic.
  Blocked on: T-050.
- **T-054** Probe times feed rate learning. Why: better rates. Blocked on: T-053.
- **T-055** Confirmed set-temp button (HA phase 4, optional). Why: the most grill control the app will ever
  have. Blocked on: Jason opting in, T-053.
- **T-060** Low and slow for tough cuts (brisket heated faster than the plan). Why: Jason's cook of
  2026-11-14. Blocked on: Jason choosing one of four candidates, sourced numbers, and two facts only he has
  (what the smoker went back up to 250F for; which Pit Boss probe pairs with which Chef iQ probe).
- **T-062** A name of the user's own for a food. Why: Jason wants "Dad's brisket". Blocked on: a mockup.
- **T-040** Lane chart full screen. Why: Jason's idea, landscape view. Blocked on: a mockup, then his OK.
- **T-041** Oven warming drawer: use it or drop it. Why: a stored field nothing uses. Blocked on: Jason's
  decision (offer it as a hold place at or above 140F, or remove it).
- **T-036** (Setup part) Restore from a file on a new phone's first screen. Why: a new phone has no data.
  Blocked on: Jason's decision on a version. 0.3.0 has it in Gear only. Source: BACKLOG, TASKS T-036,
  Jason 2026-11-16.
- **T-022** (note) Running behind, Keep serve: name every food that would come off after serve and select
  Move serve then. Why: today only the most-changed hold is named, as in 0.2.0. Blocked on: Jason's call
  (he said "maybe a future update").
- **T-056** Keep native access behind the interfaces (iOS readiness). Why: lets iOS be added later. Blocked
  on: T-015, T-030 (done) and T-045 (0.4.0).

## Untriaged

No task, no version. Nothing here is scheduled.

- **No task.** Dial smokers with fixed presets and "pick by controller". Why: presets work in the engine but
  not in the picker's catalog. First case is Jason's own Pit Boss Sportsman 820 with Wi-Fi (PB0820SPW) with a
  newer card (5F steps, reports PB850SPW2); a "Pit Boss Sportsman 820" catalog entry comes with it. Blocked
  on: Jason's triage, sources for the presets and the 820 main and upper rack split, and how Smoke and High
  show. Found in: BACKLOG, Jason 2026-11-17, "after 0.3.0".
- **No task.** Go back on the full timeline to set what was missed: tap a step, adjust it. Why: cook of
  2026-11-14. Blocked on: a mockup. Found in: BACKLOG, "next version".
- **No task.** More than one smoker or griddle. Why: someone may own two. Touches Setup, Gear, the plan's
  cooker choice and rates per cooker. Blocked on: a mockup. Found in: BACKLOG, "next version".
- **No task.** Sources for the smoker specs still marked `verified: false` (sixteen picker entries). Why:
  left blank without a source. Blocked on: sources from Jason. Found in: the waiting-on-Jason page, SPEC
  section 12.

## Flags

Sources that disagree:

- T-068 (alarm ring log). Its TASKS entry says Jason moved it into 0.3.0 on 2026-11-16, and it is merged.
  The TASKS Versions section was fixed on 2026-11-17. WBS (Versions paragraph) and the BACKLOG row ("Planned
  before, not in 0.3.0") still put it in 0.5.0 or later and need updating. It is not listed above.
- T-039. WBS puts it in phase 10 (0.3.0). Its entry says one week after 0.3.0 ships. Listed under Later.
- T-060 and T-062. TASKS and BACKLOG say "next version"; WBS says "after the beta" (phase 11). None names
  0.3.x, 0.4.0 or 0.5.0.
- "0.3.x is reserved for bug fixes" (TASKS, WBS). The 0.3.x list above holds a feature (T-078), new Celsius
  choices needing a mockup, and the wings gating. Jason set T-078 as an exception; the others are new.

No version at all:

- T-036 (Setup restore), T-022 (note), T-040, T-041, T-056, T-057 (a date only), the dial smokers item,
  the timeline item, more than one cooker, the unverified specs.

Dependency points at a later version:

- T-056 (no version) depends on T-045 (0.4.0).
- T-060 candidate 4 (re-time from probes) depends on T-050 (0.4.0) and T-054 (0.5.0 or later).
- T-045 (0.4.0) lists T-043 as a dependency. T-043 is dropped, so the dependency should go.

Looks dropped but still open:

- T-043 (GitHub Pages `client_id` page) is dropped by Jason but its status is still `todo`. D-9 is dropped with
  it.
- The T-022 note (Keep serve naming every food) and T-041 were parked as "maybe" and still read `todo`.
- T-070 was dropped from 0.3.0 and moved to 0.5.0; its status line still says `todo` with no version
  mention (the version line above it has it).
