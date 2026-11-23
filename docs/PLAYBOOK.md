# New App Playbook (Claude chat + Claude Code)

How to take an app idea from a conversation to a signed APK, the way Pit Planner and Bee Timer were built. Replace everything in <angle brackets>.

## 0. Before any code: design it in Claude chat

Talk it through in a regular Claude chat first. Code is the expensive part, so settle these before Claude Code ever starts:

- Who uses it, on what phone, and what the one job is (Owner: Jason, due: YYYY-MM-DD)
- Screen list and what each screen does (Owner: Jason, due: YYYY-MM-DD)
- Mockups for every screen, exported as PNGs, at 100%, 115% and 130% text size (Owner: Jason, due: YYYY-MM-DD)
- Ask Claude to critique the mockups and the flow, then fix what it finds (Owner: Jason, due: YYYY-MM-DD)
- Decisions table: app ID, distribution, units, anything that's permanent (Owner: Jason, due: YYYY-MM-DD)
- Failure-mode table (FMEA style): what breaks, what the user sees, what the app does (Owner: Jason, due: YYYY-MM-DD)
- App name, icon and splash (Owner: Jason, due: YYYY-MM-DD)

Ask Claude chat for these files at the end:

- SPEC.md: what the app does, screens, rules, decisions table, failure modes, definition of done
- CLAUDE.md: house rules for Claude Code (start from section 6 below)
- docs/mockups/: the PNG exports
- assets/: icon and splash files
- Any data files the app needs (like data/foods.json), with a cited source for every safety-related number

Permanent decisions. The app ID (io.github.mecheng70.<appname>) can never change once anyone installs the app. Pick it on day one.

A clickable HTML demo of the main flow, built in Claude chat, is worth it before code: it's cheap to change and easy to send to a friend on any phone for feedback.

## 1. Standard stack

Default: Expo + React Native + TypeScript + NativeWind + React Native Reusables + Expo Router + expo-sqlite + expo-secure-store.

- No server, so no Redis.
- Native features go in local Expo modules (Kotlin), behind TypeScript interfaces, so iOS can be added later.
- Tests: Jest for logic and UI, Robolectric/JUnit for native modules, Maestro for device tests.

Exception: when the app's core job is a native feature (exact alarms, lock-screen alerts, background timing), go native Kotlin + Jetpack Compose + Room instead, with the core logic in a pure Kotlin module (stdlib only) so it can move to Kotlin Multiplatform for iOS later. Bee Timer is the example. Tests: JUnit and Robolectric, Maestro for device tests. Format and lint: ktlint and detekt in place of Prettier and ESLint.

## 2. Machine setup (one time, Fedora)

```
# Java 21
sudo dnf install temurin-21-jdk
echo 'export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk' >> ~/.zshrc

# Maestro (device tests)
curl -fsSL "https://get.maestro.mobile.dev" | bash
echo 'export MAESTRO_CLI_NO_ANALYTICS=1' >> ~/.zshrc
echo 'export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true' >> ~/.zshrc
source ~/.zshrc

# Check KVM for the emulator
ls -l /dev/kvm

# jq, for the usage status line
sudo dnf install jq
```

Android SDK, the emulator and a system image: let Claude Code install these with the SDK manager in the first task, and have it check KVM first.

Security tools: Snyk CLI (run `snyk auth` before the first task; org ID in your Snyk config, never in the repo) and Semgrep.

## 3. GitHub repo

- Create MechEng70/<appname> on GitHub (public is fine if no secrets ever go in) (Owner: Jason, due: YYYY-MM-DD)
- Clone to ~/Documents/git/<appname> (Owner: Jason, due: YYYY-MM-DD)
- Copy in SPEC.md, CLAUDE.md, docs/PLAYBOOK.md, docs/mockups/, assets/ and data files, then commit and push (Owner: Jason, due: YYYY-MM-DD)
- Add .gitignore entries for *.jks, *.keystore, keystore.properties, release/, device test output (Owner: Jason, due: YYYY-MM-DD)

## 4. Claude Code: the planning prompt (first session)

Paste this as the first message in Claude Code, in the repo folder:

