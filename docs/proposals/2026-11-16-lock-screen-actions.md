# Lock-screen Done and +15 min: why the other foods are not re-timed

Report only. Nothing is changed. Read on `main` at ed4d84d. Numbers are computed with the real functions
in a throwaway Jest file (since deleted). Statements that are my reading, not something I read or
computed, are marked **(inference)**.

## Summary

1. **Cause.** The two paths do not differ. "Move serve for one late food" is wrong in the engine for both: `extendCook` and `markStepDone` with `keepServe = false` move that food and serve, and leave every other food where it was, so the other foods' holds grow by the same minutes (`engine/live.ts:156-158`, `engine/live.ts:75-81`).
2. **Recommended behaviour.** Keep the lock screen as it is (no question; keep serve while every food keeps its minimum rest, else move serve). Fix the engine so that when serve moves for one food, the other foods move with it. The in-app Done > Move serve and Not yet get the same fix, because they call the same functions.
3. **Size (estimate).** About 20 lines in `engine/live.ts`, 0 to 3 in `src/lib/cook.ts`, about 80 lines of tests, 2 lines of SPEC. No Kotlin change. No migration. One existing test on `main` changes, three on the T-069 branch.
4. **Jason decides.** (a) The rule for the other foods when serve moves (section 4, option B). (b) What a food already on the heat does: cook that much longer, or stay and warn. (c) Whether the notice on Live cook gets a few more words. (d) Whether Back up to temp gets the same fix now (same gap for griddle and oven foods).
5. **Not fixed by this.** With the app fully closed, only the snoozed step rings again. The other foods' alerts keep their old times until the app is opened (section 4, "What cannot be made the same").

## 1. The lock-screen path

### Native (Kotlin)

Files are under `modules/pit-alarms/android/src/main/java/io/github/mecheng70/pitplanner/alarms/`.

- The notification has two actions, Done and +15 min (`Notifications.kt:81-82`). Each is a broadcast to `ActionReceiver` with the alarm id, the step keys, the title and the body (`Notifications.kt:55-63`).
- `ActionReceiver.onReceive` (`Receivers.kt:62-83`), for both actions:
  - reads the time of the tap, `Clock.now()` (`Receivers.kt:66`);
  - stops the repeats for those step keys, `AlarmScheduler.acknowledge` (`Receivers.kt:68`, `AlarmScheduler.kt:71-82`);
  - removes the notification (`Receivers.kt:69`).
- **Done** then queues `{type: "done", alarmId, keys, at: tap time}` and tells the app if it is running (`Receivers.kt:71-74`).
- **+15 min** then sets one new alarm, id `<alarmId>~snooze`, for tap time + 15 min, with the same title, body and keys (`Receivers.kt:77-78`, `AlarmScheduler.kt:109-114`, `SNOOZE_MS` at `AlarmScheduler.kt:18`). It queues `{type: "snooze15", alarmId, keys, at: tap time}` and tells the app if it is running (`Receivers.kt:79-80`).
- Nothing else is touched. The alarms of every other step stay at the times of the last `replaceAll`. The native side has no plan and no engine. It cannot re-time anything.
- The queue is a JSON list in device-protected preferences (`AlarmStore.kt:103-107`). `drainActions` returns it and empties it (`AlarmStore.kt:109-113`, bridge at `PitAlarmsModule.kt:68`).
- "Tells the app" only works when the React Native module is alive (`PitAlarmsModule.kt:116-121`). With the app closed it does nothing and the action waits in the queue.

### TypeScript

