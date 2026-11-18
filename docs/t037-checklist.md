# T-037 staged cook: checklist (Saturday 2026-11-21, 0.3.0-beta.2)

No food. The full-length real timeline on Jason's phone, to prove every alarm rings on time with the phone
locked, unplugged and idle, through a reboot and every kind of change. It ends with Discard, so the cook
rates are not touched. Pass: every ring within 1 minute of its planned time, nothing lost at the reboot,
nothing twice.

Fixture times below come from the engine on 2026-11-17 (evening), built the way the phone builds the plan:
the gear, saved rates and cook history from the phone's debug file of 2026-11-17 4:24 PM (a 20 min smoker
preheat, a 15 min griddle preheat, brisket saved at 0.65 hr/lb and used as-is: two brisket cooks logged, the
blend starts at three), `data/foods.json` at commit `c95f4ba` and the engine as built into beta.2. The first
fixture (2026-11-16) assumed a saved 0.75; the same run at 0.75 gives its times again (fire 7:50 AM, wrap
check 12:15 PM), so only the rate moved them. Jason's decision, 2026-11-17: keep 0.65, do not touch the rate.
Your phone's plan is the truth: write its times in the blank column at Start cook, and after each change
that moves serve.

## Rehearsal, Wednesday 2026-11-18 (Jason's decision that morning)

The same staged cook runs today on his phone as a rehearsal: the same plan, ready today 5:00 PM, so every
time is the same as Saturday's table below. **Today uses Saturday's fixture times; the engine was not run
again for today** (no time before Fire the smoker at 8:50 AM). Saturday 2026-11-21 stays the main run. One
phone, no second device. He is in meetings; the phone lies face down, unplugged, and is not used for
anything else.

- Before 8:35 AM he ends and discards Saturday's cook (started that morning, steps 14 and 15), sets the same
  plan to ready today 5:00 PM and taps Start cook once. Done about 8:10 AM: the Cook tab shows Fire the
  smoker to 225F at 8:50 AM, ready today 5:00 PM (Jason).
- Claude reads the app's alarms right after (read only). Read at 8:11:08 AM, after his yes: 13 alarms, each
  time once, all dated today: 8:50 AM, 9:10 AM, 12:40 PM, 3:15, 3:25, 3:40, 4:05, 4:20, 4:25, 4:40, 4:52, 4:55
  and 5:00 PM. Nothing dated Saturday, none of the dev build: the first is Fire the smoker 8:50 AM today,
  then Brisket on the smoker 9:10 AM, and nothing is left of Saturday's cook. He was told to unplug.
- 12:25 PM: at the computer, plugged in, for the battery history (one read-only adb line after his yes).
  12:30 PM: the reboot, on the phone.
- Tonight, after Time to serve and Discard: Send to developer, then the phone's reads for the readout while
  it is plugged in and before it charges to full, then he loads Saturday's plan again (ready Sat Nov 21
  5:00 PM), one tap Start cook, and step 15's read again.

Results of the rehearsal go in a table of their own at the end of this file; Saturday's table stays blank
for Saturday.

Seen during the rehearsal, to settle in the readout:

- **9:10 AM (Jason):** Fire the smoker was answered with Done on the lock screen at 8:50 AM. After the in-app
  Done for Brisket on the smoker at 9:10 AM, the app showed something about Fire the smoker that he had to
  tap OK or Done on. Not known yet which it was. By the code there are two candidates: the notice banner
  the app shows for a tap made on an alert ("Fire the smoker to 225F: done at 8:50 AM from the alert.", with
  OK; as designed), or the step still open in the app with Done (the lock-screen tap not applied; a bug).
  Tonight's debug file settles it: the event log's "done" line for the fire step reads 8:50 AM in the first
  case and about 9:10 AM in the second.
  **Jason, later that morning: "it was a banner above the next step".** So it was the notice, as designed.
  The 8:50 AM "done" line is still checked in tonight's debug file.
