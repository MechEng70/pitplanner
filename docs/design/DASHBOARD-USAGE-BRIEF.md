# Dashboard and usage tracking brief (Pit Planner)

Written in Claude chat with Jason on 2026-11-23. Claude Code: this is a work order. Read it fully, plus `docs/PLAYBOOK.md` section 9, before starting.

## Goal

Rebuild Pit Planner's `dashboard.html` the way Bee Timer's now works, and adopt the same automatic usage tracking and throttle. No app code changes. Nothing in `src/`, `app/`, `engine/`, `modules/`, `android/` or `plugins/` is touched.

Reference implementation (read only, change nothing there): `~/Documents/git/beetimer`
- `scripts/dashboard.py`: generates the dashboard from the docs
- `scripts/dashboard-timer.sh`: transient 15-minute systemd timer, start, stop and status
- `scripts/statusline.sh`: status line that captures usage
- `docs/dashboard.html`: the result Jason likes
- `docs/PLAYBOOK.md` section 9: the rules (a copy is in this repo too)

## Decisions (Jason, 2026-11-23; these replace older CLAUDE.md rules where they conflict)

| Topic | Old Pit Planner rule | New rule |
|---|---|---|
| How the dashboard is made | A keeper agent hand-edits `dashboard.html` and its `D` data object | `scripts/dashboard.py` generates it from TASKS.md, HANDOFF.md, USAGE.md, ROADMAP.md, the last gate and E2E output, and the usage snapshot. Never hand-edited. No keeper agent. |
| When it updates | Every time an agent starts or stops | At the end of every task (committed), plus a 15-minute transient timer while a session is running (not committed). The main session also regenerates it when an agent starts or stops. |
| What it shows | "What's next only", no task lists | Bee Timer's layout: usage bars, gate results per tool, last E2E, tasks by phase. Keep Pit Planner's "what's next" sections at the top (see Layout). |
| Usage numbers | Jason reads /usage and tells Claude | Captured automatically from the status line (playbook section 9). Jason only reports a model-specific weekly bar (for example Fable) that the status line can't see. |
| Throttle | "When Jason says Fable is at 80%..." | The playbook section 9 tables: 5-hour window and weekly pacing at 20% of the week per working day, counted from the weekly reset. The stricter one wins. Keep the Fable rules as written, triggered by Jason or by a `/usage` reading he passes on. |

Update CLAUDE.md to match this table: rewrite the dashboard-keeper and usage-rule bullets, keep every other rule.

## Layout

Top of the page, always visible, in this order:
1. Status line: version, current task, overall progress, last updated (from the clock, never typed).
2. Usage: 5-hour bar and weekly bar, each with % used, reset time, today's weekly budget line, snapshot age (stale after 30 minutes), and the throttle state in words ("wide open", "normal", "throttled", "stop after this task").
3. Waiting on Jason.
4. Testing needed from you: every hands-on test Jason owes, with minutes needed, steps, what he judges and against which picture or text, and what isn't his to test. Removed when he reports it. (Keep this exactly as Pit Planner has it now.)
5. Today: today's to-dos in order.

Below, collapsible, like Bee Timer:
6. Releases at a glance (the bars).
7. Tasks by phase: ID, title, status, commit, size, model, agent.
8. Gate: last result per tool (Prettier, ESLint, typecheck, Jest with test count, Semgrep, Snyk) and last device-test (Maestro) result.
9. Agents: running and finished this session, with model and files.
10. Usage log: USAGE.md summarized by model, agent and size.

Colors: Pit Planner's own brand from `assets/brand/` and the current dashboard, not Bee Timer's. Bee Timer provides the layout and sections, not the palette.

## Shared status line (affects both repos: do this carefully)

Right now `~/.claude/settings.json` points the status line at Bee Timer's repo script, which reads Bee Timer's HANDOFF and only writes `~/.claude/beetimer-usage.json`. Usage limits are account-wide, but the task shown should follow whatever repo Claude Code is running in.