- The queue is read at three moments: app start, app back to the front, and when the native side reports a tap while the app is alive (`src/lib/alarmWiring.ts:19-20`).
- `drainAlerts` (`src/lib/store.tsx:218-246`) calls `alarms.drainActions()` (line 222), logs each tap, and calls `applyActions(cook, actions)` (line 229). If the cook changed it calls `saveCook(next)` (line 231).
- `saveCook` saves the cook and calls `sync()` (`src/lib/store.tsx:182-188`). `sync` calls `syncAlarms` (`src/lib/store.tsx:172`), which acknowledges done steps, sets Quiet, and calls `alarms.replaceAll(alarmsFromPlan(...))` (`src/lib/cook.ts:185-210`). So the cancel-all and reschedule from `plan.events` already happens on this path. The native `~snooze` alarm is in the stored set, so `replaceAll` cancels it with the rest (`AlarmScheduler.kt:23-33`).
- `applyActions` (`src/lib/cook.ts:223-245`):
  - sorts the actions by tap time (line 226), so order of tapping wins, not order in the queue;
  - skips a key that is unknown or already done (line 230);
  - **Done:** `doneStep(cur, key, a.at, keep)` (line 233). The time used is the time of the tap, not the time the app read it;
  - **+15:** `postpone(cur, key, a.at, 15, keep)` (line 233), also with the tap time;
  - picks `keep` with `keepServeIfCovered` (line 234; `src/lib/cook.ts:213-216`): keep serve if every food still gets its minimum rest (`holdsCover`, `engine/live.ts:215-220`), else move serve;
  - adds to `notice`: "Check the brisket: moved 15 min from the alert." and "Serve moves to 5:15 PM." when serve changed (lines 235-240).
- `postpone` calls the engine's `postponeStep` (`src/lib/cook.ts:125-133`, `engine/live.ts:165-185`):
  - a step during the cook (`phase`): `markStepDone` at `max(step time, now) + 15` (lines 177-179);
  - a pull: `extendCook(now, 15)` (lines 180-181);
  - a fixed step (fire, refill, serve): the plan does not change, a reminder is set (lines 183-184).

## 2. The in-app path

- **Done on Next up** (`src/screens/cook/CookScreen.tsx:130-154`): `doneStep(cook, next.key, clock())` (lines 132-133). The same function as the lock screen, with the time of the tap.
  - Less than 5 min off, or a pull, or a fixed step: saved at once (`src/lib/cook.ts:109`, `112-121`).
  - 5 min or more off on a step during the cook: both outcomes come back and the Keep serve / Move serve sheet opens (`CookScreen.tsx:139-153`). The sheet preselects Keep only when the holds cover it (`src/screens/cook/KeepMoveSheet.tsx:37`). That is the same rule as `keepServeIfCovered`.
  - Ends in `markStepDone` (`engine/live.ts:56-83`) or `markPullDone` (`engine/live.ts:116-126`).
- **There is no in-app +15 min.** The Next up card has Done and Adjust only (`CookScreen.tsx:279-288`). Adjust opens Cook options. The in-app ways to say "this is late" are:
  - **Not yet, check again in 30 min** (`src/screens/cook/CookOptions.tsx:78-81`, `172-191`): `keepServeIfCovered(keep => postpone(cook, next.key, now, 30, keep))`. This is the same call as the lock-screen +15 with 30 in place of 15. Only offered when Next up is a check step. No question is asked; the row says whether serve stays or moves.
  - **Running behind or ahead** (`CookOptions.tsx:70-73`, `113-153`): `shift` > `shiftRemaining` (`src/lib/cook.ts:135-138`, `engine/live.ts:23-53`). The user picks Keep or Move. This is the only action that moves every food (`engine/live.ts:34-50`).
  - **Back up to temp** (`CookScreen.tsx:156-169`): `pitUp` > `pitOutage` (`engine/live.ts:86-110`), with the Keep / Move sheet.
- A +15 tapped on the alert while the app is open goes through the same queue and `applyActions` as with the app closed (`alarmWiring.ts:20`).

What SPEC says (section 5, `SPEC.md:99-101`, `108`):

- Done on a check step: "That food's later phases move by the difference. UI then asks: shift the rest, or keep serve time (hold absorbs it)."
- Running behind: "Every not-yet-finished phase moves."
- Not yet: "That food only. Serve stays while every food keeps its minimum rest, else serve moves; the row says which."
- "After every change: re-run `derive`, cancel every scheduled alarm, schedule the new set."
- TECH-DESIGN: "Changes made without asking keep serve only if every food keeps its minimum rest" (`docs/design/TECH-DESIGN.md:280`).

SPEC does not say what happens to the other foods when Not yet or a late Done moves serve. "Shift the rest" in the Done row reads as "the rest of the plan moves" **(inference)**. The code moves serve only.

## 3. The difference

### What I expected and what I found

The report line from T-069 is right about the result and wrong about the place. The lock-screen path and the in-app path call the same functions with the same time and the same keep-or-move rule. They give the same plan. Both are wrong when serve moves.

