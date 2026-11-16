# Alarm testing (SPEC section 6)

Native code: `modules/pit-alarms/android/src/main/java/io/github/mecheng70/pitplanner/alarms/` (the 0.2.0
plugin as an Expo module; 0.2.0's own copy is in `legacy/android/`). JS: `modules/pit-alarms/index.ts`,
`src/platform/alarms.ts`; the store (`src/lib/store.tsx`) replaces the set after every cook change. Engine
side (event -> alarm grouping): `engine/alarms.ts`. The 0.2.0 names below (`rescheduleFromPlan`,
`PitAlarms.setAlarms`) are `syncAlarms` and `alarmService.replaceAll` in the Expo app; the behavior is the same.

## How it works

- `rescheduleFromPlan(plan, now)` turns `plan.events` into one alarm per minute (same-minute steps share
  one notification) and calls `PitAlarms.setAlarms`, which cancels everything and schedules the new set.
- Every alarm goes through `AlarmManager.setAlarmClock()`. Exact-alarm access comes from
  `USE_EXACT_ALARM` (Android 13+), so it is granted at install; `SCHEDULE_EXACT_ALARM` covers 12.
- The set lives in SharedPreferences (`pit_alarms`), so the receivers work with the app dead.
- Fired step: high-priority notification on channel `steps_v1` (alarm sound, `USAGE_ALARM`, vibration,
  public on the lock screen), actions Done / +15 min (a tap on the alert opens the app). Full-screen intent for critical steps and
  for anything between 10 PM and 7 AM.
- No Done: repeats every 10 min, 6 times ("Still waiting: ..."), then one "Cook needs you" alert.
- Done (notification or `acknowledge(keys)` from the app) stops the repeats. +15 min rings the step again
  in 15 min and queues a `snooze15` action. The app reads queued actions with `drainActions()`.
- Direct Boot: the alarm store is in device-protected storage and the receivers are `directBootAware`,
  so after a reboot alarms are restored on LOCKED_BOOT_COMPLETED, before the phone is first unlocked.
  Only step titles and times are stored there.
- Restore: `RestoreReceiver` reschedules on LOCKED_BOOT_COMPLETED, BOOT_COMPLETED, MY_PACKAGE_REPLACED, TIME_SET,
  TIMEZONE_CHANGED and exact-alarm permission changes. Steps whose time passed while the phone was off
  fire immediately, marked "Missed while the phone was off".

## Debug screen

Gear tab, tap the version 5 times. Shows permission status with Allow buttons, a 10 second test alert,
every step of the active cook (or draft plan) with "10 sec" to fire it now, what is scheduled, open
repeats, and the notification taps waiting for the app.

## adb commands

```
# What Pit Planner has registered with AlarmManager
adb shell dumpsys alarm | grep -A2 "io.github.mecheng70.pitplanner}"

# Force Doze (screen off, simulate unplugged). Take the app off the battery allowlist first to prove
# setAlarmClock works without it.
adb shell dumpsys deviceidle whitelist -io.github.mecheng70.pitplanner
adb shell dumpsys battery unplug
adb shell input keyevent KEYCODE_SLEEP
adb shell dumpsys deviceidle force-idle
adb shell dumpsys deviceidle get deep          # IDLE

# Put everything back
adb shell dumpsys deviceidle unforce
adb shell dumpsys battery reset
adb shell dumpsys deviceidle whitelist +io.github.mecheng70.pitplanner

# When did it fire, and was the notification posted
adb logcat -d -v time | grep "sending alarm.*pitplanner"
adb shell dumpsys notification --noredact | grep -A40 "pkg=io.github.mecheng70.pitplanner"
```

## Results on the OnePlus CPH2583, Android 16 (2026-11-11)

| Test | Result |
|---|---|
| Doze: forced deep idle, screen off, battery-simulated unplugged, app removed from allowlist, test alarm 60 s out | Pass. AlarmManager sent it at the exact scheduled ms (12:49:15.759); notification posted 33 ms later, full-screen intent attached. |
| App update (`adb install -r`) with two cook alarms set, app not opened | Pass. Android started the app for MY_PACKAGE_REPLACED -> RestoreReceiver; both alarms registered again at their original times. |
| Cook alarm fires | Pass. Sent 12:55:00.909 as scheduled, notification +55 ms, Done / +15 min / Open, repeat registered for +10 min. |
| Done from the notification | Pass. Repeat unregistered, notification removed, `done` action with the step key queued, other alarm untouched. |
| Unanswered repeat | Pass. Step fired 13:04:12; with no Done it rang again at 13:14:12 as "Still waiting: Reboot test" and the next repeat was set for 13:24:12. |
| Swiping the notification away | Behaves as designed: not treated as Done, repeat stays scheduled. |
| +15 min from the notification | Pass (tapped by hand). Repeat cancelled, step re-set for exactly 15 min later, `snooze15` action queued with the step key. |
| Unplanned restart, old build (no Direct Boot) | Gap found: after boot, while locked, nothing was registered. OnePlus delivered BOOT_COMPLETED about 1 min after unlock; alarms came back then. Fixed by Direct Boot (next row). |
| Reboot mid-cook, Direct Boot build (`adb reboot`) | Pass. Booted locked 13:00:47; RestoreReceiver ran 13:00:50 on LOCKED_BOOT_COMPLETED, 12 s before the phone was unlocked; step fired 13:04:12.816 (scheduled .815), notification +10 ms. |
| Storage migration | Pass. Existing alarm store moved from credential to device-protected storage on update; migration waits for an unlocked user so a locked update cannot drop it. |
| Permissions flow | Notifications (system dialog) and battery exemption (system dialog) granted from the Allow buttons; status updates on return. |

## Results on the Expo build, test emulator (Android 16, API 36), 2026-11-13 (T-016)

Tools: `tools/device/upgrade020.sh` (`setup`, `live`, `alarms`) for the release app, the `alarm` device test
for the dev build. `upgrade020.sh alarms` lists AlarmManager's pending alarms beside the app's stored set.
`dumpsys alarm` prints the next alarm clock a second time as "Next wake from idle": the listing counts each
alarm object once.

**Upgrade with a live cook** (real `pitplanner-0.2.0.apk`, then `0.3.0-alpha.3` installed over it with
`adb install -r`). The cook: 2 lb of wings started in 0.2.0 with its Start cook button, six alarms set by
0.2.0 (11:55:00 fire, 11:58:00 wings on, 12:48, 13:03, 13:38, 13:43).

| Test | Result |
|---|---|
| Install 0.3.0-alpha.3 over 0.2.0 with the six alarms pending, app not opened | Pass. The update dropped 0.2.0's alarms; the new build's `RestoreReceiver` (MY_PACKAGE_REPLACED) registered the same six again from 0.2.0's stored set, same times, one each. |
| Open the upgraded app | Pass. Import `done`, the running cook came across, the notice showed; the app replaced the set from the plan: still six alarms, the same times, none doubled; AlarmManager and the stored set agree. |
| `USE_EXACT_ALARM` | `dumpsys package`: `granted=true` under 0.2.0 and after the upgrade (and on the fresh dev build: "exact alarms on"). |
| First step, app killed, screen off | Pass. Planned 11:55:00.000, notification `when` 11:55:00.093, once (AlarmManager's count for the FIRE tag went to 1). Repeat registered for 12:05:00. |
| Done on the notification, app dead | Pass. Repeat unregistered, notification removed, `done fire::` queued, the other five alarms untouched. |
| Second step, app killed, screen off | Pass. Planned 11:58:00.000, rang 11:58:00.101, once (count 2). |
| +15 min on the notification, app dead | Pass. Repeat cancelled, notification removed, the step set again natively for 12:13:27 (`phase:w:smoke~snooze`), `snooze15` queued. |
| Open the app after both taps | Pass. Each applied once: fire done at 11:55, wings moved 15 minutes, serve moved to 1:58 PM (the notice says so), Cook tab opened. The app's set replaced everything, including the native snooze alarm: five alarms (12:13:00, 13:03, 13:18, 13:53, 13:58), none doubled. |
| Time zone change (New York to Paris and back), app not opened | Pass. `RestoreReceiver` ran (the alarm objects are new); the five alarms kept their instants, one each. |
| App update (`adb install -r` of the same APK) with the five alarms set, app not opened | Pass. All five registered again at their times. |
| Reboot (`adb reboot`) mid-cook, app not opened | Pass. 12 seconds after boot all five were registered again. The emulator has no screen lock, so this is BOOT_COMPLETED, not the locked case: that is the phone's. |
| Step after the reboot | Pass. Planned 12:13:00.000, rang 12:13:00.038, once; repeat registered for 12:23:00. |
| Unanswered repeat | Pass. 12:23:00.045: "Still waiting: Chicken wings", "10 min past the step. Wings on the smoker on a wire rack."; next repeat 12:33:00. |

No alarm rang twice and none was lost. The largest delay was 101 ms.

**Dev build** (`npm run device -- --only alarm`): a test alarm rings with the screen off; a second one rings
after the emulator is forced into deep idle (`dumpsys deviceidle force-idle`, battery reported unplugged, app
off the battery allowlist); the debug screen's test alert rings and leaves the stored list.

**How Doze treats these alarms (seen on Android 16, 2026-11-13).** Two things the forced-idle test ran into:
- Android does not enter deep idle while an alarm clock is close: `dumpsys deviceidle` shows
  `min_time_to_alarm=+1h0m0s0ms`, and `force-idle` answers "Unable to go deep idle; stopped at ACTIVE" with
  a `setAlarmClock` alarm less than an hour out. (The emulator test shortens that window as root to get in;
  a phone cannot.)
- Once idle, Android ends the idle period ahead of the next alarm clock: forced in with a test alarm 45 s
  out, the state read back was `IDLE_MAINTENANCE`, and the alarm rang on time.
Checked directly on the emulator (no root, the one-hour window as shipped): with no alarm clock, or one 65
minutes out, `force-idle` reaches `IDLE` and stays there; with one 2 minutes out it stops at `INACTIVE`; and
setting one 60 s out on a device already in `IDLE` takes it to `INACTIVE` within seconds. Both alarms rang on
time.

So a step alarm does not have to break through deep Doze: the system keeps the phone out of it around alarm
clocks. A forced-idle check with an alarm a minute out therefore shows "screen off, unplugged, off the
allowlist", not deep idle. The real case, a step hours away with the phone idle overnight, is the Saturday
cook (T-037).

Not testable on the emulator: sound (it runs without audio), OEM power management, a locked reboot.

## Results on the Expo dev build, OnePlus CPH2583, Android 16, 2026-11-16 (phone block, T-016 phone half)

Jason at the phone; every action listed first and approved. The dev build (`...pitplanner.debug`) only; the
real app was not touched. Evidence is the phone's own alarm list filtered to Pit Planner
(`dumpsys alarm`), the app's screens, the lock and Doze state read back, and what Jason heard and saw. The
phone's notification list is never read (it holds other apps' notifications). adb cannot grant or revoke
permissions on this phone (OnePlus permission monitoring): Jason switches them in Settings.

| Test | Result |
|---|---|
| Test alert, phone locked, battery reported unplugged | Pass. Rang and showed on the lock screen ("Test alert doze", "Alarms work."). Doze was not forced in this run (state `IDLE_PENDING`): the script waited for `Asleep`, this phone reports `Dozing`. |
| Step alert in forced Doze | Pass. Locked 08:51:17, `deviceidle force-idle`, state `IDLE`, on the battery allowlist (Jason: set unrestricted first). "Wings on the smoker on a wire rack." showed on the lock screen at 08:52 (`tools/device/out/phone/step2-lock.png`, cropped to the alert). |
| P2: an unanswered step repeats in Doze | Pass for one repeat. Doze stayed `IDLE` from 08:51 to 08:59; after 08:59 the alarm list held the step's next repeat at 09:09, so the 08:59 repeat fired and set the next. No picture (the screen was dark again when it was taken). Six repeats and "Cook needs you" stay proven in Robolectric only: accepted for 0.3.0 (Jason, 2026-11-16). |
| P1: reboot with the phone locked | **Fail on the dev build.** Booted locked 09:00:29; Android started the app at 09:00:31 for LOCKED_BOOT_COMPLETED and it crashed in `MainApplication.onCreate`: `IllegalStateException: SharedPreferences in credential encrypted storage are not available until after user (id 0) is unlocked`, from React Native's `DevSupportManagerBase`. RestoreReceiver never ran: 0 alarms while locked, the 09:09 repeat did not ring. Unlocked 09:10:01; the alarms were back between 09:11:18 and 09:11:38 (BOOT_COMPLETED, late on this OnePlus as on 2026-11-11): four steps at their times, both repeats moved to 09:21:25. T-072. |
| P3: a permission taken away during a cook | Pass. Notifications switched off in Settings: `POST_NOTIFICATIONS: granted=false`, the Cook tab showed "Alerts are off. Steps may not ring." with Fix. Switched on: `granted=true`, the banner gone, the cook's 6 alarms still held. |
| Done and +15 min from the lock screen, without unlocking | Pass. With the phone reading locked at every check: Done took the step's repeat off the alarm list; +15 min set the step again 15 minutes on. Picture of the expanded alert: `tools/device/out/phone/lock-alert-expanded.png`. |
| Button labels on the lock screen at 115% font | Bug, fixed. With three buttons "Done" and "+15 min" were cut to "Do..." and "+15...". Now two buttons, Done and +15 min as in mockup 14; a tap on the alert opens the app (Jason, 2026-11-16). Not yet seen on the phone with two buttons. |

Not run: Doze with a test alert more than an hour out (Android leaves deep idle ahead of a near alarm clock
unless forced; Jason dropped the 65 minute round). It moves to the Saturday cook (T-037): every step alarm on
time with the phone idle and locked between steps, and the Doze history read back afterwards
(`dumpsys deviceidle`) to show the phone really was in deep idle.

Jason's report, not instrumented: his real cook on Saturday 2026-11-14 ran on 0.2.0 on this phone and its step
alerts notified him fine through the day. It is the same `setAlarmClock` path the Expo build ported.

## Locked restart on an emulator with a PIN, 2026-11-16 (T-072)

AVD `pitplanner-lock` (`AVD_LOCK=1 tools/device/avd.sh start`, API 36, PIN 1111 set with
`locksettings set-pin`): it boots locked (`RUNNING_LOCKED`) like a phone after a restart. `adb reboot` ends
the headless emulator, so a restart here is `avd.sh stop` then `start`.

| Build | While still locked after the restart |
|---|---|
| Release build 0.3.0-alpha.4 (`io.github.mecheng70.pitplanner`), a cook started through its own screens, 10 alarms | **Pass, twice.** Android started the app for RestoreReceiver; all 10 alarms registered again; the process alive; no crash line. |
| Dev build (`...pitplanner.debug`), `dev/alarm?cook=3`, 6 alarms | **Fail**, as on the OnePlus. `MainApplication.onCreate` builds the React host, whose dev support (`DevInternalSettings`, through `expo-dev-launcher`) reads default SharedPreferences in credential-encrypted storage: `IllegalStateException`, the process dies, 0 alarms. |

The scripted test, `tools/device/locked-reboot.sh release/pitplanner-0.3.0-alpha.5.apk`, 2026-11-16 (T-072), on
the same emulator: **PASS**. A cook started at 11:1x with 5 alarms; after the restart, still locked
(`RUNNING_LOCKED`): no crash, all 5 alarms registered again, the step due at 11:35:00 rang (its alert posted
on the step channel) and its repeat was set; after the PIN the app opened on the running cook. This is the
case the hand run above had not shown: a step that comes due before the first unlock.

The test can fail (Jason asked for the proof, 2026-11-16): a throwaway release build with `RestoreReceiver`
made to do nothing on the two boot signals, built in its own worktree beside the repo and deleted after, run
on `pitplanner-lock` only. Result: locked, no crash, then `FAIL  the alarms while locked are not the cook's
(want 5 FIRE alarms, have "")`, `FAIL  the step due at 12:15:00 did not ring while locked`, `FAIL  no repeat
is set`, `== locked-reboot: FAIL`, exit 1.

So the failure seen on the phone is in code that only a dev build runs. A release build restores its alarms
before the first unlock on this emulator. Not yet shown: a release build on a real phone (T-038, and the
tester's Samsung at T-037).

## Shared .pitplan file, cold start, 2026-11-16 (T-031 stand-in)

| Build | Opened from | App not running | App already running |
|---|---|---|---|
| Dev build, OnePlus | Gmail attachment | "Could not read that file." | Shared plan sheet |
| Dev build, emulator | Files app | "Could not read that file.": `SecurityException: Permission Denial: opening provider com.android.externalstorage.ExternalStorageProvider ...` (logged under `PitShare`) | Shared plan sheet |
| Release build 0.3.0-alpha.4, emulator | Files app | Shared plan sheet | Shared plan sheet |

A dev build that is not running starts in the Expo dev launcher, which takes the intent and hands it on; the
read permission the sending app gave does not reach the app's own activity. A release build has no dev
launcher. Limitation of dev builds only: open the dev build first, then the file. A release build opened for
the first time shows Setup and the shared plan's sheet right after Finish setup.

## Android 14 and 15 emulator images, 2026-11-15 (T-037 prep)

The `alarm` device test on the dev build, at 115%, on Google APIs x86_64 images started with
`AVD_API=34` and `AVD_API=35` (`tools/device/README.md`, "Other Android versions"), and again on the
Android 16 emulator.

| Android | Result |
|---|---|
| 14 (API 34) | Pass. Test alarm rang with the screen off; a second rang in forced deep idle with the app off the battery allowlist; the debug screen's 10 second test alert rang and left the stored list. |
| 15 (API 35) | Pass, the same three. |
| 16 (API 36) | Pass, the same three (the test's debug screen step was changed, so it was run again here). |

Emulator images are not a Samsung phone: its own battery rules are only seen on the tester's phone.
