# After Sunday's readout: INSTALL.md on his wife's phone (T-033), then the two-phone share test (T-031)

Done together on Sunday afternoon, 2026-11-22, once the readout has passed; the release is Monday
2026-11-23. Jason decided this on 2026-11-17. Her phone has
0.2.0 now. It gets 0.3.0-beta.2 as an upgrade over it, by following `docs/INSTALL.md` exactly as written.

Built only from `docs/INSTALL.md`, the T-031 and T-033 entries in `docs/design/TASKS.md` and SPEC's Share and
Open shared plan lines. Where those are silent, the step says "to confirm with Jason". Every action on a
phone is marked **yes**: it needs Jason's yes first, on the day, one action at a time. Pass: INSTALL.md is
followed with no step that confuses her, and a plan goes through Gmail and through Drive and opens the Shared
plan sheet with the right menu.

## Part 1: INSTALL.md on her phone (T-033)

Jason present, her phone in his hands or hers, on wifi.

| # | What to do | What must be seen | Needs yes | Done |
|---|---|---|---|---|
| 1 | On her phone, open the Gear screen of 0.2.0 and read the version line at the bottom | It reads 0.2.0 | yes | |
| 2 | Screenshot her 0.2.0 Gear, Cook rates and Cook history (to compare later) | Three pictures, status bar cropped off | yes | |
| 3 | Get the 0.3.0-beta.2 file onto her phone. INSTALL.md step 1 points at the GitHub releases page, which has no beta.2 until the release | To confirm with Jason: how the beta.2 file reaches her phone | yes | |
| 4 | INSTALL.md "Install" step 3: tap "Open" on the finished download | Android shows the install screen | yes | |
| 5 | INSTALL.md "Install" step 4: if asked, Settings, "Allow from this source", go back | The install screen comes back | yes | |
| 6 | INSTALL.md "Install" step 5: tap "Install", then "Open". Do not uninstall 0.2.0 first | It installs over 0.2.0, no "App not installed" | yes | |
| 7 | Read the "Pit Planner has a new look" notice, tap OK | One of the three lines in INSTALL.md "Pit Planner has a new look" | yes | |
| 8 | Compare Gear, Cook rates and Cook history with the step 2 pictures | Her smokers, rates, plan and history are as before | yes | |
| 9 | Gear, 5 taps on the version line | It reads 0.3.0-beta.2 | yes | |
| 10 | Allow the alerts, if the app asks (INSTALL.md "Allow the alerts"): Notifications, Alarms and reminders, No battery limits, and Full-screen alerts if shown | Each row shows as on | yes | |
| 11 | Tap "Send a test alert in 10 sec" and lock the phone | It rings | yes | |
| 12 | Write down every place in INSTALL.md she hesitated, or where the wording of her phone differed | Notes here: ____________. What to do with them: to confirm with Jason | no | |

If the install fails, INSTALL.md says: do not uninstall the app. Stop and email pitplanapp@gmail.com with the
version and what the phone said.

## Part 2: two-phone share (T-031)

Jason's phone with 0.3.0-beta.2 (the release build, not the dev build) and her phone with 0.3.0-beta.2 from
Part 1. A plan on his phone that has at least two foods.

| # | What to do | What must be seen | Needs yes | Done |
|---|---|---|---|---|
| 13 | On his phone, Plan: build a menu of at least two foods and note it down | The menu is on screen | yes | |
| 14 | Tap the share icon on Plan, choose Gmail, send to her address | A `.pitplan` file goes as an attachment, no "Couldn't share" | yes | |
| 15 | On her phone, open the email and tap the attachment, with the app closed | The Shared plan sheet opens, not "Could not read that file." | yes | |
| 16 | In the sheet, read the menu and pick a date and her cookers | The menu is the one from step 13. Missing cookers, if any, are flagged with a fallback | yes | |
| 17 | Repeat steps 14 to 16 with the app already open on her phone | The sheet opens | yes | |
| 18 | On his phone, tap the share icon again, choose Drive, save the file | The file is in Drive, no "Couldn't share" | yes | |
| 19 | On her phone, open the file from Drive | The Shared plan sheet opens with the right menu | yes | |
| 20 | The other direction: from her phone to his, Gmail and Drive. SPEC says "round-trips between two phones"; T-031 only names his phone to hers | To confirm with Jason: whether her phone to his is part of the test, and what plan she sends | yes | |
| 21 | Note anything that did not open, with the exact words on screen. A failing route gets a regression test (T-031) | Notes here: ____________ | no | |