The faulty lines:

- `extendCook` (`engine/live.ts:133-159`): changes `it` only (lines 148-157), then `derive(..., keepServe ? next.serveAt : next.serveAt + d)` (line 158). Other foods are not touched, so each one's hold grows by `d`.
- `markStepDone` (`engine/live.ts:56-83`): moves `ni` only (lines 75-79), then serve + delta (line 81). Same result.
- `shiftRemaining` does it right: it loops over every food (`engine/live.ts:34-50`).

### Scenario 1 (the T-069 test): brisket, wings, breasts; brisket's pull alert snoozed four times

The cook of mockup 12 (`src/test/cook.ts`). Serve 5:00 PM. As started: brisket off 3:40 PM, hold 60 min (minimum 30, limit 240). Wings on 3:15 PM, to 400F at 4:05 PM, off 4:55 PM, hold 5 (limit 30). Breasts on the griddle 4:40 PM, off 4:52 PM, hold 8 (limit 20). +15 tapped at 3:40, 3:55, 4:10, 4:25 PM.

Lock screen today, tap by tap (computed):

| After tap | Serve | Brisket off / hold | Wings off / hold | Breasts off / hold | New warnings |
|---|---|---|---|---|---|
| 1 (3:40) | 5:00 | 3:55 / 45 | 4:55 / 5 | 4:52 / 8 | Brisket rest drops to 45 min |
| 2 (3:55) | 5:00 | 4:10 / 30 | 4:55 / 5 | 4:52 / 8 | Smoker conflict (brisket 225F, wings 400F) |
| 3 (4:10) | 5:15 | 4:25 / 30 | 4:55 / **20** | 4:52 / **23** | Breasts hold 23, past 20 |
| 4 (4:25) | 5:30 | 4:40 / 30 | 4:55 / **35** | 4:52 / **38** | Wings hold 35, past 30. Breasts hold 38, past 20 |

Taps 1 and 2 keep serve (the brisket still has its 30 min minimum). Taps 3 and 4 cannot, so serve moves 15 min each time. The wings' and breasts' steps stay at 4:05, 4:20, 4:40, 4:52, 4:55 PM.

The same situation done in the app, today (computed):

| Path | Serve | Brisket off / hold | Wings off / hold | Breasts off / hold |
|---|---|---|---|---|
| Lock screen, +15 four times | 5:30 | 4:40 / 30 | 4:55 / 35 | 4:52 / 38 |
| In app, Not yet twice (3:40 and 4:10) | 5:30 | 4:40 / 30 | 4:55 / 35 | 4:52 / 38 |

The two plans are identical: same phases, same events, same warnings. So the in-app action has the same fault.

With the fix prototyped (section 5, option B; computed on a patched copy outside the repo):

| Path | Serve | Brisket off / hold | Wings off / hold | Breasts off / hold | Warnings |
|---|---|---|---|---|---|
| Lock screen, +15 four times | 5:30 | 4:40 / 30 | 5:25 / 5 | 5:22 / 8 | Smoker conflict, Brisket rest 30 |
| In app, Not yet twice | 5:30 | 4:40 / 30 | 5:25 / 5 | 5:22 / 8 | the same |

Events after the fix: wings crisp 4:50 PM, griddle on 4:55, breasts on 5:10, slice 5:10, breasts off 5:22, wings off 5:25, serve 5:30. The wings were already on, so their running phase ends later (to 400F from 4:05 to 4:50 in place of 4:05 to 4:20). The smoker conflict stays. It is real (the brisket is still on at 225F when the wings need 400F) and it appears at tap 2, before serve moves. It is T-069's banner to show.

### Scenario 2 (simple): one +15 on "Check the brisket" (wrap), tapped at 11:36 AM

| Path | Serve | Wrap step | Brisket off / hold | Wings, breasts |
|---|---|---|---|---|
| Lock screen +15 | 5:00 | 11:50 | 3:55 / 45 | unchanged, holds 5 and 8 |
| In app, Not yet (30) | 5:00 | 12:05 | 4:10 / 30 | unchanged, holds 5 and 8 |

Serve is kept in both, so nothing is wrong here. One +15 is not enough to show the fault. The fault needs serve to move.

