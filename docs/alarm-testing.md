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
  public on the lock screen), actions Done / +15 min / Open. Full-screen intent for critical steps and
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