```
Read SPEC.md, CLAUDE.md, docs/PLAYBOOK.md, docs/mockups/ and any data files. Before writing any app code, produce these for my review, then stop:

1. docs/design/TECH-DESIGN.md: architecture, layers and what each may import, data model and schema, native modules, security, test strategy, and risks.
2. docs/design/TASKS.md: numbered tasks (T-001, T-002...) grouped in phases. Each task has Goal, Files, Depends on, Size (S, M or L), Model, Parallel-safe (yes or no), Acceptance (pass/fail), Tests, and "Device testing (Jason)" that says exactly what I judge and what I compare it against, or "none".
3. docs/design/WBS.md: the work breakdown by phase.

Also create docs/design/SECURITY-EXCEPTIONS.md (empty table), docs/design/USAGE.md (empty log) and docs/HANDOFF.md.

Stack: <the stack from section 1, default or native exception>.

Quality gate after every task (scripts/check.sh or npm run check): formatter, linter with zero warnings, typecheck, unit and regression tests, Semgrep (<languages>, secrets), Snyk open source and code at high+. Every bug fix gets a regression test that fails before the fix.

T-001 is always usage tracking and the dashboard (playbook section 9). Then: scaffold, quality gate, device test tooling (Maestro on an emulator), release build and signing. The last task of every round stops the dashboard timer (section 9).
```

Review the documents in Claude chat before approving. Ask it to critique them.

## 5. Claude Code: the task loop

Two ways to run it. Pick per project or per round.

Reviewed mode (new apps, early phases). Start or restart a session (fresh sessions are much cheaper than resuming):

```
Read CLAUDE.md, docs/HANDOFF.md and docs/design/TASKS.md. Run git status and git log -5 and tell me what's committed and uncommitted. Start the dashboard timer if it isn't running (playbook section 9). Then start T-<NNN> and stop after it for my review.
```

After each task report:

- Paste the report into Claude chat for a review.
- Look at every screenshot it names (or have Claude chat look).
- Approve with follow-ups, and end with: Then start T-<NNN> and stop after it.

Approval template:

```
T-<NNN> approved. Before T-<next>:
1. <follow-up>
2. <follow-up>
Then start T-<next> and stop after it.
```

Autonomous mode (a working app, a well-specified round). Write a work order in Claude chat (docs/design/<ROUND>-BRIEF.md) with the goal, decisions not to reopen, the oracle rule, hard stops and the task list, then:

```
Read CLAUDE.md, docs/HANDOFF.md, docs/PLAYBOOK.md and docs/design/<ROUND>-BRIEF.md. Run git status and git log -5 and tell me what's committed and what isn't. Start the dashboard timer (playbook section 9). Then start at the first unfinished task and work through every task without stopping, except at the brief's hard stops and the usage throttle (section 9). Commit, update HANDOFF and regenerate the dashboard after each task, and log each task in docs/design/USAGE.md. Stop the dashboard timer as the last step before the final handoff.
```

The oracle rule: tag the last known-good build (for example alpha-baseline). Any behavior question is answered by that build; a visible behavior change is a bug.

Standard hard stops (put them in every brief):

1. Anything destructive on the phone or in the repo (uninstall, clear data, delete tracked files, rewrite pushed history, force push).
2. Creating the release keystore or handling its passwords. Claude Code prepares the commands; Jason runs them.
3. A security tool that needs Jason's login.
4. A test only a real phone can do. Batch these into one list at the end unless the next task depends on the answer.
5. A high or critical finding that can't be fixed without changing behavior.
6. A conflict the oracle rule can't settle.

If a session is canceled or hits a limit:

```
Read CLAUDE.md, docs/HANDOFF.md and docs/design/TASKS.md. Last session stopped partway. Run git status and git log -5, tell me what's committed and what isn't, and check uncommitted work before building on it. Start the dashboard timer if it isn't running. Then finish T-<NNN> and <stop | continue under the brief>.
```

## 6. CLAUDE.md rules (learned the hard way)

Paste these into every new project's CLAUDE.md:

```
## Working rules
- Reviewed mode: one task at a time, stop after each task for review, never start the next task unasked. Autonomous mode: follow the round's brief and its hard stops.
- Uninstalling apps, deleting data, or any other destructive action on a device or in the repo needs an explicit yes from Jason. Don't read consent into an unclear reply.
- No UI element that isn't in docs/mockups or SPEC without asking Jason first. Mockups win over any older version of the app unless SPEC says otherwise.
- "Device testing for Jason" must say exactly what to judge and what to compare it against.
- Every bug fix gets a regression test that fails before the fix.
- Never report a check as passing without having run it. Say what wasn't verified.
- Never loosen or remove a test assertion to make a run pass. Log any changed check in docs/e2e/FIXES.md.
- Never edit a file by truncating it and reading it back in the same pipeline. Write to a temp file, move it into place, and check it isn't empty.
- After every task: commit with the task ID, update docs/HANDOFF.md, regenerate docs/dashboard.html, log the task in docs/design/USAGE.md.
- Start the dashboard timer at the start of a session; stop it before the final handoff of a round.

## Security
- Never commit tokens, keys, keystores or keystore.properties. Never print secrets.
- No high or critical finding left open without an entry in docs/design/SECURITY-EXCEPTIONS.md with scope and an expiry date.
- Any security scanner skip must fail the gate if it scans fewer projects than exist.
- Device tests: clear logcat (adb logcat -c) before and after each run. Never save logcat unless a test fails, and then only with token patterns redacted.
- Device screenshots always crop off the status bar.

## Devices
- The emulator is the default for device tests. Use the real phone only for tasks marked Real phone (alarms in Doze, lock screen, OEM battery, Bluetooth, real upgrades).
- Install on the phone with adb install -r only. Never force-stop the app in tests (it cancels alarms); simulate process death with Home, am kill, then kill -9.
- Stop Gradle and Kotlin daemons before booting the emulator. Never run a release build with the emulator up.
- Device tests run at 115% and 130% font scale and put every phone setting back afterward.

## Data
- Shipped database migrations are frozen (checksum test). Changes go in new migrations only.
- Corrupt data never crashes a read, and is quarantined (kept for export) before anything overwrites it.
- Every food-safety, medical-safety or treatment number cites a primary source. If unverified, mark it "citation needed (Jason)".

## Layout
- Changing a value never moves the control being tapped or anything above it: tabular digits, fixed-height rows for computed values, warnings below the control, reserve bold label widths, no auto-scroll.
- Never ellipsize the text the user needs to act on (step names, next actions). Wrap instead.
```

## 6b. Models and parallel agents (add to CLAUDE.md)

```
## Models and agents
- Main session: the strongest model available (Fable when included). It plans, merges, runs the gate and talks to Jason.
- Agents: pick the cheapest model that can do the job well.
  - Fable: design judgment, tricky native or debugging work, security decisions.
  - Opus: implementation from a clear spec, writing tests, refactors, code review.
  - Sonnet or Haiku: mechanical work (dashboard updates, doc edits, log scraping, renames).
- Run independent tasks in parallel, each in its own worktree off local main: no emulator, no gate in the worktree, stop with a report.
- Never run two agents that edit the same file. Sequence those.
- Device work is serial: one emulator job at a time (RAM limit). The main session owns the emulators and the phone.
- Merge one branch at a time, run the gate after each merge, then delete the worktree and branch.
- At most 5 agents at once. Stack UI reviews for Jason into one list.
- Before starting any task or agent, check the usage throttle (playbook section 9) and log the decision in docs/design/USAGE.md.
- Never spawn an agent just to refresh the dashboard or poll for status; that's the timer's job.
```

## 7. Release and signing

- Generate the release keystore once. Back up the .jks file and its passwords in the password manager, never the repo (Owner: Jason, due: YYYY-MM-DD)
- chmod 600 the keystore and keystore.properties (Owner: Jason, due: YYYY-MM-DD)
- versionCode scheme from day one: (major*10000 + minor*100 + patch) * 1000 + stage, with alpha.N = N, beta.N = 300+N, rc.N = 600+N, final = 999. Example: 0.1.0-alpha.1 = 100001 (Owner: Jason, due: YYYY-MM-DD)
- Release script: runs the gate, builds, signs, checks the certificate fingerprint, app ID and versionCode, and fails if the signing key is missing (Owner: Jason, due: YYYY-MM-DD)
- Distribute through GitHub Releases. Test every upgrade on the emulator before it goes to anyone's phone (Owner: Jason, due: YYYY-MM-DD)