- **12:40 PM, the locked reboot (Jason): it did not ring while the phone was still locked.** Battery history
  was saved at 12:27 PM, he unplugged, rebooted at 12:30 PM and left the phone locked. Check the brisket
  (wrap) did not ring before the unlock; the alert showed once he unlocked, and he tapped Done then (the
  table asked for Not yet, keep serve). Unlock time and ring time not noted yet. This is the pass line "nothing
  lost at the reboot" and Jason's own 0.3.0 acceptance (T-038, 2026-11-16: a step that comes due while the
  phone is still locked rings before unlock), so it is a fail until shown otherwise. **Cause not known.**
  Jason's lean: the phone, not the app ("true of all the notifications until I unlock it"). What is on
  record: the same beta.2 release build passes this on the PIN emulator, 6 of 6; on this OnePlus the only
  earlier locked reboot was the dev build (2026-11-16), where Android did start the app for
  LOCKED_BOOT_COMPLETED 2 seconds after boot and it crashed in dev-only code; a release build was never
  run through a locked reboot on this phone before today. Evidence to read: the crash log and logcat from
  the boot (they wrap, so soon), and tonight's ring log (when the 12:40 PM step is logged as rung).
  **Read at 12:50 PM (phone plugged in, read only: crash log, logcat, `dumpsys alarm`):**
  - The phone booted at 12:29:27 PM. Jason unlocked at 12:43 PM; "all my notifications sounded" then, Pit
    Planner's among them. He tapped Done on the alert at 12:44 PM (the Cook tab banner says so) and opened
    the app at 12:49:03 PM.
  - **The alarm came back while locked and went off on time.** Android's alarm statistics since boot show
    one Pit Planner step alarm delivered, at 12:40:01 PM, 2 to 3 minutes before the unlock; the app's
    receiver ran for 358 ms. So the restore before the first unlock works on this phone with the release
    build.
  - The release app did not crash: the crash log since boot holds one app crash, the dev build
    (`...pitplanner.debug`, also on the phone) at 12:29:50 PM, the known dev-only crash of T-072.
  - **Not known: why nothing was heard at 12:40 PM.** Logcat had wrapped (it starts at 12:45 PM), so there
    is no line from the alert itself. Either the app did not post the alert, or it posted it and the phone
    made no sound before the first unlock. Tonight's ring log has the answer to the first half: the 12:40 PM
    record says when it rang and whether the alert was posted.
  - Ten alarms are pending for the rest of today, set again when he opened the app: 3:15, 3:30, 3:45, 4:05,
    4:20, 4:25, 4:40, 4:52, 4:55, 5:00 PM. Against the table, Oven to 170F moved 3:25 to 3:30 PM and Check
    tenderness 3:40 to 3:45 PM. Likely from the Done at 12:44 PM on the wrap check (4 minutes late); not
    checked in the code yet.
  **Jason's decision, 12:55 PM: checked off as working.** "It may have shown it but until the phone is
  unlocked nothing (any apps I have) shows until the device is unlocked. So it is a device issue not an app
  issue." Pass on this phone means: the alarm is back and delivered on time while the phone is still locked
  (shown above), and it sounds at the unlock. Still read tonight, as a check and not a gate: the ring log's
  12:40 PM record (when it rang, and that the alert was posted).
- **3:15 PM (Jason): Wings on the smoker rang, and he tapped +15 min on the alert**, where the table asks
  for Done. So the +15 tap with the app closed is being run here, on Wings on the smoker, and not at 4:20 PM
  on Wings crisp. By "The +15 tap with the app closed" below, expected, not read from the phone: the wings
  alert rings again 15 minutes after his tap (about 3:30 PM, the same minute as Oven to 170F, so two alerts
  that Android may group); no other alarm moves while the app stays closed (Oven to 170F 3:30 PM and Check
  tenderness 3:45 PM ring at their times); when he opens the app (the 4:05 PM step) it applies the tap,
  shows one notice, and moves serve later with the other foods if the wings' hold cannot take 15 minutes.
  After that the remaining times are the app's new ones, not the table's.
- **3:30 PM (Jason): the wings alert rang again; no Oven to 170F alert.** He tapped Done on the wings alert.
  On the Cook tab afterwards, Oven to 170F is set for 3:45 PM and the banner reads (his words, read aloud):
  "Wings on the smoker on a wire rack, moved 15 minutes from the alert. Serve moved to 5:15. The other
  foods moved with it. Wings on the smoker on a wire rack, done at 3:30 p.m. from the alert." That is the
  notice the pass line describes: the +15 applied, serve moved from 5:00 to 5:15 PM, the other foods moved
  with it, then the Done. **Not known yet: when the app applied the +15.** If it was only when he opened
  the app after 3:30 PM, the oven alarm should still have rung at its old time, 3:30 PM, and it did not;
  if the app was still alive in the background and applied the tap at 3:15 PM, the alarms were set again
  then and 3:45 PM is right. Tonight's event log has the time of the "moved 15 min" line and of the alarm
  set. From here the Cook tab's times are the schedule for today.