### Done from the lock screen against Done in the app

- The tap's own time is used on both paths (`Receivers.kt:66,72`; `src/lib/cook.ts:233`; `CookScreen.tsx:132`). A Done tapped at 12:15 and read by the app at 2:00 is done at 12:15.
- Done 40 min late on the wrap step (computed): the lock-screen plan is identical to the app's Move serve plan, which is the one the sheet preselects. Serve 5:40, brisket off 4:20, hold 60. Wings hold **45** (limit 30), breasts hold **48** (limit 20). So the app's own Move serve has the same fault today.
- Done 150 min late on the wrap step: again identical to the app's Move serve. Wings hold 155, breasts hold 158.
- Done on a pull, 47 min late: identical on both paths. Serve stays 5:00, the brisket's rest drops to 13 min. No question on either path (Jason, 2026-11-15, `SPEC.md:65`).
- With the fix prototyped, Done 40 late gives serve 5:40, wings on 3:55 and hold 5, breasts hold 8, no warnings, on both paths.

Real differences between the two paths (none of them causes the holds):

1. The lock screen never asks. It takes what the sheet would preselect (`src/lib/cook.ts:234` against `KeepMoveSheet.tsx:37`).
2. +15 exists only on the alert. In the app the step is 30 min (Not yet), and only for a check step that is Next up.
3. One alert can carry several steps (same minute, or the Quiet summary). Done or +15 on it applies to every step in it (`src/lib/cook.ts:228`). In the app Done is one step at a time.
4. The lock-screen path writes a notice on Live cook. The in-app actions do not.

## 4. What "the same result" should mean

What cannot be made the same:

- The lock screen cannot ask Keep or Move.
- With the app fully closed, the plan cannot change until the app runs. Until then only the snoozed step rings again; the other foods ring at their old times. Closing that gap needs the engine to run without the app open (a headless task) or the native side to shift alarms itself. Both are much bigger and SPEC says "Never patch alarms one at a time". Not for 0.3.0 **(inference)**.

Options for what +15 from the lock screen does:

| | Option | Scenario 1 result | Notes |
|---|---|---|---|
| A | Today. That food +15; keep serve while holds cover, else serve moves; others stay. | Serve 5:30. Wings hold 35 (limit 30), breasts 38 (limit 20). | The bug. |
| B | Same rule for keep or move. When serve moves, the other foods move with it. Fix in the engine, so Not yet and Done > Move serve get it too. | Serve 5:30. Wings hold 5, breasts 8, brisket 30. | Recommended. |
| C | +15 never moves serve. The late food eats its own hold. | Serve 5:00. Brisket off 4:40, rest 0 (minimum 30), sliced as it comes off. Wings 5, breasts 8. | Breaks "no food comes off after serve" on one more tap. Against TECH-DESIGN line 280. |
| D | +15 only rings again. The plan is not changed. Ask Keep or Move when the app is next opened. | Unchanged plan until the app is opened and answered. | Needs a new question on open: new UI, not in the mockups. If the app is never opened the plan is never right. |
| E | +15 = Running behind +15 for every food. | Not the same thing: at a pull that is due, `shiftRemaining` does not move that food at all (`engine/live.ts:38`, computed: brisket stays 3:40). | Wrong tool. One food being late is not every food being late. |

SPEC supports B: no question for changes made without asking, serve kept only while every food keeps its minimum rest (`TECH-DESIGN.md:280`, `SPEC.md:101`), and "shift the rest" as the meaning of moving serve (`SPEC.md:99`). Running behind's own text says the same: "Serve moves to 5:15 PM. Holds stay as planned." (`src/lib/cookView.ts:200`).

**Recommendation: B.**

What "the other foods move with it" means, proposed (the rule Running behind already uses for each food, `engine/live.ts:36-48`):

- A food not on yet: all its steps move later by the same minutes. Its hold stays as planned.
- A food already on the heat: the phase it is in ends later, its later steps move. Its hold stays as planned. (Alternative for Jason: leave it alone and let the hold warning show. I recommend the first, because it matches Running behind and keeps the food hot to serve.)
- A food already off the heat: it cannot move. Its hold grows and the hold warning shows.

What the user sees under B:

- On the lock screen: as today. The alert goes away. It rings again 15 min after the tap with the same text. Nothing says serve moved.
- If the app is alive in the background: the plan and every alarm are updated at the tap.
- If the app is closed: the other foods' alerts ring at their old times until the app is opened.
- On opening the app: Live cook shows the notice, for example "Check tenderness: moved 15 min from the alert. Serve moves to 5:30 PM." with OK. The header shows serve 5:30 PM. The wings and breasts steps show their new times. T-069's banner shows the smoker conflict.

## 5. The fix (proposed, not built)

### Code

- `engine/live.ts`, about 20 lines:
  - one small helper that moves every food except one by `d` from `now` (the per-food loop of `shiftRemaining`, lines 36-48, skipping a food already off);
  - `extendCook` calls it when `keepServe` is false (after line 157);
  - `markStepDone` calls it when `keepServe` is false (before line 81). It needs to know `now`. Proposed: a last parameter `now = doneAt`, and `postponeStep` passes its own `now` (line 179), because there `doneAt` is 15 min in the future.
- `src/lib/cook.ts`: nothing has to change with the default parameter. `doneStep` passes the tap time as `doneAt`.
- Kotlin: no change.
- Database: no change. `ActiveCook` gets no new field.
- SPEC section 5: one sentence in the Done row and one in the Not yet row saying the other foods follow when serve moves.
- Optional, needs Jason's yes because it is UI copy: add to the notice which foods moved.

### Alarms

Already right on this path. `drainAlerts` > `saveCook` > `sync` > `syncAlarms` > `replaceAll` (`src/lib/store.tsx:231`, `182-188`, `172`; `src/lib/cook.ts:202-209`). After the fix the new set carries the other foods' new times with no extra code. `src/screens/cook/alertActions.test.tsx:58,73` already check one whole set per change.

### Regression tests (written failing first)

1. `engine/cook.test.ts`: **"serve moved for one late food: the other foods move with it and keep their holds"**. On the three-food cook, `extendCook(..., 30, false)` on the brisket and `markStepDone(..., +40 min, false)` on the wrap. Asserts serve moved by `d`, and for wings and breasts: hold equals the hold before, finish moved by `d`, no `HOLD_TOO_LONG`. Fails today: the holds are 5 + d and 8 + d.
2. `src/lib/cook.test.ts`: **"+15 from the lock screen four times: serve moves and every food keeps its hold"**. The T-069 scenario through `applyActions`. Asserts serve 5:30 PM, wings hold 5, breasts hold 8, no `HOLD_TOO_LONG`. Fails today: 35 and 38.
3. `src/lib/cook.test.ts`: **"lock screen and app agree"**, two cases.
   - Done: `applyActions(cook, [done at T]).plan` equals the plan of `doneStep(cook, key, T)` that the sheet preselects (`holdsCover(keep) ? keep : move`), for 4, 40 and 150 min late, and for a pull.
   - +15: four +15 from the alert give the same plan as two Not yet at 3:40 and 4:10.
   These pass today and after. They pin "same result" so the paths cannot drift later. The failing assertions are in tests 1 and 2.
4. `src/screens/cook/alertActions.test.tsx`: one case that the alarm set after a +15 that moved serve has the wings' and breasts' alarms at the new times. Fails today.

### Existing tests that pin today's behaviour

Found by running both suites against the prototype.

- `main`: `engine/plan.test.ts:145-152`, "wrapping 15 min late shifts only the brisket". It calls `markStepDone(..., false)` and asserts the wings do not move. It has to become two cases: keep serve (wings stay) and move serve (wings follow). All other engine tests (139 of 140) and all Jest tests pass with the prototype.
- T-069 branch (2a6bed1), three tests assert the text "Chicken wings holds 35 min, past its 30 min limit. Chicken breasts holds 38 min, past its 20 min limit.":
  - `src/lib/cook.test.ts`, "+15 min tapped on the lock screen can make a conflict: it is on the plan, and nothing rings for it";
  - `src/screens/cook/CookScreen.test.tsx`, "both at once are one banner with one OK, the conflict first";
  - `src/screens/cook/CookScreen.test.tsx`, "temps in the banner read in Celsius when that is the unit".
  After the fix the banner in that scenario is the conflict alone. Those tests need another way to make a long hold next to a conflict (the branch already has one for the brisket: pulled early, "holds 6 hr 10 min").
