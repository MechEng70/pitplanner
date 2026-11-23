#!/usr/bin/env python3
"""Writes dashboard.html (repo root) from the docs. Never edit the HTML by hand.

Reads docs/design/TASKS.md (phases, tasks, status lines), docs/ROADMAP.md (which release each task is in, the
goal and risks of each release), docs/HANDOFF.md (its "Dashboard" section: the Next line, Waiting on Jason,
Testing needed from you, Today, Agents), docs/design/USAGE.md (the usage log), build/gate/last.tsv and
last.log (the last tools/check.sh run), tools/device/out/report.txt (the last device run), package.json and
the git tags (version), and ~/.claude/usage-snapshot.json (written by the status line). Standard library only.

Run by the main session at the end of every task (the page is committed) and by the dashboard timer
(scripts/dashboard-timer.sh, every 15 minutes, not committed). After writing, it loads the page in headless
Chrome and fails (exit 1) unless the page error count is 0. Safety net: with --timer, if the repo has had no
commit for 12 hours, it stops its own timer.

  python3 scripts/dashboard.py [--timer]
"""

from __future__ import annotations

import base64
import glob
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "dashboard.html")
USAGE_SNAPSHOT = os.path.expanduser("~/.claude/usage-snapshot.json")
TIMER_UNIT = "pitplanner-dashboard"
STALE_SECONDS = 30 * 60
IDLE_STOP_SECONDS = 12 * 3600
WAIT_SHOWN = 5


