# Handoff (2026-11-16, end of the twenty-first session: twelve tasks merged, beta.1 not yet built; the emulator block is next, all before Friday)

Read SPEC.md and CLAUDE.md first, then `docs/design/TECH-DESIGN.md` and the task you are given in
`docs/design/TASKS.md` (phases and order: `docs/design/WBS.md`). This note is what a fresh session needs on top.

## Restart, twenty-second session (written Monday 2026-11-16, end of the twenty-first; read this first)

**Running notes, twenty-second session (Tuesday 2026-11-17; rewritten into a new Restart section at the end):**
- **Kotlin floor is 117** (Jason): pit-alarms 68, pit-share 40, pit-legacy 9. The "Kotlin 68" below was
  pit-alarms alone. `tools/test-android.sh` now prints the count per module from Gradle's result files and
  whether each "ran" or is "up-to-date (results from <time>)". Report that line with every gate; it must
  not drop below 117.
- **Before the 0.3.0-beta.1 build:** one gate with the Android tests forced to run,
  `ANDROID_TESTS_FORCE=1 npm run check` (adds `--rerun` to the test tasks only), so the release is backed by
  a fresh run. The line must read "ran" for all three modules.
- **Beta.1 freeze (Jason):** once 0.3.0-beta.1 is built, nothing merges to `main` until Sunday's readout
  except fixes for problems that block the test, each with his yes. Everything below merges first.
- **Agents (Jason's rules, in `CLAUDE.md` and here):** check an agent's files against running work before
  starting it and put the list in the report; fix agents run only their own test files, the full gate runs
  on `main` alone; one gate rerun is allowed only if every failure is a timeout, and both runs are reported.
- **Fable is at 0%** (Jason, 2026-11-17): the Opus-only rule for agents is off; `CLAUDE.md`'s model rule holds.
- T-057 is held until after 0.3.0. Review finding 6 is approved as built (SPEC, with a pinning test).
- **Jason's answers of 2026-11-17** (`docs/proposals/2026-11-17-waiting-on-jason.md`, each with an Answer
  line): T-033 and T-031 are done together on Sunday afternoon after the readout, on his wife's phone
  (`docs/after-readout-checklist.md`); the release WAITS for them and is Monday 2026-11-23 (second answer,
  replaces "release the day the readout passes"); the Samsung tester is asked by him; looks are one stacked
  review; mockup 16 closed (B); backlog after 0.3.0; icon and two T-060 facts still open.
- **Pit Boss 820 (Jason, 2026-11-17, option A for 0.3.0):** the 820 entry becomes not verified with its step
  blanked; the Saturday fixture moves to `pitboss-sportsman-850`, the entry his Gear uses; the engine tests'
  private copies and the mockups stay; the blank "Pit Boss 850" entry stays. His body may be an 820 with a
  replacement board that reports PB850SPW2 (180 to 500F, 5F steps); unconfirmed until he reads the data plate;
  it does not block beta.1 (same size and hopper numbers). An Opus agent is building it. "Dial smokers with
  fixed presets" is in `docs/design/BACKLOG.md`.
- **Cook-finished device test fails 3 lines on a test rig fault:** the dev seed serves on any minute, so the
  planned minutes vary with the clock. Jason's decision: seed with a fixed serve time on the 5 minute grid so
  the expected minutes are constant. The main session is fixing it.

`main` is committed and clean, **the last few commits not pushed** (Jason pushed during the session; check `git log origin/main..main`). The gate passed on
the last code change (T-075's three cases: engine 218, gate self-tests 153, Jest 882, Kotlin 68 in
Gradle; Snyk 26 projects, none skipped); a later commit that touches only this file is not gated. No agent is running, no worktree, no branch but `main`. Emulator and Metro are stopped. The phone was not touched this session. `dashboard.html` (local,
never committed) was restyled in the medtechcto.com palette: the keeper edits only its `D` data block.

**Usage (Jason):** Fable at 94% on 2026-11-16 (93% in his restart prompt): every agent on Opus; at 95% the
main session moves to Opus at the next task boundary. The session limit was at 85% at the end.

### 1. First thing next session: the emulator block (all before Friday 2026-11-20)

One job at a time, 115% only. The dev build on the emulator is OLDER than `main` (T-068 added native code):
the first device run must build (no `--no-build`).

1. `DEVICE_SCALES=1.15 tools/device/run.sh --only live-warnings` (builds first). It now also checks T-081:
   the banner's line break (the dump should show `&#10;` between the two sentences; not yet seen on a
   device, fix the grep if the dump differs) and the header's end and first banner top in px for On plan,
   Ahead and Behind (it waits 4 minutes for Behind; the pill states are assumed from the pictures). Then
   re-shoot `docs/fidelity/rn-12-live-warned.png` and `rn-12-live-conflict.png` from `out/1.15/` and show
   Jason. Also look at Cook finished's header (same AppBar, now with the subtitle on its own line).
2. Battery history across a reboot: does `dumpsys batterystats --history` keep the deep idle entries from
   before a reboot? (`adb reboot` ends the headless emulator: `avd.sh stop` and `start`.) Report to Jason;
   Sunday's "deep idle before the ring" column depends on it.
3. The +15 pass line of `docs/t037-checklist.md`: on a running cook with the app swiped away, +15 on the lock
   screen: the step rings again 15 min after the tap (`~snooze`), no other alarm moves until the app opens,
   then one notice, serve moves and the others follow, alarms set once. Correct the checklist first if the
   emulator shows otherwise. Check the ring log (T-068) in the debug file while there: one ring with the app
   killed shows with planned and actual times, and a `snooze` source.
4. Security finding 1 on the alpha.5 release build (it reports 0.2.0 / 200999).
5. Build `npm run release -- --version 0.3.0-beta.1` (about 20 min; needs a clean tree and the version
   commit, `docs/RELEASING.md`): must end `cert ok` and `app config ok: version 0.3.0-beta.1, versionCode
   300301, io.github.mecheng70.pitplanner, variant production`. Then on the emulator: Gear's version line
   and a Send to developer file read 0.3.0-beta.1 / 300301; the update check offers betas; `aapt2 dump
   badging` has no `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`; the two backup
   attributes are in the manifest; a `bmgr` backup and restore of the rules (the 0.2.0 import marker comes
   back with the database).
6. `tools/device/upgrade020.sh check release/pitplanner-0.3.0-beta.1.apk` (the emulator upgrade over the real
   0.2.0 APK), then `tools/device/locked-reboot.sh` on beta.1 (clears Pit Planner's data on the
   `pitplanner-lock` emulator only).
7. Device checks still owed for things merged today, none seen on a device: T-075 (Food details for tri-tip
   with no griddle, the import box, the lane with a dashed hold for the climb), T-036 screen (Gear rows,
   export, restore through the file picker, a refusal), T-076 (+15 with two foods and the notice), T-077.

### 2. Friday and Saturday (T-038's phone check and T-037)

`docs/t037-checklist.md` is the plan, agreed with Jason: Friday the beta.1 install over 0.2.0 on his phone
(he screenshots 0.2.0 first, a short 0.2.0 cook is carried across, then ended and discarded), Saturday the
staged cook with no food (brisket 10 lb so the first ring is 7:50 AM, wrap check 12:15 PM, reboot 12:05 PM),
Sunday the readout table. Every phone action is listed there and still needs his yes on the day.

### 3. Waiting on Jason

Jason answered the questions page on 2026-11-17: `docs/proposals/2026-11-17-waiting-on-jason.md`, every item
has an "Answer (2026-11-17)" line. What is still open:

- **One stacked look review after the re-shoots** (Jason, 2026-11-17): every look owed is in it, including
  T-081's header and the line break (`rn-12-live-warned.png` and `rn-12-live-conflict.png` were re-shot on
  2026-11-17, `live-warnings` passes at 115%) and the two-button lock-screen alert on the phone against
  mockup 14.
- **T-031 and T-033 together, Sunday afternoon 2026-11-22 after the readout; the release is Monday
  2026-11-23 and waits for them:** INSTALL.md with 0.3.0-beta.1 on his wife's phone (an upgrade over her
  0.2.0, with his yes), then the two-phone share test through Gmail and Drive. One list:
  `docs/after-readout-checklist.md` (three places say "to confirm with Jason").
- **The Samsung locked reboot (P4, T-072):** he asks the tester (a draft request is on the questions page). If
  the tester declines, the release notes say it was not tested (draft line in
  `docs/release-notes/0.3.0.md`).
- **App icon:** not answered. A close / B he will check it. Also open: what the smoker went back up to 250F for
  at the end of the 2026-11-14 cook, and which Pit Boss probe pairs with which Chef iQ probe (T-060).
- Phone yeses are given on the day, action by action.

Closed on 2026-11-17: mockup 16 (B, the repo copy is the source); T-036's four strings (A, as built); T-022's
stepper; T-064 (the menu stays on Plan); T-081's wings source; T-023's rate card wording; the GitHub repo
name; T-075's Plan warning sentence; parity D2, D9, D10, D11; T-038's timing (the release waits, Monday 2026-11-23).
The backlog triage and every "later versions" item wait until 0.3.0 has shipped. The griddle sub-case (a
shared smoker-sear tri-tip with a griddle) is built and merged: "Tri-tip will be seared on the griddle." in
the same box style (SPEC). His smoker is the Pit Boss Sportsman 850 (PB850SPW2); the check of
`data/cookers.json` and SPEC against it is with the main session (see the Pit Boss 820 note above).

- Push state: `origin/main` moved to `5c3576b` at 2:16 PM on 2026-11-16 by a push from this working copy.
  The main session ran no `git push` and no agent transcript holds one, so it was Jason's own. Checked
  then: `git log origin/main --all -- keystore.properties dashboard.html` is empty (neither file is in any
  pushed commit; both are ignored).
- Done since this section was first written: the FSIS chart is cited for wings, breasts, brisket and
  tri-tip's other two methods (he confirmed the page in his browser; the sources check is scoped to the
  topics such a source covers, `scope: 'covers'`); the debug screen's "Alarm rings" line is approved as
  written; "apple cider vinegar" and the wings griddle sentence are in.

### 4. Done in the twenty-first session (all on `main`, each through the gate)

