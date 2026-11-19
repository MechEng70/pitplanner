# Backlog for the next version (after 0.3.0)

Jason, 2026-11-14: "we should keep a backlog for next version so we can triage." Anything that is not part
of 0.3.0 goes here, one line each, with its task in `TASKS.md` when it has one. Nothing here is scheduled or
decided until Jason triages it. New ideas that come up during the port are added here, not built.

## From Jason's cooks

| Item | Task | From | State |
|---|---|---|---|
| Low and slow for tough cuts: a brisket heated far faster than the plan (cut and thickness, a recommended smoker temp, re-timing on a temp change, re-timing from probes) | T-060 | Cook of 2026-11-14 | Four candidates, none decided; needs sourced numbers. Phone logs and the two Pit Boss charts still to be read with him. |
| A name of the user's own for a food ("Dad's brisket"), replacing the default label | T-062 | Cook of 2026-11-14 | Wanted; needs a mockup. The default label ("11.5 lb brisket") is in 0.3.0 as T-061. |
| Go back on the full timeline to set what was missed: tap a step, adjust it | none yet | Cook of 2026-11-14 | Next version (Jason, 2026-11-14). Taking back a step marked Done by mistake is not here: it is in 0.3.0 as T-063. Needs a mockup. |
| More than one smoker or griddle (Add a cooker offers only the kinds not switched on yet; someone may own two) | none yet | Review of fidelity PNG 17, 2026-11-15 | Next version (Jason, 2026-11-15). Touches Setup, Gear, the plan's cooker choice and rates per cooker. Needs a mockup. |
| New food: bacon on the smoker at 350F, 20 to 25 min, timer only, done by crispness, with checks at 15, 20 and 25 min (it can finish early in a hot spot) | T-083 | Jason, 2026-11-17, his measured times | After 0.3.0. Decide alongside the wings proposal (branch `worktree-agent-a00d9697f70d1c24c`): the same fixed 350F gap. Open: regular or thick cut; how three checks on one food work |
| New food: baked potato on the smoker at 350F, about 1 hr, done at 210F on a probe | T-083 | Jason, 2026-11-17, his measured time | After 0.3.0, with bacon. A timer estimate with a probe check, the same question as fish (T-071). Open: potato size, foil or bare |

## Planned before, not in 0.3.0

| Item | Task | State |
|---|---|---|
| Lane chart full screen | T-040 | Mockup first |
| A log of every alarm ring kept on the Android side, in the debug file | T-068 | Jason, 2026-11-15: a task for later |
| Running behind, Keep serve: name every food that would come off after serve and select Move serve then (today only the most-changed hold is named, as 0.2.0) | T-022 note | Jason, 2026-11-15: maybe a future update |
| Oven warming drawer: use it or drop it | T-041 | Jason decides |
| Home Assistant: sign-in, sensors, probes on Live cook, publish the cook, blueprint, suggestions, learning from probes, set-temp button | T-042 to T-055 | Plan in `docs/HA-INTEGRATION.md`; mockups first (T-042) |
| iOS readiness (interfaces only, no Xcode work) | T-056 | Depends on T-015, T-030, T-045 |
| Setup offers "Restore from a file" on a new phone's first screen | T-036 | Jason, 2026-11-16: not in 0.3.0 (a restore is reached from Gear after Setup) |
| Lock-screen taps re-plan with the app closed (headless JS), spike first | T-078 | Jason, 2026-11-16: 0.3.x, after 0.3.0 ships |
| Dial smokers with fixed presets. Preset lists already work in the engine and in "Enter it yourself" (`tempPresetsF`); what is missing is preset lists in the picker's catalog, one list per controller version. PB820SC manual presets: 200, 225, 250, 300, 350, 400, 450, 475, plus Smoke and High; some later units list 180 (sources from Jason: the Pit Boss 820 owner's manual, manualslib 751551, and the PB820SC control board page). An upgraded controller changes the step (a replacement board can turn a dial 820 into 180 to 500F in 5F steps), so the picker may need "pick by controller". Smoke and High are not temps: how they show is open. First real case for "pick by controller": Jason's own smoker, a Pit Boss Sportsman 820 with Wi-Fi (PB0820SPW) with a newer controller card that sets in 5F steps and reports PB850SPW2; a "Pit Boss Sportsman 820" catalog entry comes with this item (849 sq in, 21 lb hopper, 180-500F on the Pit Boss product page; main and upper rack split not sourced yet) | none yet | Jason, 2026-11-17: after 0.3.0 |
| Wings at 400F on a smoker that tops out lower: offer the method only when the smoker's max reaches its temp, greyed with the reason otherwise (as tri-tip's smoker sear does, T-075) | none yet | Jason, 2026-11-16: 0.3.x |

## iOS

Jason, 2026-11-17. Backlog only: no task yet, nothing scheduled. The Apple facts below are as he gave them;
check them against Apple's own pages before relying on them.

| Item | Task | State |
|---|---|---|
| iOS through a free Apple Personal Team: Xcode on Jason's MacBook, his own iPhone only. Limits of the free route: a build expires after 7 days, 3 apps per device, no paid capabilities. Friends' iPhones need the $99 developer program (TestFlight) | none yet | To confirm first: the MacBook's model and macOS version (which Xcode it can run) |
| First step, before any port: a throwaway app on the free team that schedules one AlarmKit alarm (iOS 26 and later) and rings with the phone locked. If AlarmKit needs a paid capability, record that here and stop | none yet | Not started. Nothing else on iOS begins until this has an answer |
| Native work for iOS, behind the existing TypeScript interfaces: `pit-alarms` (AlarmKit) and `pit-share`. `pit-legacy` is not needed (there is no 0.2.0 on iOS to import from) | none yet | After the first step. T-056 (iOS readiness, interfaces only) is the groundwork already listed above |

## Maintenance (has a date, not a version)

| Item | Task | State |
|---|---|---|
| Clear the build-tool Snyk findings (SE-001) | T-057 | Deadline 2027-02-01 |