## When both parts pass

Tick them off on the page, then Claude updates T-031 and T-033 in `docs/design/TASKS.md` and the HANDOFF.
Order (Jason, 2026-11-17, second answer): Sunday 2026-11-22 the readout passes; Sunday afternoon this
checklist; Monday 2026-11-23 the 0.3.0 release (T-038). The release waits for this checklist: T-038 depends on
T-033, and SPEC's definition of done includes the share round trip. T-031 and T-033 are not done until it is
ticked. If the readout does not pass, none of this runs.

## Disk cleanup after the readout

Jason approves the list first (the inventory of 2026-11-17 is in the HANDOFF's running notes), then Claude
deletes. Nothing is deleted before his yes.

- Keep: anything tracked in git, the keystore and `keystore.properties`, the latest signed APK, the 0.2.0 APK,
  the `pitplanner-lock` emulator.
- Delete once the readout no longer needs it: the 2026-11-15 phone data capture
  (`tools/device/out/t064-2026-11-15/`).

## Fixes and checks after the readout (from Jason's stacked look, 2026-11-17)

Branches only until the readout passes; then merge one at a time, the gate after each.

- [ ] **Replace button off-screen (real bug, must be in 0.3.0 on Monday).** In Gear, Restore from a file,
      "Replace your data?" at 115%: Replace is pushed off the right edge, only a sliver shows
      (`tools/device/out/checks-2026-11-17/t036-restore-confirm.png`). Opus agent, failing test first, on a
      branch. At merge: add a device check to the `gear` test (Replace's bounds fully inside the screen and
      clear of Cancel), run `gear` at 115% and 130%, Jason's look.
- [ ] **Plural food names.** "Chicken breasts needs a griddle." must read "need", and "it" must read "them";
      every sentence with a food as its subject. Opus agent, failing test first, on a branch. At merge: SPEC
      and the device test lines that quote the old words.
- [ ] **Lane chart, for his decision (report only, nothing fixed):** the tri-tip's short smoke bar shows only
      "s" (the label does not fit). The picture `t075-lanes-climb.png` was taken after the finding-3 fix; it
      shows the 2:50 to 3:15 PM share note because that is the next stretch at the start of the cook, and
      that plan has no clash during the climb (the brisket is off at 3:40 PM, before the climb). A picture
      of the climb clash note itself needs a cook where the brisket runs late: take one on the emulator.
- [ ] **Cook finished at 115%:** checked on the emulator on 2026-11-17: the rate card scrolls fully into
      view above the buttons (card text ends at 889 px, the notes field follows, Save to history starts at
      1430 px; picture `cook-finished-scrolled.png`). As opened, its last lines sit under the fade over the
      pinned buttons. Nothing to fix unless Jason wants the card whole without scrolling.
- [ ] **`.gitignore`:** add `.claude/worktrees/` and `.claude/settings.local.json` with the first merge after
      the readout; confirm `git status` no longer shows them. (Checked 2026-11-17: `.claude/` holds only
      `worktrees/`; nothing else is there to ignore or track.)
- [x] **Start cook dead after one cook (found by Jason on his phone, 2026-11-17): fixed on `main`, `d2fdccc`,
      gated; it is in 0.3.0-beta.2, on his phone since 2026-11-17 and proven on the emulator's release build
      (start, end, start after Discard and after Save). Left: a device check that starts two cooks in one
      app launch, and whether a start that fails gets a message.** The original item: The
      double-tap guard in `src/screens/plan/PlanTab.tsx` is never cleared after a cook starts, so Start cook
      does nothing after that cook ends until the app is restarted. Failing Jest test first (start, end,
      start again, mounted throughout), the fix, a device check that starts two cooks in one app launch.
- [ ] **Sheet buttons in "Start over?" and "Alerts may not ring"** (same bug as Replace: the second button a
      24 px sliver at the right edge at 115%). Fixed on the Replace branch, each with a failing test first;
      all three merge together and must be in 0.3.0 on Monday. Device checks at merge (115% and 130%): in
      `cook-options` for Start over, in `cook` for the alert sheet, in `gear` for Replace.
- [ ] **Rig rule (Jason, 2026-11-17):** a button a device test taps must be inside the screen AND at least a
      quarter of the screen wide (Android clamps off-screen bounds to the edge, so "inside the screen" alone
      passes a 24 px sliver). Use it for the three sheets at merge, then for every tapped button in every
      device test.
- [ ] **Rig: the locked-reboot test's 20 minute guard (2026-11-17).** `tools/device/locked-reboot.sh` stops
      with "the next step is more than 20 minutes away" on about 3 starts in 10. Its plan's first alarm is 45
      minutes before serve, serve is 63 to 68 minutes out, so that alarm is 16.5 to 21.5 minutes from the
      start of the cook. The comment above the plan assumes the prep step 60 minutes before serve rings; prep
      steps have no alarm. Fix: bring serve nearer or move the guard to 22 minutes, and correct the comment.
- [ ] **New device test: update the release app with a cook running (Jason, 2026-11-17).** Install a newer
      release APK over a running cook and read `dumpsys alarm` without opening the app: every alarm still to
      come is registered again. `pit-alarms` does this in `RestoreReceiver` on `MY_PACKAGE_REPLACED`
      (`Receivers.kt:107`), proven by Robolectric tests and once by hand on his phone (beta.1 to beta.2).
      **Also the 0.2.0 window, on beta.2 (Jason, 2026-11-17):** install beta.2 over a running 0.2.0 cook and
      do not open the app; a step must ring before the first open (0.2.0's alarms are dropped by the update
      and put back from 0.2.0's own stored set, same receiver names, actions and store). Registration in that
      window was shown on alpha.3 (`docs/alarm-testing.md`, "Upgrade with a live cook"); a ring before the
      first open has never been run, and `upgrade020.sh check` opens the app at once, so it needs its own
      step. Not run on 2026-11-17 (his order).
- [ ] **A start that fails shows nothing** (`newCook`, the store's save or the alarm sync throwing is an
      unhandled rejection). Whether it gets a message is Jason's call, after Sunday; new UI needs his words.
- [ ] **Device rig fixes from the full pass of 2026-11-17** (HANDOFF section 5): date the legacy-import
      fixture's running cook from the clock; wait for the MediaStore row before opening a pushed plan file
      (`shared`, `shared-soon`); scroll to Alerts in `gear` at 130%; scroll a button clear of the pinned footer
      before tapping it (`setup`'s test alert, `cook-finished`'s Keep). Then rerun those five, plus
      `followups` and `turkey`, at 115% and 130%.
- [ ] **For Jason, from that pass at 130%:** Setup's "Send a test alert in 10 sec" and Cook finished's
      Use / Keep buttons are hidden under the pinned buttons until scrolled (`tools/device/out/1.3/
      setup-alerts.png`, `cook-finished-rate.png`). Leave, or change the layout?
- [ ] **User guide pictures (T-066):** 5 of 22 slots are filled on a branch; shoot the other 17 on the
      emulator at 115% from seeded test data only, check each for personal data before committing. Replace
      `docs/fidelity/rn-debug-send.png` with a picture showing the app's address (the old one shows Jason's
      old email address; no history rewrite, his decision).
- [ ] **Smoker catalog:** retry the rate-limited makers' sites; the ten entries whose name covers several
      versions are left out of this pass (Big Green Egg, Weber WSM, Pit Barrel, Masterbuilt electric,
      Z Grills 700, recteq Bullseye, Weber Searwood, Oklahoma Joe's Highland, Old Country Brazos, Pit Boss
      850); Jason sends his testers' exact models later.
- [ ] **`CLAUDE.md`, Models and agents:** an agent that needs a file outside its list stops and asks first.