Merged: T-069 (hold note inside the food's entry), T-074, T-034 thin tests, T-036 logic and its screen
(Export my data, Restore from a file, `expo-document-picker`), T-035 security fixes, T-079 (a lock-screen
tap is never lost), T-076 (serve moves and the others follow; Done early rule; the lock screen never moves
serve earlier), T-077 (oven hold raised to 140F), T-075 (tri-tip smoke then sear on the smoker), T-081
(header line, banner line break, wings pull wording), T-068 (alarm ring log). Device tests at 115%:
`plan-sheets`, `shared` (rewritten: files from Download by MediaStore link, own-cache open refused),
`shared-soon` (new, T-073 closed), `live-warnings` (new, before T-081). New dev seeds `conflict` and
`warned`. Recorded: T-078 (headless JS, 0.3.x, spike first), T-080 (Chef iQ over Bluetooth, 0.5.0), the HA
plan (a pasted long-lived token for 0.4.0; T-043 and D-9 dropped), T-037 as a staged cook.

### 5. Traps found today

- `adb shell am start` cannot grant a `content://com.android.externalstorage.documents/...` link (shell has
  no access); a MediaStore link (`content://media/external/file/<id>`) with
  `--grant-read-uri-permission` works. A Maestro flow floods the device log: read `logcat` before the next
  tap.
- A worktree with a symlinked `node_modules` cannot add a dependency: that agent runs its own `npm ci`.
  After merging a dependency change run `npm ci` on `main` (other agents' links see it change under them).
- When removing a worktree, delete only the git-ignored extras (`node_modules` link, `.expo/`,
  `expo-env.d.ts`); `nativewind-env.d.ts` is tracked.
- Agents must not edit `SPEC.md` or `TASKS.md` in parallel: they put the text in their report and the main
  session applies it at merge.
- A JSON data edit: validate before writing the file (a bad write to `data/cookers.json` was caught by Jest).
- Chrome headless renders a mockup source for a PNG: strip `<x-dc>`, `<helmet>` and the `support.js` script,
  then `--headless=new --force-device-scale-factor=2 --window-size=390,844 --screenshot`.

## Restart, twenty-first session (written Monday 2026-11-16, 12:20 PM, end of the twentieth)

`main` is committed and clean, 1 commit ahead of `origin/main` (this handoff; Jason pushed the rest during the session), **not pushed**. The last gate pass
was on `45a8b71`; the two commits after it are docs only (`CLAUDE.md`; then this file, `docs/alarm-testing.md` and two reports in `docs/proposals/`). Emulators and Metro are
stopped. The phone is put back (dev build as before the session; notifications left on for it). No agent is
running. Five agent branches are built and **not merged**; their worktrees are under `.claude/worktrees/`.
Reports for Jason in `docs/proposals/`:
`2026-11-16-security-pass.md` and `2026-11-16-lock-screen-actions.md` (committed), and
`2026-11-16-data-export-ui.md` (that one is on the T-036 branch).

Read `CLAUDE.md` first: it has a new section, "Models and agents" (parallel agents in worktrees, merge one
at a time with the gate after each, at most 5, the usage rule). **Fable was at 83% at 12:10 PM: every new
agent starts on Opus.** The main session stays on Fable until Jason says 95%.

### 1. Branches waiting to merge, in this order

Merge one at a time (`git merge --ff-only` where it applies, else a normal merge), run `npm run check` after
each, then `git worktree remove` and `git branch -d`. None of them has been through the gate or seen on a
device. Each agent's own runs passed (Jest, engine, gate self-tests, ESLint, Prettier).

1. **T-069** conflict banner on Live cook: `worktree-agent-a31bfed3313b87e83` at `7d1af5e`.
   - Before merging, one more change on the branch (an Opus agent or by hand): Jason's hold line with the
     note inside the food's entry, "Long hold: brisket 5 hr 10 min (limit 4 hr, keep above 140F), chicken
     wings 35 min (limit 30)." Keep "chicken breasts" (not "breasts"). The single-food wording on Plan stays
     "Long hold: brisket 5 hr 10 min, limit 4 hr. Keep it above 140F." unless he says otherwise: ask if unsure.
   - At merge: `tools/device/run.sh` line 803 needs the new sentence, "Smoker conflict: 2 lb chicken wings 1
     at 225F and 2 lb chicken wings 2 at 350F at the same time." (check the `clash` seed is that menu).
     Update `docs/parity.md` rows D8, D9, T16. It adds `warningsSeen` to the running cook (one JSON column,
     no migration). Three of its tests pin holds of 35 and 38 min that T-076 below will change.
2. **T-074** wording: `worktree-agent-a0661260bd07e7911` at `c24159d`. Serve alert "Time to serve" with the
   menu; "More weight" / "Less weight", "More breasts"; Cook options "Earlier" / "Later".
   - It and T-069 both export `inSentence` from `engine/labels.ts`: expect a small merge conflict there.
   - Record in its TASKS entry: the Quiet time summary keeps "Serve." (Jason: a step list, like the
     timeline). `docs/HANDOFF.md` history still says "More quantity" in one place: leave history alone.
3. **T-034** thin tests: `worktree-agent-a4155e1de76922be5` at `057000d`. 12 of 14 rows closed, tests only,
   in new `*.parity.test.*` files. `ParityTest.kt` (rows T6, T14, T15) has never been run: the gate's Android
   step runs it. Also drop "by-weight" from the SPEC wording about Cook history rate cards (row T7; Jason:
   fine as built).
4. **T-036** data export and restore, logic only: `worktree-agent-a81dbb264adafa644` at `ef18b99`. No screen
   is wired. Its screen proposal (`docs/proposals/2026-11-16-data-export-ui.md`) waits for Jason's answers:
   where Export and Restore go, how a restore starts, replace or merge, the file's extension, the caps.
5. **T-035 security fixes**: `worktree-agent-afcbb0a3e349b61c1`. at `8d5f7a3` (8 commits: findings 1 to 6, 8, 10, the TASKS entry, and the test
   fixture links). Its agent's own runs pass with that last commit (gate self-tests 153, engine and Jest);
   the Kotlin tests compile but have never run. Delete the `node_modules` link in its worktree with the
   worktree. At merge, from its report (kept in the T-035 entry on the branch):
   - Run `npm run test:android` (new `OpenedPlanTest` cases), then the gate (Semgrep and Snyk Code have not
     seen the new Kotlin or scripts).
   - Device test `shared` in `tools/device/run.sh` must change: its three opens of
     `file:///data/user/0/$PKG/cache/...` are now refused by design. Push the files to `/sdcard/Download/`
     and open them through the Files app as `locked-reboot.sh` does; keep one own-cache open as the
     regression (expect "Could not read that file." and the log line `PitShare: open refused ...`).
   - Build `npm run release -- --version 0.3.0-beta.1`: it must end with `cert ok` and `app config ok:
     version 0.3.0-beta.1, versionCode 300301, io.github.mecheng70.pitplanner, variant production`. Then on
     the emulator: Gear's version line and a Send to developer file read 0.3.0-beta.1 / 300301; `aapt2 dump
     badging` shows the permission list without `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`,
     `WRITE_EXTERNAL_STORAGE`; the two backup attributes are in the manifest.
   - Choices its agent made that Jason has not seen: the alarm store is EXCLUDED from backup (a restore on a
     new phone would ring every past alarm as missed), the 0.2.0 files are included, smoker temp from a
     file clamped to 150 to 700F, serve date outside 2000 to 2099 refused, the log line keeps the exception
     class and a fixed reason with no message text, storage permissions blocked in the dev build too. Show
     him the permission list (in its T-035 entry and TECH-DESIGN section 10 on the branch).
6. Then build **T-075** (below), on Opus, in a worktree.

### 2. Jason's decisions from 2026-11-16 that are not in TASKS yet

Write these into TASKS as the first step of the next session (new entries T-075, T-076, T-077; notes on
T-069, T-074, T-034).

- **Review answers 1 to 10.** T-069: (1) banner approved; (2) and (3) hold warnings without a verb, as
  above, the same wording on Plan, the banner at most two sentences (the conflict, then the holds); (4) the
  lane chart note keeps the conflict's own stretch; (5) a warning hidden with OK stays hidden; (6) two OK
  buttons on screen are fine. T-074: (7) (8) (9) approved as built. T-034: (10) the ribs history card is fine
  as built; drop "by-weight" from the SPEC wording.
- **T-075 tri-tip with no griddle (small, 0.3.0).** A third method in `data/foods.json`, "Smoke, then sear
  on the smoker", data only: smoke at the plan's smoker temp to about 120F as the reverse method does
  (source: Louisiana Grills reverse-seared tri-tip, smoke at 225F until 5F below target, about 75 min to
  115F, https://louisiana-grills.com/blogs/pork/reverse-seared-tri-tip); off the heat while the smoker
  climbs to 500F (450F if the smoker tops out lower), 15 min preheat (source: Traeger smoked tri-tip,
  https://www.traeger.com/za/en/recipes/smoked-tri-tip); sear 4 min per side at 500F to 130-135F, then rest
  10 to 15 min (source: Traeger, https://traeger.com/au/en/recipes/smoked-tri-tip). Cite them as given by
  Jason, 2026-11-16. It is the fallback at import for a receiver with no griddle; the "No griddle set up."
  box reads "Tri-tip will be seared on the smoker, or add a griddle in Gear." The import checks every
  cooker a method's steps need (today only the main one: `mapToCookers`, `src/lib/sharedPlan.ts`), with a
  tri-tip no-griddle test. Add food picks the first tri-tip method the user's cookers can fully do. In Food
  details a method whose steps need a missing cooker is greyed out with "Add in Gear", like the Cook on
  chips. The Plan warning names the other method instead of "move it to the smoker" (his earlier wording for
  it: "Tri-tip's sear needs a griddle. Add one in Gear, or pick Smoked brisket-style in Food details.";
  with the new method the method to name is the smoker sear: confirm the sentence with him). The 500F climb
  conflicts with low foods the way wings do; that is fine. **Also in T-075:** with no smoker in Gear a food
  gets "needs a smoker" once per smoker step (twice for brisket, and a duplicate React key in
  `FoodEdit.tsx`): fix it. It touches `engine/plan.ts`, `sharedPlan.ts`, `FoodEdit.tsx`: build it after
  T-069, T-074 and the security fixes are merged.
- **T-076 serve moves for one food, the others follow (must-fix, 0.3.0).** Report:
  `docs/proposals/2026-11-16-lock-screen-actions.md`. The lock screen and the app give identical plans; the
  fault is in the engine (`engine/live.ts`, `extendCook` and `markStepDone`: they move one food and serve
  and leave the rest, so the other holds grow; only `shiftRemaining` moves every food). Jason: (1) approved,
  the others follow; (2) a food already on the heat cooks that much longer, as Running behind does; (3) the
  Live cook notice reads "Serve moved to {time}. The other foods moved with it."; (4) fix Back up to temp
  (`pitOutage`) in the same change; (5) Done early with Move serve: PROPOSE the rule with tests before
  building (his rule: serve no earlier than the slowest other food can still be ready from now; otherwise
  keep serve). Closed-app limit: EVALUATE the native side shifting every later alarm by the same minutes
  when a lock-screen tap moves serve, with the app re-planning on next open; report the cost before
  building; wanted for 0.3.0 if small. Build after T-069 merges. Regression tests that fail first,
  including one pinning that lock screen and app agree.
- **T-077 oven hold below 140F.** Clamp to 140F at the 0.2.0 import and on load, and say so in the import
  notice: "Oven hold raised to 140F, the safe minimum." Test it. (Parity row T18.)
- **Security pass** (`docs/proposals/2026-11-16-security-pass.md`), his answers: finding 1 fix the release
  script so `--version` reaches the Gradle build, must be done before any beta, test: a release built with
  `--version 0.3.0-beta.1` reports that version and versionCode and its update check offers betas;
  finding 2 keep backups on with explicit rules that include the database, add a 0.4.0 requirement that the
  HA token store is excluded, fix the TECH-DESIGN claim; findings 3, 4, 5 approved; finding 6 remove the
  three unused permissions if nothing depends on them and show him the list; findings 7 to 10: pin the
  update check to the GitHub releases URL, fix the doc drift, leave the rest. Finding 1 is confirmed from
  the APK (`release/pitplanner-0.3.0-alpha.5.apk` carries version 0.2.0, versionCode 200999, "Pit Planner
  dev" in `assets/app.config`); not yet looked at on the emulator.
- **Usage rule** (in `CLAUDE.md`): Fable at 80%, new agents on Opus (in force); at 95% the main session
  moves to Opus at the next task boundary; the all-models weekly limit at 90%: finish the task, commit,
  update HANDOFF, stop for the day.

### 3. Done today (all on `main`, each through the gate)

The phone block (`docs/alarm-testing.md`, three sections dated 2026-11-16). Closed: T-016, T-025, T-029,
T-030, T-059, T-065, T-067, T-072. T-073 is merged and gated; its emulator check is still owed (below).
New address pitplanapp@gmail.com. Alert buttons are two, Done and +15 min. Turkey: 18 min per lb at 275F
and an info line above 16 lb. Hold note "Keep it above 140F." `tools/device/locked-reboot.sh` (required
before every release, `docs/RELEASING.md` 5b) passes on 0.3.0-alpha.5 and was shown to fail on a throwaway
build with the restore broken (three FAIL lines, exit 1; built in its own worktree, deleted). Versions:
0.4.0 is Home Assistant phase 1, 0.5.0 is fish, cooker choice and the alarm log (WBS, TASKS).

### 4. Running, blocked, and the next three steps

Nothing is running. Blocked on Jason: the T-036 screen proposal; his look at the two-button alert on the
phone; T-031 with two phones; the Saturday cook (T-037).

Next three steps:
1. Write section 2 into TASKS (T-075, T-076, T-077 and the notes), commit, then do the T-069 follow-up
   (the hold note inside the food's entry) on its branch with an Opus agent.
2. Merge the five branches in the order of section 1, the gate after each, deleting each worktree and
   branch. Stack anything Jason has to look at into one list.
3. Emulator, one job at a time: the T-073 check with the real Android date dialog (a plan under an hour
   out, the note, Pick a date opens on today, pick today, the note goes and the plan keeps today; a picture
   of the sheet with the note for mockup 11); look at security finding 1 on a release build, then build
   `0.3.0-beta.1` with the fixed script and check its version and update check; rerun
   `tools/device/locked-reboot.sh` on it. In parallel, Opus agents for T-075, T-076 (report parts first)
   and T-077. Held until then: T-064 (after T-069), fidelity sheets 08 to 10, README screenshots.

### 5. Rules and traps added today

- Play a sound three times when Jason has to act: `for i in 1 2 3; do paplay
  /usr/share/sounds/freedesktop/stereo/complete.oga; done`.
- A Sonnet agent keeps `dashboard.html` (local, never committed): send it short notes; it also has a
  "Later versions" group and a "Resolved today" group now. Start a new keeper in a new session.
- adb cannot grant or revoke permissions on the OnePlus: Jason switches them in Settings.
- `adb reboot` ends the headless emulator: restart with `avd.sh stop` and `start`.
- Never `pkill -f` or `pgrep -f` with a pattern that is in your own command line (it killed my own command
  three times): write the pattern as `'name[.]sh'` or find the process by port (`ss -ltnp`).
- A deliberate break or any throwaway build goes in its own worktree beside the repo (with its own
  `npm ci`), never in the main working tree; an APK signed with the release key is installed on
  `pitplanner-lock` only and deleted right after.
- The only place data is cleared: `tools/device/locked-reboot.sh`, Pit Planner's data on the
  `pitplanner-lock` emulator only.
- With Metro bundling or several agents running tests, the first gate run can fail step 4 on Jest 5 s
  timeouts; run it again with nothing else running. Do not raise the timeout.
- Snyk: from the fourth run on 2026-11-16 its monthly-limit notice no longer prints and its output is boxed
  summaries. A full run reads "Projects tested: 26 projects", "Open: 0", "Ignored: 2" (the two `.snyk`
  entries) and the gate's own line "Snyk coverage: all 26 projects tested, none skipped". A throwaway
  project outside the repo proved it still flags an old lodash (7 high) and a planted command injection.
- Files that are generated from the engine and must be regenerated when a planned item gains a field:
  `UPDATE_DEVICE_FIXTURES=1 npx jest src/db/fixtures`.

## Restart, twentieth session (written Sunday 2026-11-15, end of the nineteenth; read this first)

Everything is committed on `main`; the gate passed on it (five runs in the nineteenth session, Snyk's
monthly-limit notice in each, scans complete). `main` is ahead of `origin/main` by the T-034 commits unless
Jason pushed (my `git push` is blocked by the permission system: he runs `! git push origin main`). Emulators
and Metro are stopped. No agents, worktrees or branches. The working rules of the sections below still hold.

**Done in the nineteenth session:** device test `turkey` (T-059, 115% only by Jason's choice); T-037 prep
(`AVD_API=34|35`, `alarm` passes on Android 14, 15, 16); T-034 review written (`docs/parity.md`), SPEC wording
edits, five missing tests; new tasks T-069 (conflict banner on Live cook) and T-070 (the receiver picks
cookers), both new UI that needs Jason's OK on wording and design before any code.

**Twentieth session, in this order (Jason: phone work first thing in the morning):**
1. Phone block. List every action and wait for his yes; reboots need him there.
   a. Rebuild and install the dev build on the phone (data backed up and put back by `run.sh --phone`).
   b. T-029, his idea: make a plan on the phone, he shares it to the computer, check the `.pitplan` file.
   c. T-065: Send to developer with a real email app; the file arrives and reads right.
   d. T-016 phone half and T-025: test alert in Doze, lock-screen alert (a picture for mockup 14).
   e. Parity P1 to P3: reboot with the phone locked on the new build; an unanswered step's repeats in Doze;
      a permission taken away during a cook.
   f. T-017 check on the phone. T-031 (two phones) only if the second phone is at hand.
2. His answers still open: parity D2, D9, D10, D11 (D4, the lane chart, is settled: keep as built); wording for T-069; design for T-070; the turkey
   picture (`tools/device/out/turkey-115.png`); "More quantity" for the turkey weight stepper.
3. Then, without the phone: T-069, T-070 once approved.

**Sessions after that (a guess, one line each; the dashboard has the same list):**
- 21: finish T-034: tests for the parity 1b rows he picks, fidelity sheets for mockups 08 to 10, the full
  device pass at 115% and 130%.
- 22: T-035 security pass, T-036 data export, the rest of T-064.
- 23: T-066 user README with screenshots, the small open points (Serve alert "Serve Serve.", turkey at 275F),
  INSTALL.md on his wife's phone (his).
- T-071 fish (salmon, sea bass, catfish; Jason, 2026-11-15): not placed yet. Ask him whether it is in 0.3.0
  and for his sources and answers (the task lists the questions).
- His: T-037, a real Saturday cook on the new build (earliest Saturday 2026-11-21). It sets the earliest date.
- 24: T-038 upgrade test over 0.2.0 and the first GitHub release, with him step by step. `npm run
  snyk:monitor` is part of the release and is held until 2026-12-01 (the monthly limit).

## Restart, nineteenth session (written Sunday 2026-11-15, end of the eighteenth)

Everything is committed on `main` and pushed (Jason pushed once himself, then allowed the push at the end of
the session). The gate passed on this `main`. Emulator and Metro are stopped. No agents, no worktrees, no
branches besides `main`. The sections below are history; the working rules and traps of the sixteenth
session's "Restart" (items 2 to 4, 6 to 8) still hold.

**Done in the eighteenth session (all on `main`, each through the gate):**
- **T-067** fast test cook: `src/lib/fastCook.ts`, dev link `pitplanner://dev/plan?seed=fast` (`&x=<n>` for
  another speed), device test `fast-cook` (240 times, saves a picture at every step and alert to
  `tools/device/out/fast-cook-N.png`). Emulator only (Jason); he approved the pictures.
- **T-059** whole turkey: in `data/foods.json` with cited sources, the 225F floor issue, its own "Unusual
  rate" range from 0.33 hr/lb. Smoker flame icon, no size warning (changed 2026-11-16: an info line above 16 lb), rest 30 / 20. Not yet seen on a device.
- **Prep steps** on every food are plain reminders ("Prep the brisket."), Jason's wording.
- **T-065** tap the address to copy it (`expo-clipboard`, `src/platform/clipboard.ts`); dev build rebuilt and
  on the emulator; `followups` passes at 115%; Jason approved `rn-debug-copied.png`.
- **T-033** his answers are in INSTALL.md and RELEASING.md; TECH-DESIGN lists `sendFile` and the clipboard.

**Gate facts:** as below (Snyk prints its monthly-limit notice in every run and still scans all 26 projects;
five runs this session; stop and tell Jason the moment that step fails or skips; no `npm run snyk:monitor`
before 2026-12-01).

**Jason's rule (2026-11-15):** "You should be deleting things you don't need anymore." After an agent's work
is merged and gated, remove its worktree and branch. All leftover branches were deleted with his yes.

**Nineteenth session (2026-11-15, evening), both on `main` and gated, not pushed:**
- Device test `turkey` (T-059) passes at 115%; Jason chose 115% only. His look at
  `tools/device/out/turkey-115.png` is open.
- T-037 prep: `AVD_API=34|35` for `avd.sh` and `run.sh`; `alarm` passes on Android 14, 15 and 16
  (`docs/alarm-testing.md`). A new emulator fails its first run once (dev menu on first launch).
- Jason's idea for T-029: put the dev build on his phone, make a plan, he exports it to the computer, the
  file is checked. Part of the phone block; list the actions first.

- T-034: `docs/parity.md` written (about 170 claims; open rows in its section 1). Not done: Jason's
  decisions on 1a, the SPEC edits, fidelity sheets 08 to 10, the full device pass.

**Next, in this order:**
1. (done) Turkey device test.
2. (done) T-037 prep.
3. Phone (list every action, wait for his yes): rebuild and reinstall the dev build, T-016 phone half, T-017
   check, T-065 Send to developer with a real email app, T-031 with two phones.
4. T-034 parity review, T-035 security pass, T-036 data export, T-066 user README, T-064, T-038 upgrade test
   and cut 0.3.0 (the first GitHub release is done with Jason step by step).
5. Small open points for him: the Serve alert reads "Serve Serve." (title and text); turkey at 275F plans
   21.7 min per lb against his 15 to 20.

## Restart, eighteenth session (written Sunday 2026-11-15, 5:15 PM)

Everything is committed on `main`, 55 commits ahead of `origin/main`, **not pushed** (Jason pushes when he
says so). The gate passed on this `main`. Emulator and Metro are stopped. No agents, no worktrees. The
sections below this one are history; the sixteenth session's working rules and traps (items 2 to 4, 6 to 8
of "Restart" further down) still hold.