- Make one global script, `~/.claude/statusline-usage.sh`, based on Bee Timer's. It reads the current directory from the JSON Claude Code sends (`.workspace.current_dir`, falling back to `.cwd`) and shows that repo's current task from its `docs/HANDOFF.md` if it has one.
- It writes the snapshot to `~/.claude/usage-snapshot.json` and, for compatibility, also to `~/.claude/beetimer-usage.json` (same content) until Bee Timer's dashboard.py is switched over. Write to a temp file and move it into place.
- Keep the caveman badge working (wrap it, as Bee Timer's script does).
- Back up `~/.claude/settings.json` first, then point `statusLine` at the global script. This is the one change outside this repo Jason approves.
- Don't edit anything in the beetimer repo. Add a line to Pit Planner's HANDOFF: "Bee Timer: switch dashboard.py to read ~/.claude/usage-snapshot.json, then the compatibility copy can go."
- Check it: the status line shows Pit Planner's task when Claude Code runs here, and the snapshot file updates.

## Tasks

Do them in order, one commit each, prefixed DASH-.

- **DASH-1 Read.** Read Bee Timer's four files above and Pit Planner's current `dashboard.html`. List which current sections and data map to which new sections. Report anything in the current page that would be lost; keep it unless it's covered elsewhere.
- **DASH-2 Status line.** The shared status line above.
- **DASH-3 Generator.** `scripts/dashboard.py` (Python 3, standard library only) writes `dashboard.html` at the repo root (keep the same path so links still work). Self-contained, opens from disk, no network. Same headless Chrome page-error check as today, run by the script itself; it fails if the count isn't 0.
- **DASH-4 Timer.** `scripts/dashboard-timer.sh` start, stop and status, unit name `pitplanner-dashboard`, as in Bee Timer. Safety net: dashboard.py stops its own timer after 12 hours with no commit.
- **DASH-5 Usage log.** Create `docs/design/USAGE.md` with Bee Timer's columns. Backfill nothing; start logging from this round.
- **DASH-6 Docs.** Update CLAUDE.md (decisions table above), HANDOFF.md, DEVELOPING.md (how to run the generator and the timer). Copy the Bee Timer section 9 throttle tables into CLAUDE.md by reference to `docs/PLAYBOOK.md`, not by duplicating them.
- **DASH-7 Check and stop.** Generate the dashboard, confirm 0 page errors, open it and confirm every section has real data (no placeholders). Then run `scripts/dashboard-timer.sh stop` and include the `status` output. Report, then stop.

Hard stops: anything destructive in either repo, any change to app code, any problem with `~/.claude/settings.json` you can't undo from the backup.

## DASH-1 findings (2026-11-23)

Read: Bee Timer's `scripts/dashboard.py`, `scripts/dashboard-timer.sh`, `scripts/statusline.sh`,
`docs/dashboard.html`, its PLAYBOOK section 9, and Pit Planner's `dashboard.html` (the hand-kept `D` object).

### Where each part of the current page goes

| Current page (D field) | New section | Generated from |
|---|---|---|
| Header: written / loaded time, Reload, Auto reload | 1 Status line (buttons kept) | the clock at generation |
| `now.status` | 1 Status line | HANDOFF title line, `- **Next:**` line, TASKS counts |
| Waiting on Jason (`jason`, 14 items, 5 shown) | 3 Waiting on Jason | HANDOFF `### Waiting on Jason` (the 14 items move there) |
| Testing needed from you (`testing`, empty today) | 4 Testing needed from you | HANDOFF `### Testing needed from you` (same fields: minutes, when, steps, what he judges, not his) |
| Today (`today`) | 5 Today | HANDOFF `### Today (date)`; an old date shows as "nothing listed for today" |
| Releases at a glance (`roads.list`, `tasks`, `beta1`) | 6 Releases at a glance | ROADMAP sections for membership, TASKS status lines for status |
| Releases: goal, next steps, decisions, risks, `road` lines | 6 (goal and risks per release) | ROADMAP `Goal:` and `Risks:` lines (added); next steps and decisions are HANDOFF's "Owed" and Waiting on Jason |
| `tasks`, `after` (rows with notes) | 7 Tasks by phase | TASKS (phase headings, status lines), commit from `git log`, model and agent from USAGE.md |
| (none) | 2 Usage, 8 Gate, 10 Usage log | status line snapshot, `build/gate/last.tsv` and log, `tools/device/out/report.txt`, USAGE.md |
| Agents (`agents`, empty) | 9 Agents | HANDOFF `### Agents` table |
| Time and tokens (`timeTokens`, counted 2026-11-18) | 10 Usage log | moved to USAGE.md "Time and tokens" (not covered elsewhere, so kept) |
| Now in detail (`now.title`, `detail`, `eta`) | dropped | covered by HANDOFF's top section, which it restated |
| `beta1` (ten steps of 0.3.1-beta.1, all done) | dropped as its own bar | covered by T-102 (done) in TASKS and HANDOFF; T-102 counts in the 0.3.x bar |

### What would be lost, and what is done about it

- **Task statuses.** The page's statuses were curated by hand; many TASKS status lines are stale (built or
  gate-complete tasks that shipped in 0.3.0, T-038 "todo", T-035 "in progress", T-084 has none, waits on
  Jason written as "backlog"). DASH-3 brings the TASKS status lines in line with the page, prefixing the
  current state and keeping the old text, so TASKS becomes the one source.
- **Release goals and risks.** Not in ROADMAP. Added there as one `Goal:` line and a `Risks:` list per
  release. 0.4.0's risk "if 0.3.0 slips" is dropped: 0.3.0 shipped.
- **Time and tokens.** Moved into USAGE.md as a table, shown in the Usage log section, marked with its count date.
- **Gate results.** `tools/check.sh` printed its summary only to the terminal. DASH-3 makes it also write
  `build/gate/last.tsv` (step results) and `build/gate/last.log` (test counts), git-ignored. No gate step
  changes.
- **Sizes.** TASKS has no sizes; the column fills from USAGE.md for tasks logged from now on.
- **The "Tonight shown next morning" rule.** Kept by design: Today carries its date and goes empty when stale.

Jason, 2026-11-23, after DASH-7: `dashboard.html` is never committed (the repo is public). This replaces "committed" above.