- **The schedule after the +15, read off the Cook tab by Jason at about 3:35 PM** (each is 15 minutes
  later than the alarm list read from the phone at 12:50 PM): Oven to 170F 3:45 PM; Check tenderness
  4:00 PM; Turn the smoker up to 400F 4:20 PM; Wings crisp at 400F 4:35 PM; Fire the griddle 4:40 PM;
  Chicken breasts on the griddle and Slice or plate the brisket, both 4:55 PM (he first said 4:45 for the
  breasts, then "4:45 or 4:55"; 4:55 is what the 15 minute move gives); Pull chicken breasts 5:07 PM; Pull
  wings 5:10 PM; Serve 5:15 PM. The table's actions stay, at these times.
- **3:45 PM and 4:00 PM (Jason):** Oven to 170F rang at 3:45 PM and Check tenderness at 4:00 PM, both at
  the times the Cook tab showed after the +15; Done on the lock screen for both.
- **4:20 PM (Jason):** Turn the smoker up to 400F rang at 4:20 PM; Done in the app, then the app swiped
  away from recent apps and the phone locked. From here the app is closed.

## The plan to load (Friday night)

Ready by Saturday 5:00 PM. Smoker 225F.

| Food | Settings |
|---|---|
| Brisket | 10 lb trimmed, butcher paper wrap, rest 60 min, no rate of its own (the phone's saved 0.65 hr/lb applies; do not change the rate) |
| Chicken wings | 2 lb, smoke then crisp, dry brine, rest 5 min |
| Chicken breasts | 4, griddle, pounded, no brine, rest 8 min |

The first ring is Fire the smoker at 8:50 AM, and it is also the first step the phone shows. Nothing rings
before 8:30 AM. The phone shows and rings 14 steps, in 13 alerts (two steps share 4:40 PM).

**No prep or brine reminder is on the phone (corrected 2026-11-18, Jason).** An earlier line here said "two
reminders have no alarm (Dry brine the wings 7:15 AM, Prep the brisket 7:55 AM)". The engine does still
make those entries, and two more (Prep the chicken breasts 4:10 PM, Smoker done 4:55 PM), each with no
alarm; the engine run of that morning listed them and was not stale. But the app never shows them: the Cook
tab lists only steps that ring (`steps`, `src/lib/cook.ts:87`), and Plan shows no step list. So on the phone
there is nothing at 7:15 AM or 7:55 AM, and nothing to be "already past" when a cook is started later.

## Friday: upgrade over 0.2.0 (T-038's phone check) and get ready

Phone unlocked and plugged in, Jason present. Claude runs only the adb lines, each after Jason's yes.

**Tuesday 2026-11-17 evening, part done; the rest is Friday 2026-11-20 (Jason).** Jason asked to run
steps 3 and 8 to 15 that evening, then had no time for the phone. What ran, 7:10 to 7:20 PM, is in the Done
column: step 9 passed (18 alarms, each once, the first Sat 8:55 AM; 0.3.0-beta.2 / 300302;
`USE_EXACT_ALARM: granted=true`), steps 3 and 8 by his word, step 10 ("yes it worked": the beta.2 start,
end, start check passes on the phone) and step 11 (nothing pending). So the beta.1 cook is ended and
discarded: at the 7:18 PM read no cook was running and no alarm was pending, and nothing has been read from
the phone since. His wrap-up note listed steps 3, 8 and 10 to 15 for Friday and the beta.1 cook as still
running; steps 3, 8, 10 and 11 had run by then, so on Friday they are repeated only if he wants.
**Friday:** first step 9's two reads again (read only, after his yes) to see what is on the phone: with no
cook started since Tuesday, nothing is pending (if one is running, he ends and discards it and step 11 is
read again). Then steps 12 to 15. Saturday's plan is loaded on Friday night and sits on the phone one night.
The phone steps are Jason's by design (Claude only reads over adb): about 15 minutes with the phone in hand,
plugged in. The event log and the ring log hold Tuesday's entries (the beta.1 cook, step 10's start, end,
start): Sunday's readout filters both to Saturday.

