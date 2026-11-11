# Alarm testing (SPEC section 6)

Native code: `android/app/src/main/java/io/github/mecheng70/pitplanner/alarms/`.
JS bridge: `src/platform/alarms.ts`. Engine side (event -> alarm grouping): `engine/alarms.ts`.

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
