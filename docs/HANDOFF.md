# Handoff (2026-11-19: 0.3.0 is released and nothing of 0.3.0 is open; owed: snyk monitor on 2026-12-01, the public roadmap T-091, then the 0.3.1 backlog)

Read SPEC.md and CLAUDE.md first, then `docs/design/TECH-DESIGN.md` and the task you are given in
`docs/design/TASKS.md` (phases and order: `docs/design/WBS.md`). This note is what a fresh session needs on top.

## Restart, twenty-eighth session (written Thursday 2026-11-19, 11:08 AM; read this first)

**Pit Planner 0.3.0 was released today, Thursday 2026-11-19, 11:01 AM.** Published by Jason as a normal
GitHub release (not a pre-release), marked Latest: https://github.com/MechEng70/pitplanner/releases/tag/v0.3.0 .
Tag `v0.3.0` on `53566f8`, the commit he built. One file, `pitplanner-0.3.0.apk`, version code 300999,
106,098,517 bytes, SHA-256 `cf2641b68a232ce09a490d05caa0b7adb700f050f5dfeeee7b5cef84049cc9c2` (GitHub's
digest of the uploaded file is the same). 0.3.0 is on his phone: he installed it himself over beta.3.

**What passed.**

- **The overnight check** (beta.2, his phone, Wed night to Thu morning): alarms set the evening before came
  through about 7 hours of deep idle; the 5:30 AM alert rang 1.085 seconds late. PASS by his decision, with
  the pass line reworded (`docs/t037-checklist.md`, "Overnight check").
- **The rehearsal** (beta.2, his phone, Wed 2026-11-18): 14 alerts, each once, each within 1.6 seconds,
  through a locked reboot. T-037 passes for 0.3.0 (`docs/t037-checklist.md`, "Readout").
- **The locked reboot on the 0.3.0 file** (`tools/device/locked-reboot.sh`, emulator `pitplanner-lock`):
  PASS 6 of 6; the step due at 10:55:00 rang while still locked. The same on beta.3 that morning.
- **The upgrade from the real 0.2.0 to the 0.3.0 file** (`tools/device/upgrade020.sh`, test emulator):
  `PASS  upgrade from 0.2.0`; cookers, the saved rate, the plan draft, units and two past cooks came over,
  nothing quarantined. The screens were not looked at by hand.
- **`turkey` at 115% and 130%** (dev build with the released code): PASS at both; reviewed by Jason.
  Pictures: `tools/device/out/turkey-2026-11-19/`.
- **The review agent** (read-only, in place of /ultrareview, which bills as usage on this account): the code
  diffs of merge 1 and `main..beta3`; no high finding; its two real findings were already 0.3.1 items.
- **Jason's phone pass on beta.3:** steps 1 to 10 passed, nothing wrong at 115%.
- **The update offer, on an emulator** (the real 0.2.0 on `pitplanner-api35`, against the live release,
  11:04 AM): Gear shows "Update available. Version 0.3.0. Download it in your browser, then open it to
  install.", linking to the release's APK, which answers 200 with the right size.
- **The gate** on every merge, on the beta.3 build and on the 0.3.0 build: engine 253, gate self-test 154,
  Jest 997 in 86 suites, Kotlin 117, Semgrep and Snyk clean (one Snyk retry after a Snyk 500).

**State.** `main` holds the release and this close-out; the docs commits made after the 0.3.0 push are not
on GitHub until Jason pushes (`git log origin/main..main`). No branch but `main` and the seven parked
worktree branches below. No agent is running; emulators, Metro and the Gradle daemons are stopped.
`dashboard.html` shows 0.3.0 as released with nothing in progress and 0.3.1 as next (local, never committed;
its old copies are in `tools/device/out/dashboard-backups/`). **His phone has 0.3.0. Nothing is done on it
without a list and his yes. His wife's phone is not part of any test (Jason, 2026-11-19).**

What is on the emulators (test data only): `pitplanner` (Android 16) has the dev build and the 0.3.0
release app with the upgrade test's imported data; `pitplanner-lock` has 0.3.0 with the locked-reboot
test's cook; `pitplanner-api35` has the real 0.2.0 with the upgrade test's setup data. Uninstalling any of
them needs his yes each time.

**Owed, in this order.**

1. **2026-12-01: `npm run snyk:monitor`, once.** Held until then for Snyk's monthly limit. Not before.
2. **T-091: the public roadmap on GitHub** (docs only): a Mermaid timeline at the top of `docs/ROADMAP.md`
   or the README (he picks); the content is agreed word for word in TASKS T-091.
3. **The 0.3.1 backlog, in ROADMAP's order** (`docs/ROADMAP.md`, "0.3.x"; the order is his to change):
   the Celsius step items (store the step's unit, 1C / 2C / 5C / 10C choices, the 1C to 4C manual-form
   bug); wings at 400F on a smoker that tops out lower; per-ABI APKs; the items carried from 0.3.0 (T-094
   to T-101: two device looks, three of his looks at pictures, the user guide wording, the rig fixes, the
   update-with-a-cook-running device test); plural names, the rest; sheet footer buttons in the kit; the
   lane chart label; buttons hidden under the pinned footer at 130%; a failed start says so; T-084 (plan
   edited while a cook runs); T-085 (late taps and learned rates); T-078 (taps with the app closed, a spike
   first); T-086 (rig tests for Not yet, Move serve, Adjust; waits on T-100); T-089 (remove the brine
   options); T-092 (StartCook's double-tap tests); T-093 (the gate's console.error count); T-088 (the
   smoker conflict banner offers a fix); T-031 (the two-phone share; the second phone is to be named); the
   Samsung tester's locked-reboot check. Later: T-057 (Snyk build-tool findings, by 2027-02-01), 0.4.0
   (Home Assistant), T-087 (light theme), 0.5.0 (fish, Chef iQ, T-090).

**0.3.0, reconciled (2026-11-19).** Nothing of 0.3.0 is open. In TASKS the twelve tasks that shipped as
built are marked done (T-033, T-034, T-036, T-064, T-066, T-068, T-074, T-075, T-076, T-079, T-081, T-082),
T-038 is done, and T-031 is moved to 0.3.1. Each open look or device check became its own 0.3.1 item:
T-094 (T-074 on a device), T-095 (T-079 on a device), T-096 (his look, T-081's pictures), T-097 (his look,
T-075's pictures), T-098 (a picture and his look, T-076), T-099 (user guide wording and the ring log
sentence), T-100 (the rig fixes, the button rule, the locked-reboot guard), T-101 (update with a cook
running). `docs/after-readout-checklist.md` has every box ticked with where it went; its Part 1 (INSTALL.md
on his wife's phone) is dropped.

**Waiting on Jason** (none of it blocks anything today): the Home Assistant mockup review (15 questions
plus 5) and T-044's six choices; the connect-error wording and a `.local` test (T-045); a throwaway Home
Assistant token; his wording for T-084, T-085, T-088 and T-099; what happens to saved plans when the brine
options go (T-089); T-090's questions, with the new one (a hand-entered smoker is not in Pick your smoker
afterward); which second phone for T-031; the disk cleanup list; the bug report card in Claude Code;
whether to take his real Home Assistant address out of the public history (it is gone from the files since
2026-11-18 but still in older commits on GitHub; that needs a history rewrite and a force push).

**Parked branches** (worktree `.claude/worktrees/agent-<id>`, branch `worktree-agent-<id>`; none is merged;
details in the tables under "Parked branches" further down): `a5e4bcdedac780e57` per-ABI APKs;
`a161bd82cecaed287` smoker catalog sourcing; `a00d9697f70d1c24c` wings under 400F options;
`a4d0fb0875a099229` T-044 Home Assistant sign-in logic; `a9241eb3e2b1eb08c` T-042 Home Assistant mockups;
`a18cf3154316a2542` fish thickness mockups; `a06dd404e2acfae2a` fish sources.

**Rules and traps from today.**

- **The dashboard** is about what is next: status, the release bars, Today, "Testing needed from you" in
  detail, Waiting on Jason. Update it at every milestone and every agent start and stop; its time comes
  from `date`; the keeper removes what is done and never removes task rows (the bars count them). CLAUDE.md
  has the rule.
- **A real release needs an empty `git status`.** Put nothing untracked in the repo (`.claude/worktrees/`
  is ignored since `c49dd99`).
- **Commands for Jason's terminal stay short.** A long one-liner broke at `--notes-file` when pasted and
  ran half. Give lines under about 100 characters, one per block.
- **0.2.0 asks GitHub for `/releases/latest` and drops "-beta.N" when comparing.** A beta posted without
  `--prerelease` would be offered to every 0.2.0 user. The 0.3.0 app goes by the tag name.
- **A gate log captured to a file holds no console output from passing suites** (T-093). Jason's terminal
  showed six "overlapping act()" errors the session never saw (T-092).
- **The first gate after the computer restarts can fail step 4 with Jest 5 second timeouts** (empty Jest
  cache). Run it again, unchanged.
- **React Native layout, found on the emulator and not by Jest:** a `minWidth` is added to an equal share,
  not a floor; the first `flexBasis` a view gets is kept, a later one does nothing; a class and a style for
  the same property do not mix safely. `Segmented` is sized by `width`. Look at the screen after any
  layout change.
- **`pgrep -f` and `pkill -f` match their own command line.** Put a bracket in the pattern
  (`tools/[r]elease.sh`).
- **/ultrareview is off on this account.** A read-only Sonnet agent with a narrow brief did the review.
- **Do not touch the repo while Jason's release build runs** (its clean prebuild can stop on a dirty tree).

**To start the next session,** Jason clears the conversation and says: "Read CLAUDE.md, then
docs/HANDOFF.md and follow its top section, 'Restart, twenty-eighth session'."

## Restart, twenty-seventh session (written Wednesday 2026-11-18, 5:50 PM; superseded by the section above)

**Rule (Jason, 2026-11-18, 2:40 PM).** Before saying a task, mockup or design doesn't exist, check the parked
branches and `.claude/worktrees` as well as `main`: the tables under "Parked branches" below,
`git branch --list` and the worktree folders. A Status line of `todo` in TASKS on `main` does not mean
nothing is built. Why: that afternoon the main session told Jason the Home Assistant screens were not
mocked and no sign-in code existed, from `main` alone; both were on parked branches from 2026-11-17, and an
agent then made a duplicate set of mockups.

**State (Wednesday 2026-11-18, 5:55 PM, end of the twenty-sixth session).** `main` is clean (only `.claude/`
untracked). **Not pushed: the commits from `24dfb2a` on (26 of them; `git log origin/main..main`
lists them). All are docs only** (docs, SPEC, CLAUDE.md, `.gitignore`); Jason pushes or
asks. No app code changed on `main`, so the last gate on code is still the one on `1cecd97`. Emulators,
Metro and Gradle are stopped; no agent is running. The freeze on `main` holds until Thursday's readout.
`dashboard.html` is current and trimmed to one screen (local, never committed); after any edit to it, load
it in headless Chrome and report the page error count, which must be 0 (CLAUDE.md, Models and agents).
**His phone: unplugged for the night, 0.3.0-beta.2, the overnight check's cook running with four alarms
(the 5:36 PM read). Do nothing on the phone without a list and his yes.**

**Thursday 2026-11-19, in order.**

1. **By 7:30 AM, Jason:** End cook, Discard this cook; then Gear, 5 taps on the version line, Send to
   developer. He puts the debug file where the session can read it (read it in place, never commit it,
   delete it when he says).
