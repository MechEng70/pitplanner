# T-037 staged cook: checklist (Saturday 2026-11-21, 0.3.0-beta.2)

No food. The full-length real timeline on Jason's phone, to prove every alarm rings on time with the phone
locked, unplugged and idle, through a reboot and every kind of change. It ends with Discard, so the cook
rates are not touched. Pass: every ring within 1 minute of its planned time, nothing lost at the reboot,
nothing twice.

Fixture times below come from the engine on 2026-11-16 (`data/foods.json` at commit `fe5e384`, a 20 min
smoker preheat, a 15 min griddle preheat). Your phone's plan is the truth: write its times in the blank
column at Start cook, and after each change that moves serve.

## The plan to load (Friday night)

Ready by Saturday 5:00 PM. Smoker 225F.

| Food | Settings |
|---|---|
| Brisket | 10 lb trimmed, butcher paper wrap, rest 60 min, saved rate 0.75 hr/lb (do not change the rate) |
| Chicken wings | 2 lb, smoke then crisp, dry brine, rest 5 min |
| Chicken breasts | 4, griddle, pounded, no brine, rest 8 min |

The first ring is Fire the smoker at 7:50 AM. Nothing rings before 7:30 AM. Two reminders have no alarm
(Prep the brisket 6:55 AM, Dry brine the wings 7:15 AM).

## Friday: upgrade over 0.2.0 (T-038's phone check) and get ready

Phone unlocked and plugged in, Jason present. Claude runs only the adb lines, each after Jason's yes.

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
| 3 | Jason | In the dev build ("Pit Planner dev"): no cook running | |
| 4 | Jason | In 0.2.0: screenshots of Gear, Cook rates and Cook history | |
| 5 | Jason | In 0.2.0: start a short cook with a step due in about 20 minutes | |
| 6 | Claude | `adb -s <phone> install -r release/pitplanner-0.3.0-beta.1.apk` (installs over 0.2.0; nothing uninstalled, no data cleared). Done 2026-11-17; beta.2 went over beta.1 the same afternoon | |
| 7 | Jason | Open the app. Read the import notice. Compare Gear, Cook rates and Cook history with the step 4 screenshots | |
| 8 | Jason | Gear, Export my data, save to Drive | |
| 9 | Claude | `adb -s <phone> shell dumpsys alarm` for the app and `dumpsys package` again (read only: each alarm of the running cook once, 18 of them, the first Fire the smoker at Saturday 8:55 AM; exact alarms still granted). The running cook is the one started on beta.1 on 2026-11-17 at 2:53 PM (serve Sat Nov 21 5:00 PM, 250F, five foods), not a 0.2.0 cook; Jason keeps it until this step | |
| 10 | Jason | Open the running cook, End cook, Discard. (Its first alarm is Saturday 8:55 AM, so no ring is waited for on Friday.) **Then the beta.2 check on the phone, not before this step** (Jason, 2026-11-17: no start, end, start on the phone while that cook runs): without closing the app, Start cook, End cook, Discard, then Start cook again: the second start must work (in beta.1 it did nothing until the app was restarted). End cook and Discard once more, so nothing is pending for step 11. This is the last step before Saturday's plan is loaded | |
| 11 | Claude | `adb -s <phone> shell dumpsys alarm` for the app (read only: nothing pending, so none of that cook's Saturday alarms is left: the first was Fire the smoker at 8:55 AM) | |
| 12 | Jason | Settings: notifications on; battery not restricted; on the app's battery usage page, allow background activity | |
| 13 | Jason | Gear, 5 taps on the version line: it reads 0.3.0-beta.2 | |
| 14 | Jason | Load Saturday's plan (above). Start cook. (No need to swipe the app away first on beta.2: Start cook after an ended cook is fixed, `d2fdccc`. Only beta.1 needed it.) If a sheet "Alerts may not ring" shows, tap **Start anyway** and note it here: ____ (in beta.1 and beta.2 its second button, Start cook, is pushed off the right edge at larger font sizes; known, fixed after the readout; it should not show if step 12's settings are on). Write the times in the table below | |
| 15 | Claude | `adb -s <phone> shell dumpsys alarm` for the app (read only): no Pit Planner alarm before 7:30 AM Saturday; the first is Fire the smoker at 7:50 AM. If any alarm is earlier, stop and tell Jason before he unplugs. Then unplug | |