**Done this session (all on `main`, each through the gate):** step 5a (device tests `setup`,
`cook-finished`, `gear`, `history`); `t032`, `t033`, `t030` merged; T-063 (undo, the undo icon, Back to the
cook); T-065 (Send to developer, the event log, the recipient filled in by `pit-share`); T-028's two changes
(rate cards only for foods cooked or with a saved rate; Cook again asks first); `maker.ts` removed; device
tests `shared` and `followups`. Jason approved fidelity PNGs 01-03, 15-20 and the release docs. His answers
are in each task's TASKS entry (T-022, T-028, T-030, T-033, T-037, T-059, T-063, T-065, T-067).

**Gate facts:**
- The gate skips `.claude/` (SE-004), so agent worktrees do not break it.
- **Snyk prints "You have reached your monthly limit of 200 private tests"** in every run since 2026-11-15.
  Scans still complete (26 projects, Snyk Code 0 issues). Jason: keep running the gate, once per merged
  change, and stop and tell him the moment the Snyk step fails or skips. Never remove the step. No
  `npm run snyk:monitor` before 2026-12-01.
- With agents running, a first gate run can fail step 4 on Jest 5 s timeouts; a second run passes. Do not
  raise the timeout.

**Next, in this order (ask Jason which to start; he wants agents used where tasks are independent, told
first, each in a worktree off local `main`, no emulator, no gate; `git reset --hard main` first in each):**
1. Done: Jason approved all six newest screenshots (11, 13 undo, 15 back, debug send, 20, Edit cook) on
   2026-11-15, 5:20 PM. He does not want approved screens pulled back toward the mockups. One thing to build
   from it (T-065): on the debug screen, tapping the address copies it, with a line saying so; use
   `expo-clipboard` (works on Android and iOS; Jason wants no Android-only module where a cross-platform one
   exists).
2. **T-067** fast test cook: a dev-only link, the Saturday fixture, 60 times faster; nothing left to settle.
3. **T-059** whole turkey, in 0.3.0 and unblocked (Jason, 2026-11-15, 5:30 PM): the numbers and how to cite
   them are in its TASKS entry; no more links, no food-safety note. Build it.
4. T-033 leftovers: put his answers into INSTALL.md and RELEASING.md (contact line, betas for testers); fix
   `docs/design/TECH-DESIGN.md` where it calls `pit-share` read-only.