If the keystore is lost, nobody's installed copy can ever be updated again. Back it up before the first APK leaves the laptop.

A debug-signed install can't be upgraded by a release-signed APK. Switch to release signing before anyone else installs the app; after that, the only cost is one reinstall on your own phone.

## 8. Usage tips (Claude Pro)

- Use a fresh session per task or two (/clear), not --resume on a long one. Long history burns the 5-hour window fast.
- Don't switch models mid-task. Switch between tasks only.
- Don't start a big task above about 80% of the 5-hour window. Wait for the reset.
- If it stops mid-device-test: check phone font size and notification settings, and kill a leftover emulator with adb emu kill.
- Decline usage-credit prompts. Keep auto-reload off.
- An ANTHROPIC_API_KEY environment variable makes Claude Code bill the API instead of the subscription. Check /status shows the Pro login.
- /usage shows any model-specific weekly bar (for example Fable) that the status line can't see. Glance at it once a day.

## 9. Dashboard and usage tracking

Set this up in T-001 of every project, so every later task can be watched and paced.

Status line (on screen):
- scripts/statusline.sh (bash and jq) reads the JSON Claude Code sends to its status line command: rate_limits.five_hour.used_percentage and rate_limits.seven_day.used_percentage, with reset times.
- It prints model, 5-hour %, weekly %, today's weekly budget (below), reset countdowns and the current task ID from docs/HANDOFF.md.
- It also writes the same numbers with a timestamp to ~/.claude/<appname>-usage.json, outside the repo.
- It's wired as the statusLine command in ~/.claude/settings.json. Back the file up first, and wrap any status line already there instead of replacing it.

Dashboard (docs/dashboard.html):
- One self-contained HTML file that opens from disk, in the app's colors.
- Generated by scripts/dashboard.py from TASKS.md, USAGE.md, HANDOFF.md, the last gate output and the usage snapshot. Never hand-edited.
- Shows: version, current task and overall progress; every task by phase with status, commit, size, model and agent; a "Waiting on Jason" box at the top (hard stops and real-phone tests); gate results per tool and the last E2E result; usage bars for the 5-hour window and the week, with today's budget line, reset times and snapshot age (flagged stale after 30 minutes); usage by model, agent and size.

Dashboard timer (on only while a round is running):
- scripts/dashboard-timer.sh with three commands: start, stop and status. Start creates a transient systemd user timer with systemd-run (unit name <appname>-dashboard, every 15 minutes, running scripts/dashboard.py). Transient units leave nothing installed, and they disappear on logout or reboot.
- Started at the beginning of every Claude Code session. Stopped as the last step of a round, right before the final handoff. The final handoff report confirms "dashboard timer stopped" with the output of status.
- Safety net: dashboard.py stops its own timer if the repo has had no commit for 12 hours, so a forgotten timer can't run for days.
- The timer never commits; the main session commits the dashboard at the end of each task. No AI agent runs on a timer.

Usage throttle (the main session checks the snapshot before every task and every agent launch, and logs the decision):

Weekly budget: spread the week over 5 working days, 20% a day. The week starts at the weekly limit's last reset (from its reset time), not on Monday. Day N of the window (counting the current day, capped at 5) has a budget of 20% x N. Days 6 and 7 can use whatever is left.

| Weekly used vs today's budget | What happens |
|---|---|
| 20 or more points under budget | Wide open: parallel agents allowed, normal models |
| Under budget | Normal: agents allowed |
| At or over budget | Throttled: no new agents, agents move to the cheapest model that can do the job, S and M tasks only |
| 10 or more points over budget | Finish the current task, commit, update HANDOFF and the dashboard, stop, and report |
| Over 95% | Stop |

Examples: day 1 with 20% already used is at budget, so throttle. Day 2 with nothing used is 40 points under, so wide open.

| 5-hour window | What happens |
|---|---|
| Under 70% | Normal |
| 70 to 85% | No new agents; finish running ones; S or M tasks only |
| Over 85% | Finish the current task, commit, update HANDOFF and the dashboard, stop until the reset |

The stricter of the two tables wins.

USAGE.md logs every task: task ID, model, agent or main, start and end time, size, 5-hour and weekly % at start and end, the throttle decision, and notes.
