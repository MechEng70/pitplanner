# Usage log

One row per task (and per throttle decision), so Jason can see where plan usage goes. Times are local
(Eastern). Size: S (under 30 min), M (30 to 90 min), L (over 90 min). 5h and Wk are the 5-hour and weekly
used % from the status line snapshot (`~/.claude/usage-snapshot.json`) at the start and end of the task.
Throttle is the decision taken before the task (`docs/PLAYBOOK.md` section 9). "n/a": not read at that point.
Logging starts with the DASH round (2026-11-23); nothing before it is backfilled. `scripts/dashboard.py` reads
the first table and the "Time and tokens" section.

| Task | Model | Agent or main | Start | End | Size | 5h start | 5h end | Wk start | Wk end | Throttle | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DASH-1 | Opus 5.5 | main | 2026-11-23 11:08 | 2026-11-23 11:11 | S | 7 | n/a | 61 | n/a | wide open (61% vs 100% budget, day 7) | Read Bee Timer's files and the old page; mapping in the brief |
| DASH-2 | Opus 5.5 | main | 2026-11-23 11:11 | 2026-11-23 11:13 | S | n/a | 8 | n/a | 61 | wide open | Global status line; settings.json backed up first |
| DASH-3 | Opus 5.5 | main | 2026-11-23 11:13 | 2026-11-23 11:19 | M | 8 | 9 | 61 | 61 | wide open | Generator, TASKS statuses, ROADMAP goals and risks, HANDOFF Dashboard section, gate output |
| DASH-4 | Opus 5.5 | main | 2026-11-23 11:19 | 2026-11-23 11:21 | S | 9 | 9 | 61 | 62 | wide open | Timer script; safety net tested |
| DASH-5 | Opus 5.5 | main | 2026-11-23 11:21 | 2026-11-23 11:21 | S | 9 | 9 | 62 | 62 | wide open | USAGE.md; the old page's time and tokens moved here |
| DASH-6 | Opus 5.5 | main | 2026-11-23 11:23 | 2026-11-23 11:22 | S | 9 | 9 62 | 62 |  | wide open | CLAUDE.md dashboard and usage rules, HANDOFF, DEVELOPING |
| DASH-7 | Opus 5.5 | main | 2026-11-23 11:23 | 2026-11-23 11:27 | S | 9 | 10 | 62 | 62 | wide open | Gate run twice: first failed on 13 Jest timeouts at load 18 (Jest alone then passed 1002); second passed all six |
| T-105 replan | Opus 5.5 | main + 1 Sonnet agent | 2026-11-23 18:42 | 2026-11-23 18:55 | S | 7 | 8 | 65 | 65 | wide open (65% vs 100% budget, day 7) | T-105 into beta.2, alarm volume (B); Play rules checked; beta.2 plan; docs only |

## Time and tokens (counted 2026-11-18; carried from the old dashboard, not recounted)

Transcripts: main and subagent files, one count per message id. Active time skips gaps over 15 min. Git hours: commits within 2h form a block, plus 30 min. Local time (EST). Cache writes and cache reads are counted in "in". Sessions are counted as main transcript files that hold replies.

| Measure | Value |
|---|---|
| Git-estimated hours | 55.0 h over 8 days, 294 commits |
| Main thread active | 48.8 h in 27 transcript files |
| Agents active | 14.7 h in 82 agent runs (parallel agents overlap) |
| Main tokens, Fable 5.2 | in 904.6M, out 3.00M |
| Main tokens, Opus 5.5 | in 321.2M, out 1.41M |
| Agent tokens, Opus 5.5 | in 284.6M, out 1.70M |
| Agent tokens, Fable, Sonnet, Haiku | in 90.6M / 34.0M / 0.24M, out 1.04M / 0.32M / 0.01M |

| Week or item | Value |
|---|---|
| 2026-11-09 | 145 commits, git 35.1 h, 21 sessions, main 31.4 h, agents 2.7 h |
| 2026-11-16 (so far) | 149 commits, git 19.9 h, 6 sessions, main 17.3 h, agents 12.0 h |
| Oldest transcript | 2026-11-11 09:05 |
| Retention | cleanupPeriodDays set to 365 |

| Model | Main in | Main out | Agents in | Agents out |
|---|---|---|---|---|
| Fable 5.2 | 904.64M | 3.00M | 90.63M | 1.04M |
| Opus 5.5 | 321.20M | 1.41M | 284.56M | 1.70M |
| Sonnet 5.5 | 0.00M | 0.00M | 34.00M | 0.32M |
| Haiku 5.5 | 0.00M | 0.00M | 0.24M | 0.01M |