5. T-037 prep: emulator images for Android 14 and 15, `alarm` device test on each (`avd.sh` is fixed to API
   36 today).
6. Phone (list every action, wait for his yes): rebuild and reinstall the dev build (it is far behind), T-016
   phone half, T-017 check, T-065 Send to developer with a real email app, T-031 with two phones.
7. T-034 parity review, T-035 security pass, T-036 data export, T-066 user README, T-064 (partly built),
   T-038 upgrade test and cut 0.3.0. The first GitHub release is done with Jason step by step (0.2.0 is
   only on Drive; GitHub has a tag and no release).
8. Leftover branches, safe to delete with his yes (their commits are on `main`): `t030`, `t032`, `t033`,
   `worktree-agent-a666a162b7613bda9`, `worktree-agent-a8dd0046dfd3a9168`, `worktree-agent-af599cf2f6236d017`.

**Dashboard:** `dashboard.html` (local, never committed). Rules: update at every milestone and at least
every 20 minutes; the queue lists only what is left; the label for his items is "Needs Developer Insight"
and the section is "Waiting on Developer"; the "App bugs found" tile counts the current session and starts
again at 0 in a new one.

## Restart, seventeenth session (written Sunday 2026-11-15, 1:50 PM; read this first)

The sixteenth session's Restart list below still holds for items 1 to 4 and 6 to 8. Its step 5 is replaced by
this. Nothing from this session is committed yet: the working tree on `main` holds step 5a.

**Update, 3:45 PM the same day: step 5a is done and committed.** All four device tests pass at 115%
(`history` rerun passed), the fidelity PNGs are in `docs/fidelity/`, the four tests are in the README table,
T-023 to T-028 have a "Device test" line in TASKS, and `npm run check` passed all six steps (539 Jest tests).
Jason still has to judge the screenshots against mockups 01-03 and 15-20. Next: merge `t032`, `t033`, `t030`
one at a time, each through the gate; then the questions below. **Trap:** agent worktrees under
`.claude/worktrees/` fail the gate at Prettier (it reads them, and rewrote two fixture files in each). The
three were removed with Jason's yes (branches `t030`, `t032`, `t033` and `worktree-agent-*` kept). Remove
an agent's worktree, with his yes, before the next gate run. The "Still to do" list below is history.

**Update, 3:55 PM:** `t032` is on `main`, gate passed. Jason reviewed the ten fidelity PNGs: all approved
(his words are in the T-023 to T-028 "Device test" lines). From that review: more than one smoker or griddle
is for the next version (BACKLOG.md); new task **T-067**, a fast test cook (60 times faster, dev builds only,
design to settle with him) before T-037. Still to ask on T-028: do the rate cards for foods other than
brisket stay. Next: `t033`, then `t030`. He wants agents used where they fit: T-063 and T-065 are the
candidates (tell him first; their worktrees must be gone before a gate run).

**Update, 4:05 PM:** `t033` is on `main`, gate passed. The gate now skips `.claude/` (SE-004, Jason's
choice), so agent worktrees no longer break it: the trap above is closed. Two agents are running in
worktrees off `main` cfc1428: **T-063** and **T-065** (no emulator, no gate; merge each through the gate when
it reports). With agents running, the first gate run can fail step 4 on Jest 5 s timeouts (11 tests did);
the second run passed unchanged. Next: `t030` (prebuild, dev build rebuild, emulator test).

**Update, 4:10 PM:** **T-063** (`a96e198`) and **T-065** are on `main`, each through the gate (598 Jest
tests). Neither has a device test. Their worktrees and `worktree-agent-*` branches are left over (delete with
Jason's yes). Questions for Jason from the two agents (ask in plain words; full text in each TASKS entry):
- T-063: (1) undo after a later change to the cook also takes that change back (built) or the Undo row goes
  away; (2) row name as Next up words it, "Undo: Check the brisket" (built), or a shorter name per kind of
  step; (3) an overdue step taken back rings again 10 min later (built) or right away; (4) the row uses Start
  over's icon (the kit has no undo icon) or add one; (5) Serve marked Done lands on Cook finished with no
  Undo there: leave it or add a way back.
- T-065: (1) the share sheet cannot fill in the recipient (expo-sharing has no such option): the tester types
  the address shown on screen (built), or a few lines of Kotlin in one of our modules to fill it in; SPEC
  section 6 still says it is offered as the recipient, fix the line once he answers; (2) alarms that ring
  while the app is closed are not in the log: accept, or a task for a native ring log; (3) cook history notes
  are in the file: keep or leave out; (4) the section sits under the test alert button: keep or move to the top.
**All nine answered (4:15 PM), written into the T-063 and T-065 entries.** As built stays for T-063 (1) to
(3) and T-065 (3), (4). To build: an undo arrow icon in the kit (T-063), "Back to the cook" on Cook finished
(T-063), the recipient filled in by Kotlin in one of our modules (T-065; rebuild and device test). New later
task T-068 (native ring log).

**Update, 4:35 PM:** all three branches are on `main`. Two agents are running in worktrees off `main`
9883472: T-063 follow-up (undo arrow icon, "Back to the cook" on Cook finished) and T-065 follow-up (the
recipient filled in by Kotlin in `modules/pit-share`; needs a dev build rebuild and an emulator check when
merged). The emulator has the dev build with `pit-share`; the phone's dev build is older. Still to ask
Jason: T-028's six, T-030's, T-033's, the carried ones, T-067's three.

**Update, 4:45 PM:** both follow-ups are on `main`, each through the gate (655 Jest tests): T-063 undo
arrow icon and Back to the cook; T-065 `sendFile` in `pit-share` (Kotlin compiled, JUnit passes). The
emulator's dev build is now older than `main`: rebuild before the next device run. Not device-tested:
T-063 (undo row, Back to the cook, the bottom row may wrap on a first cook), T-065 (debug screen; the To
field needs an email app with an account), T-032. Jason answered T-030's four and T-028's (1), (2), (4), (5),
(6) plus the rate-card question: see those TASKS entries. To build from them: rate cards only for foods
cooked or with a saved rate; Cook again asks before replacing a plan. Still to ask: T-028 (3) with a
screenshot of Edit cook, T-033's six, T-067's three, the carried ones, four small ones from the follow-ups
(T-063: button colour, wrapping; T-065: email subject "Pit Planner debug file", the second line "If the
address isn't filled in, type it."). `docs/design/TECH-DESIGN.md` still calls pit-share read-only: fix.
Two agent worktrees and branches are left over (`worktree-agent-acd0…`, `worktree-agent-add2…`; commits on
`main`): delete with his yes.

**Update, 4:55 PM:** T-028's two changes are built and gate-complete (rate cards only for foods cooked or
with a saved rate; Cook again asks first). `src/lib/maker.ts` removed and branches `t025`, `t026` deleted
(Jason's yes). T-067 is a dev-only route, nothing left to settle. Carried item 5 below is now only: T-022's
15 min control, and deleting `t030`, `t032`, `t033` and the remaining `worktree-agent-*` branches.

**Snyk limit (2026-11-15, in every gate run of this session from 3:42 PM on; first noticed at 4:44 PM):** `snyk test` prints "You have reached your monthly limit of
200 private tests for your mecheng70 org." The gate still passes (all 26 projects tested, Snyk Code 0
issues), so nothing is skipped yet. Jason has been told; do not remove the step, and stop and ask him if it
starts failing or skipping. Each gate run uses tests: run the gate once per merged change, not more.

**State of step 5a (device tests for Setup, Cook finished, Gear, History):**

- Four device tests are written in `tools/device/run.sh`: `setup`, `cook-finished`, `gear`, `history`. Each
  starts on an empty database (`db_fresh` sets the emulator's database aside, `db_done` puts it back; the exit
  trap does too). On the emulator at 115%: `setup`, `cook-finished` and `gear` pass. `history` passed every
  check but one, which was the test's fault (the label is "More brisket minutes", lower case; fixed, not
  rerun). **Next: run `history` once more**, then the rest of this list.
- Run one test per call, with the emulator started first, or the run goes past the Bash tool's 10 minutes:
  `tools/device/avd.sh start`, then `DEVICE_SCALES=1.15 tools/device/run.sh --no-build --only history`
  (about 7 minutes each), `tools/device/avd.sh stop` at the end. The emulator and Metro are stopped now.
- New dev seeds (`app/dev/plan.tsx`, fixture `src/lib/fixtures/finishedCook.ts` with a Jest test):
  `?seed=finished` (mockup 15: all done but Serve, due in about a minute; Done on Serve opens Cook finished),
  `?seed=finished-blend` (three logged briskets, so the rate card offers Use 0.74 / Keep 0.75),
  `?seed=history` (mockup 20). Every seed clears the brisket rate lock and the other seeds' saved cooks.
- **App bug found and fixed:** on Cook finished, Save to history was only as wide as Discard this cook (753 of
  1080 px) on every cook after the first, when the support link is not there (`FinishScreen.tsx`: the footer
  is now in `Fill`). The regression check is in the `cook-finished` device test (full width without the link).
- Not app bugs, noted for Jason: the history card reads "chicken wings 2 lb" (mockup 20: "wings 2 lb");
  Cook history shows a rate card for every by-weight food (mockup: brisket only), so the cooks are a screenful
  down; at 115% Setup's Add another cooker is half behind Back and Continue until scrolled; the oven's default
  is Ask each time (mockup 19 shows Oven).
- **Still to do for 5a, in order:** (1) `history` rerun passes; (2) save fidelity PNGs to `docs/fidelity/` as
  `rn-01-setup-cookers.png`, `rn-02-smoker-picker.png`, `rn-03-setup-alerts.png`, `rn-15-cook-finished.png`
  (and `rn-15-cook-finished-rate.png`, the Use / Keep card Jason has not seen), `rn-16-gear.png`,
  `rn-17-add-cooker.png`, `rn-18-griddle.png`, `rn-19-oven.png`, `rn-20-cook-history.png`, from
  `tools/device/out/1.15/` (`setup-cookers.png`, `setup-picker.png`, `setup-alerts.png`, `cook-finished.png`,
  `cook-finished-keep.png`, `gear.png`, `gear-add-cooker.png`, `gear-griddle.png`, `gear-oven.png`,
  `history.png`; raw cropped shots, like `rn-13-cook-options.png`); (3) add the four tests to the table in
  `tools/device/README.md` and compose lines at the end of `run.sh` if wanted; (4) update the T-023 to T-028
  status lines in TASKS (device test passes at 115%); (5) `npm run check`; (6) commit as
  "T-023 to T-028: device tests ..."; (7) stop with the check summary and tell Jason which screenshots to
  judge against which mockups (memory: device testing format).

**Agent branches, built and unit-tested, not merged, not gated (each one commit series on top of `main`
3bf0ae6; the worktrees are gone, the branches remain):**

| Branch | Task | What to do |
|---|---|---|
| `t032` (2e30596) | Update check | **Merged onto `main` (cherry-picked) and gate-complete, 2026-11-15 3:55 PM; 554 Jest tests.** Was: cherry-pick or merge, `npm run check`. Jason's answers are in: a final install is offered finals only, a prerelease install anything newer; a failed check retries at the next launch or resume; the dev build checks too (as built). SPEC section 10 reworded on the branch. |
| `t033` (3f65215) | Release docs | **Merged onto `main` and gate-complete, 2026-11-15 4:05 PM.** Jason reviews `docs/RELEASING.md`, `docs/INSTALL.md`, `docs/release-notes/0.3.0.md`, `README.md`. |
| `t030` (b2ab25a) | Open a shared plan | **Merged onto `main` and gate-complete, 2026-11-15 4:35 PM; dev build rebuilt and on the emulator; device test `shared` passes at 115%.** Was: merge last. New Expo module `modules/pit-share` (Kotlin never compiled, 16 JUnit tests never run), config plugin, `app/+native-intent.ts`. Needs `npx expo prebuild`, a dev build rebuild, then a device test (the agent's report: write a plan into the app's cache with `run-as`, open it with `am start -a android.intent.action.VIEW -t application/json -d file:///data/user/0/<pkg>/cache/test.pitplan`; an oversized file must show "That file is too big to be a Pit Planner plan."). Any Jest test that imports `@/platform/share` needs the `modules/pit-share` mock. `tools/snyk.test.mjs` lists Gradle projects; check it after adding the module. |