def read(rel: str) -> str:
    try:
        with open(os.path.join(REPO, rel), encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def esc(s: object) -> str:
    return html.escape(str(s), quote=True)


def inline_md(s: str) -> str:
    """Escapes text, then renders `code` and **bold**."""
    s = esc(s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)


def git(*args: str) -> str:
    try:
        return subprocess.run(["git", "-C", REPO, *args], capture_output=True, text=True, timeout=20).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


# ---- sources: TASKS -----------------------------------------------------------------------------

STATUS_LABEL = {
    "done": "Done",
    "built": "Built",
    "doing": "In progress",
    "wait": "Waiting on Jason",
    "blocked": "Blocked",
    "todo": "To do",
    "dropped": "Dropped",
}
PHRASE = {"built": "built", "doing": "in progress", "wait": "waiting on Jason", "blocked": "blocked"}
STATUS_ORDER = ["done", "built", "doing", "wait", "blocked", "todo"]


def classify(status_line: str) -> str:
    """Maps a TASKS status line to a status key. The first words decide (TASKS keeps them current)."""
    if status_line.startswith("- **Done"):
        return "done"
    s = re.sub(r"\*\*", "", status_line.split("Status:", 1)[-1]).strip().lower()
    for prefix, key in (
        ("done", "done"),
        ("dropped", "dropped"),
        ("waiting on jason", "wait"),
        ("blocked", "blocked"),
        ("in progress", "doing"),
        ("partly", "doing"),
        ("built", "built"),
        ("gate-complete", "built"),
        ("merged", "built"),
        ("todo", "todo"),
        ("backlog", "todo"),
    ):
        if s.startswith(prefix):
            return key
    return "todo"


def parse_tasks(text: str) -> list[dict]:
    """'## Phase N: name' (or '## Maintenance') then '### T-001 Title' with a '- **Status:**' line.
    Tasks after '## Superseded ...' were added after the plan and go into a phase of their own."""
    phases: list[dict] = []
    task = None
    in_phase = False
    for line in text.splitlines():
        m = re.match(r"^## (.+)$", line)
        if m:
            head = m.group(1).strip()
            pm = re.match(r"^(Phase \d+): (.+)$", head)
            if pm:
                phases.append({"id": pm.group(1), "name": pm.group(2), "tasks": []})
                in_phase = True
            elif head.startswith("Maintenance"):
                phases.append({"id": "Maintenance", "name": "", "tasks": []})
                in_phase = True
            elif head.startswith("Superseded"):
                phases.append({"id": "Added later", "name": "tasks added after the plan (T-069 on)", "tasks": []})
                in_phase = True
            else:
                in_phase = False
            task = None
            continue
        m = re.match(r"^### (T-\d{3}) (.+?)\s*$", line)
        if m and in_phase and phases:
            task = {"id": m.group(1), "title": m.group(2), "status": "todo", "status_line": ""}
            phases[-1]["tasks"].append(task)
            continue
        if task is not None and not task["status_line"] and re.match(r"^- \*\*(Status:\*\*|Done)", line):
            task["status_line"] = line
            task["status"] = classify(line)
    return [p for p in phases if p["tasks"]]


def task_commits() -> dict[str, str]:
    """The newest commit whose subject starts with a task ID ('T-105: ...')."""
    out: dict[str, str] = {}
    for line in git("log", "--format=%h%x09%s").splitlines():
        h, _, subj = line.partition("\t")
        m = re.match(r"^(T-\d{3})\b", subj)
        if m and m.group(1) not in out:
            out[m.group(1)] = h
    return out


# ---- sources: ROADMAP ---------------------------------------------------------------------------


def parse_roadmap(text: str) -> list[dict]:
    """One release per '## ' section (not Untriaged or Flags). Members are bullets that start with a bold task
    ID; a bullet like '**T-036** (Setup part)' or '(note)' is part of a task, not the task, and is listed but
    not counted. Also '**Goal:**' and '- **Risk:**' lines, and the '- **No task.**' items."""
    rels: list[dict] = []
    cur = None
    last = None  # the list or dict key that continuation lines append to
    for line in text.splitlines():
        m = re.match(r"^## (.+)$", line)
        if m:
            title = m.group(1).strip()
            last = None
            if title in ("Untriaged", "Flags"):
                cur = None
                continue
            cur = {"name": title.split(":")[0].strip(), "title": title, "intro": "", "goal": "", "ids": [], "parts": [], "notask": 0, "risks": []}
            rels.append(cur)
            continue
        if cur is None:
            continue
        stripped = line.strip()
        if not stripped:
            last = None
            continue
        m = re.match(r"^\s*- \*\*(T-\d{3})\*\*(?:\s*\(([^)]*)\))?", line)
        if m:
            last = None
            q = (m.group(2) or "").lower()
            (cur["parts"] if ("part" in q or q == "note") else cur["ids"]).append(m.group(1))
            continue
        if re.match(r"^\s*- \*\*No task\.\*\*", line):
            cur["notask"] += 1
            last = None
            continue
        m = re.match(r"^- \*\*Risk:\*\* (.+)$", line)
        if m:
            cur["risks"].append(m.group(1).strip())
            last = ("risks", len(cur["risks"]) - 1)
            continue
        m = re.match(r"^\*\*Goal:\*\* (.+)$", line)
        if m:
            cur["goal"] = m.group(1).strip()
            last = ("goal", None)
            continue
        if last and not stripped.startswith("- "):
            key, idx = last
            if idx is None:
                cur[key] += " " + stripped
            else:
                cur[key][idx] += " " + stripped
            continue
        if stripped.startswith("- ") or line[:1].isspace():
            last = None
            continue
        if not cur["intro"]:
            cur["intro"] = stripped
    return rels


# ---- sources: HANDOFF ---------------------------------------------------------------------------


def handoff_section(text: str, heading: str) -> tuple[str, str]:
    """Returns (rest of the heading line, body) of the '### heading' in HANDOFF's Dashboard section."""
    dash = re.search(r"^## Dashboard\b.*?(?=^## |\Z)", text, re.M | re.S)
    if not dash:
        return "", ""
    m = re.search(rf"^### {re.escape(heading)}([^\n]*)\n(.*?)(?=^### |\Z)", dash.group(0), re.M | re.S)
    return (m.group(1).strip(), m.group(2)) if m else ("", "")


def bullets(body: str) -> list[str]:
    items: list[str] = []
    for line in body.splitlines():
        if line.startswith("- "):
            items.append(line[2:].strip())
        elif line.startswith("  ") and items and line.strip():
            items[-1] += " " + line.strip()
        elif not line.strip() and items:
            continue
    return [i for i in items if i and i.lower() != "nothing."]


def handoff_title(text: str) -> str:
    m = re.match(r"^# Handoff \((.+)\)\s*$", text.splitlines()[0] if text else "")
    return m.group(1) if m else ""


def handoff_next(text: str) -> str:
    m = re.search(r"^- \*\*Next:\*\* (.+)$", text, re.M)
    return m.group(1).strip() if m else ""


def handoff_tests(body: str) -> list[dict]:
    """'#### Title' blocks with '- **Field:** value' lines and '  - item' sub-bullets."""
    tests: list[dict] = []
    field = None
    for line in body.splitlines():
        m = re.match(r"^#### (.+)$", line)
        if m:
            tests.append({"title": m.group(1).strip(), "fields": {}})
            field = None
            continue
        if not tests:
            continue
        m = re.match(r"^- \*\*([^:*]+):\*\*\s*(.*)$", line)
        if m:
            field = m.group(1).strip()
            tests[-1]["fields"][field] = [m.group(2).strip()] if m.group(2).strip() else []
            continue
        m = re.match(r"^\s+- (.+)$", line)
        if m and field:
            tests[-1]["fields"][field].append(m.group(1).strip())
            continue
        if line.startswith("    ") and field and tests[-1]["fields"][field]:
            tests[-1]["fields"][field][-1] += " " + line.strip()
    return tests


def parse_table(text: str, first_header: str) -> list[dict]:
    rows: list[dict] = []
    header = None
    for line in text.splitlines():
        if not line.startswith("|"):
            if header is not None:
                break
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header is None:
            if cells and cells[0] == first_header:
                header = cells
            continue
        if set("".join(cells)) <= set("-: "):
            continue
        rows.append(dict(zip(header, cells)))
    return rows


# ---- sources: gate, device run, version, usage --------------------------------------------------

GATE_TOOLS = [
    ("1 ", "Prettier"),
    ("2 ", "ESLint"),
    ("3 ", "TypeScript typecheck"),
    ("prebuild", "Prebuild android/"),
    ("4 ", "Tests"),
    ("5 ", "Semgrep"),
    ("6 ", "Snyk"),
]


def gate_status() -> dict:
    steps: dict[str, dict] = {}
    finished = ""
    try:
        with open(os.path.join(REPO, "build", "gate", "last.tsv"), encoding="utf-8") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if parts[0] == "finished":
                    finished = parts[1] if len(parts) > 1 else ""
                elif len(parts) >= 2:
                    steps[parts[0]] = {"name": parts[0], "status": parts[1], "secs": parts[2] if len(parts) > 2 else ""}
    except OSError:
        pass
    log = read("build/gate/last.log")
    counts = []
    node = re.findall(r"^(?:#|ℹ) pass (\d+)", log, re.M)
    node_fail = re.findall(r"^(?:#|ℹ) fail (\d+)", log, re.M)
    for i, label in enumerate(("engine", "gate self-test")):
        if i < len(node):
            fails = int(node_fail[i]) if i < len(node_fail) else 0
            counts.append(f"{label} {node[i]}" + (f" ({fails} failed)" if fails else ""))
    jest = re.search(r"^Tests:\s+(.*?(\d+) total)", log, re.M)
    suites = re.search(r"^Test Suites:.*?(\d+) total", log, re.M)
    if jest:
        jp = re.search(r"(\d+) passed", jest.group(1))
        jf = re.search(r"(\d+) failed", jest.group(1))
        counts.append(f"Jest {jp.group(1) if jp else 0}" + (f" in {suites.group(1)} suites" if suites else "") + (f" ({jf.group(1)} failed)" if jf else ""))
    k_tests = k_fail = 0
    files = glob.glob(os.path.join(REPO, "modules", "*", "android", "build", "test-results", "testDebugUnitTest", "TEST-*.xml"))
    for p in files:
        try:
            r = ET.parse(p).getroot()
            k_tests += int(r.get("tests", 0))
            k_fail += int(r.get("failures", 0)) + int(r.get("errors", 0))
        except (ET.ParseError, ValueError, OSError):
            k_fail += 1
    if files:
        counts.append(f"Kotlin {k_tests}" + (f" ({k_fail} failed)" if k_fail else ""))
    return {"steps": steps, "finished": finished, "counts": counts, "has_run": bool(steps)}


def device_status() -> dict:
    path = os.path.join(REPO, "tools", "device", "out", "report.txt")
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read()
        mtime = os.path.getmtime(path)
    except OSError:
        return {"results": [], "when": None, "target": ""}
    results = []
    m = re.search(r"^=== device summary ===\n(.*)", text, re.M | re.S)
    if m:
        for line in m.group(1).splitlines():
            r = re.match(r"^(PASS|FAIL)\s+(.+)$", line)
            if r:
                results.append((r.group(1), r.group(2)))
            elif line.strip() and results:
                break
    t = re.search(r"^target: (.+)$", text, re.M)
    return {"results": results, "when": mtime, "target": t.group(1) if t else ""}


def version() -> tuple[str, str]:
    try:
        v = json.loads(read("package.json")).get("version", "?")
    except ValueError:
        v = "?"
    tags = git("tag", "--sort=-creatordate").split()
    return v, (tags[0] if tags else "")


def usage_snapshot() -> dict | None:
    try:
        with open(USAGE_SNAPSHOT, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def last_commit() -> tuple[int, str]:
    out = git("log", "-1", "--format=%ct %h %s").strip()
    try:
        ts, rest = out.split(" ", 1)
        return int(ts), rest
    except ValueError:
        return 0, ""


def icon_data_uri() -> str:
    try:
        with open(os.path.join(REPO, "assets", "brand", "pit-planner-avatar.svg"), "rb") as f:
            return "data:image/svg+xml;base64," + base64.b64encode(f.read()).decode()
    except OSError:
        return ""


# ---- throttle (docs/PLAYBOOK.md section 9) -------------------------------------------------------

LEVELS = ["open", "normal", "throttled", "stop-after", "stop"]
LEVEL_WORDS = {
    "open": "wide open",
    "normal": "normal",
    "throttled": "throttled",
    "stop-after": "stop after this task",
    "stop": "stop",
    "unknown": "unknown",
}
LEVEL_TEXT = {
    "open": "Parallel agents allowed, normal models.",
    "normal": "Agents allowed.",
    "throttled": "No new agents, the cheapest model that can do the job, S and M tasks only.",
    "stop-after": "Finish the current task, commit, update HANDOFF and the dashboard, stop and report.",
    "stop": "Stop.",
}


def throttle(snap: dict | None, now: float) -> tuple[str, str]:
    """Returns (level, why). The stricter of the weekly and the 5-hour table wins."""
    if not snap:
        return "unknown", "No usage snapshot yet. The status line writes one when Claude Code refreshes it."
    if now - snap.get("updated", 0) > STALE_SECONDS:
        return "unknown", "The usage snapshot is over 30 minutes old. Check /usage before starting a task."
    level, why = "normal", []
    wk = snap.get("seven_day") or {}
    used, budget = wk.get("used_percentage"), wk.get("budget_percentage")
    if used is not None and budget is not None:
        diff = used - budget
        if used > 95:
            level = "stop"
            why.append(f"weekly {used:.0f}% is over 95%")
        elif diff >= 10:
            level = "stop-after"
            why.append(f"weekly {used:.0f}% is {diff:.0f} points over today's {budget:.0f}% budget")
        elif diff >= 0:
            level = "throttled"
            why.append(f"weekly {used:.0f}% is at or over today's {budget:.0f}% budget")
        elif diff <= -20:
            level = "open"
            why.append(f"weekly {used:.0f}% is {-diff:.0f} points under today's {budget:.0f}% budget")
        else:
            why.append(f"weekly {used:.0f}% is {-diff:.0f} points under today's {budget:.0f}% budget")
    h5 = (snap.get("five_hour") or {}).get("used_percentage")
    if h5 is not None:
        # Under 70% the 5-hour table sets no limit, so it does not pull "wide open" down to "normal".
        hl = "stop-after" if h5 > 85 else "throttled" if h5 >= 70 else "open"
        why.append(f"5-hour {h5:.0f}%")
        if LEVELS.index(hl) > LEVELS.index(level):
            level = hl
    return level, "; ".join(why)


# ---- rendering ----------------------------------------------------------------------------------

CSS = """
/* Pit Planner's dashboard colors (the hand-kept page's palette, medtechcto.com; assets/brand). */
:root { --bg:#f7f9fa; --surface:#ffffff; --inset:#ecf0f3; --line:#dde3e8;
  --ink:#0f2a43; --ink2:#3d4f5f; --ink3:#5b6b7a; --action:#0c7b7b; --on-action:#ffffff;
  --ok:#1e7d4f; --ember:#6b4fc8; --info:#2563a8; --warn:#9a5b00; --bad:#b3271e;
  --sans:'Inter', -apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --mono:'JetBrains Mono', 'SFMono-Regular', Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root { --bg:#0f2a43; --surface:#1a3a58; --inset:#0c2238; --line:#2d4d6b;
  --ink:#ffffff; --ink2:#a9b6c2; --ink3:#8b98a5; --action:#2fb5b5; --on-action:#0f2a43;
  --ok:#6fcf97; --ember:#b9a6ff; --info:#8fc1ff; --warn:#ffc46b; --bad:#ff8a80; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 var(--sans); }
main { max-width:1240px; margin:0 auto; padding:12px 16px 40px; }
header { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; }
.titlebox { display:flex; gap:12px; align-items:center; min-width:0; }
.titlebox img { width:40px; height:40px; border-radius:10px; flex:none; }
h1 { font-size:22px; font-weight:600; letter-spacing:-0.4px; margin:0; }
h2 { font:500 12px/1.5 var(--mono); letter-spacing:1.5px; text-transform:uppercase; color:var(--ink3); margin:20px 0 6px; }
h3 { font:600 13px/1.5 var(--sans); color:var(--ink2); margin:14px 0 4px; }
.sub { color:var(--ink2); font-size:13px; }
.num { font-family:var(--mono); letter-spacing:-0.3px; font-variant-numeric:tabular-nums; white-space:nowrap; }
code { font-family:var(--mono); font-size:0.88em; background:var(--inset); padding:0 4px; border-radius:4px; overflow-wrap:anywhere; }
button { font:inherit; font-size:13px; font-weight:600; color:var(--on-action); background:var(--action); border:0; border-radius:999px; padding:4px 14px; min-height:32px; cursor:pointer; }
button.quiet { background:transparent; color:var(--ink); border:1px solid var(--line); }
.card { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:12px 16px; }
.top { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:10px 16px; }
.status { font-size:14px; color:var(--ink2); margin:6px 0 0; }
.now { font-size:16px; font-weight:600; margin-top:6px; }
.now .lbl { font:500 11px/1.5 var(--mono); letter-spacing:1.5px; text-transform:uppercase; color:var(--action); margin-right:8px; }
.progress { display:flex; height:12px; border-radius:999px; overflow:hidden; background:var(--inset); margin:8px 0 4px; }
.progress i, .relbar i { display:block; height:100%; }
.grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); }
.meter { position:relative; height:16px; border-radius:8px; background:var(--inset); border:1px solid var(--line); overflow:hidden; margin:6px 0; }
.meter .fill { position:absolute; left:0; top:0; bottom:0; }
.meter .budget { position:absolute; top:-2px; bottom:-2px; width:3px; background:var(--ink); }
.fill.ok { background:var(--ok); } .fill.warn { background:var(--warn); } .fill.bad { background:var(--bad); }
.stale { color:var(--bad); font-weight:600; }
.pill { display:inline-block; font-size:12px; font-weight:500; border-radius:999px; padding:1px 9px; white-space:nowrap; border:1px solid currentColor; }
.done, .pass, .open { color:var(--ok); } .built { color:var(--action); } .doing { color:var(--ember); } .wait { color:var(--info); }
.todo, .dropped, .none, .unknown { color:var(--ink3); } .blocked, .throttled { color:var(--warn); } .fail, .stop, .stop-after { color:var(--bad); }
.normal { color:var(--ok); }
.s-done { background:var(--ok); } .s-built { background:var(--action); }
.s-doing { background:repeating-linear-gradient(45deg, var(--ember) 0 5px, var(--surface) 5px 7px); box-shadow:inset 0 0 0 1px var(--ember); }
.s-wait { background:repeating-linear-gradient(90deg, var(--info) 0 4px, var(--surface) 4px 7px); box-shadow:inset 0 0 0 1px var(--info); }
.s-blocked { background:var(--warn); } .s-todo { background:var(--inset); box-shadow:inset 0 0 0 1px var(--ink3); }
.legend { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:12px; color:var(--ink2); margin-top:4px; }
.dot { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:5px; vertical-align:-1px; }
ul.items { margin:0; padding-left:20px; } ul.items li { margin:4px 0; }
.waitbox { border:2px solid var(--info); }
.today li.isdone { color:var(--ink3); text-decoration:line-through; }
.today { list-style:none; padding-left:0; margin:0; } .today li { margin:3px 0; }
.today .box { font-family:var(--mono); color:var(--action); margin-right:6px; }
.test { border-top:1px solid var(--line); padding:8px 0; } .test:first-child { border-top:0; }
.test summary { cursor:pointer; font-weight:600; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { text-align:left; font-weight:600; color:var(--ink2); font-size:12px; padding:4px 6px; border-bottom:1px solid var(--line); }
td { padding:5px 6px; border-bottom:1px solid var(--inset); vertical-align:top; }
tr.r-doing td, tr.r-wait td { background:var(--inset); }
.tscroll { overflow-x:auto; }
table.tasks { table-layout:fixed; min-width:640px; }
.rel { display:grid; grid-template-columns:110px minmax(120px, 1fr) 210px; gap:4px 14px; align-items:center; padding:8px 0; border-top:1px solid var(--line); }
.rel:first-child { border-top:0; }
.rel b { font:600 14px/1.4 var(--mono); }
.relbar { display:flex; gap:2px; height:14px; border-radius:5px; overflow:hidden; background:var(--inset); }
.rel .what { grid-column:1 / -1; font-size:13px; color:var(--ink2); }
.rel .what .risk { color:var(--warn); }
details.sec { margin-top:10px; background:var(--surface); border:1px solid var(--line); border-radius:12px; }
details.sec > summary { padding:9px 14px; font-weight:600; cursor:pointer; }
details.sec > .body { padding:0 14px 14px; }
footer { margin-top:24px; color:var(--ink3); font-size:12px; }
@media (max-width:700px) { .rel { grid-template-columns:1fr; } .hide-sm { display:none; } }
"""

JS = """
const written = new Date(document.body.dataset.written);
function tick() {
  const mins = Math.max(0, Math.round((Date.now() - written.getTime()) / 60000));
  document.getElementById('age').textContent = mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago' : Math.floor(mins / 60) + ' hr ' + (mins % 60) + ' min ago';
}
tick(); setInterval(tick, 30000);
let auto = false;
try { auto = localStorage.getItem('pp-auto') === '1'; } catch (e) { auto = false; }
function paintAuto() { document.getElementById('auto').textContent = 'Auto reload: ' + (auto ? 'on' : 'off'); }
function toggleAuto() { auto = !auto; try { localStorage.setItem('pp-auto', auto ? '1' : '0'); } catch (e) { /* private window */ } paintAuto(); }
paintAuto();
setInterval(() => { if (auto) location.reload(); }, 60000);
"""


def fmt_time(epoch: float | None, with_day: bool = True) -> str:
    if not epoch:
        return "?"
    return datetime.fromtimestamp(epoch).strftime("%a %b %-d, %-I:%M %p" if with_day else "%-I:%M %p")


def fmt_left(epoch: float | None, now: float) -> str:
    if not epoch:
        return "?"
    s = max(0, int(epoch - now))
    if s >= 86400:
        return f"{s // 86400}d {s % 86400 // 3600}h"
    return f"{s // 3600}h {s % 3600 // 60:02d}m"


def pill(key: str, label: str | None = None) -> str:
    return f'<span class="pill {esc(key)}">{esc(label or STATUS_LABEL.get(key, key))}</span>'


def bar(counts: dict[str, int], total: int, cls: str = "relbar") -> str:
    total = max(1, total)
    return f'<div class="{cls}">' + "".join(
        f'<i class="s-{k}" style="width:{counts.get(k, 0) * 100 / total:.2f}%" title="{esc(STATUS_LABEL[k])}: {counts.get(k, 0)}"></i>'
        for k in STATUS_ORDER if counts.get(k)) + "</div>"


def legend() -> str:
    return '<div class="legend">' + "".join(f'<span><i class="dot s-{k}"></i>{esc(STATUS_LABEL[k])}</span>' for k in STATUS_ORDER) + "</div>"


def meter(label: str, used: float | None, resets: float | None, now: float, budget: float | None = None, extra: str = "") -> str:
    if used is None:
        return f'<div class="card"><b>{esc(label)}</b><div class="sub">Not in the snapshot.</div></div>'
    cls = "ok" if used < 70 else "warn" if used <= 85 else "bad"
    if budget is not None:
        cls = "bad" if used - budget >= 10 or used > 95 else "warn" if used >= budget else "ok"
    mark = f'<div class="budget" style="left:calc({min(budget, 100):.1f}% - 3px)" title="today\'s budget"></div>' if budget is not None else ""
    btxt = f" &middot; today's budget <span class=num>{budget:.0f}%</span>" if budget is not None else ""
    return (f'<div class="card"><b>{esc(label)}</b> <span class="num" style="float:right">{used:.0f}% used</span>'
            f'<div class="meter"><div class="fill {cls}" style="width:{min(used, 100):.1f}%"></div>{mark}</div>'
            f'<div class="sub">Resets {esc(fmt_time(resets))} (in <span class=num>{esc(fmt_left(resets, now))}</span>){btxt}{extra}</div></div>')


def render() -> str:
    now = time.time()
    tasks_md = read("docs/design/TASKS.md")
    handoff = read("docs/HANDOFF.md")
    usage_md = read("docs/design/USAGE.md")
    phases = parse_tasks(tasks_md)
    all_tasks = [t for p in phases for t in p["tasks"]]
    by_id = {t["id"]: t for t in all_tasks}
    commits = task_commits()
    rels = parse_roadmap(read("docs/ROADMAP.md"))
    usage_rows = parse_table(usage_md, "Task")
    by_task: dict[str, dict] = {}
    for r in usage_rows:
        by_task[r.get("Task", "")] = r  # the last row for a task wins
    gate = gate_status()
    dev = device_status()
    snap = usage_snapshot()
    level, why = throttle(snap, now)
    commit_ts, commit_txt = last_commit()
    pkg_version, tag = version()
    nxt = handoff_next(handoff)
    title_line = handoff_title(handoff)
    _, wait_body = handoff_section(handoff, "Waiting on Jason")
    waiting = bullets(wait_body)
    _, test_body = handoff_section(handoff, "Testing needed from you")
    tests = handoff_tests(test_body)
    today_head, today_body = handoff_section(handoff, "Today")
    _, agents_body = handoff_section(handoff, "Agents")
    agents = parse_table(agents_body, "Agent")

    counted = [t for t in all_tasks if t["status"] != "dropped"]
    counts = {k: 0 for k in STATUS_ORDER}
    for t in counted:
        counts[t["status"]] += 1

    written = datetime.now().astimezone().isoformat(timespec="seconds")
    h: list[str] = []
    h.append('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">')
    h.append(f'<title>Pit Planner status</title><style>{CSS}</style></head><body data-written="{esc(written)}"><main>')

    # 1 Status line
    icon = icon_data_uri()
    h.append('<div class="top"><header><div class="titlebox">' + (f'<img src="{icon}" alt="">' if icon else ""))
    ver = f'Version <span class=num>{esc(pkg_version)}</span>' + (f' &middot; latest tag <span class=num>{esc(tag)}</span>' if tag else "")
    h.append(f'<div><h1>Pit Planner status</h1><div class="sub">{ver} &middot; updated '
             f'<span class=num>{esc(datetime.now().strftime("%a %Y-%m-%d %-I:%M %p"))}</span> (<span id="age"></span>)</div></div></div>')
    h.append('<div><button onclick="location.reload()">Reload</button> <button class="quiet" id="auto" onclick="toggleAuto()">Auto reload: off</button></div></header>')
    h.append(f'<div class="now"><span class="lbl">Now</span>{inline_md(nxt) if nxt else "Nothing named in HANDOFF"}</div>')
    if title_line:
        h.append(f'<div class="status">{inline_md(title_line)}</div>')
    h.append(bar(counts, len(counted), "progress"))
    parts = [f'{counts[k]} {PHRASE[k]}' for k in ("built", "doing", "wait", "blocked") if counts[k]]
    h.append(f'<div class="sub"><span class=num>{counts["done"]} of {len(counted)}</span> tasks done' + (", " + ", ".join(parts) if parts else "") + "</div>")
    h.append("</div>")

    # 2 Usage
    h.append("<h2>Usage</h2>")
    if snap:
        age = now - snap.get("updated", 0)
        st = age > STALE_SECONDS
        stale = f' &middot; snapshot <span class="{"stale" if st else "num"}">{int(age // 60)} min old{" (stale)" if st else ""}</span>'
        fh, wk = snap.get("five_hour") or {}, snap.get("seven_day") or {}
        day = wk.get("day")
        h.append('<div class="grid">')
        h.append(meter("5-hour window", fh.get("used_percentage"), fh.get("resets_at"), now, extra=stale))
        h.append(meter("Week (all models)", wk.get("used_percentage"), wk.get("resets_at"), now, budget=wk.get("budget_percentage"),
                       extra=(f" &middot; day <span class=num>{day}</span> of 7" if day else "") + stale))
        h.append("</div>")
    h.append(f'<div class="card" style="margin-top:10px">{pill(level, "Throttle: " + LEVEL_WORDS[level])} '
             f'{esc(LEVEL_TEXT.get(level, ""))} <span class="sub">({esc(why)})</span>'
             '<div class="sub" style="margin-top:4px">The status line sees the 5-hour and the all-models weekly limit only. '
             "A model's own weekly bar (Fable) shows only in <code>/usage</code>; Jason passes it on, and the Fable rules in CLAUDE.md apply.</div></div>")

    # 3 Waiting on Jason
    h.append("<h2>Waiting on Jason</h2>")
    if waiting:
        def li(w: str) -> str:
            return f"<li>{inline_md(w)}</li>"
        h.append('<div class="card waitbox"><ul class="items">' + "".join(li(w) for w in waiting[:WAIT_SHOWN]) + "</ul>")
        if len(waiting) > WAIT_SHOWN:
            h.append(f'<details><summary class="sub">{len(waiting) - WAIT_SHOWN} more</summary><ul class="items">'
                     + "".join(li(w) for w in waiting[WAIT_SHOWN:]) + "</ul></details>")
        h.append("</div>")
    else:
        h.append('<div class="card sub">Nothing right now.</div>')

    # 4 Testing needed from you
    h.append("<h2>Testing needed from you</h2>")
    if tests:
        h.append('<div class="card">')
        for i, t in enumerate(tests):
            f = t["fields"]
            mins = " ".join(f.get("Minutes", [])) or "?"
            h.append(f'<details class="test"{" open" if i == 0 else ""}><summary>{inline_md(t["title"])} '
                     f'<span class="sub">({esc(mins)} of your time)</span></summary>')
            if f.get("When"):
                h.append(f'<div class="sub">When: {inline_md(" ".join(f["When"]))}</div>')
            for label, key in (("What to do", "Do"), ("What you judge, and against what", "Judge"), ("Not yours to test", "Not yours")):
                if f.get(key):
                    h.append(f"<h3>{label}</h3><ul class=\"items\">" + "".join(f"<li>{inline_md(x)}</li>" for x in f[key]) + "</ul>")
            h.append("</details>")
        h.append("</div>")
    else:
        h.append('<div class="card sub">Nothing needed from you right now.</div>')

    # 5 Today
    h.append("<h2>Today</h2>")
    m = re.search(r"\((\d{4}-\d{2}-\d{2})\)", today_head)
    todo_items = bullets(today_body)
    if m and m.group(1) == date.today().isoformat() and todo_items:
        rows = []
        for it in todo_items:
            cm = re.match(r"^\[( |x)\]\s*(.*)$", it)
            done = bool(cm and cm.group(1) == "x")
            text = cm.group(2) if cm else it
            rows.append(f'<li class="{"isdone" if done else ""}"><span class="box">{"[x]" if done else "[ ]"}</span>{inline_md(text)}</li>')
        left_n = sum(1 for r in rows if 'class=""' in r)
        h.append(f'<div class="card"><ul class="today">{"".join(rows)}</ul><div class="sub" style="margin-top:4px">'
                 f'<span class=num>{left_n}</span> of {len(rows)} left</div></div>')
    else:
        last = f" The last list in HANDOFF is from {esc(m.group(1))}." if m else ""
        h.append(f'<div class="card sub">Nothing listed for today.{last}</div>')

    # 6 Releases at a glance
    member: dict[str, str] = {}
    for r in rels:
        for tid in r["ids"]:
            member.setdefault(tid, r["name"])
    for r in rels:  # a part bullet ("the two-phone part") counts there while the task itself is still open
        for tid in list(r["parts"]):
            if tid in by_id and by_id[tid]["status"] != "done" and tid not in member:
                member[tid] = r["name"]
                r["ids"].append(tid)
                r["parts"].remove(tid)
    shipped = {"name": "0.3.0", "title": "0.3.0", "intro": "", "goal": "", "ids": [], "parts": [], "notask": 0, "risks": []}
    unplaced = {"name": "Not placed", "title": "Not placed", "intro": "Open tasks that ROADMAP does not list.", "goal": "", "ids": [], "parts": [], "notask": 0, "risks": []}
    for t in all_tasks:
        if t["id"] in member or t["status"] == "dropped":
            continue
        (shipped if t["status"] == "done" else unplaced)["ids"].append(t["id"])
    rm = re.search(r"\*\*(0\.3\.0 was released[^*]+)\*\*", read("docs/ROADMAP.md"))
    shipped["intro"] = (rm.group(1) + ".") if rm else "Released."
    rows_rel = [shipped] + rels + ([unplaced] if unplaced["ids"] else [])
    h.append('<details class="sec" open><summary>Releases at a glance</summary><div class="body">')
    for r in rows_rel:
        c = {k: 0 for k in STATUS_ORDER}
        for tid in r["ids"]:
            if tid in by_id:
                c[by_id[tid]["status"] if by_id[tid]["status"] in c else "todo"] += 1
        n = sum(c.values())
        if not n and not r["notask"]:
            continue
        txt = f'<span class=num>{c["done"]} of {n}</span> done' + "".join(f', {c[k]} {PHRASE[k]}' for k in ("built", "doing", "wait", "blocked") if c[k])
        if r["notask"]:
            txt += f' &middot; {r["notask"]} item{"s" if r["notask"] != 1 else ""} with no task'
        goal = r["goal"] or r["intro"]
        what = inline_md(goal[:1].upper() + goal[1:])
        if r["parts"]:
            what += f' <span class="sub">Also parts of {esc(", ".join(r["parts"]))}.</span>'
        risks = "".join(f'<div class="risk">Risk: {inline_md(x)}</div>' for x in r["risks"])
        h.append(f'<div class="rel"><b>{esc(r["name"])}</b>{bar(c, n)}<div class="sub">{txt}</div><div class="what">{what}{risks}</div></div>')
    h.append(legend() + "</div></details>")

    # 7 Tasks by phase
    h.append('<details class="sec"><summary>Tasks by phase</summary><div class="body">')
    for p in phases:
        pc = {k: 0 for k in STATUS_ORDER}
        for t in p["tasks"]:
            if t["status"] in pc:
                pc[t["status"]] += 1
        h.append(f'<h3>{esc(p["id"])}{": " + esc(p["name"]) if p["name"] else ""} '
                 f'<span class="sub num">{pc["done"]} of {sum(pc.values())} done</span></h3>')
        h.append('<div class="tscroll"><table class="tasks"><colgroup><col style="width:62px"><col><col style="width:130px">'
                 '<col style="width:76px"><col style="width:42px"><col style="width:90px"><col style="width:80px"></colgroup>'
                 "<tr><th>ID</th><th>Task</th><th>Status</th><th>Commit</th><th>Size</th><th>Model</th><th>Agent</th></tr>")
        for t in p["tasks"]:
            u = by_task.get(t["id"], {})
            commit = commits.get(t["id"]) or next(iter(re.findall(r"`([0-9a-f]{7,})`", t["status_line"])), "")
            h.append(f'<tr class="r-{t["status"]}"><td class="num">{esc(t["id"])}</td><td>{inline_md(t["title"])}</td>'
                     f'<td>{pill(t["status"])}</td><td class="num">{esc(commit)}</td><td>{esc(u.get("Size", ""))}</td>'
                     f'<td>{esc(u.get("Model", ""))}</td><td>{esc(u.get("Agent or main", ""))}</td></tr>')
        h.append("</table></div>")
    h.append('<div class="sub" style="margin-top:8px">Status comes from the first words of each task\'s status line in TASKS. '
             "Commit is the newest commit whose subject starts with the task ID. Size, model and agent come from USAGE.md "
             "(logged from 2026-11-23 on).</div></div></details>")

    # 8 Gate
    h.append('<details class="sec"><summary>Gate and device tests</summary><div class="body"><div class="grid">')
    rows = []
    if gate["has_run"]:
        for prefix, label in GATE_TOOLS:
            step = next((s for n, s in gate["steps"].items() if n.startswith(prefix)), None)
            if step is None:
                if prefix == "prebuild":
                    continue
                rows.append(f"<tr><td>{esc(label)}</td><td>{pill('none', 'not run')}</td><td></td></tr>")
                continue
            key = "pass" if step["status"] == "PASS" else "fail"
            extra = ""
            if prefix == "4 " and gate["counts"]:
                extra = '<div class="sub">' + esc(", ".join(gate["counts"])) + "</div>"
            rows.append(f'<tr><td>{esc(label)}{extra}</td><td>{pill(key, step["status"])}</td><td class="num">{esc(step["secs"])} s</td></tr>')
        fin = gate["finished"]
        when = esc(datetime.fromisoformat(fin).strftime("%a %b %-d, %-I:%M %p")) if fin else "unfinished run"
        h.append(f'<div class="card"><b>npm run check</b><div class="sub">Last run: {when}</div><table>{"".join(rows)}</table></div>')
    else:
        h.append('<div class="card"><b>npm run check</b><div class="sub">No run recorded yet. <code>tools/check.sh</code> writes '
                 "<code>build/gate/last.tsv</code> from the next run on.</div></div>")
    if dev["results"]:
        dr = "".join(f'<tr><td>{esc(name)}</td><td>{pill("pass" if res == "PASS" else "fail", res)}</td></tr>' for res, name in dev["results"])
        h.append(f'<div class="card"><b>Last device run (Maestro, <code>npm run device</code>)</b><div class="sub">'
                 f'{esc(fmt_time(dev["when"]))} &middot; {esc(dev["target"])}</div><table>{dr}</table></div>')
    else:
        h.append('<div class="card"><b>Last device run (Maestro)</b><div class="sub">No device summary in <code>tools/device/out/report.txt</code>.</div></div>')
    h.append("</div></div></details>")

    # 9 Agents
    h.append('<details class="sec"><summary>Agents</summary><div class="body">')
    if agents:
        cols = list(agents[0].keys())
        h.append('<div class="tscroll"><table><tr>' + "".join(f"<th>{esc(c)}</th>" for c in cols) + "</tr>")
        for a in agents:
            h.append("<tr>" + "".join(f"<td>{inline_md(a.get(c, ''))}</td>" for c in cols) + "</tr>")
        h.append("</table></div>")
    else:
        h.append('<div class="sub">No agents this session (HANDOFF, Dashboard, Agents).</div>')
    h.append("</div></details>")

    # 10 Usage log
    def summarize(key: str) -> str:
        agg: dict[str, int] = {}
        for r in usage_rows:
            k = r.get(key, "") or "?"
            agg[k] = agg.get(k, 0) + 1
        return ", ".join(f"{esc(k)}: <span class=num>{v}</span>" for k, v in sorted(agg.items())) or "none yet"

    h.append('<details class="sec"><summary>Usage log</summary><div class="body">')
    if usage_md:
        h.append(f'<div class="sub">Tasks by model: {summarize("Model")}<br>By agent or main: {summarize("Agent or main")}<br>By size: {summarize("Size")}</div>')
        if usage_rows:
            cols = list(usage_rows[0].keys())
            h.append('<div class="tscroll"><table style="margin-top:8px"><tr>' + "".join(f"<th>{esc(c)}</th>" for c in cols) + "</tr>")
            for r in usage_rows:
                h.append("<tr>" + "".join(f"<td>{inline_md(r.get(c, ''))}</td>" for c in cols) + "</tr>")
            h.append("</table></div>")
        tt = re.search(r"^## (Time and tokens.*)\n(.*?)(?=^## |\Z)", usage_md, re.M | re.S)
        if tt:
            h.append(f"<h3>{inline_md(tt.group(1))}</h3>")
            body = tt.group(2)
            for para in re.split(r"\n\s*\n", body.strip()):
                if para.lstrip().startswith("|"):
                    first = [c.strip() for c in para.strip().splitlines()[0].strip().strip("|").split("|")]
                    trows = parse_table(para, first[0])
                    h.append('<div class="tscroll"><table style="margin:6px 0"><tr>' + "".join(f"<th>{esc(c)}</th>" for c in first) + "</tr>")
                    for r in trows:
                        h.append("<tr>" + "".join(f"<td>{inline_md(r.get(c, ''))}</td>" for c in first) + "</tr>")
                    h.append("</table></div>")
                else:
                    h.append(f'<div class="sub" style="margin:6px 0">{inline_md(" ".join(para.split()))}</div>')
    else:
        h.append('<div class="sub">No <code>docs/design/USAGE.md</code> yet.</div>')
    h.append("</div></details>")

    h.append(f'<footer>Generated by <code>scripts/dashboard.py</code> from TASKS.md, ROADMAP.md, HANDOFF.md, USAGE.md, the last gate '
             f'and device runs and <code>~/.claude/usage-snapshot.json</code>. Never edit by hand. Last commit: '
             f'<span class=num>{esc(commit_txt)}</span>{" (" + esc(fmt_time(commit_ts)) + ")" if commit_ts else ""}.</footer>')
    h.append(f"</main><script>{JS}</script></body></html>\n")
    return "\n".join(h)


# ---- page error check, timer safety net, main ---------------------------------------------------


def page_errors(path: str) -> int | None:
    """Loads the page in headless Chrome and counts uncaught page errors (CLAUDE.md's check). None: no Chrome."""
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        return None
    try:
        r = subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--virtual-time-budget=4000", "--enable-logging=stderr", "--v=1",
             "--dump-dom", "file://" + path],
            capture_output=True, text=True, timeout=90)
    except (OSError, subprocess.SubprocessError):
        return None
    return len(re.findall(r'CONSOLE:\d*\] "Uncaught', r.stderr))


def stop_timer_if_idle() -> None:
    ts, _ = last_commit()
    if ts and time.time() - ts > IDLE_STOP_SECONDS:
        subprocess.run(["systemctl", "--user", "stop", f"{TIMER_UNIT}.timer"], capture_output=True, timeout=20)
        print(f"No commit for 12 hours: stopped {TIMER_UNIT}.timer", file=sys.stderr)


def main() -> int:
    page = render()
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(page)
    if os.path.getsize(tmp) == 0:
        os.remove(tmp)
        print("dashboard.py: empty output, not written", file=sys.stderr)
        return 1
    os.replace(tmp, OUT)
    if "--timer" in sys.argv:
        stop_timer_if_idle()
    errors = page_errors(OUT)
    if errors is None:
        print(f"Wrote {os.path.relpath(OUT, REPO)}; page error check NOT run (no Chrome found)", file=sys.stderr)
        return 1
    print(f"Wrote {os.path.relpath(OUT, REPO)}; page errors: {errors}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