## Saturday

Between steps: screen off, locked, unplugged, lying still (the phone only goes into deep idle when it is
not moving). Answer each alert within a couple of minutes. Never open the dev build.

| Fixture time | What rings | What you do | Your phone's time | Rang at | OK |
|---|---|---|---|---|---|
| 7:50 AM | Fire the smoker to 225F | **Done** on the lock screen | | | |
| 8:10 AM | Brisket on the smoker | Unlock. **Done** in the app. Lock | | | |
| 12:00 PM | nothing | Plug the phone in. Claude saves the battery history to a file on the computer: `adb shell dumpsys batterystats --history` (read-only, after Jason's yes). Unplug. Plugging in ends deep idle for that moment, by design: a reboot can drop the newest history entries (seen on the emulator, 2026-11-17), and this keeps the morning's | | | |
| 12:05 PM | nothing | **Reboot** the phone. Do not unlock it afterwards | | | |
| 12:15 PM | Check the brisket (wrap) | It must ring while the phone is still locked after the reboot. Note the time. Unlock. Tap **Not yet**, keep serve | | | |
| about 12:30 PM | Check the brisket again | **Done**. Then Cook options, **Undo** that Done | | | |
| about 12:40 PM | Check the brisket a third time (10 min after the Undo) | **Done**. Lock | | | |
| 1:30 PM | nothing | Cook options, **Pit went out**. Lock | | | |
| 1:45 PM | nothing | **Back up to temp**, choose Move serve. Write the new serve time: ________. Every time below moves with it | | | |
| 2:30 PM | nothing | **Adjust** on Next up: later by 10 min, Move serve. Write the new serve time: ________ | | | |
| 3:15 PM + moves | Wings on the smoker | **Done** on the lock screen | | | |
| 3:25 PM + moves | Oven to 170F for holding | **Done** on the lock screen | | | |
| 3:40 PM + moves | Check tenderness (brisket pull) | **Done** on the lock screen | | | |
| 4:05 PM + moves | Turn the smoker up to 400F | Unlock, **Done** in the app. Then swipe the app away from recent apps (app closed). Lock | | | |
| 4:20 PM + moves | Wings crisp at 400F | **+15 min** on the lock screen. Keep the app closed until Fire the griddle rings. See "The +15 tap" below | | | |
| 4:25 PM + moves | Fire the griddle | It must ring at the time it had before the +15 tap. Note the time. **Done** on the lock screen. Then open the app: read the notice and the new serve time: ________. Lock | | | |
| 15 min after the +15 tap | Wings crisp, again | Note the time. **Done** on the lock screen | | | |
| as the app shows | Chicken breasts on the griddle | **Done** on the lock screen | | | |
| as the app shows | Slice or plate the brisket | **Done** on the lock screen | | | |
| as the app shows | Pull chicken breasts | **Done** on the lock screen | | | |
| as the app shows | Pull wings | **Done** on the lock screen | | | |
| as the app shows | Time to serve | **Done**, then **Discard this cook** | | | |
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
  and the event log (each Done, Not yet, Undo, Pit went out, Adjust and +15).
- `adb shell dumpsys deviceidle`: Doze state and settings.
- `adb shell dumpsys batterystats --history`: when the phone went into and out of deep idle.
- `adb shell dumpsys alarm` for the app: nothing pending after Discard.

| Step | Planned | Rang | Delta | Deep idle before the ring | Source | Note |
|---|---|---|---|---|---|---|
| | | | | | | |

"Planned" is the time in force when it rang (after Not yet, Pit went out, Adjust and +15 it is the
re-planned time). Android wakes the phone out of deep idle just before an alarm-clock alarm, so the idle
column says whether the phone was in deep idle in the stretch before the ring, not at the ring.