**Moved to Wednesday 2026-11-18 morning (Jason): the rest of the table runs today, not Friday.** So
Saturday's plan is loaded on Wednesday and sits on the phone three nights, not one ("Friday" and "Friday
night" in this file now mean Wednesday). Nothing else in the plan or the times changes. What ran, each adb
line after his yes, serial `5ece07c1`: step 9's two reads again at 7:47 AM (nothing pending; he had started
and discarded a cook that morning), then step 8 again by one tap (the file is in Drive). Before the table,
the Share plan failure of Tuesday evening was diagnosed: a second tap while the share sheet opens gets a
false "Couldn't share" behind the sheet; the share itself works. Not a blocker, Saturday stays on beta.2
(`docs/after-readout-checklist.md`, "Share plan failed on the phone"). On Saturday and before: one tap on
Share plan and Export my data.

**Done early, Tuesday 2026-11-17 (Jason wanted beta.1 on the phone to look for layout bugs; each adb line
after his yes):** steps 1, 2, 6 and 7. Before: 0.2.0, versionCode 200, the same signing key as beta.1
(`dumpsys package` shows signature id `d3c9ed0e` for both). `adb install -r` of
`release/pitplanner-0.3.0-beta.1.apk` (SHA-256 `68b9e64a...bc5bf7`): Success, 11:30 AM. The app opened with
"Pit Planner has a new look. Your smokers, cook rates, plan and history came over." After: 0.3.0-beta.1,
versionCode 300301. Step 7's comparison was against the 2026-11-15 copy of the phone's 0.2.0 storage
(`tools/device/out/t064-2026-11-15/`), not screenshots (step 4 skipped, his choice): smoker Pit Boss
Sportsman 850, griddle 22 in with 2 burners, oven at 170F, brisket 0.65 and tri-tip 0.9 hr/lb, one past cook
(Sat Nov 14, served 5:17 PM, 18 min late), the plan for Sat Nov 21 5:00 PM at 250F with five foods: "everything
looks good" (Jason). Step 5 (a short 0.2.0 cook carried across) was skipped, his choice; the emulator upgrade
test covers the import (PASS on beta.1 the same morning). **Sunday's copy held a running cook, but it was not on the phone any more on Tuesday (see the update below):** the copy
holds a 0.2.0 cook started Sun Nov 15 10:49 AM, serve Sat Nov 21 5:00 PM, 28 steps, none done. Its first step, a
prep reminder at Saturday 5:35 AM, has no alarm; its first alarm is Fire the smoker at 6:30 AM (from the
copy's plan: `alarm` is false on prep steps). Still to do on Friday: steps 3 and
8 to 15 (9 to 11 use the cook now running, see the update below). The emulator was first: the upgrade
test and locked-reboot both pass on beta.1.

**Update, Tuesday 2026-11-17 afternoon: beta.2 is on the phone, and the running cook is a beta.1 cook.**
beta.1 had a bug Jason found the same day (Start cook did nothing after a cook had ended, until the app was
reopened). The fix is in 0.3.0-beta.2 (`release/pitplanner-0.3.0-beta.2.apk`, SHA-256 `e27ea9b3...8b242`),
installed over beta.1 at 4:10 PM with `adb install -r`, each line after his yes: 0.3.0-beta.1 / 300301
before, 0.3.0-beta.2 / 300302 after, no data cleared. 16 seconds after the install, before the app was
opened, `dumpsys alarm` showed the running cook's 18 alarms registered again. Then Jason opened the app: the
cook was there, Start cook greyed, Fire the smoker at 8:55 AM.
**No 0.2.0 cook came across.** The debug file from the phone (2026-11-17 4:24 PM) says so: the import's own
report reads running cook: no. The cook in Sunday's copy had been ended in 0.2.0 before the upgrade. The
cook running now was started on beta.1 on Tuesday at 2:53 PM from Plan: serve Sat Nov 21 5:00 PM, 250F, the
same five foods, 18 alarms, the first Fire the smoker at Saturday 8:55 AM (the copy's 6:30 AM was planned at
each brisket's own 0.9 hr/lb; the menu on the phone was made again in 0.2.0 after Sunday's copy, so its
briskets have no rate of their own and plan at the saved 0.65). Steps 9 to 11 use this cook. The import of a
running 0.2.0 cook is therefore not proven on the phone; it is covered on the emulator only.

| # | Who | What | Done |
|---|---|---|---|
| 1 | Claude | `adb devices` (read only: the phone's serial) | |
| 2 | Claude | `adb -s <phone> shell dumpsys package io.github.mecheng70.pitplanner` (read only: 0.2.0, its versionCode, exact alarms granted) | |
| 3 | Jason | In the dev build ("Pit Planner dev"): no cook running | Tue 2026-11-17 evening: "correct" (Jason) |
| 4 | Jason | In 0.2.0: screenshots of Gear, Cook rates and Cook history | |
| 5 | Jason | In 0.2.0: start a short cook with a step due in about 20 minutes | |
| 6 | Claude | `adb -s <phone> install -r release/pitplanner-0.3.0-beta.1.apk` (installs over 0.2.0; nothing uninstalled, no data cleared). Done 2026-11-17; beta.2 went over beta.1 the same afternoon | |
| 7 | Jason | Open the app. Read the import notice. Compare Gear, Cook rates and Cook history with the step 4 screenshots | |
| 8 | Jason | Gear, Export my data, save to Drive | Tue 2026-11-17 evening: "seemed like it did" (Jason). Again Wed 2026-11-18 7:49 AM, one tap: saved to Drive, "the file is there" (Jason); the phone's log shows the hand-off to Drive |
| 9 | Claude | `adb -s <phone> shell dumpsys alarm` for the app and `dumpsys package` again (read only: each alarm of the running cook once, 18 of them, the first Fire the smoker at Saturday 8:55 AM; exact alarms still granted: the line to read is `android.permission.USE_EXACT_ALARM: granted=true`. The phone is Android 16, API 36, and the manifest of `modules/pit-alarms` declares `SCHEDULE_EXACT_ALARM` only up to API 32, so the app relies on `USE_EXACT_ALARM` and there is no `appops` line for step 9). The running cook is the one started on beta.1 on 2026-11-17 at 2:53 PM (serve Sat Nov 21 5:00 PM, 250F, five foods), not a 0.2.0 cook; Jason keeps it until this step | Tue 2026-11-17 7:10 PM, serial `5ece07c1`: 18 alarms pending, each time once, the first Sat 8:55:00 AM, the last Sat 5:00 PM; 0.3.0-beta.2 / 300302; `USE_EXACT_ALARM: granted=true`; no alarm of the dev build pending. Again Wed 2026-11-18 7:47 AM: no alarm pending for the app or the dev build; 0.3.0-beta.2 / 300302; `USE_EXACT_ALARM: granted=true`; notifications granted |
| 10 | Jason | Open the running cook, End cook, Discard. (Its first alarm is Saturday 8:55 AM, so no ring is waited for at this step.) **Then the beta.2 check on the phone, not before this step** (Jason, 2026-11-17: no start, end, start on the phone while that cook runs): without closing the app, Start cook, End cook, Discard, then Start cook again: the second start must work (in beta.1 it did nothing until the app was restarted). End cook and Discard once more, so nothing is pending for step 11. This is the last step before Saturday's plan is loaded | Tue 2026-11-17, about 7:17 PM: "yes it worked" (Jason): the second start worked without restarting the app |
| 11 | Claude | `adb -s <phone> shell dumpsys alarm` for the app (read only: nothing pending, so none of that cook's Saturday alarms is left: the first was Fire the smoker at 8:55 AM) | Tue 2026-11-17 7:18 PM: no alarm pending for the app or the dev build; the removal history shows the cancels at 7:17:10 PM |
| 12 | Jason | Settings: notifications on; battery not restricted; on the app's battery usage page, allow background activity | Wed 2026-11-18, before 7:58 AM: done (Jason) |
| 13 | Jason | Gear, 5 taps on the version line: it reads 0.3.0-beta.2 | Wed 2026-11-18: reads 0.3.0-beta.2 (Jason) |
| 14 | Jason | Load Saturday's plan (above). Start cook. (No need to swipe the app away first on beta.2: Start cook after an ended cook is fixed, `d2fdccc`. Only beta.1 needed it.) If a sheet "Alerts may not ring" shows, tap **Start anyway** and note it here: ____ (in beta.1 and beta.2 its second button, Start cook, is pushed off the right edge at larger font sizes; known, fixed after the readout; it should not show if step 12's settings are on). Write the times in the table below | Wed 2026-11-18, before 7:58 AM: done (Jason). The plan first came up at 250F, left from the old plan; he started a cook at 250F, changed the plan to 225F, saw the running cook did not change, ended and discarded it, and started again at 225F. The Cook tab shows Fire the smoker to 225F, ready Sat Nov 21 5:00 PM. He did not report an "Alerts may not ring" sheet. The times column below is filled from step 15's read |
| 15 | Claude | `adb -s <phone> shell dumpsys alarm` for the app (read only): no Pit Planner alarm before 8:30 AM Saturday; the first is Fire the smoker at 8:50 AM. If any alarm is earlier, stop and tell Jason before he unplugs. Then unplug | Wed 2026-11-18 7:58 AM, after his yes: 13 alarms pending for the app, each time once, all Sat Nov 21: 8:50 AM, 9:10 AM, 12:40 PM, 3:15, 3:25, 3:40, 4:05, 4:20, 4:25, 4:40, 4:52, 4:55 and 5:00 PM. Nothing before 8:30 AM Saturday, none of the dev build. Nothing is left of the discarded 250F cook: its own times (9:45 AM, 10:05 AM, 1:10 PM, 3:20 PM) are not there. 14 steps ring in 13 alarms: two steps share 4:40 PM |

## Saturday

"Your phone's time" is filled in from the phone on Wednesday 2026-11-18, 7:58 AM (step 15's read of the
app's alarms): the times as started, before any change on the day. The names come from the engine run with
the same plan, which gives the same 13 times. From Pit went out on, each time moves with serve: write the new
serve time where the table asks.

Between steps: screen off, locked, unplugged, lying still (the phone only goes into deep idle when it is
not moving). Answer each alert within a couple of minutes. Never open the dev build.

| Fixture time | What rings | What you do | Your phone's time | Rang at | OK |
|---|---|---|---|---|---|
| 8:50 AM | Fire the smoker to 225F | **Done** on the lock screen |  8:50 AM | | |
| 9:10 AM | Brisket on the smoker | Unlock. **Done** in the app. Lock |  9:10 AM | | |
| 12:25 PM | nothing | Plug the phone in. Claude saves the battery history to a file on the computer: `adb shell dumpsys batterystats --history` (read-only, after Jason's yes). Unplug. Plugging in ends deep idle for that moment, by design: a reboot can drop the newest history entries (seen on the emulator, 2026-11-17), and this keeps the morning's | | | |
| 12:30 PM | nothing | **Reboot** the phone, 10 minutes before the wrap check. Do not unlock it afterwards | | | |
| 12:40 PM | Check the brisket (wrap) | It must ring while the phone is still locked after the reboot (Jason, 2026-11-18, after the rehearsal: this phone sounds nothing before the first unlock; pass is the alarm delivered on time while locked, read from the ring log afterwards, and the sound at the unlock). Note the time. Unlock. Tap **Not yet**, keep serve |  12:40 PM | | |
| about 12:55 PM | Check the brisket again | **Done**. Then Cook options, **Undo** that Done | | | |
| about 1:05 PM | Check the brisket a third time (10 min after the Undo) | **Done**. Lock | | | |
| 1:30 PM | nothing | Cook options, **Pit went out**. Lock | | | |
| 1:45 PM | nothing | **Back up to temp**, choose Move serve. Write the new serve time: ________. Every time below moves with it | | | |
| 2:30 PM | nothing | **Adjust** on Next up: later by 10 min, Move serve. Write the new serve time: ________ | | | |
| 3:15 PM + moves | Wings on the smoker | **Done** on the lock screen |  3:15 PM | | |
| 3:25 PM + moves | Oven to 170F for holding | **Done** on the lock screen |  3:25 PM | | |
| 3:40 PM + moves | Check tenderness (brisket pull) | **Done** on the lock screen |  3:40 PM | | |
| 4:05 PM + moves | Turn the smoker up to 400F | Unlock, **Done** in the app. Then swipe the app away from recent apps (app closed). Lock |  4:05 PM | | |
| 4:20 PM + moves | Wings crisp at 400F | **+15 min** on the lock screen. Keep the app closed until Fire the griddle rings. See "The +15 tap" below |  4:20 PM | | |
| 4:25 PM + moves | Fire the griddle | It must ring at the time it had before the +15 tap. Note the time. **Done** on the lock screen. Then open the app: read the notice and the new serve time: ________. Lock |  4:25 PM | | |
| 15 min after the +15 tap | Wings crisp, again | Note the time. **Done** on the lock screen | | | |
| as the app shows | Chicken breasts on the griddle | **Done** on the lock screen |  4:40 PM | | |
| as the app shows | Slice or plate the brisket | **Done** on the lock screen |  4:40 PM (one alert with the chicken breasts) | | |
| as the app shows | Pull chicken breasts | **Done** on the lock screen |  4:52 PM | | |
| as the app shows | Pull wings | **Done** on the lock screen |  4:55 PM | | |
| as the app shows | Time to serve | **Done**, then **Discard this cook** |  5:00 PM | | |
| after | | Gear, 5 taps on the version line, Send to developer. If you can, do not charge the phone to full before Sunday's readout | | | |

### The +15 tap with the app closed: what 0.3.0 should do (the pass line)

0.3.0 does not re-plan while the app is closed (that is T-078, for 0.3.x). So:

1. The alert goes away, and the wings crisp step rings again about 15 minutes later, once. With the app
   still closed it rings 15 minutes after the tap, to the second. Once the app has been opened and has
   re-planned (step 3), it rings 15 minutes after the step's planned time instead, so tap within a minute
   of the ring and the two agree within a minute. (Seen on the emulator, 2026-11-17: ring 9:35:00, tap
   9:35:59, app opened 9:42, second ring 9:50:00, nothing at 9:51.)
2. No other alarm moves while the app stays closed. Fire the griddle still rings at the time it had before
   the tap.
3. When the app is opened (after Fire the griddle rings), it applies the tap: Live cook shows one notice, the wings step is 15
   minutes later, and because the wings' hold cannot absorb 15 minutes, serve moves and the other foods move
   with it ("Serve moved to {time}. The other foods moved with it."). The alarms are set again once, at the
   new times.
4. After that every remaining step rings once, at its new time. Nothing rings at both the old and the new
   time.

A fail is any of: no second ring for the wings step; another alarm moving before the app is opened; a step
ringing twice; a step not ringing after the app re-planned.

The rule in the code (`applyActions`, `src/lib/cook.ts`): a +15 from the lock screen keeps serve when the
holds can absorb it and moves serve later when they cannot; the wings hold 5 minutes, so here serve moves.
SPEC section 5 says the same. (SPEC's "the lock screen always keeps serve" is about a step marked Done
early, which never moves serve earlier.) This expectation is from reading the code. It is checked on the emulator before Saturday; if the emulator
shows something else, this section is corrected first.

Checked on the emulator on 2026-11-17 (dev build, the app's process killed): points 1 to 3 hold; the notice
read "Wings crisp at 400F: moved 15 min from the alert. Serve moved to 10:30 AM. The other foods moved with
it."; the alarms were set once at the new times. A second +15 with the app kept closed rang 15 minutes after
the tap and is in the ring log with source `snooze`. Not checked there: Done on Fire the griddle from the
lock screen before opening the app. With two alerts waiting, Android may group them and hide Done and
+15 min until the alert is pulled open.

## Sunday readout (Claude, phone plugged in, each line read only and after Jason's yes)

- The debug file from Send to developer: the alarm ring log (planned and actual time of every ring, T-068)
  and the event log (each Done, Not yet, Undo, Pit went out, Adjust and +15). **Filter both to Saturday
  2026-11-21 first:** both logs also hold Tuesday 2026-11-17's entries (the beta.1 cook and step 10's
  start, end, start).
- `adb shell dumpsys deviceidle`: Doze state and settings.
- `adb shell dumpsys batterystats --history`: when the phone went into and out of deep idle.
- `adb shell dumpsys alarm` for the app: nothing pending after Discard.

| Step | Planned | Rang | Delta | Deep idle before the ring | Source | Note |
|---|---|---|---|---|---|---|
| | | | | | | |

"Planned" is the time in force when it rang (after Not yet, Pit went out, Adjust and +15 it is the
re-planned time). Android wakes the phone out of deep idle just before an alarm-clock alarm, so the idle
column says whether the phone was in deep idle in the stretch before the ring, not at the ring.