Merge one at a time, each through the gate. TASKS.md is touched on all three branches and on `main` (expect
small conflicts in the T-030, T-032, T-033 entries only). **Trap:** an agent's worktree starts at
`origin/main` (3e77bca), 34 commits behind local `main`: tell every agent to move onto local `main` first.

**Jason's decisions this session (already in TASKS):** T-063: undo is a row in Cook options naming the step,
the most recent Done only, until the next step is marked done. T-065: hidden (5 taps on the version line on
Gear), share sheet with one file, his address as where to send it, the file's contents listed. Both tasks are
unblocked. T-032: as in the table.

**Questions still to ask Jason (plain words, two choices spelled out, a few at a time, no caveman):**

1. (Answered 2026-11-15: the test copy, "Pit Planner dev", also asks GitHub once a day, as built. Add this
   to the T-032 note in TASKS when `t032` is merged; nothing to change in the code.)
2. T-028's seven questions (its TASKS entry). Not asked yet.
3. T-030 (agent's report, also noted in its TASKS entry on `t030`): where an import-made conflict shows (as
   built: the Conflicts sheet opens after Use this plan); whether "holds too long" counts as such a conflict;
   "Someone shared a Saturday plan." (no sender name in the file) or a name; the too-big wording; the
   read-only smoker field (mockup shows a chevron); OK as the error sheet's button.
4. T-033: which phones and Android versions his friends and wife have; will testers get betas; a contact
   line for a failed install; commit the version bump before the build (the script needs a clean tree) or
   change the script; is 0.2.0 on GitHub Releases or only Drive; is whole turkey (T-059) in 0.3.0.
5. Carried: T-022's 15 min control; `src/lib/maker.ts` remove or keep; delete branches `t025`, `t026`
   (and later `t030`, `t032`, `t033` and the `worktree-agent-*` branches and worktrees, with his yes).

**Dashboard (Jason, 2026-11-15):** `dashboard.html` at the repo root, a local file ignored through
`.git/info/exclude` (never commit or push it). Rewrite its `D` data block (between the DATA markers; keep the
field names and the `st` values done, built, doing, todo, blocked, wait) and set `updated` to the current
local time **at every one of these**: a device test passes or fails, an agent finishes, a branch is merged,
the gate runs, a commit is made, Jason answers a question, and at least every 20 minutes while work is under
way. It went stale once this session and he noticed. After editing, check the block still parses (run the
`D` block through `node`).

**Usage:** he was at 87% at 1:40 PM with a reset at 3:30 PM. Four agents ran this session. Ask before
starting more, and keep the dashboard's usage note current with what he reports.

## Restart (written Sunday 2026-11-15, end of the sixteenth session)

Do these in order:

1. **Push:** `main` is ahead of `origin/main` (3e77bca), all local. Jason pushes when he says so. **Snyk
   monitor is paused until December 2026**: do not run `npm run snyk:monitor` before 2026-12-01; run it once
   on the first push in December. If `npm run check` starts failing or skipping on Snyk's monthly limit, stop
   and ask Jason: do not remove the step.
2. **Phone:** the hold is lifted, and the phone is plugged in (`adb devices` shows it next to the emulator).
   Every phone action is still listed first and waits for his yes. Hand-written adb commands must name the
   emulator (`adb -s emulator-5554 ...`). Never touch the release app without his yes.
3. **Jason's working rules (2026-11-15):**
   - Run tasks in parallel where it makes sense: agents, each in its own git worktree off `main`, no
     emulator, no phone, no `npm run check`; the main session merges, gates and runs the emulator. He was
     at 56% session usage after eight agent tasks; watch the usage he reports and stop adding agents when it
     runs hot.
   - Emulator at 115% only: `DEVICE_SCALES=1.15 tools/device/run.sh --no-build --only <tests>`.
   - The mockups are a starting point, not a contract: where a built screen follows 0.2.0 and he approved
     it, the screen wins (SPEC "Cook tab").
   - He reads on the move: ask questions in plain words with the two choices spelled out, never by quoting
     UI strings alone.
4. **Traps found this session:**
   - Never `git add -A` in a worktree: a committed `node_modules` link replaced `main`'s `node_modules` on
     merge (fixed with `npm ci`; `.gitignore` now ignores the link too). Agents add files by path.
   - A worktree needs the git-ignored `.expo/`, `nativewind-env.d.ts` and `expo-env.d.ts` copied in, or
     `tsc` fails there. After adding a route, Expo's route types are stale until Metro runs once.
   - Do not edit `tools/device/run.sh` or app source while a device run is in flight (bash reads the script
     as it goes; Metro reloads the app). Edit in a worktree and merge when the run ends.
   - `pkill -f` and `pgrep -f` match the shell that runs them. A background device run started through the
     Bash tool is killed at its 10 minute limit: the full suite takes longer, so run it in parts.
   - Under emulator or agent load the first Jest run can fail with 5 s timeouts; a second run passes. Do not
     raise the timeout.
5. **Where the tasks stand (all on `main`; `npm run check` passed on this `main`, all six steps, on 2026-11-15; 536 Jest tests):**

   | Task | Built | Emulator at 115% | Open with Jason |
   |---|---|---|---|
   | T-021 Live cook, Start cook | done | `cook`, `survive` pass | none |
   | T-022 Cook options, keep or move, Start over asks | yes | `cook-options` passes | the 15 min control: built stepper stays unless he says mockup 13's two buttons |
   | T-023 Cook finished, Full timeline | yes | not run | rate card now plain with Use / Keep (built to his words; he has not seen it) |
   | T-024 Setup steps 1 and 2, picker, Add a cooker | yes | not run | none |
   | T-025 Setup alerts step | yes | not run; test alert in Doze needs the phone | none (battery note is a plain line, no link) |
   | T-026 Gear | yes | `smoke` opens the tab | none |
   | T-027 Cooker sheets | yes | not run | none |
   | T-028 History and cook rates, with Edit | yes | not run | seven questions in its TASKS entry, not asked yet |
   | T-029 Share export | yes | not run; Gmail and Drive in the share sheet need a device | none |

   - **Next, in this order:** (a) device tests for Setup, Cook finished, Gear with its sheets and History
     (write them in `tools/device/run.sh` in the style of `test_cook_options`, run at 115%, save fidelity
     PNGs 01-03, 15-20); Setup needs a state with no cookers (see how `legacy-import` gets "cookers 0").
     (b) Ask Jason T-028's questions in plain words, a few at a time. (c) Then T-030 (open a shared plan:
     intent filters by config plugin, content:// read, so a native rebuild), T-032, T-033, T-063 (needs his
     approved mockup or SPEC line), T-065.
   - Decisions of 2026-11-15 are in SPEC ("Cook tab", "First launch", section 5) and in each task's
     "Jason's answers" lines in TASKS; do not ask them again.
   - `src/lib/maker.ts` (battery help links per maker) is unused since he chose a plain line; remove it or
     keep it for later, his call.
   - Branches `t025` and `t026` are left over: their commits were cherry-picked onto `main`, so they are
     safe to delete (`git branch -D t025 t026`) once Jason says so.
   - T-059 waits for the FSIS pages (403 to automated fetches: read in a browser).
6. **Dev seeds added on 2026-11-15:** `pitplanner://dev/plan?seed=briskets` (11.5 lb and 6 lb),
   `?seed=twins` (two 6 lb), `?seed=tomorrow` (mockup menu for 5:00 PM tomorrow) and `?seed=cooking` (mockup 12
   as a running cook; end it with `pitplanner://dev/alarm?cook=end`).
7. **Gate note:** right after the emulator stops, the first `npm run check` can fail step 4 with Jest 5 s
   timeouts (cold cache, high load); a second run passed with no change. Do not raise the timeout for it.
8. **Session habit (Jason, 2026-11-14):** before the context needs compacting, park the work, ask him the
   open questions in one batch, write his answers into the docs, then tell him to clear and give him the
   restart prompt.

Where things stand:

- T-017 is closed on the emulator. T-018 is built (temp menu, Add food, Conflicts sheet); Jason approved
  its screenshots and settled its questions (TASKS T-018 notes). The whole device suite for Plan passes on
  the emulator at 115% and 130% (`plan`, `plan-3button`, `plan-sheets`, `stable-controls`).
- T-061 is built (`engine/labels.ts`; labels in step text, warnings, Plan card titles and Conflicts
  buttons) and gate-complete; notes in TASKS T-061.
- T-020 (`engine/cookState.ts`) and T-058 (font size, activity destruction, process death; device test
  `survive`, emulator only) are built and gate-complete; T-058's notes in TASKS say what was found on the
  emulator and what is not built.
- T-019 is built: `src/screens/plan/FoodEdit.tsx`, kit `ResultBar` and `Sheet tall`; Add food opens it and
  the Conflicts sheet has its Edit buttons. Device tests `food-details` and the `food` targets pass at 115%
  and 130% on the emulator.
- Emulator and Metro are stopped. The emulator is 1080x2376, gesture navigation.
- **The phone hold is lifted** (Jason, 2026-11-15). Older notes below that say "do not touch the phone" are
  history.
- Waiting on the phone (list every phone action and wait for his yes before the first one): rebuild and reinstall the dev build (date picker
  and alarm module are new), the T-016 phone half (approved list in TASKS T-016), the T-017 check against
  mockups 04-05. On that check also read the phone's status bar and navigation bar heights: the emulator's
  are 43 dp and 24 dp, the phone's status bar is not known, and Plan's fit depends on it.
- Still open with Jason: the tester Android versions for T-037 ("coming later").

Decided by Jason on 2026-11-14 (all in the docs named):

- Plan 115% fit target: two cards whole, the third may end in the fade, Add food by scrolling (TASKS T-017,
  `plan_fit` in `tools/device/run.sh`).
- Celsius set points show in 2C increments; Fahrenheit in the cooker's 5F steps (SPEC section 1 Units,
  `showTemp` in `engine/units.ts`). The rows are 2C or 4C apart, because the smoker's steps are 2.8C.
- The Conflicts fixes are move to griddle, change temp, edit the food. "Finish earlier" is dropped (SPEC
  section 3). It was a planning fix, not food finishing early during a cook.
- Add food opens food details first (T-019).