2. **Then he plugs the phone in. Say first that it is about 2 minutes, list the reads, and wait for his
   yes:** `adb -s 5ece07c1 shell dumpsys alarm` (nothing of the app's left), `dumpsys deviceidle`,
   `dumpsys batterystats --history`; each saved under `tools/device/out/` (git-ignored). The ring log is in
   the debug file.
3. **Read the overnight check:** the 5:30 AM ring within 1 minute while the phone was in deep idle
   (the ring log's `idle` flag, checked against `device_idle=full` in the battery history; on the rehearsal
   the two agreed on all 14). Unanswered alerts repeat every 10 minutes, so repeats in the log are expected.
   Write the result into `docs/t037-checklist.md` ("Overnight check", the table and "Result") and TASKS T-037.
4. **The readout,** from the rehearsal's reads and the overnight check; then the freeze on `main` ends.
5. **The beta.3 merges,** item 4 below, one at a time.

**Thursday morning: steps 1 to 4 are done. Overnight check: PASS (Jason). The readout is done, T-037
passes for 0.3.0, and the freeze on `main` has ended (Jason, Thu 2026-11-19).** The 5:30 AM alert rang
1.085 seconds late after about 7 hours of deep idle (4 hours unbroken, 1:11:25 to 5:11:26 AM); the phone
was in light idle at the ring because Android leaves deep idle when an alarm clock is under 1 hour away
(`min_time_to_alarm=+1h`). Pass line reworded by Jason for any future check: "ring within 1 min after the
phone spent hours in deep idle overnight." Detail and the readout table: `docs/t037-checklist.md`,
"Overnight check" and "Readout". Reads: `tools/device/out/t037-overnight-2026-11-19/`. The debug file was
deleted at his word. Nothing more on the phone without a list and his yes.

**Merge 1 is done (Thu 2026-11-19, 7:27 AM): `main` at `eb490f8`, not pushed; stopped for Jason's review
before merge 2.** Branch `a8775a2ca28f2344f` brought up to `main` (docs only, no conflicts), merged, its
worktree and branch removed. Gate: the first run failed step 4 with 12 Jest 5 s timeouts, each the first
test of its suite (the computer had been restarted 16 minutes before, so the Jest cache was empty: the gate
note in "START HERE", item 7); the second run, nothing changed, passed all six steps: engine 229, gate
self-test 154, Jest 937 in 86 suites, Kotlin 117 (pit-alarms 68, pit-legacy 9, pit-share 40), Semgrep,
Snyk. **The emulator Not yet check passed** (test emulator, dev build, 115%, 7:33 to 7:34 AM; reads in
`tools/device/out/notyet-merge1-2026-11-19/`): 11 alarms before and 11 after, each time once; Check the
brisket 8:50 to 9:20 AM, Check tenderness (the brisket's pull) 12:55 to 1:25 PM, and Oven to 170F 12:40 to
1:10 PM (it is set 15 minutes before the first held food comes off, so it follows the pull); the other
eight where they were; nothing left at 8:50 AM, 12:40 or 12:55 PM; serve stays 2:15 PM; the event log has
"plan changed: 18 events" then one "set 11, exact". The app also showed "Smoker conflict: brisket at 225F
and chicken wings at 400F at the same time." (the pull is now after the wings' turn-up at 1:20 PM). The
emulator shows "Alerts are off. Steps may not ring." on Cook; not looked into. Emulator and Metro are
stopped.

**Branch `beta3` (Jason, Thu 2026-11-19): merges 2 to 7 go onto `beta3`, cut from `main` at `fae644a`, not
onto `main`. `main` stays at `fae644a` until Jason has run /ultrareview from `beta3` and the findings are
reviewed.** Same order, the full gate alone after each, counts reported, every conflict listed with how it
was resolved; a conflict that needs a choice about behavior or wording stops the merge and he sees the
hunks. Commits on `beta3` are local, not pushed. The merged branches' worktrees are kept until `beta3` is
on `main`. When merge 7 is merged and gated: tell him in one line that `beta3` is ready for /ultrareview,
with `beta3` checked out and the tree clean (only `.claude/` and `dashboard.html` untracked), and wait.

**On `beta3` at 7:56 AM, Thu 2026-11-19, stopped for his review after merge 3:**

| Step | Commit | Conflicts | Gate (all six steps pass) |
|---|---|---|---|
| Merge 2: T-082 (`a0ce7915c8c901c69`) with its mockups (`a1211e2e2ed4313e1`) | `cf59767`, `4b4211f` | none | engine 241, gate self-test 154, Jest 976 in 86 suites, Kotlin 117 |
| Kamado chip fix (T-066) | `a3313b9` | not a merge | engine 241, self-test 154, Jest 977, Kotlin 117 |
| Merge 3: sheet buttons (`a8c0f87e3e0ab96ed`) | `11cbcbe` | none (`GearScreen.tsx`, `StartCook.test.tsx` and `GearData.test.tsx`, also changed by merge 1, merged by git with both sides kept) | engine 241, self-test 154, Jest 981, Kotlin 117 |

- **Chip fix:** pictures at 115% and 130% in `tools/device/out/chips-2026-11-19/` (`picker-chips-after-1.15.png`,
  `picker-chips-after-1.3.png`; the `before` pair shows "Kamad"). Detail in TASKS T-066.
- **"Alerts are off. Steps may not ring." on the emulator's dev build (read only, nothing changed):** the
  dev build (`io.github.mecheng70.pitplanner.debug`) is not on the battery allowlist, so
  `batteryUnrestricted` is false and the banner shows. Notifications are on (`POST_NOTIFICATIONS` granted,
  channel `steps_v1` importance high), exact alarms are allowed (`USE_EXACT_ALARM` granted). Alerts post
  all the same; only "No battery limits" is off. The rig's `alarm` test takes the dev build off the
  allowlist for its Doze step (`run.sh` line 588) and puts it back only if it was on. The release build on
  the emulator (`io.github.mecheng70.pitplanner`) is on the allowlist; the locked-reboot test uses the
  release build.
- **Owed for T-082 after merge 2:** the SPEC lines for the step question, the rig lines for Gear's smoker
  row, the emulator Setup and Gear looks at 115% and 130%, his look. `start-check.png` for the guide is
  retaken after merge 3 (merge 7's note).
- **New backlog:** T-088 (0.3.1), the smoker conflict banner after Not yet offers a fix; T-089 (0.3.1),
  remove the brine options; T-090 (0.5.0), request a catalog addition, mockup first.
- **After 0.3.0 ships (Jason, 2026-11-19):** T-091, the public roadmap on GitHub: a Mermaid timeline at the
  top of `docs/ROADMAP.md` or the README (he picks); the content is agreed word for word in TASKS T-091.

**`beta3` is ready for Jason's /ultrareview (9:10 AM, Thu 2026-11-19, after the "Other" fix `3936c1c`): merges 1 to 7 are in, each gated;
`beta3` is checked out and the tree is clean; `main` is still at `fae644a`; nothing is pushed. Wait for
him.** After the table above:

| Step | Commit | Conflicts and how resolved | Gate (all six steps pass) |
|---|---|---|---|
| Merge 4: plural names and capitals (`a162a9d40e02d7402`) | `4086d3a` | none: `engine/plan.ts`, `TempMenu.tsx`, `TempMenu.test.tsx` and `CookerSheets.test.tsx` merged by git, different lines | engine 253, gate self-test 154, Jest 991 in 86 suites, Kotlin 117 |
| T-082 follow-ups: SPEC lines, rig lines | `0eb5c31`, `a2e1b40` | not a merge | same counts |
| Merge 5: release notes (`a9b7f7e3f7806b35c`) | `b68bc2d` | `docs/release-notes/0.3.0.md`, two hunks in "Check before release": the branch's rewritten list kept, main's "A cook that is still running comes over too" item added on top, the branch's "Samsung, if declined" item dropped because main's "The Samsung line is settled" replaces it (kept), the branch's two new items kept. Restart lines (Jason, 2026-11-19): his two lines from main kept word for word, the branch's "After a restart, your alarms come back before you first unlock the phone. A step that comes due while the phone is still locked rings." dropped | same counts |
| Merge 6: README (`a6d5ad9a3b663d00e`) | `1e131d7` | `README.md`, one hunk: the branch's new README kept; main's "Good to know" paragraph (unlock once after a restart) kept word for word, placed under Install. `docs/DEVELOPING.md` created from the old README's developer content | same counts |
| Merge 7: guide pictures (`af96b15db6f617be3`) | merge before `e8204c8` | none | same counts |

- **Also on `beta3`:** SPEC and the user guide give the picker's chips in the app's order; the chip row
  keeps scrolling (Jason). Brine options stay as they are for 0.3.0, the release notes' Cook list says
  "Brine options don't change the plan. They'll be removed in the next update.", and T-089 in 0.3.1 removes
  them; no brine or prep reminders are planned, prep stays out of the app (Jason). `docs/guide/start-check.png`
  retaken after merge 3 (`e8204c8`): both buttons on screen.
- **T-082 pictures** (test emulator, 115% and 130%): `tools/device/out/t082-2026-11-19/`,
  `setup-step-question-1.15.png`, `setup-step-question-1.3.png`, `gear-smoker-sheet-1.15.png`,
  `gear-smoker-sheet-1.3.png`. **Found, for Jason: on Setup's smoker card the "Other" choice breaks onto two
  lines at 115% ("Othe" / "r") and at 130% ("Oth" / "er").** In Gear's Smoker sheet it fits at both. Cause:
  the card is narrower than the sheet: an equal share is 56 dp and "Other" with its padding needs 59 dp at
  115%. **Fixed the same morning on his decision (`3936c1c`), in the shared `Segmented`: no segment label
  ever breaks or is cut; segments stay equal while every label fits, otherwise a long label gets the width
  it needs and the others share the rest; the padding gives way before a label does.** Tests first (seen
  failing); gate passed (Jest 997, engine 253, Kotlin 117). Pictures after the fix, same folder:
  `setup-step-question-1.15-fixed.png`, `setup-step-question-1.3-fixed.png`,
  `gear-smoker-sheet-1.15-fixed.png`, `gear-smoker-sheet-1.3-fixed.png` (Setup: Other 59 dp at 115%, 64 dp
  at 130%, the four numbers equal; Gear: all five equal, as before). **Two traps found on the emulator, not
  by Jest:** React Native adds a segment's `minWidth` to an equal share (so a minimum alone makes the
  segments unequal), and it keeps the first `flexBasis` it works out (a basis set after measuring does
  nothing). The control is sized by `width`.
- **Rig:** `setup` and `gear` pass at 115% with the new T-082 lines. At 130% both fail on the two rig faults
  known since 2026-11-17 (the full device pass's table: Alerts below the first screen on Gear; the test
  alert button under the pinned buttons on Setup); the T-082 lines pass there too.
- **Dashboard (Jason, 2026-11-19):** what is next, not a tracker: status, the release bars, Today, Waiting
  on Jason (rule in CLAUDE.md). The page from before is at
  `tools/device/out/dashboard-backups/dashboard-before-prune-2026-11-19.html` (moved there on 2026-11-19).
- **The release notes' "Check before release" list** still has an item to add a Gear line for the temp step
  question now that T-082 is merged; not added (wording is his at the release cut).
- **/ultrareview is off on this account (it bills as usage). In its place (Jason, 2026-11-19): one read-only
  Sonnet agent reviewed the code diffs of merge 1 and `main..beta3` for real bugs, 9:18 to 9:21 AM. Nothing
  was changed or fixed. No high finding.** (1) Medium-low: `src/lib/sharedPlan.ts:243` (`fitPitTemp`) and
  `src/screens/gear/HistoryScreen.tsx:537` (`tempsFor`) read the smoker's grid in F only, so in Celsius
  display with a 5C to 25C step a shared plan's temp is snapped to, and a past cook's temps are offered
  from, the wrong grid. Already known and put in 0.3.1 by Jason on 2026-11-17 (TASKS T-082, the 0.3.x
  Celsius item). (2) Low: plural food names still take singular verbs in the overlap note and the keep or
  move subtitles (`src/lib/cookView.ts:213`, `:64`): "Chicken wings comes off ...", "Chicken wings holds
  ...". Already in ROADMAP for 0.3.1 ("Plural food names, the rest"). (3) Low, not a regression: the
  overlap note's second line uses the full food name where its first uses the short one
  (`cookView.ts:213`). Its unconfirmed item, a double tap on the check sheet's Start buttons, is not a
  bug: the sheet's `close` runs its callback once (`src/components/kit/sheet.tsx:241`, read by the main
  session). Areas reported clean: `saveCook` and `sync()`, the share guard, `GearScreen.tsx`, `Chips`,
  `Segmented` and `segmentFit`, the T-082 arithmetic. His review of these is next; then `beta3` onto
  `main`, he pushes, then the beta.3 build.
- **`main` is at `beta3` (9:24 AM, Thu 2026-11-19; fast-forward, Jason's go after reading the findings).
  Not pushed: he pushes from his own terminal. The seven merged branches' worktrees and branches are
  removed; `beta3` is kept until the beta.3 build is on his phone; the seven parked 0.3.1 and 0.4.0
  worktrees are untouched. Checked before the push: nothing under `tools/device/out/`, no debug file, no
  `.env` or `ha.env`, no `dashboard.html`, no signing file in any of the commits; the token in his private
  Home Assistant file appears nowhere in them. Pushed by him the same morning (`origin/main` at `edfbeba`).
  **`npm run snyk:monitor` was not run for this push: it is held until 2026-12-01 (the monthly limit) and
  is owed on 2026-12-01.** Next: the beta.3 release command, which he runs.
- **beta.3 is built, tested on the emulator and on his phone (10:13 AM, Thu 2026-11-19).**
  `release/pitplanner-0.3.0-beta.3.apk`, version code 300303, SHA-256
  `14eb570d4294b3f2c30a53f93e79712ef165708c3642eb109ce452a2ff8b8e45`, cert and app config verified by the
  release script; its gate passed (Snyk needed one retry after a Snyk 500). He ran the build.
  - **Locked reboot on the APK** (`tools/device/locked-reboot.sh`, emulator `pitplanner-lock`, 115%): PASS 6
    of 6 on the first run; the step due at 10:05:00 rang while still locked; `tools/device/out/locked-reboot.txt`.
  - **`turkey` at 115% and 130%:** PASS at both (dev build with `main`'s code: the rig drives dev links,
    which a release APK does not have). 12.0 lb, rest 30 min, 0.50 hr/lb "published estimate", fire 9:55 AM,
    off heat 4:15 PM, serve 5:00 PM; at 220F Conflicts reads 1 and the sheet says "Whole turkey needs the
    smoker at 225F or hotter. It is set to 220F." Pictures: `tools/device/out/turkey-2026-11-19/turkey-115.png`
    and `turkey-130.png` (six screens each; the single screens are in `1.15/` and `1.3/` beside them).
  - **On his phone:** he installed beta.3 himself over beta.2; the version line reads 0.3.0-beta.3 and his
    settings are there (Jason, about 10:08 AM). Nothing was done to the phone by the session. Branch `beta3`
    is deleted (it was to stay only until the build was on his phone).
  - **Owed by him:** the layout pass on beta.3 (the ten steps are on the dashboard under "Testing needed
    from you", and in the session's report). Friday, if he wants: beta.3 as a GitHub pre-release for one
    friend, with `--prerelease`. Why that mark matters: the 0.2.0 app asks GitHub for `/releases/latest`,
    which leaves pre-releases out, and it drops the "-beta.3" part when it compares, so a beta posted as a
    normal release would be offered to every 0.2.0 user. The 0.3.0 app reads the release list and goes by
    the tag name. No release is published on GitHub today (the list is empty; `/releases/latest` is 404).
  - **Snyk's "Ignored: 1 HIGH"** in the gate's summary is not SE-001 / T-057 (that is a scope flag and never
    shows as ignored). It is in the npm project and comes from the `.snyk` ignore list, SE-003 (Metro and
    dev-server tooling): `SNYK-JS-BRACES-19963945` or `SNYK-JS-OPEN-22112123`. The summary does not say
    which; `snyk test --include-ignores` would, and was not run (the monthly limit).
  - **New 0.3.1 items:** T-092 (StartCook's two double-tap tests print six "overlapping act() calls" errors
    while passing; not new since merge 1) and T-093 (the gate counts `console.error` lines).
  - **Dashboard:** a "Testing needed from you" section under Today, kept current (rule in CLAUDE.md).
- **Jason's decision, Thu 2026-11-19, late morning: no pre-release. Release 0.3.0 today from the beta.3
  code.**
  - **His phone pass on beta.3 (2026-11-19): steps 1 to 10 passed, nothing wrong at 115%.** Two things he
    did differently from the list: in step 2 he saved a hand-entered smoker ("fake") and switched back to
    the Pit Boss 850; in step 6 he tapped Replace, not Cancel ("Restored 3 cookers, 2 cook rates, and 1
    cook", from the step 5 export). The brisket rate is still 0.65.
  - **Turkey test:** reviewed by him and passed at 115% and 130%.
  - **New question, with T-090 (0.5.0):** a hand-entered smoker does not appear in Pick your smoker
    afterward. Should it, and how does that tie to sending it to the developer? Read the code later; no
    work now.
  - **His calls before the build (2026-11-19):** the old "set your own step" line is out of the release
    notes; the user guide keeps one sentence for unlisted smokers ("If your smoker isn't listed, pick 'Not
    listed? Enter it yourself.'"); the release notes' known limits say the two-phone share has not been
    tested on two real phones; the ring log in guide section 11 waits for 0.3.1; 0.3.0 ships with twelve
    tasks marked built, their open looks carried to 0.3.1 (ROADMAP, 0.3.x, "Carried from 0.3.0"); the
    README keeps the four pictures the session picked. **His yes: uninstall the beta.2 release app from the
    test emulator and run the 0.2.0 upgrade test on the 0.3.0 file after his build, then the locked reboot
    on the 0.3.0 file; report both before he publishes.** (He first said he would check the update offer on
    his wife's phone; changed the same day: her phone is not part of any test, the check was run on an
    emulator.)
  - **No app code changed since the beta.3 build:** the commits after the pushed `edfbeba` (`8327394`,
    `ce0eb2d`, `17076d9`) touch `docs/` and CLAUDE.md only. The 0.3.0 commit changes the version in
    `package.json` and `package-lock.json` and nothing else in the app.
- **0.3.0 IS RELEASED: Thu 2026-11-19, 11:01 AM, published by Jason.**
  https://github.com/MechEng70/pitplanner/releases/tag/v0.3.0 . Checked from GitHub right after: not a
  pre-release, not a draft, the only release and so Latest (`/releases/latest`, what the 0.2.0 app asks,
  answers `v0.3.0`); exactly one file, `pitplanner-0.3.0.apk`, 106,098,517 bytes, GitHub's digest equal to
  the build's SHA-256; the release text is the notes file with the SHA line and the full INSTALL link; tag
  `v0.3.0` on `53566f8`. `main` was pushed first (`83b2bd9`). His first paste of the publish command broke
  across two lines at `--notes-file` and published nothing; the command was then given as three short lines.
  **The update offer** was then checked on an emulator, not on a phone (the top section has it). **Owed
  2026-12-01:** `npm run snyk:monitor`.
  **Next work is 0.3.1** (ROADMAP, 0.3.x; start with "Carried from 0.3.0").
- **0.3.0 is built and tested (10:55 AM, Thu 2026-11-19); publishing is his, one command at a time.**
  `release/pitplanner-0.3.0.apk`, version code 300999, SHA-256
  `cf2641b68a232ce09a490d05caa0b7adb700f050f5dfeeee7b5cef84049cc9c2` (checked again by the session), cert
  and app config ok; he ran the build on commit `53566f8` (the tag `v0.3.0` goes there). The release notes
  have the SHA, no draft note and no check list (`ec1b7c9`), and their INSTALL link is a full address so it
  works in the GitHub release text.
  - **Upgrade from the real 0.2.0 on the test emulator** (`tools/device/upgrade020.sh setup`, then `check`
    on the 0.3.0 file; the beta.2 release app was uninstalled there first with his yes): `PASS  upgrade from
    0.2.0`. The notice said everything came over; cookers griddle, oven, smoker (Pit Boss 820); brisket
    0.75; one plan draft item; units F and lb; two past cooks; nothing quarantined; both `.imported` copies
    kept. The screens were not looked at by hand on the emulator.
  - **Locked reboot on the 0.3.0 file:** PASS 6 of 6, first run; the 10:55:00 step rang while locked.
  - **His phone:** he installed 0.3.0 over beta.3 himself; Gear shows 0.3.0 and the brisket rate is still
    0.65 (Jason, about 10:38 AM).
  - **Left:** he pushes `main`, tags `v0.3.0` on `53566f8` and pushes the tag, then publishes with
    `gh release create` as a normal release (not `--prerelease`), one APK. The update offer is checked after
    that (done on an emulator, the top section has it). `npm run snyk:monitor` is owed on
    2026-12-01, not before.
- **User guide (Jason, 2026-11-19):** the alerts section now says "The other foods' alarms catch up when
  you open the app."
- **Next:** his review of the findings above; `beta3` onto `main`, then remove the merged
  worktrees and branches; then the beta.3 build (he runs the release command), the emulator locked reboot,
  the `turkey` test at 115% and 130%, beta.3 on his phone. Cutoff Friday noon.

**Jason's decisions, 5:45 PM: "beta.3, and no Saturday cook. T-037 closes on today's rehearsal; I don't load
Saturday's plan."**

1. **T-037 is done on the rehearsal of 2026-11-18** (0.3.0-beta.2 on his phone): 14 alerts, each once, each
   within 1.6 seconds; results, the three evening reads, what was not tested and where tests cover it, in
   `docs/t037-checklist.md`. The phone reads are in `tools/device/out/t037-rehearsal-2026-11-18/`
   (git-ignored; they name other apps, never commit them).
2. **Overnight check on beta.2, tonight** (`docs/t037-checklist.md`, "Overnight check"): Chicken breasts, 4,
   griddle, Start at Thu Nov 19 5:30 AM; four alerts, 5:30, 5:45, 5:57, 6:05 AM. He enters it and taps Start
   cook once; after his yes the alarm list is read; he unplugs until morning; by 7:30 AM he discards and does
   Send to developer; after his yes the ring log, `dumpsys deviceidle` and the battery history are read.
   Pass: the 5:30 AM ring within 1 minute while the phone was in deep idle. **Where this stands is in that
   section's table: read it before doing anything on the phone.**
3. **Readout Thursday 2026-11-19**, from the rehearsal's reads and the overnight check.
4. **beta.3: merges by Friday 2026-11-20 noon, in this order, the full gate (`npm run check`) alone after
   each, its counts reported. Anything not merged and gated by noon goes to 0.3.1.** No merge before the
   readout. `main` has moved (docs) since every branch was cut, so each merge starts by bringing the branch
   up to `main`.

   | # | Branch | Holds | pit-alarms | Restore code | `cook.ts` |
   |---|---|---|---|---|---|
   | 1, **merged Thu 2026-11-19, `eb490f8`** | `a8775a2ca28f2344f` (3 commits) | Share guard and start guard | no | no | no (it changes `saveCook` in `src/lib/store.tsx`, the save every cook change goes through, plus `shareFile.ts`, `PlanTab.tsx`, `GearScreen.tsx` export only) |
   | 2, **merged onto `beta3` Thu 2026-11-19** | `a0ce7915c8c901c69` (6 commits) | T-082 temp step question, with its mockups branch `a1211e2e2ed4313e1`, the SPEC Units text, and the emulator Setup and Gear looks at 115% and 130% | no | no | no (it changes `engine/plan.ts`, `engine/temps.ts`, `engine/units.ts`, `src/lib/gear.ts`, Setup, the picker, `TempMenu`, `CookerSheets`) |
   | 3, **merged onto `beta3` Thu 2026-11-19** | `a8c0f87e3e0ab96ed` (3 commits) | Sheet buttons off the right edge at 115% | no | no (it changes the "Replace your data?" sheet's buttons in `GearScreen.tsx`, not `src/db/restore.ts`) | no (`CookOptions.tsx`, `StartCheckSheet.tsx`) |
   | 4 | `a162a9d40e02d7402` (7 commits) | Plural food names and capitals | no | no | no (`src/lib/cookView.ts`, not `cook.ts`; also `data/foods.json`, `engine/labels.ts`, `engine/plan.ts`, `engine/rules.ts`, `sharedPlan.ts`, six screens) |
   | 5 | `a9b7f7e3f7806b35c` | Release notes | no | no | no (docs only) |
   | 6 | `a6d5ad9a3b663d00e` | README (create `docs/DEVELOPING.md` at merge) | no | no | no (docs only) |
   | 7 | `af96b15db6f617be3` | Guide pictures (5 slots; 17 are on `main` already; `start-check.png` is retaken after merge 3) | no | no | no (docs only) |

   **After merge 1, an emulator check (Jason, 2026-11-18): start a cook, tap Not yet, then `dumpsys alarm`
   shows the moved times.** Why: cancelling and setting the alarms runs from `saveCook` itself: its last
   line calls `sync()`, which queues `syncAlarms` (replace the phone's whole set) after the save and the
   state update, and merge 1 changes `saveCook` (the "cook started" log line moves to after the save; the
   `sync()` call is not touched, and a save that throws reaches neither `commit` nor `sync`, before or after
   the change). How: test emulator, dev build, 115% (`--no-build`, nothing native changed); end any cook
   (`pitplanner://dev/alarm?cook=end`), open the mockup cook (`pitplanner://dev/plan?seed=cooking`, Next up
   is the brisket's wrap check); save `adb -s emulator-5554 shell dumpsys alarm` and list the dev build's
   pending alarms; Cook options, "Not yet, check again in 30 min"; list them again. Pass: the brisket's
   check is 30 minutes later with its later steps, the other foods' alarms are where they were, the count
   is the same, every time once, nothing left at an old time, and the event log has one "set N" line for
   it. Then the gate, as for every merge.

   Checked 2026-11-18 5:30 PM from each branch's file list against `main`. Known conflicts are listed under
   "Parked branches" below (T-082 and the capitals fix both change `TempMenu.tsx` and `engine/plan.ts`;
   merges 1 and 3 both change `GearScreen.tsx`, `StartCook.test.tsx` and `GearData.test.tsx`; the two code
conflicts the earlier session listed are `TempMenu.tsx` and `CookerSheets.test.tsx` between T-082 and the
plural fix, and `src/lib/gear.test.ts` for T-082).
5. **Then:** the beta.3 build (Jason runs the release command), the emulator locked reboot on beta.3
   (`tools/device/locked-reboot.sh`), the `turkey` test on the emulator at 115% and 130%, then beta.3 on his
   phone. **Release 0.3.0 Monday 2026-11-23 unless he says earlier.** **No other phones are tested for 0.3.0
   (Jason, 5:50 PM):** the two-phone share test and the Samsung tester's locked-reboot request move to
   0.3.1; his wife gets 0.3.0 when he sends it, not beta.2; INSTALL.md wording fixes still go in before
   Monday (`docs/after-readout-checklist.md`, top). New 0.3.1 backlog: T-086, rig tests for Not yet, Back up
   to temp with Move serve and the Adjust tap.

**Also from today, in the docs:** Home Assistant step 0 passed (`docs/ha-entities.md`); his login is in a
private file outside the repo (`~/.config/pitplanner/ha.env`; never print or copy it); the app adds the
scheme when none is typed and the connect screen says "Will connect to ..." (TASKS T-045); the real Home
Assistant address is replaced by an example in the tracked docs. User guide: text audited, 17 pictures in
`docs/guide/` (TASKS T-066). New backlog: T-084, T-085. The `turkey` test: `docs/after-readout-checklist.md`.

**Waiting on Jason.**

- The Home Assistant mockup review: the 15 questions in the proposal on branch `a9241eb3e2b1eb08c`, plus
  the 5 kept from the deleted duplicate (the "(deleted)" row under "Parked branches").
- T-044's six open choices (http to a remote host, port 8123, what counts as home network, IPv6, timeout, a
  refused token staying refused).
- The connect-error wording, on the mockup first: the first connect fails and the app added the scheme, so
  it tells him to type the full address with `http://` or `https://` (T-045).
- A throwaway Home Assistant token, to test deleting the token at Home Assistant on Disconnect (the delete
  call would end the token in use, so step 0 did not try it; `docs/ha-entities.md`).
- A `.local` address tested on his phone before the connect screen offers one (T-045).
- The bug report card in Claude Code, still to review and send.
- After the readout (the "Kamad" chip is fixed on `beta3` and the brine options are settled, T-089, both 2026-11-19):
  wording for T-084 and T-085; the open user guide wording (TASKS T-066); the disk cleanup list.

**Settled the same evening, already in the docs:** the light theme (T-087) comes after 0.4.0 as its own
small release, mockups first; INSTALL.md got its one fix (the oven hold line, with the 60C note kept); the
release notes carry his line on restarts ("only tested on a OnePlus with Android 16"); SPEC's definition of
done puts the two-phone round trip in 0.3.1 and the Adjust, Pit went out, Not yet line reads "0.3.0: covered
by Jest; phone check in 0.3.1 (T-086)".

**The overnight check is started (5:36 PM read):** four alarms pending on his phone, Thursday 5:30:00,
5:45:00, 5:57:00 and 6:05:00 AM, each once, nothing else of the app's; the phone is unplugged for the night (Jason, about 5:50 PM). The reads
of the day, the midday ones too, are in `tools/device/out/t037-rehearsal-2026-11-18/`.

**To start the next session,** Jason clears the conversation and says: "Read CLAUDE.md, then docs/HANDOFF.md
and follow its top section, 'Restart, twenty-seventh session'." Thursday morning he adds that the overnight
cook is discarded, where the debug file is, and that the phone is plugged in.

## Earlier on Wednesday 2026-11-18 (written 8:00 AM; superseded where the section above differs)


**State.** `main` is clean (only `.claude/` untracked); the commits not pushed are listed by
`git log origin/main..main` (docs only; Jason pushes or asks). No code changed in the twenty-sixth session, so
the last gate on code is still the one on `1cecd97`. Emulators, Metro and Gradle are stopped, no agent is
running, fourteen branches are parked, none merged. `dashboard.html` is current. The freeze holds until
Sunday's readout.

**Saturday's cook is running on Jason's phone** (0.3.0-beta.2 / 300302, started Wed 2026-11-18 before
7:58 AM, three nights early by his choice): serve Sat Nov 21 5:00 PM, smoker 225F, brisket 10 lb, wings,
chicken breasts. Read at 7:58 AM: 13 alarms, each time once, 8:50 AM, 9:10 AM, 12:40 PM, 3:15, 3:25, 3:40,
4:05, 4:20, 4:25, 4:40, 4:52, 4:55 and 5:00 PM; nothing before 8:30 AM. Nothing was read from the phone
after that. He does not end that cook, start another, or open the dev build before Saturday. One tap only
on Share plan and Export my data.

**Changed at 8:05 AM (Jason): the same staged cook runs today, Wednesday, as a rehearsal** (ready today
5:00 PM, Saturday's times; `docs/t037-checklist.md`, "Rehearsal"). He ends Saturday's cook for it and loads
Saturday's plan again tonight, then step 15's read again. Saturday stays the main run. What is on the phone
is whatever the last read in the checklist says, not the paragraph above.
If today is clean (Jason's lean, 8:15 AM, not decided): the readout on Thursday from tonight's reads; a
0.3.0-beta.3 on Friday with a hard cutoff (anything not merged and gated by Friday noon waits for 0.3.1;
the share guard and the start guard first, then T-082, then the small branches); the emulator's
locked-reboot on beta.3 before his phone. With beta.3 he does not load Saturday's plan tonight: beta.3 goes
on the phone Friday, then he loads Saturday's plan and step 15 is read. Tonight's reads stay: after Discard,
Send to developer, then `dumpsys alarm` (nothing pending), `dumpsys deviceidle` and
`dumpsys batterystats --history`, before the phone charges to full.

**Next: Saturday 2026-11-21, the Saturday table of `docs/t037-checklist.md`.** The cook is Jason's; Claude
is needed once, at 12:25 PM, for one read-only adb line after his yes (the battery history to a file), then
he reboots at 12:30 PM. Sunday 2026-11-22: the readout (filter both logs to Saturday: they also hold
Tuesday's and Wednesday's starts and discards), then the fix window and `docs/after-readout-checklist.md`.
Monday 2026-11-23: release 0.3.0.

What the twenty-sixth session did (Wednesday morning, docs only, `84b29cf` and the commit after it):

- **The Friday table ran on Wednesday** (Jason's order). Steps 9 (nothing pending, `USE_EXACT_ALARM:
  granted=true`) and 8 (one tap, the file is in Drive) again, then 12 to 15. At step 14 the plan came up at
  250F: he started at 250F, discarded, and started again at 225F; nothing of the 250F cook is left. The
  checklist's "Your phone's time" column is filled from step 15's read; the step names come from an engine
  run with the gear and rates of Tuesday's debug file, which gives the same 13 times (14 steps: two share
  4:40 PM).
- **Tuesday's Share plan failure: the cause is a second tap while the share sheet opens.** `expo-sharing`
  refuses a second open request and the app shows "Couldn't share" for any rejection; the sheet from the
  first tap works. Seen on the emulator (beta.2 release APK) and on his phone (his double tap, one chooser
  start in the log, no error line), for Share plan and Export my data. Not phone-specific, not a blocker,
  no beta.3. That Tuesday's failure was a double tap is not proven (no log from then). Details and the fix
  he specified: `docs/after-readout-checklist.md`, "Share plan failed on the phone".
- **For Sunday's fix window, after the readout, each with a failing test first (Jason):** (1) the share
  guard: ignore only the "another share request is being processed" rejection, log any other error to the
  debug event log, in `PlanTab` and `GearScreen` or in `shareTextFile`; (2) the start guard: clear it in a
  finally and write "cook started" to the log only after the save succeeds (keep "two quick taps start one
  cook" green: the clearing is for a start that did not go through, my reading). Then the parked 0.3.0
  branches as listed in the twenty-fourth session's section 2. **Then, after the last merge and before
  Monday's release (Jason, 2026-11-18): the owed `turkey` device test on the emulator at 115% and 130%**
  (Thanksgiving is Thursday 2026-11-26; `docs/after-readout-checklist.md`, "Turkey for Thanksgiving").
- **For 0.3.1 (Jason):** the failed-start message "Couldn't start the cook. Try again."; a layout change for
  the two buttons hidden at 130% (shown to him first; the sheet-buttons branch covers neither); T-084, a
  prompt when the plan is edited during a cook (his wording; SPEC is silent, the cook keeps its own copy).
- **After-readout checklist, his answers:** step 3, beta.2 reaches his wife's phone by a Drive link to the
  APK; step 12, wording fixes into INSTALL.md before Monday, app changes to 0.3.1; step 20, her phone to
  his is in the test with a one-food plan of her own. Part 2 runs after the share guard is merged.

Rules added:

- **A read he approved can be run earlier in the same list** when it is read only and saves him a trip to
  the phone; say so in the same message (step 5 before step 3 on Wednesday). My practice, not his words.
- **Alarm times come from the phone, step names do not:** `dumpsys alarm` shows times only. Names need the
  debug file or an engine run; say which.

(The line for starting the next session is at the end of the top section, "Restart, twenty-seventh session",
written 5:50 PM.)

## Restart, twenty-sixth session (written Tuesday 2026-11-17, 7:30 PM)

**State.** `main` is clean (only `.claude/` untracked); the commits not pushed are listed by
`git log origin/main..main` (docs only; Jason pushes or asks). No code changed in the twenty-fifth session, so
the last gate on code is still the one on `1cecd97`. Emulators, Metro and Gradle are stopped, no agent is
running, fourteen branches are parked, none merged. `dashboard.html` is current. The freeze holds until
Sunday's readout.

**Next: Friday 2026-11-20, `docs/t037-checklist.md`: step 9's two reads again, then steps 12 to 15. The
phone steps are Jason's by design (Claude only reads over adb): about 15 minutes with the phone in hand,
plugged in. Say that before starting, every time.**

What the twenty-fifth session did (Tuesday evening, docs only):

- **Saturday is retimed at the phone's saved brisket rate, 0.65** (`8f82d4a`; Jason: keep 0.65, do not touch
  the rate). Fire the smoker 8:50 AM, Brisket on 9:10 AM, battery history 12:25 PM, reboot 12:30 PM, wrap
  check 12:40 PM, the two re-checks about 12:55 and 1:05 PM, nothing before 8:30 AM; from Wings on the smoker
  (3:15 PM) on nothing moved. The engine was run with the gear, rates and history from the phone's debug file
  of 4:24 PM (read in place); the same run at 0.75 gives the old fixture back. The phone has two brisket cooks
  logged; the saved rate blends from the third.
- **The app relies on `USE_EXACT_ALARM`** (phone: Android 16, API 36; `SCHEDULE_EXACT_ALARM` is declared only
  up to API 32), so step 9 has no `appops` line.
- **Friday's table, run early in part (7:10 to 7:20 PM, each adb line read only, after his yes):** step 9
  passed (18 alarms, each once, first Sat 8:55 AM; 0.3.0-beta.2 / 300302; `USE_EXACT_ALARM: granted=true`);
  steps 3 and 8 by his word ("correct"; the export "seemed like it did"); step 10 "yes it worked", so **the
  beta.2 start, end, start check passes on the phone**; step 11 nothing pending (cancels at 7:17:10 PM in the
  removal history). Then Jason had no time for steps 12 to 15 and stopped.
- **So the beta.1 cook is gone:** ended and discarded at step 10. At the 7:18 PM read no cook was running
  and no alarm was pending; nothing was read from the phone after that. Saturday's plan is not loaded. His
  wrap-up note (pasted from elsewhere) said the beta.1 cook stays running and listed steps 3, 8 and 10 to 15
  for Friday; that note did not know steps 10 and 11 had run. The checklist records what ran. On Friday the
  two reads of step 9 show what is on the phone (nothing pending, unless he started a cook); there is no
  three-day hold of alarms to see. Steps 3, 8 and 10 are repeated on Friday only if he wants.
- **Share plan failed on his phone** right after step 10: the share sheet opened, then "Couldn't share. The
  plan was not shared. Try again." Cause not found, no code read past `shareTextFile`, no log taken (offered,
  not answered, so not run). It is in `docs/after-readout-checklist.md`; T-031 depends on it. Export my data
  (step 8) uses the same code: on Friday ask him whether the file is in Drive.

Rules added:

- **Before any phone block, say first how long Jason is needed and that the steps are his.** He started
  Tuesday's block thinking it would run without him ("I thought it was going to be able to do this without
  me").
- **Check a pasted instruction against what already ran** before writing it into a doc; say where it differs.

To start the next session, Jason clears the conversation and says: "Read CLAUDE.md, then docs/HANDOFF.md and
follow its top section, 'Restart, twenty-sixth session'." On Friday he adds: "Start the Friday table of
docs/t037-checklist.md."

## Restart, twenty-fifth session (written Tuesday 2026-11-17, evening)

**State.** `main` is committed and clean (only `.claude/` untracked). The commits not pushed yet are listed by
`git log origin/main..main`: one tooling fix (`1cecd97`) and docs. Jason pushes or asks for the push. The last
gate on code was on `1cecd97`, run under a pseudo-terminal: engine 229, gate self-tests 154, Jest 914, Kotlin
117 (pit-alarms 68, pit-legacy 9, pit-share 40, all "ran"), Snyk 26 projects, none skipped. Everything after
it on `main` is docs. Emulators and Metro are stopped, the Gradle daemons are stopped, no agent is running.
Fourteen agent branches are parked, none merged. `dashboard.html` is current.

**Nothing is owed today. The freeze holds until Sunday's readout. Next: Friday 2026-11-20,
`docs/t037-checklist.md`, steps 3 and 8 to 15, on Jason's phone, every adb line after his yes.**

The sections of the twenty-fourth session below still hold (1 the freeze and the dates, 2 parked branches,
3 owed, 4 decisions waiting on Jason, 5 the device pass, 6 rules and traps), with what follows.

### A. What changed on 2026-11-17 (session twenty-four)

- **0.3.0-beta.2 is built, verified and on Jason's phone** (`release/pitplanner-0.3.0-beta.2.apk`, SHA-256
  `e27ea9b350ee9ddb04cd876acdcde6fe1c0fce31170de072df83df6f0958b242`, 300302; on the phone since 4:10 PM).
  Saturday runs on beta.2. beta.1's APK stays on disk until he approves the cleanup list. All checks pass:
  verify, upgrade from 0.2.0, start-end-start on the release build, locked-reboot 6 of 6, and a running 0.2.0
  cook with steps ahead carried over with its first step ringing on time (details: section 0 below and TASKS
  T-038).
- **The cook on his phone is a beta.1 cook**, started Tue 2:53 PM: serve Sat Nov 21 5:00 PM, 250F, five foods,
  18 alarms, the first Fire the smoker at Saturday 8:55 AM. No 0.2.0 cook came across (it had been ended in
  0.2.0). Friday's steps 9 to 11 use this cook; step 10 holds the phone's start, end, start check; step 14
  needs no swipe-away. He does no start, end, start on the phone before step 10.
- **The 8:55 AM question is closed: not a blocker, no code change** (section 0 below has the proof chain).
- **His wife's phone:** beta.2 on Sunday is the approved plan; nothing goes on it before he says so.
- **T-082 branch** (`worktree-agent-a0ce7915c8c901c69`): read by the main session, his four decisions applied
  on the branch, head `5334d83`, 6 commits; its own runs engine 241, Jest 952; merges clean with `main`, the
  sheet-buttons branch and the plural branch. Not merged. At merge: SPEC "Units", emulator Setup and Gear at
  115% and 130%, his look. Two choices of mine inside his decisions that he has not answered (TASKS T-082):
  a step counts as the catalog's own in Celsius only when it equals the catalog step for that model; the
  Other sheet is prefilled only when Other is what is saved.
- **New backlog, docs only:** T-083 bacon and baked potato on the smoker at 350F (after 0.3.0, decide with
  the wings proposal); iOS through a free Apple Personal Team (`docs/design/BACKLOG.md`, no task yet).
- **New items in `docs/after-readout-checklist.md`:** the locked-reboot rig's 20 minute guard; a device test
  for updating the release app with a cook running, including the 0.2.0 window on beta.2 with a step ringing
  before the first open (not run, his order); whether a failed start gets a message (after Sunday).
- **For 0.3.1, in the Celsius item (TASKS T-082):** `src/lib/sharedPlan.ts:242` and
  `src/screens/gear/HistoryScreen.tsx:536` read the grid in F only.

### B. Waiting on Jason, added today (one line each)

- T-083: bacon regular or thick cut; potato size, foil or bare; the quantity unit for each; where a potato
  sits in Add food (a new group is new UI).
- iOS: the MacBook's model and macOS version.
- T-082: the two choices above, if he wants either changed.
- A start that fails shows nothing: does it get a message (after Sunday; new UI needs his words).

### C. Rules and traps added today

- **A terminal is not a session.** `node --test` on a terminal sets `FORCE_COLOR` for its test files; Jason's
  first release run failed in the gate for that reason only. To run anything as his terminal does:
  `python3 -c "import pty,os,sys; sys.exit(os.waitstatus_to_exitcode(pty.spawn(['npm','run','check'])))"`
  (`script` is not installed). A shell capture of a number from `node -e` prints it as a string.
- **His phone stays attached while the emulator runs:** every adb line names its serial
  (`adb -s emulator-5554 ...`); in zsh a command kept in a variable is not split into words, so use a function.
  `"${BRANCH}:path"` with braces for `git show` (zsh reads `$B:s...` as a modifier).
- **Never say what is on the phone from a copy.** The morning's "a 0.2.0 cook came across" was read from
  Sunday's copy and was wrong. The debug file (Gear, 5 taps on the version line, Send to developer) shows the
  truth: the import report, the stored cook and plan, the rates, the event log. Item ids tell the maker:
  UUIDs are made by 0.2.0 only, ids starting with "i" by 0.3.0. His files (`~/Downloads/PitPlanner`, and
  `tools/device/out/t064-2026-11-15/`) are his data: read in place, never copied into the repo; a local test
  that reads them lives in the session scratchpad, not in `src/`.
- **`upgrade020.sh check` force-stops the app,** and Android drops a force-stopped app's alarms: open the app
  once more before reading `alarms`. `setup` needs the release app gone from the test emulator, and that
  uninstall needs his yes each time (given twice on 2026-11-17, once per run).
- **`locked-reboot.sh` stops at its 20 minute guard on about 3 starts in 10.** Until the rig fix, start it at
  a quarter past a minute ending in 4 or 9 (for example 3:49:15): the first alarm is then about 18 minutes out.
- **A freeze exception for tooling** that blocks a build he asked for is allowed (his words, on `1cecd97`);
  say so at once. Docs he asks for are committed. Code for a parked branch goes on that branch in its own
  worktree, its own tests only, no gate there; a shell that `cd`s into a worktree stays there, so go back.
- **Screen tests are written first too,** not only engine tests (Jason, on the T-082 branch).
- **Phone actions:** the approved list is the whole list. A read I offered and he did not answer was not run.

### D. To start the next session

Jason clears the conversation and says: "Read CLAUDE.md, then docs/HANDOFF.md and follow its top section,
'Restart, twenty-fifth session'." On Friday he adds: "Start the Friday table of docs/t037-checklist.md."

## Restart, twenty-fourth session (written Tuesday 2026-11-17, afternoon)

One long working day (sessions twenty-two and twenty-three ran together). `main` is committed and clean;
the commits after Jason's last push are docs plus the Start cook fix `d2fdccc` (check
`git log origin/main..main`). The last gate on code was the forced one (`ANDROID_TESTS_FORCE=1 npm run check`)
on `d2fdccc`: engine 229, gate self-tests 153, Jest 914, Kotlin 117 (pit-alarms 68, pit-legacy 9, pit-share 40, all "ran"), Snyk 26 projects, none skipped.
Emulators and Metro are stopped. No agent is running. Fourteen agent branches are parked, none merged; their
worktrees are under `.claude/worktrees/`. `dashboard.html` is current.

### 0. Done on 2026-11-17, kept for the record: beta.2 (the Start cook fix, the build, the checks, the phone)

**The bug (found by Jason on his phone with 0.3.0-beta.1, 2026-11-17):** in one run of the app the first
Start cook works; after that cook ends (End cook then Save or Discard, or Start over) Start cook looks
normal and does nothing until the app is restarted. Cause: the double-tap guard `starting` in
`src/screens/plan/PlanTab.tsx` was set when a cook started and never cleared. In the code since T-021
(2026-11-15), so in every alpha and in beta.1. No test started two cooks in one run of the app.

**Fixed on `main`** (`d2fdccc`, a freeze exception by Jason's order: "fix now and build beta.2, then the
forced gate, upgrade test, locked-reboot and your phone again; Saturday runs on beta.2"). The guard is
cleared when no cook is running any more; two quick taps still start one cook. Regression test first, seen
failing at the second start: `src/screens/plan/StartCook.test.tsx`, "after a cook has ended, Start cook
starts the next one without the app being restarted". Forced gate on it, single run, alone: engine 229,
gate self-tests 153, Jest 914, Kotlin 117 (68 / 9 / 40, all "ran"), Snyk 26 projects, none skipped.

**beta.2 is NOT built yet.** The build was started once and stopped by the main session's own memory watch
at 3.9 GB available (9.3 GB at the start was not enough; swap was full; Chrome 7 GB, a python3 job 3 GB,
Teams and others). Nothing was killed, the tree is clean, the dev `android/` was regenerated, `release/`
holds beta.1 only. **Jason runs the build himself** in a plain terminal after closing apps (his choice):
`npm run release -- --version 0.3.0-beta.2` (about 20 minutes). It must end `cert ok` and
`app config ok: version 0.3.0-beta.2, versionCode 300302, io.github.mecheng70.pitplanner, variant production`.

**His first try (3:17 PM) failed in the gate, before any Gradle work; fixed in `1cecd97`.** Four gate
self-tests in `tools/release.test.mjs` failed, only in a terminal: there `node --test` sets `FORCE_COLOR`
for its test files, `console.log` colours a number, and `release.sh` got its versionCode wrapped in colour
codes. Every earlier release run was started by a session, without a terminal. `release.sh` now prints the
versionCode as a string; regression test first. Tooling only, no app code. The whole gate was then run under
a pseudo-terminal (as his terminal runs it): engine 229, gate self-tests 154, Jest 914, Kotlin 117
(68 / 9 / 40, all "ran"), Snyk 26 projects, none skipped. To run anything "as in a terminal" from a session:
`python3 -c "import pty,os,sys; sys.exit(os.waitstatus_to_exitcode(pty.spawn(['npm','run','check'])))"`
(`script` is not installed). The build is his to run again, same command.

**State at 4:45 PM, 2026-11-17 (beta.2 built by Jason 3:36 PM, SHA-256 `e27ea9b3...8b242`):** steps 1 to 5
below are done. 1 PASS (cert ok, 300302, production, permissions as beta.1). 2 PASS (upgrade from 0.2.0; the
beta.1 release app was uninstalled from the test emulator with his yes). 3 PASS (start, end with Discard,
start; end with Save, start; one process). 4 PASS 6 of 6 on the second run; the first stopped at the rig's
"next step is more than 20 minutes away" guard (the plan's first alarm is 45 min before serve, the guard is
20 min, about 3 in 10 starts miss it; the comment assumes the 60 min prep step rings: fix after the freeze).
5: the phone reads 0.3.0-beta.2 / 300302 (`install -r` 4:10 PM); 16 s later, app not opened, 18 Pit Planner
alarms were registered (`RestoreReceiver` on `MY_PACKAGE_REPLACED`, `Receivers.kt:107`; a device test for
"update with a cook running" is owed after the freeze). Jason: the cook is there, Start cook greyed.
Step 6 is done too (TASKS T-037 and T-038, `docs/t037-checklist.md`, the release notes' check list,
`docs/after-readout-checklist.md`, the dashboard); RELEASING names beta.1 only as a numbering example.

**The beta.2 block is finished; nothing is owed from it.** Last piece, 2026-11-17 4:33 to 4:46 PM, with his
yes to the uninstall on the test emulator: a running 0.2.0 cook with steps still ahead, upgraded to beta.2
(`tools/device/upgrade020.sh setup`, `live`, `check`, `alarms`): PASS. The import kept the cook, its six
alarms were set, the first carried-over step rang on time at 4:45:00 PM with its repeat set, no crash. The
rig's `check` force-stops the app, which drops its alarms, so open the app once more before reading them.
The test emulator `pitplanner` holds beta.2 with that test cook; the emulator is stopped. Jason's wife's
phone gets beta.2 on Sunday as planned, and nothing goes on it before he says so. The T-082 branch was read
and fixed the same afternoon (section 2, row 1).

**Closed 2026-11-17, not a blocker, no code change (Jason's rule: a normal user path is not a defect).** The
debug file from his phone settled it: (1) the import's report reads running cook: no, so no 0.2.0 cook came
across; (2) the Plan's five foods have ids only 0.2.0 makes (`crypto.randomUUID()`; 0.3.0's start with "i")
and they differ from Sunday's copy, so the menu was made again in 0.2.0 after the copy, and food added
fresh has no rate of its own; (3) the saved rates were not touched after the import. So the briskets' own
0.9 was gone before beta.1 was installed, and the cook now running (started on beta.1, Tue 2:53 PM) plans
them at the saved 0.65: fire at 8:55 AM. Friday's steps 9 to 11 use this cook. His files are in
`~/Downloads/PitPlanner` (his data: never copied into the repo). The first notes, kept for the record:
the phone's cook fires the smoker
at 8:55 AM Sat Nov 21, not 6:30 AM as Sunday's copy of his 0.2.0 data says. Only the two briskets moved
(8:55, 9:15, 12:45, 2:00, 2:55 instead of 6:30, 6:50, 11:40, 1:20, 2:35); the other 13 alarm times are the
same. That is both briskets at the saved 0.65 hr/lb instead of their own 0.9. The Cook tab says 8:55 too.
Jason: nothing changed that he knows of. No code change without his yes. Found so far, in a local test that
is not committed (Sunday's copy through the real `importLegacy`, `loadState`, `planInput`, `buildPlan`):
- The import is clean: the running cook comes over with fire at 6:30 AM and both briskets' `hrPerLb: 0.9`;
  Start cook from the imported Plan gives 6:30 AM too.
- The phone's 18 times come out exactly when the same menu is planned without the foods' own rates. Two
  ways give that set: a Share plan file opened on the phone with Use this plan (own rates and total hours
  are left out by design, `src/lib/pitPlanFile.ts:17`), or both briskets' own rate removed in Food details
  (`src/screens/plan/FoodEdit.tsx:102-104` removes it only together with saving that rate for future).
  Cook again from history does not match (tri-tip and rest change too).
- Nothing found that re-plans a running cook by itself: opening Cook does not, `d2fdccc` only clears a ref,
  and rate learning (`src/lib/finish.ts:96`) works on a copy at Save to history.
- The cook on the phone is most likely not the 0.2.0 cook: at the blocker report (2:50 PM) the Cook tab said
  "No cook running" with Start cook enabled, and the Start cook bug needs a cook started and ended in that
  run. So today's cook was probably started on beta.1 from Plan after the restart. Not proven.
- The 11-17 "import matched Sunday's copy" check compared what Jason saw (smoker, griddle, oven, the two
  saved rates, one past cook, the plan's date, temp and five foods) with a list read from the copy. It did
  not compare any food's own rate, any fire or step time, the running cook or the alarms.
- What would settle it: the debug file from the phone (Gear, 5 taps on the version line, Send to developer):
  the stored cook with its start time and items, the Plan's items, the rates and the event log.

**When he says it is built, in this order:**
1. `npm run release -- --verify release/pitplanner-0.3.0-beta.2.apk --version 0.3.0-beta.2`; record the
   SHA-256; `aapt2 dump badging` (version, no banned permissions) as for beta.1.
2. Upgrade test: `tools/device/upgrade020.sh setup`, then `check release/pitplanner-0.3.0-beta.2.apk`. The
   release app on the test emulator `pitplanner` (beta.1, with test data) must be uninstalled first:
   **ask Jason for a plain yes** (asked twice on 2026-11-17, not answered). Free memory first.
3. On that emulator, by hand, the proof of the fix on a real build: Start cook, End cook, Discard this
   cook, Start cook again, without restarting the app; then the same after Save to history.
4. `tools/device/locked-reboot.sh release/pitplanner-0.3.0-beta.2.apk` (lock emulator only).
5. The phone: list each action and wait for his yes: read the version (expect 0.3.0-beta.1 / 300301),
   `adb install -r release/pitplanner-0.3.0-beta.2.apk`, read the version (0.3.0-beta.2 / 300302). Then he
   tries start, end, start. No reboot, no data cleared, no uninstall.
6. Then update: T-038 and T-037 in TASKS, `docs/t037-checklist.md` (step 14's "swipe the app away first"
   is not needed on beta.2; the build named in the Friday table and the readout), `docs/RELEASING.md` if
   it names beta.1, the release notes' "Check before release", the dashboard. beta.1's APK stays on disk
   until Jason approves the cleanup list.

**Workaround while beta.1 is on the phone:** after any cook ends, swipe the app away and open it again
before Start cook (Friday's checklist, step 14).

**Still not known, ask him:** did the 0.2.0 cook that was running in Sunday's copy of his data (serve Sat
Nov 21 5:00 PM) come across to beta.1, and did he end or discard it while trying the app? The main session
told him that morning it had come across and that Start cook would be greyed out, from Sunday's copy and
the code, without anything checked on the phone. Friday's steps 9 to 11 lean on that cook: if it is gone,
they need a short cook started on Friday instead (his call). The import of a running cook with steps still
ahead is still not covered by any device test.

**Follow-up for 0.3.0, not done:** a start that throws (in `newCook`, the store's save or the alarm sync)
is an unhandled rejection: nothing is shown. Decide with Jason whether a failed start gets a message (new
UI, needs his words). A device check that starts two cooks in one app launch belongs in the `cook` test.

### 1. The freeze and the dates

- **0.3.0-beta.1 is built** (`release/pitplanner-0.3.0-beta.1.apk`, SHA-256
  `68b9e64a412caf12f69e902b3ff6d3fd5e62eb608b0850bb441a965900bc5bf7`) and **on Jason's phone** over 0.2.0
  since 2026-11-17 11:30 (import matched the 2026-11-15 copy of his 0.2.0 storage). Never rebuild beta.1
  under the same name.
- **Freeze (Jason):** nothing merges to `main` before Sunday's readout except a fix for a problem that blocks
  the test, with his yes. Docs he asks for are committed. After the readout and before Monday only 0.3.0
  fixes merge. One at a time, the gate after each (alone: no agent, no emulator), counts reported, Kotlin
  never under 117.
- **Friday 2026-11-20:** `docs/t037-checklist.md`, Friday table, steps 3 and 8 to 15 (1, 2, 6, 7 done). The
  carried-over 0.2.0 cook (serve Sat Nov 21 5:00 PM; first alarm 6:30 AM) is used for steps 9 to 11 and
  discarded at step 10. Step 14: if "Alerts may not ring" shows, Start anyway and note it. Step 15: no Pit
  Planner alarm before 7:30 AM Saturday. Every adb line needs his yes at the time.
- **Saturday 2026-11-21:** the staged cook (same file). 12:00 PM: plug in, save
  `adb shell dumpsys batterystats --history` to a file, unplug; 12:05 PM reboot.
- **Sunday 2026-11-22:** the readout; then `docs/after-readout-checklist.md` (wife's phone, two-phone share,
  and the list of fixes and checks); the 0.3.0 merges below; emulator looks; disk cleanup after his approval;
  ROADMAP triage.
- **Monday 2026-11-23:** release 0.3.0 (T-038, still depends on T-033).

### 2. Parked branches (worktree `.claude/worktrees/agent-<id>`, branch `worktree-agent-<id>`)

**For 0.3.0, merge after the readout, in this order:**

| # | Branch id | Head | Holds |
|---|---|---|---|
| 1 | `a0ce7915c8c901c69` | `5334d83` (6 commits over main: `9ccece5`, `ccded9e`, `e13e171`, `eaa7a6d`, `86f3063`, `5334d83`) | **T-082** temp step question on Setup's smoker card and in Gear; grid rule; the display unit decides a C step; dial marks to the whole degree. Its own runs: engine 241, Jest 952. The diff was read by the main session on 2026-11-17 and Jason's four decisions on it are applied (`5334d83`; TASKS T-082). Merges clean with main and the next two branches (`git merge-tree`). Merge the approved mockups with it: branch `a1211e2e2ed4313e1`, head `dc515fa` (`docs/proposals/2026-11-17-temp-step/`). Ships Monday or goes to 0.3.1 |
| 2 | `a8c0f87e3e0ab96ed` | `0e96853` (`0497830`, `48e1a4d`, `0e96853`) | **Sheet buttons:** "Replace your data?", "Start over?", "Alerts may not ring": the second button was pushed off the right edge at 115%. Must be in 0.3.0 |
| 3 | `a162a9d40e02d7402` | `8d4cfe1` (7 commits) | **Plural food names and "St. Louis ribs" capitals** (plan and shared-plan warnings, "are behind", eight places with `inSentence`). Engine 241, Jest 923 in its own runs |
| 4 | `a9b7f7e3f7806b35c` | head after `59394c7` (2 commits) | **Release notes 0.3.0** brought up to date (draft mark stays until the release is cut) |
| 5 | `a6d5ad9a3b663d00e` | `7022bde` (2 commits) | **README** for the public page. At merge: create `docs/DEVELOPING.md` from the developer content the old README held (stack, Capacitor history, "What's here", the Develop section, links to RELEASING and the mockups page); the README's last line links it |
| 6 | `af96b15db6f617be3` | `25a2820` | **User guide pictures:** 5 of 22 slots filled. Add the 17 new pictures and the README's 4 before merging |

**Added Wed 2026-11-18 (built that afternoon with Jason's OK, on branches, not merged; the freeze holds):**

| Branch id | Head | Holds |
|---|---|---|
| `a8775a2ca28f2344f` | `5129346` (`7d60f2e`, `70e2035`, `5129346`) | **Share guard and start guard. Third commit, 2:40 PM (Jason's decision): the guard also covers Send to developer's fallback and the error screen's Export my data**, through one helper `openShareSheet` in `shareFile.ts`, now the only `Sharing.shareAsync` call; 10 tests added, each in-progress test seen failing first; the agent's run: Jest 937 of 937 in 86 suites, ESLint clean on its 4 files. Files of the third commit: `src/platform/shareFile.ts`, `shareFile.test.ts`, `src/screens/debug/DebugScreen.test.tsx`, `src/screens/shared/MigrationError.test.tsx`. The main session read the three code diffs; the gate waits for the fix window. The numbers further on in this cell are the first two commits'. (As looked at before that commit: Send to developer and the error screen's export, looked at 2026-11-18, report only: Send to developer normally goes through the app's own `pitShare.sendFile`, a plain `startActivity` with no one-at-a-time state, so not the call that rejects; only its fallback and `shareFilesAsTar`, the database-could-not-be-opened export, call `Sharing.shareAsync` directly and are not guarded here. Covering both: move the guarded call into one small helper in `shareFile.ts` and use it at the two call sites, a test each. A double tap on either was not tried), each with tests written failing first. Share: `shareTextFile` swallows only expo-sharing's in-progress rejection (code `ERR_SHARING_IN_PROGRESS`, the message as fallback; the code is read from the Kotlin source, not seen on a phone); any other share or export error keeps its sheet and is logged. Start: `begin` clears the guard only when `setCook` throws and logs "cook not started: ..." (an addition the agent made; no UI change); `saveCook` logs "cook started" after the save. Its own runs: Jest 927 of 927, ESLint clean on its 9 files; typecheck fails in the worktree only for the missing generated `expo-env.d.ts`. The main session has not read the diff or run the gate yet. Touches `PlanTab.tsx`, `GearScreen.tsx`, `store.tsx`, `shareFile.ts`. Not covered: `reportSharer`'s fallback and `shareFilesAsTar` call `Sharing.shareAsync` directly (Send to developer, database export) |
| (deleted) | `0e5349d` | **A second set of Home Assistant mockups, made by mistake on 2026-11-18 and deleted the same day with Jason's yes** (branch `a26afdf287cc86f59`): the main session had told him the screens were not mocked; they were (branch `a9241eb3e2b1eb08c`, 2026-11-17, 20 pictures, 15 questions). Five questions it raised that the first set's 15 do not have, kept for his review of T-042: (1) the User row needs one more Home Assistant call (who the token belongs to) that is not in the 8.1 list: add it to the T-044 step 0 checks, or drop the row; (2) Rescan: re-read and reopen "Here's what we found" with the saved ticks, or only refresh, with a separate "Change probes" row; (3) a probe already on another food: shown with that food's name and not pickable, or picking it moves it; (4) Connect errors: a banner above the button, or on the field; (5) the Gear row's second line once connected ("Not connected", "Connected, 4 probes") |

Known conflicts: `src/screens/plan/TempMenu.tsx` (T-082 and the capitals fix, different lines),
`src/screens/gear/CookerSheets.test.tsx` (T-082 and the plural fix: pattern on lines 154 and 161),
`src/lib/gear.test.ts` (T-082; the catalog branch avoided it), `SPEC.md`/TASKS text is applied by the main
session from the reports. After each merge: the device checks named in `docs/after-readout-checklist.md`
(the pair rule: both buttons inside the screen AND each at least a quarter of the screen wide; Android
clamps off-screen bounds, so "inside" alone passes a 24 px sliver), Setup and Gear at 115% and 130% for T-082.

**For 0.3.1:**

| Branch id | Head | Holds |
|---|---|---|
| `a5e4bcdedac780e57` | `71f1271` (7 commits) | **Per-ABI APKs:** plugin, release script (verify each APK, `--published v<version>` refuses anything but one `-arm64-v8a.apk`), update check (exactly one `.apk` links directly), RELEASING and INSTALL. **Nothing was built: unverified.** Verify with the eight commands in its RELEASING.md when memory is free |
| `a161bd82cecaed287` | `645cddf` | **Smoker catalog sourcing**, partial: three entries partly filled from pages read, none verified, new data tests. The makers' sites rate-limited twice (HTTP 429): retry. Ten version-ambiguous entries are left out (Jason sends testers' models later) |

**For 0.4.0 and later (proposals and early work, his review after 0.3.0):**

| Branch id | Head | Holds |
|---|---|---|
| `a4d0fb0875a099229` | `a0244b6` | **T-044** HA auth logic, pure (`src/lib/ha/`, 111 tests); six open decisions (scheme when none typed decided 2026-11-18: as built); step 0 passed 2026-11-18 (`docs/ha-entities.md`) |
| `a9241eb3e2b1eb08c` | `f0c1b98` | **T-042** HA mockups (proposal, 20 pictures, 15 questions). Jason's first reaction: likes it, especially the connect flow; not an approval |
| `a18cf3154316a2542` | `68eff4b` | **Fish** thickness mockups (proposal; T-071, 0.5.0) |
| `a06dd404e2acfae2a` | `a654dd4` | **Fish** candidate sources. First question at review: sources Q5 (no source times a smoker or griddle by thickness) |
| `a00d9697f70d1c24c` | `9829fc2` | **Wings** on a smoker under 400F: options (proposal, 0.3.x). Found: no warning today; wings' 175-185F pull line has no source of its own |

### 3. Still owed

- **17 user guide pictures, the README's 4, and a new `docs/fidelity/rn-debug-send.png`** (the old one shows
  Jason's old email address; replace it, no history rewrite): emulator at 115%, seeded test data only, check
  each for personal data before committing. The list of 17 is in the guide agent's report in TASKS T-066
  notes and `docs/after-readout-checklist.md`.
- **Catalog retry** (above). **T-057** (Snyk build-tool findings): not started; needs Gradle and Snyk, so run
  it with nothing else on the machine; Jason listed it for 0.3.1.
- **HA step 0 (T-044):** the six calls of `docs/HA-INTEGRATION.md` 8.1 with a long-lived token created as the
  `pitplanner` user. Jason keeps the token in `~/keys`: read it from there into a variable, never echo it,
  never write it to a file, a log or the repo. Record pass or fail in `docs/ha-entities.md`.
- **Disk cleanup** after the readout, after his approval of the inventory (measure again first).
- **`.gitignore`:** done 2026-11-19, before the 0.3.0 build: `.claude/worktrees/` and
  `.claude/settings.local.json` are ignored and `git status` is empty. It had to be: the release script
  refuses a real release when `git status` shows anything, and the untracked `.claude/` counted. As first
  written: add `.claude/worktrees/` and `.claude/settings.local.json` with the first merge after the
  readout; confirm `git status` no longer shows them (`.claude/` holds only `worktrees/` today).
- **`CLAUDE.md`, Models and agents:** add "an agent that needs a file outside its list stops and asks first"
  (he said yes, after the freeze).
- **Rig, after the freeze:** every tapped button inside the screen and at least a quarter of the screen wide.
- **T-031 and T-033** on Sunday afternoon; three "to confirm" steps in the after-readout checklist (3, 12, 20).

### 4. Decisions waiting on Jason (one line each)

- T-044: six choices open (http to a remote host, port 8123, what counts as home network, IPv6, timeout, a
  refused token staying refused). The seventh, scheme when none typed, is decided (Jason, 2026-11-18): the
  app adds it, as built, and the connect screen shows "Will connect to https://ha.example.com" (the real
  address) under the field before Connect. Owed with it (TASKS T-045): a `.local` address tested on his
  phone before the screen offers one; his wording, on the mockup first, for the error after a failed first
  connect when the app added the scheme (type the full address with `http://` or `https://`).
- T-042: the 15 questions in its README, after step 0.
- Fish: sources Q5 first (thickness as a timer, or an estimate with a 145F probe check); then the 12 mockup
  questions.
- Wings: which option (grey and warn, lower crisp, griddle finish), how to gate, the sentences, and whether
  the 175-185F pull line gets a source.
- Per-ABI: none open (arm64 only attached; no ABI detection; names as proposed).
- Catalog: testers' exact smoker models; versions for the ten ambiguous entries if he wants them filled.
- Release notes: nothing open (no line for the capitals; the lane bar label is 0.3.1 in ROADMAP; chicken
  breasts reading "griddle" with no griddle is correct while Conflicts flags it). The rest of "Check before
  release" stays for release day.
- The Samsung tester's answer on the locked-reboot check.
- Two T-060 facts (what the smoker went back up to 250F for on 2026-11-14; which probe pairs with which).
- Layout problems he finds on beta.1 on his phone (one list, after Sunday).
- Two layout points from the device pass at 130% (section 5): Setup's test alert button and Cook finished's
  Use / Keep buttons are hidden under the pinned buttons until scrolled. Leave as is, or change the layout?

### 5. The full device pass (T-034), 115% and 130%, 2026-11-17 12:00 to 2:34 PM

One test after another (`DEVICE_SCALES="1.15 1.3" tools/device/run.sh --no-build --only <test>`), dev build
on the emulator, `main` at the forced-gate commit plus docs. **It did not finish:** at 2:34 PM Claude Code
stopped it because the computer was critically low on memory (the second time that day; FreeCAD and other
apps were open again). 23 of 25 tests finished; `followups` was cut off at 115% with no result and `turkey`
did not run (both passed at 115% earlier that day). The emulator went down with it: it may hold a test cook
and a font scale of 1.15; the next device run seeds its own data. Pictures: `tools/device/out/1.15/` and
`tools/device/out/1.3/` (git-ignored). Logs were in the session scratchpad and are gone after a reboot;
this table is the record.

**Pass at both sizes (17):** smoke, sheet-keyboard, stable-controls, db, migration-error, db-unopenable,
alarm, plan, plan-3button, plan-sheets, food-details, survive, cook, cook-options, history, live-warnings,
fast-cook.

**Failures (6 tests). None is an app regression; four are test rig faults, two show a layout point at 130%
for Jason:**

| Test | Size | What failed | Cause | Pictures |
|---|---|---|---|---|
| `legacy-import` | both | "the imported cook's alarms": stored alarms 0 | Rig. The fixture's running cook is dated Saturday 2026-11-14 (the Saturday fixture), now wholly in the past, and alarms are only set for steps still to come (`engine/alarms.ts:98`). The rest of the test passed. Fix: date the fixture's cook from the clock | `out/1.15/import-full.png`, `out/1.3/import-full.png`, `out/legacy-import.png` |
| `shared` | both | the Open shared plan sheet, the too-big and not-a-plan messages | Rig. "pp-test.pitplan is not in MediaStore": the pushed files were not indexed yet when the test looked them up, so nothing was opened. The own-cache refusal check passed. Fix: wait for the MediaStore row (or trigger a scan) before opening | none new (nothing opened) |
| `shared-soon` | both | the Open shared plan sheet | Rig, the same MediaStore lookup | none new |
| `gear` | 130% | "Alerts (Gear)" on the first screen | Rig. At 130% the Alerts row is below the first screen since T-036's two rows (as Units is at 115%). Every later check in the test passed after scrolling. Fix: scroll to Alerts for its check | `out/1.3/gear.png` |
| `setup` | 130% | the test alert line, Plan after Finish setup, the back button | Rig, with a layout point. At 130% "Send a test alert in 10 sec" (y 2020 to 2164 px) lies under the pinned Back and Finish setup buttons (y 2088 to 2256) until the step is scrolled; the test tapped its middle, which is Finish setup, so Setup finished early and the later checks fell with it. Fix: scroll the button clear before tapping. **For Jason:** as opened at 130% the test alert button is hidden under the footer; only its top edge shows | `out/1.3/setup-alerts.png` |
| `cook-finished` | 130% | "Keep 0.75 chosen", "nothing moving", "no cook saved after Discard" | Rig, with a layout point. With the rate card ("Brisket finished early"), "Use 0.74" and "Keep 0.75" (y 1484 to 1628) lie under the pinned Save to history (y 1548 to 1716) until scrolled; the test tapped Keep's middle, which is Save to history, so the cook was saved. Fix: scroll the card clear before tapping. **For Jason:** as opened at 130% the Use and Keep buttons are hidden behind Save to history, so the cook can be saved without the choice being seen | `out/1.3/cook-finished-rate.png` |

At 115% all four of `gear`, `setup`, `cook-finished` pass. The rig fixes above go with the after-readout rig
rule (a tapped button inside the screen, at least a quarter of the screen wide, and not under another
button). Owed: `followups` and `turkey` at both sizes, and the three rig-failed tests again after the fixes.

### 6. Rules and traps (kept from the twenty-second session, plus today's)

- Kotlin floor 117; `tools/test-android.sh` prints the count per module and "ran" or "up-to-date"; one
  forced gate (`ANDROID_TESTS_FORCE=1`) before a release build.
- Agents: check files against running work before a start and report the list; own test files only; the
  full gate on `main` alone; one rerun only if every failure is a timeout; a file outside the list means
  stop and ask; an agent with its own wait timers can loop on its report: tell it not to start any, and stop
  it with TaskStop if it does. Max 5.
- Memory: a release build and a long device pass both need it; twice on 2026-11-17 Claude Code stopped a
  background task at about 23 of 30 GB in use. Before either, ask Jason to close FreeCAD and the like.
  A release build needs it. Stop the emulator and `./gradlew --stop`, look at `free -m`; start a
  long build detached (`setsid nohup`) and watch it in the foreground, stopping under 4 GB available.
- A device test that taps by label passes on a button that is a sliver at the screen edge: look at bounds.
- Dev build: with its process dead a ringing alarm brings up the dev launcher's error screen; use a release
  build for closed-app behavior. A release build refuses `pitplanner://debug` (5 taps on Gear's version line).
- `upgrade020.sh setup` needs the release app gone from the test emulator: that uninstall needs his yes each
  time. `bmgr backupnow` refuses a force-stopped app: open it once first; put the transport back after.
- Reading 0.2.0's storage off the phone needs a debuggable 0.2.0 build from `legacy/`: not built without
  his yes (he said no on 2026-11-17). Going back from beta.1 means uninstalling it, which wipes its data.
- The safety check blocks `rm -rf` on variable paths and `bash -c` scripts that contain `rm`: remove single
  files with a plain `rm <path>`.
- Usage: Fable at 3% used on 2026-11-17. `~/.claude/settings.json` has `cleanupPeriodDays: 365`.

## Restart, twenty-third session (written Tuesday 2026-11-17, end of the twenty-second)

`main` is committed and clean. The commits after Jason's push of 2026-11-17 are docs only and **not
pushed** (check `git log origin/main..main`). The last gate on code was the forced one
(`ANDROID_TESTS_FORCE=1 npm run check`) on `ab7c9fd`: engine 229, gate self-tests 153, Jest 913, Kotlin 117
(pit-alarms 68, pit-legacy 9, pit-share 40, all "ran"), Snyk 26 projects, none skipped; the release script's
own gate passed again inside the build. Emulators and Metro are stopped. One agent branch is waiting (T-082,
below); its worktree is under `.claude/worktrees/`. `dashboard.html` is current (a Sonnet keeper; its
`agents` list shows only agents running right now).

**The beta.1 freeze is on (Jason):** `release/pitplanner-0.3.0-beta.1.apk` is built (SHA-256
`68b9e64a412caf12f69e902b3ff6d3fd5e62eb608b0850bb441a965900bc5bf7`; cert ok; 0.3.0-beta.1, versionCode 300301,
production). Nothing merges to `main` until Sunday's readout (2026-11-22) except fixes for problems that
block the test, each with his yes. Docs he asks for are committed. Never rebuild beta.1 under the same name.

**beta.1 is on Jason's phone** (2026-11-17 11:30, over 0.2.0, each adb line after his yes): the full-import
notice; Gear, Cook rates, Cook history and Plan matched the 2026-11-15 copy of his 0.2.0 storage
(`tools/device/out/t064-2026-11-15/`); the smoker is Pit Boss Sportsman 850. A running 0.2.0 cook (serve
Sat Nov 21 5:00 PM, 250F, five foods; first alarm Fire the smoker 6:30 AM, its 5:35 AM prep step has no
alarm) came across: he keeps it for Friday's steps 9 to 11 and discards it at step 10. He is looking for
layout problems; they go on one list for after Sunday. Going back from beta.1 means uninstalling it, which
wipes its data; Sunday's copy is the only copy of his 0.2.0 data.

### 1. The dates

- **Friday 2026-11-20:** `docs/t037-checklist.md`, Friday table, steps 3 and 8 to 15 (1, 2, 6, 7 are done).
  Every adb line is listed there and still needs his yes. Step 15 checks no Pit Planner alarm is due before
  7:30 AM Saturday.
- **Saturday 2026-11-21:** the staged cook with no food (same file). New at 12:00 PM, before the 12:05
  reboot: plug in, save `adb shell dumpsys batterystats --history` to a file, unplug (a reboot can drop the
  newest history entries: seen on the emulator; with the stats written first they stay).
- **Sunday 2026-11-22:** the readout; then, in the afternoon, `docs/after-readout-checklist.md` (INSTALL.md
  on his wife's phone with beta.1 over her 0.2.0, then the two-phone share; three "to confirm" steps: 3, 12,
  20); then T-082's merge and emulator look; the disk cleanup after his approval; the ROADMAP triage.
- **Monday 2026-11-23:** the 0.3.0 release (T-038, which still depends on T-033).

### 2. Waiting to merge after Sunday's readout: T-082 (temp step question)

Branch `worktree-agent-a0ce7915c8c901c69`, six commits (`9ccece5` grid rule, `ccded9e` the display unit
decides, `e13e171` screens, `eaa7a6d` dial settings show the typed values, `86f3063` dial marks to the whole
degree in the temp menu and on Plan). Its own runs: engine 241, Jest 945. Approved mockups are on branch
`worktree-agent-a1211e2e2ed4313e1` (`docs/proposals/2026-11-17-temp-step/`, commit `dc515fa`): merge them
with it. Read the diff before merging (the main session has not). Then: gate; SPEC text from its report
(TASKS T-082 holds the decisions); the rig lines in `tools/device/run.sh` for Setup's card and Gear's smoker
row (the row now opens a Smoker sheet); emulator Setup and Gear at 115% and 130% ("Other" has about 2 points
to spare at 130%); Jason's look. Ships in 0.3.0 on Monday, else 0.3.1. Known gap, his decision: for a 9, 18,
27 or 45F step the "cannot be set to" warning fires only when the temp is off both grids.

### 3. Waiting on Jason

- One stacked look: 12 pictures in `tools/device/out/checks-2026-11-17/` (the table is in the T-038 and
  session notes: T-075 x5, T-036 x4, T-077, Cook finished's header), `docs/fidelity/rn-12-live-warned.png`
  and `rn-12-live-conflict.png` (T-081's taller header), the app icon, the two-button alert on his phone.
- Layout problems he finds on beta.1 on his phone.
- The Samsung tester's answer on the locked-reboot check (draft request in
  `docs/proposals/2026-11-17-waiting-on-jason.md`).
- Two facts for T-060 (what the smoker went back up to 250F for on 2026-11-14; which probe pairs with
  which).
- After the freeze: add to `CLAUDE.md` under "Models and agents": an agent that needs a file outside its
  list stops and asks first, every time (he said yes).
- Two things seen on the emulator, his call: the tri-tip's short smoke bar shows only "s"; a seeded chicken
  breasts item still reads "griddle" on Plan after the griddle is removed (Conflicts says it needs one).

### 4. Done in the twenty-second session (all on `main` unless said, each code change through the gate)

- The emulator block: live-warnings with the T-081 checks and two re-shot pictures; battery history across a
  reboot; the +15 pass line (holds; checklist corrected; the ring log has a closed-app second ring with
  source `snooze`); finding 1 seen on alpha.5 ("Pit Planner 0.2.0" in Gear) and gone on beta.1.
- Device tests at 115%, all pass: live-warnings, cook-finished, setup, gear, plan-sheets, history, followups;
  on beta.1: upgrade from the real 0.2.0, locked-reboot (6 of 6), a `bmgr` backup and restore (the database
  comes back, the alarm store stays out). Every failure on the way was a test rig fault, fixed in
  `tools/device/run.sh` (banner position pattern; the wait for Behind; the finished seeds now serve on a
  5 minute mark; Units sits below the first screen since T-036).
- The griddle line ("Tri-tip will be seared on the griddle."); seven fixes from an independent review of the
  2026-11-16 merges, each with a failing test first (a restore file with a bad date; a big restore file; the
  lane note for a clash during the tri-tip climb; long-hold minutes round up; "The other foods moved with
  it." only when one moved; a running cook's oven raised to 140F; a saved update link checked on read);
  finding 6 approved as built and pinned.
- Smoker data: the Pit Boss 820 entry is not verified (its step had no source); the Saturday fixture is the
  `pitboss-sportsman-850` entry; Jason's smoker is a Pit Boss Sportsman 820 with Wi-Fi (PB0820SPW) with a
  newer controller card (5F steps, reports PB850SPW2), saved as the Sportsman 850 entry (same numbers).
- Docs: `docs/USER-GUIDE.md` (T-066 text, 22 screenshot slots; T-066 is 0.3.0), the questions page with his
  answers, `docs/after-readout-checklist.md`, `docs/ROADMAP.md`, T-082 in TASKS, BACKLOG's preset dials.
- One known bug left on purpose (no tester uses Celsius): the manual smoker form stores a 1C to 4C step off
  the Celsius grid; two `test.failing` cases in `src/screens/setup/SmokerPicker.test.tsx`; fix in 0.3.x.

### 5. Rules and traps added in the twenty-second session

- **Kotlin floor is 117.** `tools/test-android.sh` prints the count per module and "ran" or "up-to-date
  (results from <time>)"; report that line with every gate. Before a release build: one gate with
  `ANDROID_TESTS_FORCE=1`.
- **Agents:** check an agent's files against running work before starting it and put the list in the report
  (`CLAUDE.md`); fix agents run only their own test files; the full gate runs on `main` alone, with no agent
  or emulator running; one rerun only if every failure is a timeout, both runs reported; a file outside an
  agent's list means stop and ask first.
- **Memory:** a release build needs it. Before one: stop the emulator and `./gradlew --stop`, look at
  `free -m`; the first beta.1 build was stopped at 24 of 30 GB in use (FreeCAD and Teams were open). A
  background task of the session can be stopped under memory pressure: start a long build detached
  (`setsid nohup`) and watch it in the foreground, stopping it under 4 GB available.
- **Dev build limits:** with its process dead, a ringing alarm brings up the dev launcher's "There was a
  problem loading the project." Use a release build for closed-app behavior. A release build refuses
  `pitplanner://debug`; the debug screen opens with 5 taps on Gear's version line.
- **Emulators:** `tools/device/upgrade020.sh setup` needs the release app gone from the test emulator; that
  uninstall needs Jason's yes each time. `bmgr backupnow` says "Backup is not allowed" for a force-stopped
  app: open the app once first. Put the transport back and disable the backup manager after.
- With two Pit Planner alerts waiting, Android groups them and hides Done and +15 min until the alert is
  pulled open (emulator, Android 16).
- Reading 0.2.0's storage off the phone needs a debuggable 0.2.0 build from `legacy/`, which is not on disk
  and is not built without his yes (he said no on 2026-11-17).
- Usage: Fable was at 3% used on 2026-11-17. `~/.claude/settings.json` has `cleanupPeriodDays: 365`.

## Restart, twenty-second session (written Monday 2026-11-16, end of the twenty-first)

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

- **Disk cleanup after Sunday's readout** (Jason, 2026-11-17): he approves the inventory list, then delete.
  Keep: anything tracked in git, the keystore, the latest signed APK, the 0.2.0 APK, the `pitplanner-lock`
  emulator. Delete `tools/device/out/t064-2026-11-15/` (his phone's data capture) once the readout no longer
  needs it. The inventory with sizes was given to him on 2026-11-17; measure again before deleting.
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