- The T-069 branch changes nothing on this path: `src/lib/cook.ts` only gains `warningsSeen`, `engine/live.ts` only gains `smokerConflicts`. Either can merge first. If T-069 merges first, its three tests change in this fix.

### Risks

- **A cook running when the fix is installed.** Its saved plan keeps whatever holds it has. The fix does not go back and re-time. Later changes use the new rule. No data change.
- **Actions queued for hours with the app closed.** Each is applied with its tap time, in tap order. The other foods are moved in the plan from the tap time, but their alerts rang at the old times in between. If the user followed those alerts and tapped Done on them, those Dones are in the queue too and are applied in order, so the plan ends up right. If the user followed them without tapping, the plan shows those foods later than they really are **(inference)**. Same as today for any missed Done.
- **Several +15 in a row.** Each tap is applied on the result of the one before. Computed for four taps: the others move 15 min on tap 3 and 15 on tap 4.
- **A food already on the heat is made to cook longer.** In scenario 1 the wings sit 45 min in the climb to 400F in place of 15. That is what Running behind does today. It is Jason's call (section 4).
- **Done early > Move serve.** Serve moves earlier and the others would follow earlier. A food cannot start before now. The lock screen never does this (an early Done always keeps serve, because holds only grow). In the app it needs a floor at now, or the others stay put for an early move **(inference; not prototyped)**.
- **Quiet alerts.** No change. The native +15 re-ring ignores Quiet (it is a fire, not a repeat: `Receivers.kt:25-29`). The app's set after the change holds steps inside the window as before (`src/lib/cook.ts:203-208`).
- **Undo.** A lock-screen Done is taken back whole, with the others' moves, because undo restores the saved plan (`engine/undo.ts:57-72`). +15 is not a Done and cannot be undone, as today.

## 6. Other things seen on this path (listed, not fixed)

1. **Back up to temp has the same gap.** `pitOutage` skips foods with no smoker phase left (`engine/live.ts:98`) and then moves serve by the lost time (line 109). Griddle and oven foods keep their times, so their holds grow by the outage. Pinned by `engine/plan.test.ts:154-159` ("smoker items only").
2. **The Keep / Move sheet does not show it.** Each card names one food only (`KeepMoveSheet.tsx:61,66`, `src/lib/cookView.ts:54-64`). Move serve reads "Serve 5:40 PM, later by 40 min." while wings and breasts go past their limits.
3. **Running behind does nothing to a food whose pull is due.** At or after the planned off time every phase has `end <= now` and `finish > now` is false, so that food is skipped (`engine/live.ts:38`, `48`). Computed: +60 at 3:40 PM leaves the brisket off at 3:40.
4. **A postponed step leaves a 1 min overlap.** `postponeStep` passes an unrounded time; `markStepDone` sets the phase before to end at it (line 74) and rounds the start of the next. Computed: smoke ends 11:51, wrap starts 11:50.
5. **The live rules do not re-apply the clear-pit rule.** A late brisket runs into the wings' 400F phase and the plan only reports the conflict. `derive` does not move the wings' climb. T-069 shows it; nothing solves it.
6. **The notice repeats.** Four taps give "Check tenderness: moved 15 min from the alert." four times and two "Serve moves to" lines (`src/lib/cook.ts:235-244`).
7. **The queue is emptied before the cook is saved.** `drainActions` clears it natively (`AlarmStore.kt:109-113`) and the cook is saved later (`src/lib/store.tsx:231`). A crash in between loses the taps. The comment at `store.tsx:225` covers only a failed read **(inference: small window)**.
8. **Done on a grouped alert marks every step in it done at the tap time** (`src/lib/cook.ts:228`). After Quiet the summary can hold several steps of different foods.
9. **Keep or move is decided over all foods.** `holdsCover` looks at every food (`engine/live.ts:215-220`). If any food is already under its minimum rest for another reason, every later lock-screen action moves serve.
10. **+15 on a fixed step** rings natively at tap + 15 exactly; the app's reminder is rounded to 5 min (`engine/live.ts:183`). Up to 2.5 min apart until the app runs.
11. **TECH-DESIGN line 242** still lists an Open button on the alert. It was removed (`SPEC.md:68`).
