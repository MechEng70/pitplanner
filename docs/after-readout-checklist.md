# After Sunday's readout: INSTALL.md on his wife's phone (T-033), then the two-phone share test (T-031)

Done together on Sunday afternoon, 2026-11-22, once the readout has passed; the release is Monday
2026-11-23. Jason decided this on 2026-11-17. Her phone has
0.2.0 now. It gets 0.3.0-beta.1 as an upgrade over it, by following `docs/INSTALL.md` exactly as written.

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
| 3 | Get the 0.3.0-beta.1 file onto her phone. INSTALL.md step 1 points at the GitHub releases page, which has no beta.1 until the release | To confirm with Jason: how the beta.1 file reaches her phone | yes | |
| 4 | INSTALL.md "Install" step 3: tap "Open" on the finished download | Android shows the install screen | yes | |
| 5 | INSTALL.md "Install" step 4: if asked, Settings, "Allow from this source", go back | The install screen comes back | yes | |
| 6 | INSTALL.md "Install" step 5: tap "Install", then "Open". Do not uninstall 0.2.0 first | It installs over 0.2.0, no "App not installed" | yes | |
| 7 | Read the "Pit Planner has a new look" notice, tap OK | One of the three lines in INSTALL.md "Pit Planner has a new look" | yes | |
| 8 | Compare Gear, Cook rates and Cook history with the step 2 pictures | Her smokers, rates, plan and history are as before | yes | |
| 9 | Gear, 5 taps on the version line | It reads 0.3.0-beta.1 | yes | |
| 10 | Allow the alerts, if the app asks (INSTALL.md "Allow the alerts"): Notifications, Alarms and reminders, No battery limits, and Full-screen alerts if shown | Each row shows as on | yes | |
| 11 | Tap "Send a test alert in 10 sec" and lock the phone | It rings | yes | |
| 12 | Write down every place in INSTALL.md she hesitated, or where the wording of her phone differed | Notes here: ____________. What to do with them: to confirm with Jason | no | |

If the install fails, INSTALL.md says: do not uninstall the app. Stop and email pitplanapp@gmail.com with the
version and what the phone said.

## Part 2: two-phone share (T-031)

Jason's phone with 0.3.0-beta.1 (the release build, not the dev build) and her phone with 0.3.0-beta.1 from
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

