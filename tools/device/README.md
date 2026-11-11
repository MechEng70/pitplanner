# Device tools

Drive Pit Planner on Jason's phone (OnePlus CPH2583, serial 5ece07c1) over adb. The WebView is
controlled through Chrome DevTools (playwright-core `connectOverCDP`), screenshots come from
`adb exec-out screencap`. Output goes to `out/` (git-ignored).

| Command | What it does |
|---|---|
| `npm run device` | Full pass: back up app data, build + install, capture Plan and Brisket at 115% and 130% with layout measurements, restore data and font size. Read `out/report.txt`, then `out/plan.png`, `out/brisket.png`. |
| `npm run device -- --no-build` | Same without building. |
| `tools/device/deploy.sh` | Build and install only. |
| `tools/device/attach.sh` | Restart the app and forward its DevTools socket to localhost:9333. |
| `node tools/device/alarmcall.mjs <method> '<json>'` | Call the PitAlarms plugin (e.g. `getScheduled`, `cancelAll`). |
| `tools/device/pending.sh` | Alarms Pit Planner has registered with AlarmManager. |
| `tools/device/ui.sh dump` / `tap "<text>"` | Read or tap native UI (system dialogs). Do not use it in the notification shade: other apps' notifications live there. |

Rules: always back up and restore the phone's app data (the user cooks with this app); restore the
font scale (normally 1.15); use bash scripts, not zsh one-liners with `$VAR` commands (zsh does not
word-split, which fails silently). Alarm test commands and results: `docs/alarm-testing.md`.