For the next version (after 0.3.0), so it is not lost: **T-060** in TASKS and SPEC section 11, "Low and
slow for tough cuts". Jason's brisket of 2026-11-14 heated far faster than the plan; the grill was fine,
the plan was wrong for the cut. Four candidates (cut and thickness as inputs, a recommended smoker temp
with a warning, re-timing on a smoker temp change mid-cook, re-timing from probes), none decided, all
needing sourced numbers. Chart: `docs/screenshots/pitboss_001.jpg`; charts 2 to 6 are described in words
in T-060 (two thermometers in one food 5 to 15F apart; air by the meat 40 to 80F under the grill's
reading; the brisket levelled at the smoker's own 208 to 210F set temp).

To keep the session short: TASKS.md is 1,700 lines, so read only the entries needed (`grep -n '^### T-019'`),
not the whole file. For T-019 also read `legacy/src/screens/plan/FoodEdit.tsx` and its test (the behavior to
port), mockups `docs/mockups/08-brisket-details.png`, `09-ribs-details.png`, `10-chicken-details.png`, and
`src/screens/plan/PlanTab.tsx` (where the screen is opened from).

## START HERE: scaffold, gate, theme, kit, device tests and release build, SQLite storage, the app store, the import from 0.2.0 and the alarm module, its tests and wiring, and the Plan tab with its menu and sheets in place (T-002..T-015, T-017 and T-018 done, T-016 half), T-019 next

- Root is now the Expo app: `app.config.ts` (variants by `APP_VARIANT`, versionCode from package.json),
  `app/` routes (tabs Plan, Cook, Gear placeholders), `src/lib/` pure helpers, `src/platform/types.ts`
  (service interfaces), `src/screens/` (placeholders). The Plan placeholder plans the Saturday fixture and
  shows "Fire the smoker at 6:20 AM": the engine runs in Metro unchanged.
- The Capacitor app is in `legacy/` (reference only). Tag `v0.2.0` on `e86d930` exists locally (not pushed).
- Dev build: `npm run android` (prebuild + Gradle + install + Metro). It is `io.github.mecheng70.pitplanner.debug`,
  "Pit Planner dev", beside the release. JAVA_HOME must be temurin-21. Without Metro running (and
  `adb reverse tcp:8081 tcp:8081`) the dev build opens the dev launcher instead of the app.
- Gate on the new stack (T-003): `npm run check` prebuilds `android/` when stale, lints with expo + React Native
  rules and the layer rules (TECH-DESIGN section 3; color literals and inline styles are errors, so use
  `StyleSheet` until T-004's tokens), and `npm run test:gate` proves the gate catches layer breaks, lint
  errors and planted secrets. Warm run 1 to 2.5 minutes (mostly Snyk). Native JUnit runs through Gradle for every
  `modules/*/android/src/test` (placeholder test in `modules/pit-alarms` until T-013/T-014). Semgrep reads
  rules cached in `~/.cache/pitplanner/semgrep-rules/` (refreshed weekly; `npm run semgrep:update`), so only
  Snyk needs the network.
- Destructive actions (uninstalling apps, deleting data, anything destructive on the phone or in the repo)
  need Jason's explicit yes (CLAUDE.md). Don't read consent into an unclear reply.
- TypeScript is 6.0.3 (D-2 decided); `typescript7` is gone.
- Theme (T-004): values only in `src/theme/tokens.ts`; style with token classes (`bg-surface`, `text-ink-2`,
  `rounded-card`) and the `Text`/`Button` components in `src/components/ui/`. Type comes from `Text`'s
  `variant`, never from classes. Spike: `pitplanner://dev/spike` in the dev build.
- The Expo dev build is on the phone (replaced the Capacitor dev copy; its data is backed up in
  `legacy/tools/device/out/dev-copy-backup-2026-11-12/`). To run it: `npm start`, then
  `adb reverse tcp:8081 tcp:8081` and open "Pit Planner dev". First launch shows the Expo dev menu intro.
- Kit (T-005): build screens from `@/components/kit` only (notes in TASKS T-005). Times, temps, weights and
  countdowns are `<Num>`; the lint rule `pitplanner/num-text-size` stops anything cutting one. Sheets are the
  kit `Sheet` on `Modal` (D-4). Tailwind spacing is now true dp (`inlineRem: 16`). Gallery
  `pitplanner://dev/kit`. Not ported until their screen needs them: AppBar/Screen, Lanes, Menu/SelectField
  and the Setup form pieces (list in TASKS T-005).
- Device tests (T-006): `npm run device` runs on the test emulator by default (`tools/device/avd.sh`; Maestro +
  uiautomator dumps, 115% and 130%, screenshots cropped). `--phone` only for tasks marked **Real phone** in
  TASKS. The device log is cleared before and after and kept only on failure, app lines, redacted. Maestro's
  own output (it holds the whole device log) is deleted after each flow. Read
  `tools/device/out/report.txt` first. `tools/device/README.md`.
  New screens add their controls to `tools/device/targets.tsv` (`stable-controls`, T-017 PR-3).
- D-4 confirmed by Jason on condition of the `sheet-keyboard` device test; it passes (Sheet lifts by the
  keyboard height, `FooterScroll` reveals the focused field above the footer). Kit `InputField` added.
- Release (T-007): `npm run release` (signing from git-ignored root `keystore.properties`; `--version
  x.y.z-alpha.N` for internal builds, `--dry-run`, `--verify <apk>`). It stops the test emulator first (a
  build needs the memory). About 20 minutes a run. versionCode (`plugins/version.ts`): (major*10000 +
  minor*100 + patch) * 1000 + stage; stage is N for alpha.N, 300 + N for beta.N, 600 + N for rc.N, 999 for
  the final release (N 1 to 299). So 0.3.0-alpha.1 = 300001 < 0.3.0 = 300999 < 0.3.1-alpha.1 = 301001.
  `release/pitplanner-0.3.0-alpha.1.apk` is 300001 (the first build, 300, is kept as
  `release/superseded/pitplanner-0.3.0-alpha.1-code300.apk`).
- Signing backup: see "Release signing: what to back up" below.
- Storage (T-008): `src/db/`: synchronous `Db` interface (`db.ts`), `expoDb.ts` (the only expo-sqlite
  import), `testDb.ts` (better-sqlite3, Jest only), `migrate.ts` (`openMigrated` returns ok or a
  `MigrationError`), `migrations/0001_init.ts`, `schema.snapshot.sql`. Nothing opens the database in the app
  yet (T-010).
- Repositories (T-009): `repos(db)` in `src/db/repos/` (`settings`, `cookers`, `rates`, `activeCook`,
  `history`, `kv`); corrupt rows read as defaults, never throw. `Draft` and `parseDraft` are in
  `src/lib/draft.ts`. Schema v1 gained `cook_history.ended_early` (0001 edited: allowed only because 0.3.0 has
  not shipped; after that, new migrations only).
- Store (T-010): `src/lib/store.tsx` (`useStore`) over the repositories; every change is written at once.
  `app/_layout.tsx` opens and migrates the database (`src/db/appDb.ts`) before any screen; a failure shows
  `MigrationErrorScreen` (kit empty state; Export my data via `src/db/export.ts` + `src/platform/shareFile.ts`,
  or the raw database files as a tar when the database cannot be opened). Screen tests
  wrap with `storeWrapper()` from `src/test/store.tsx`.
- Migrations are frozen (CLAUDE.md): a schema change is a new file + `npm run migrations:freeze`; the gate
  fails on an edited one. Unreadable stored values are quarantined to `kv` (`quarantine:<origin>:<time>`)
  before a write replaces them; a lost plan draft shows a notice on Plan (`state.draftLost`).
- Device tests `db`, `migration-error` and `db-unopenable` run the real expo-sqlite database on the emulator
  (`pitplanner://dev/db`, `?set=C`, `?fail=1`; dev builds only). `--repeat N` reruns a test to catch one that
  only sometimes fails. `launch` now waits for the app's own UI, not just its window.
- Legacy prefs (T-011): `modules/pit-legacy` reads the 0.2.0 `CapacitorStorage` preferences
  (`legacyStore` in `src/platform/legacy.ts`); device check passed.
- Memory: Gradle and Kotlin daemons are capped by `plugins/withGradleMemory.ts` (2 GB and 1.5 GB heaps, 6
  workers, 10 minute idle timeout), the emulator runs with 3 GB (`avd.sh`), and `npm run device` builds before
  it boots the emulator and stops the daemons in between (`tools/stop-gradle.sh`). Numbers in TASKS T-011.
  `-gpu host` was tried (2026-11-13) and dropped: on the Intel Iris Xe the app never opened; the emulator stays
  on software graphics.
- Import (T-012): `src/db/legacyImport.ts` runs once at startup (`kv.legacy_import`), in one transaction;
  unreadable parts are quarantined; a one-time notice (`ImportNotice`) says how the import went; the old files become
  `*.imported` only when everything came along. Upgrade test: `tools/device/upgrade020.sh setup`, then
  `check <apk>` (real 0.2.0 APK on the emulator, data made in its own screens, a 0.3.0 build over it); passed
  with `release/pitplanner-0.3.0-alpha.2.apk`. Device test `legacy-import` covers the two notices.
  The notice shows after a full import too (three sentences from Jason, `NOTICE_BODY`). T-038 must check the
  imported data on the Gear, Plan and History screens, not only in the database. The emulator holds no
  release app now, so `upgrade020.sh setup` can run.
- Alarms (T-013): `modules/pit-alarms` is the 0.2.0 plugin on the Expo Modules API (same package, receiver
  names and intent actions) plus `setQuiet` (`Quiet.kt`). JS: `pitAlarms` in the module, `alarmService` and
  `permissionService` in `src/platform/alarms.ts` (typed exports only; wiring is T-015). Device test `alarm`
  (emulator): a test alarm from `pitplanner://dev/alarm?test=20:<tag>` rings with the screen off. Native
  tests (T-014): 41 Robolectric tests; the alarm code reads time from `Clock.now()` so tests can move it.
- Alarm wiring (T-015): `setCook` in the store saves and then replaces the phone's whole alarm set (never
  call `alarmService.replaceAll` from a screen); `useAlarmWiring` applies notification taps at start, on
  resume and while open. Screen tests that need alarms pass `fakeAlarms()` (`src/platform/fakes.ts`) to
  `storeWrapper`. Debug screen: `pitplanner://debug` in dev builds only; in a release build the 5 taps on the
  Gear version (T-026, `grantDebugPass()`) are the only way in. The gate retries Snyk once on a server or
  network error. T-016: list every phone action and wait for Jason's yes before touching the phone.
  T-037: run the `alarm` device test on an image per tester Android version below 16 (Jason gives the list).
- **Waiting on Jason (2026-11-14, end of the eleventh session):**
  1. His word that the Saturday cook is done (he confirmed on 2026-11-14 that the hold stays). That lifts the
     phone hold below and unblocks: the T-016 phone half (approved list in TASKS T-016), the T-017 phone
     check against mockups 04-05, and reinstalling the dev build on the phone (it needs a rebuild: date
     picker and alarm module).
  2. The Android versions his testers use, for T-037 (alarm device test per version below 16). "Coming
     later" (2026-11-14): still open, ask again.
  3. More on his cook of 2026-11-14 on 0.2.0 (task T-060, next version): an 11.5 lb brisket planned at
     250F for 8 hr 50 min heated far faster than the plan; the grill held its set temp. His view: the
     starting temp was too high and the plan does not account for the brisket's thickness; tough meats go
     slow and steady. Chart: `docs/screenshots/pitboss_001.jpg`. Questions still open are in T-060.
  Settled 2026-11-14: the new Plan screenshots are approved; the 115% fit target is two cards whole.
  Settled 2026-11-14 (T-018): Add food opens food details first (T-019); Celsius set points show in 2C
  increments; the planning fix "finish earlier" is dropped from SPEC (it was a Plan-time fix for a smoker
  conflict, not food finishing early during a cook, which stays in the Cook tab).
  Settled in his review (2026-11-13): "Not in this version of Pit Planner" is approved; the taller emulator
  display is not (undone).
  `main` is not pushed (he pushes when he says so).
- **DO NOT TOUCH THE PHONE (Jason, 2026-11-13).** A real cook is running in his Pit Planner 0.2.0 with
  alarms through Sat 2026-11-14 17:00. Until he says the cook is done: no adb commands to the phone, no
  installs, no reads; emulator only; a task that needs the phone skips that step and notes it.
  `tools/device/PHONE-BLOCKED` makes the device tools refuse the phone (`pick_target`); delete it only when
  he says so. Hand-written adb commands must name the emulator (`adb -s emulator-5554 ...`).
- **T-016: emulator half done, phone half blocked** until after that cook. Emulator results are in
  `docs/alarm-testing.md` (upgrade with a live cook, Done and +15 with the app dead, time zone, app update,
  reboot, Doze). The approved phone list is in TASKS T-016; the dev route for the phone's test cook is
  `pitplanner://dev/alarm?cook=3`.
- T-016 additions from Jason (in TASKS): upgrade with a live cook (each alarm once, on time, no duplicates),
  and the exact-alarm findings with the proposal to keep the manifest (`USE_EXACT_ALARM`, plus
  `SCHEDULE_EXACT_ALARM` up to API 32). The manifest has not been changed.
- Plan (T-017): `src/screens/plan/PlanScreen.tsx` + `PlanEmpty.tsx`. What opens from it comes in as handler
  props that the route does not pass yet (temp menu, Add food, Issues: T-018; food details: T-019; Start
  cook: T-021; history: T-028; share: T-029), so those controls do nothing for now. Date and time go through
  `src/platform/dateTime.ts` (`@react-native-community/datetimepicker`). Kit: `Screen`, `AppBar`,
  `SelectField`, `Tiles equal`, chips that keep their selected width. Dev seed:
  `pitplanner://dev/plan?seed=mockup`. Device test `plan`. Since T-018 the route renders `PlanTab.tsx`
  (the screen plus the temp menu, Add food and the Conflicts sheet); device test `plan-sheets`; kit `Menu`,
  `MenuRow`, `SearchField`, `GroupLabel`, `Inset`. Radius classes must be theme names
  (`rounded-control`, not `rounded-2xl`): the gate checks it.
- Emulator geometry: the display is the AVD's own 1080x2376 at 480 dpi (360x792 dp) with gesture navigation
  and its 24 dp bar. Never resize it or change the test device to make a layout target pass (Jason,
  2026-11-13: the 24 dp taller display was not approved); report a target that cannot be met, with the
  reason. `plan-3button` repeats Plan's fit check with 3-button navigation (48 dp bar). Android's font
  scaling is non-linear above 100% (big text grows less), so 130% looks roomier than 0.2.0's WebView did.
- Pinned footers (kit `FooterScroll`, every `Screen` and `Sheet`): nothing half-shows behind the button. The
  fade is 32 dp, solid for its last 8 dp; a control counts as fitting above a pinned button only when it
  ends above the fade (34 dp over the button; `FOOT_FADE_DP` in `tools/device/run.sh`).
- Plan cards: the summary wraps to two lines (`Text clamp={2}`), numbers never. Cook a past plan again shows
  only with a past cook (dev seed `pitplanner://dev/plan?seed=past`).
- Tab bar is the kit `BottomNav` (0.2.0 icon pills); T-059 (whole turkey, cited FSIS numbers) follows T-019.
  fsis.usda.gov answers automated fetches with 403: read it in a browser.
- SE-003 (Snyk, `braces`/`open` in Metro and dev-middleware, not shipped): approved with conditions; override
  failed (open 11 is ESM-only), ignores expire 2027-02-10. Re-check triggers are in SECURITY-EXCEPTIONS.

## Release signing: what to back up (Jason keeps the copies; no secrets in the repo)

Losing any of these means no update can install over the app: every user would have to uninstall first.

1. The keystore file `~/keys/pitplanner.jks` (PKCS12; it holds the private key).
2. The values of `storePassword`, `keyPassword` and `keyAlias`. They are in the git-ignored
   `keystore.properties` at the repo root (same values in `legacy/android/keystore.properties`); backing up
   that file covers all three.

Not needed: anything in `android/` (generated), the debug keystore, Snyk or GitHub logins.

Restore on a new machine: put the `.jks` anywhere, copy `keystore.properties.example` to
`keystore.properties`, fill in the absolute `storeFile` path and the three values, `chmod 600` both files.
Check: `keytool -list -v -keystore <file> -alias <alias>` must show certificate SHA-256
`b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29` (`CN=PitPlanner, O=PitPlanner`);
`npm run release` checks the same digest on every APK and fails on any other.

## Stack change plan (approved 2026-11-12)

Jason decided (2026-11-12) to rebuild the app on **Expo SDK 58 + React Native + TypeScript + NativeWind + React
Native Reusables + Expo Router + expo-sqlite + expo-secure-store** (development builds, not Expo Go; no server,
no Redis). This session wrote the plan only, no code. `docs/design/TECH-DESIGN.md`, `TASKS.md` and `WBS.md`
are rewritten for it; Jason approved the plan on 2026-11-12.

Key points of the plan (details in TECH-DESIGN):
- `engine/` and `data/` and their tests stay unchanged. Pure helpers the engine tests import
  (`src/lib/cookView.ts`, `finish.ts`, `historyView.ts`, `sharedPlan.ts`, `timing.ts`, `update.ts`, types in
  `cook.ts`, `history.ts`) keep their paths and exports.
- The Capacitor app moves to `legacy/` in T-002 (reference until parity, deleted in T-039); tag `v0.2.0` on
  `e86d930` keeps it buildable.
- SQLite schema v1 (`kv`, `cookers`, `rate_overrides`, `active_cook`, `cook_history`, `cook_history_items`),
  migrations by `PRAGMA user_version` from day one, tested on better-sqlite3 in Jest.
- **0.2.0 data can be migrated:** same app ID + same key keeps the data dir. Capacitor Preferences is the
  SharedPreferences file `CapacitorStorage`; history is `files/history.json`. A small `pit-legacy` Expo module
  reads the prefs once; partial or failed import shows a one-time "fresh start" notice (T-011, T-012).
- Alarms: `modules/pit-alarms`, a near-verbatim Kotlin port of the 0.2.0 plugin to the Expo Modules API, same
  receiver class names, plus `setQuiet` (fixes the Quiet/nag gap). iOS later, same TS interface.
- UI: Reusables + kit themed from the mockup tokens (now in `src/ui/ui.css`, later `src/theme/tokens.ts`);
  font-scale rule unchanged (lint rule bans truncating `Num`).
- Gate unchanged in spirit: Prettier, ESLint (expo + React Native rules), typecheck, node:test (engine) + Jest/RNTL
  + JUnit, Semgrep, Snyk. Device tests move from Playwright/CDP to **Maestro** (Jason installs the CLI).
- Release: `npx expo prebuild` + Gradle signed with `~/keys/pitplanner.jks`, versionCode 300999 (scheme above), GitHub Release
  `v0.3.0` (not prerelease, so 0.2.0's update check sees it). Upgrade tested on an emulator with the real
  `release/pitplanner-0.2.0.apk` first.
- Task IDs were renumbered: old Capacitor-era T-002..T-040 are superseded (mapping table at the end of
  TASKS.md). SE-001's follow-up is now T-057.

Open decisions in TECH-DESIGN section 13 (D-4 decided in T-005: kit Sheet on `Modal`):
D-5 state (keep context store), D-6 in-place port with `legacy/`, D-7 generated `android/`, D-8 Maestro.

## Engineering plan and quality gate (2026-11-12)

- `docs/design/`: TECH-DESIGN, TASKS, WBS, SECURITY-EXCEPTIONS. CLAUDE.md has the mandatory gate:
  `npm run check` = Prettier, ESLint (zero warnings), typecheck, all tests, Semgrep, Snyk (open source + code).
  A task is not done until it passes. Today it runs on the Capacitor stack (TS 7 typecheck, Vitest, Gradle JUnit);
  T-003 moves it to the Expo stack.
- Decisions (Jason): GitHub Releases is the primary channel, Drive an optional mirror (D-1). Snyk Gradle scan
  limited to `releaseRuntimeClasspath` until T-057 (by 2027-02-01; SE-001). `reference/` and `docs/` excluded
  from Snyk Code and Semgrep (SE-002).
- Commits: `ef2107b` format/lint cleanup (typed rules schema `engine/rules.ts`), `ed51a0f` tooling,
  `fc69f5d` plan docs (pushed; `npm run snyk:monitor` ran after the push), `b524245` T-001 (not pushed).
- `tools/device/run.sh` now turns heads-up notifications off during captures (restored on exit): chat
  banners from other apps had landed in screenshots, and the repo is public.

## Done in 0.2.0 (Capacitor; moves to `legacy/` in T-002, behavior is the spec for the port)

- **Scaffold:** Vite + Preact + TS in `src/`, Capacitor 8 Android in `android/`, app ID
  `io.github.mecheng70.pitplanner` (permanent). Launcher icon and splash generated from `assets/`.
- **UI kit** `src/ui/` (components.tsx, ui.css, icons, ripple, back button). Screens use only the kit;
  no per-screen CSS. Roboto bundled. Pinned footers float over the scroll area with a fade and
  matching bottom padding; `KeepVisible` keeps a block on screen after changes.
- **Plan tab** (mockups 04-08) complete. Fidelity audit and screenshots: `docs/fidelity-audit.md`, `docs/fidelity/`.
- **Engine** (36 tests, `npm test`): 5-minute rounding of starts, settable temps, `onHeatSpan`,
  alarms from plan events (`engine/alarms.ts`: grouping, stable step keys, done/reminders/quiet),
  live helpers (`markPullDone`, `extendCook`, `postponeStep`, `smokerOverlaps`).
- **Alarm plugin** (Kotlin, `android/app/src/main/java/.../alarms/`), JS bridge `src/platform/alarms.ts`.
  All device tests passed, including Doze and a locked reboot: `docs/alarm-testing.md`.
  Hidden test screen: Gear, tap the version 5 times.
- **Start cook** checks alert permissions (sheet with Allow rows), saves the cook, schedules alarms.
- **Device tools** `tools/device/` (see its README): `npm run device` does a full unattended pass.

## Cook tab (mockups 12-15): done

Built and device-tested (see git log for the build). Live test with real notifications on 2026-11-11:
alert Done / +15 drain, the "N min past the step." repeat, Quiet, Pit out / Back up to temp, Start over,
Save to history, pellets link all pass. `tools/device/live.mjs` drives a short live cook (start / state /
click / restore; backs up real data first).

Fixed from that test:
- Changes made without asking (alert Done / +15, Not yet) keep serve only if every food keeps its
  minimum rest (`holdsCover` in engine/live.ts, `keepServeIfCovered` in cook.ts); otherwise serve moves.
- Keep/Move sheet: "X: off heat N min after serve." when keep would leave a food late; preselects Move.
- Step alerts no longer auto-cancel when tapped (the body only opens the app); they stay in the shade
  until Done / +15 / swipe. A re-timed step's repeats stop but its notification stays.
- +15 on a fixed step (fire, refill) reminds from now, and not at all if its own alarm is later.
- Alert notices append instead of replacing each other.

Open: Banner "OK" sometimes reads as
not stable to Playwright (only matters for scripts).

## Setup (mockups 01-03, plus Add a cooker 17): done

`src/screens/setup/Setup.tsx` (3 steps: Welcome + units, cookers, alerts), `SmokerPicker.tsx` (picker
and the manual form, also used for unverified catalog models), `src/screens/shared/AddCooker.tsx`
(reuse in Gear). Shows when no `gear` is saved (`state.firstRun`); `finishSetup` saves gear + units.
`seedGear` is gone. Picker groups, chips and notes come from `smokerTypes` in data/cookers.json.
Kit: SetupPage, SetupActions, InputField, CheckRow, OptionCard, DashedButton, PickRow, GroupLabel
`note`, Chips `scroll`, oven avatar glyph. `npm run device` runs `tools/device/setup.mjs` -> `out/setup.png`,
`out/setup-b.png`; it wakes the screen and stops if the phone is locked (unlock it first).

## Gear (mockups 16-20): done

`src/screens/gear/`: `GearScreen` (16: cookers, Cook rates, Alerts sheet, Units sheet, support link,
version), `CookerSheets` (Griddle 18, Oven 19; save only on Save, Remove only when another cooker
remains), `HistoryScreen` (20: rate cards, cook list, cook sheet with Cook again / Remove). Pure helpers
in `src/lib/historyView.ts` take `rules` as a parameter (tests can't import `rules.ts`, it imports JSON);
tests in `engine/history.test.ts`. Records now keep `lateMin` (serve lateness); older ones show no status.
Kit: `ListRow` href/tone/wrap, `IconAvatar`, `Tile` sub, `Tiles inset`, `Screen onBack`, `.card-col`.
Beyond the mockups (told Jason): Units row on Gear, Remove buttons, Home Assistant row has no chevron.
`npm run device -- --only gear` runs just `tools/device/gear.mjs`; it backs up and restores history.json.

## Release signing: done

`npm run release` -> `release/pitplanner-<version>.apk`, signed with `~/keys/pitplanner.jks` via
git-ignored `android/keystore.properties` (template `.example`). Cert `CN=PitPlanner, O=PitPlanner`,
SHA-256 `b6c32d128659d5338c4a8c92f8d3214d96ecfd2430e63e6a76c54549b0880a29`. versionName/versionCode come
from package.json (0.1.0 -> 100): bump it before every release. `-PdebuggableRelease` builds a
release-signed debuggable APK, used once to move Jason's data off the debug install.

**Jason's phone runs the signed release (0.1.0) for real cooks.** Debug builds are a separate dev copy:
`io.github.mecheng70.pitplanner.debug`, label "Pit Planner dev", own data. `tools/device/` (attach.sh,
pending.sh, deploy.sh) only touches the dev copy. Never uninstall the release without backing up first.

Distribution (decided 2026-11-12, D-1): GitHub Releases on the public repo is primary; Google Drive is an
optional mirror. The in-app update check (`src/lib/update.ts`) has nothing to find until the first release
(T-004 checks it, including prereleases).

## Release 0.2.0: on Jason's phone

`release/pitplanner-0.2.0.apk` (versionCode 200), built from `e86d930`, has everything up to the Sportsman 850
entry. Jason installed it himself over 0.1.0 (2026-11-12; not checked over adb, the phone was disconnected).
He still needs to re-pick his smoker as the Pit Boss Sportsman 850 in Gear.

For a future backup of the real app: it is not debuggable (`run-as` refused), targets SDK 36 (`adb backup`
skips its data) and has no WebView DevTools socket. Route that works: install a `-PdebuggableRelease` build of
the same version with `adb install -r` without opening it, copy the data out with `run-as`, then install the
normal APK over it.
Shell note: in zsh, `A="adb -s 5ece07c1"; $A shell ...` does not word-split and prints nothing. Write the
full command or use the bash scripts in tools/device/.

The dev copy was rebuilt from the T-001 work tree on 2026-11-12 (has the Sportsman 850 entry and the
105C/205C fix).

## Cook timing (HA-INTEGRATION.md "Do first"): done, closed out as T-001

Food details Timing: Hours per pound (stepper, 0.05 steps, source shown) / Total hours (any food, used as-is,
`TOTAL_HOURS_FIXED` info when the temp changes) / Size-adjusted (no lock; anchored at the reference weight).
"Use for future [food] on [cooker]" saves `rates` or `totalHours`. Rate rule (Jason): a saved rate is exact
until 3 logged cooks, then blends with them unless locked (`rateLocks`, "Keep my rate exactly" in Gear >
Cook rates). Brisket-style tri-tip is perWeight (1.67 hr/lb, 3.5 hr floor). `npm run device -- --only timing`.

T-001 check against "Do first" (2026-11-12):

| Item | Where | Test |
|---|---|---|
| 1a Hours per pound, 0.05 steps, source shown, 0.3-2.5, soft warning outside 0.5-1.6 | FoodEdit `Timing`, `src/lib/timing.ts`, `sourceText` | `engine/timing.test.ts`; FoodEdit.test "hours per pound shows the rate, its source..." |
| 1b Total hours, as-is, TOTAL_HOURS_FIXED on temp change, any food | engine `plan.ts`; FoodEdit | plan.test "total hours are used exactly..."; FoodEdit.test "total hours..." and "Standard and Total hours" (ribs) |
| 1c Size-adjusted, no lock, anchored at reference weight, "Estimate..." line | engine `rateFor`/`buildItem`; FoodEdit | plan.test "size-adjusted works with no history..."; FoodEdit.test "size-adjusted..." |
| 2 Use for future [food] on [smoker], Gear Cook rates shows it | FoodEdit `save`, store `setRate`/`setTotalHours`, `historyView.rateRows` | FoodEdit.test "stepping the rate..." and "total hours..."; history.test |
| 3 Result card shows the method | FoodEdit `methodText` | FoodEdit.test "a saved 0.75 hr/lb plans 9 hr and the result card names the rate" |
| 4 Engine tests (4 named) | `engine/plan.test.ts` | lines "a 12 lb brisket at 0.75...", "total hours...", "a per-item rate beats...", "size-adjusted works..." |
| 5 One-time published-rate hint | FoodEdit `hint`, `flags.rateHintShown` | FoodEdit.test "shows the published-rate hint once" / "does not show the hint once it has been seen" |
| 6 No truncated numbers at 115/130% | device `timing.mjs` measure | `npm run device -- --only timing`: clipped [] at both scales |
| 7 SPEC 1 and 4 updated | SPEC.md "Timing model" row, section 4 Rates/Total hours/Size-adjusted | n/a |

Screenshots (Sportsman 850, 12 lb brisket, 5:00 PM Sat serve): `docs/fidelity/timing-modes-115.png`,
`timing-modes-130.png` (three modes, 9 hr, fire 6:20 AM), `timing-plan.png` (published 1.25 = 15 hr; Plan at
0.75 hr/lb, fire 6:20 AM, at 115% and 130%). The 115% Total hours panel has a blue system screen tint;
content is unaffected.

## Open shared plan (11): done

`.pitplan` VIEW/SEND intent filters, `share/SharedPlanPlugin.kt` reads the content URI (256 KB cap),
`src/platform/sharedPlan.ts`, pure `src/lib/sharedPlan.ts` (tests `engine/share.test.ts`), `SharedPlanSheet`.
Export drops the sender's rate and total hours. Tested via a file:// VIEW intent (`--only shared`); Gmail/Drive not yet.

Also: Cook tab with food on the plan and no cook = Start cook. Next up title includes the countdown
("Fire the smoker to 225F in 45 hr 50 min"). Lane chart runs from the first step's hour to serve.
`deploy.sh` now stops on a failed build (it used to install the old APK).

HA Phase 0 done: `docs/ha-entities.md` (read-only survey). Jason's smoker is a Pit Boss Sportsman 850
(PB850SPW2), new verified catalog entry `pitboss-sportsman-850`; he re-picks it in Gear. The `pitplanner` HA
user exists. Probe batteries were dead at the survey. Next: HA Phase 1 (needs the 6 mockups in HA-INTEGRATION 4.5 first).

Fixed 2026-11-12: Plan warns (info, orange Pellets tile) when a cook burns more pellets than the hopper holds;
refill alert reads "Top off the hopper. It runs low in about 30 min." (fires 30 min before 10%). Rules and
engine wording converts to C / kg on display (`localizeText` in engine/units.ts, `tx` in format.ts; alarms
via `AlarmOptions.text`). Live changes (Done early/late, Not yet, Pit went out, +15) round scheduled times to
5 minutes; actual past times (pulled at) stay exact.

Idea from Jason (not built): tapping the lane chart opens it full screen in landscape until tapped again
(or a close button), so a long cook's short steps are readable.

Device scripts added this session (all via `npm run device -- --only <name>`): `timing`, `shared`, `update`,
`units` (Celsius + kg pass over Plan, Conflicts, Cook, Full timeline).

## Next

1. Done 2026-11-12: Jason approved the stack-change plan; T-001 phone check on 0.2.0 passed.
2. Jason: push `main` when ready (plan docs and T-001 are local only).
3. Done: Maestro CLI installed (2.12.1, `~/.maestro/bin`).
4. T-002..T-015 and T-017 done (review fixes included), T-016 emulator half done (R-1 closed, D-4 decided and
   confirmed). T-018 built and approved 2026-11-14. Next: T-019, per WBS "Suggested order" (T-058 sits
   between T-019 and the Cook screen).
   Push the `v0.2.0` tag only when Jason says.
5. Still open from before (carried into the plan): real cook with alarms through a reboot (now T-037 on the Expo
   build), two-phone share via Gmail/Drive (T-031), lane chart full screen (T-040), import-made conflict fix
   (T-030), HA Phase 1 after 0.3.0 (T-042 onward), low and slow for tough cuts (T-060, next version).

## Decisions from Jason

- Follow the Android system font size. Times, temps, weights and countdowns never truncate at any
  scale; only secondary text may. Test at 115% and 130% (normal is 115%).
- Engine rounds phase starts to 5-minute steps; off-heat stays exact (serve - slice - rest).
- Plan: only Start cook is pinned; at 115% and at 130% two cards fit whole above it and its fade; at 115%
  the third card may end in the fade and Add food is reached by scrolling (Jason, 2026-11-14; it replaces
  "three cards + Add food at 115%", which a real-size display cannot hold since summaries wrap). These apply
  on the real-size emulator with gesture and with 3-button navigation (Jason, 2026-11-13).
- Plan card summaries wrap to two lines rather than truncate; times and durations never wrap or shrink.
  Nothing half-shows behind a pinned button: content fades out before it (Jason, 2026-11-13).
- Cook a past plan again is hidden while there is no history, bright accent when there is (Jason, 2026-11-13).
- Changing a value never moves the control being tapped or shifts the layout (Jason, 2026-11-12; T-017
  PR-3): tabular digits, fixed-height rows for computed values, no warnings above the control, no automatic
  scrolling. This retires the 0.2.0 "result card scrolls into view after any change" behavior. Jason hit it
  on his phone on 2026-11-14 (weight + and - on Food details scroll the screen and he has to scroll back):
  T-019 carries it as a pass/fail requirement with a regression test and device targets for the weight
  stepper.
- Food details result (T-019): a fixed-height summary bar pinned at the bottom above the tab bar (fire, off
  heat, serve); the full result card stays in the scroll; tapping the bar scrolls to it; meets PR-3.
- Font size and process death (T-058, before the Cook screen): `configChanges` so a font-size change doesn't
  rebuild the screen (text still resizes live); the active cook, selected tab and unsaved edits survive
  process death. Device test with "Don't keep activities" on and a live font-size change mid-cook.
- No UI element that isn't in `docs/mockups` or SPEC without asking Jason first (CLAUDE.md).
- Smoker temp is the dropdown in the cooker's steps, never preset buttons (SPEC section 1; T-017 PR-1).
- Celsius set points show in 2C increments, Fahrenheit in the cooker's 5F steps (Jason, 2026-11-14).
- Add food opens food details first; the food goes on the menu on Save (Jason, 2026-11-14; T-019).
- Conflicts fixes: move to griddle, change temp, edit the food. No "finish earlier" (Jason, 2026-11-14).
- Tough cuts go low and slow; the plan should not push a brisket's temp up to make a serve time without
  saying so, and weight alone does not time a thin flat (Jason, 2026-11-14; next version, T-060).
- Setup step 1 is Welcome + units (the canvas has no step 1). Add a cooker (17) built with Setup.
- Alerts stay in the notification shade until handled or swiped; nothing removes them silently.
- Cost: keep sessions short, screenshot only at checkpoints, use `npm run device` instead of step-by-step driving.

## Known open items

- Font size changed while the app is open (or in the background) recreates the Android activity: the React tree
  remounts, the app returns to the Plan tab, and open sheets, the selected tab and unsaved edits are lost.
  Checked on a release build 2026-11-12. Now task T-058 (Jason, 2026-11-12), done before the Cook screen.

- Oven `warmingDrawer` is stored but unused by the planner.
