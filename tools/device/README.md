# Device tests

Unattended passes on the dev build (`io.github.mecheng70.pitplanner.debug`, "Pit Planner dev") on the phone
over adb. Maestro taps by accessibility label; `uiautomator dump` gives the bounds the checks compare;
screenshots are `adb exec-out screencap`, cropped below the status bar. Output goes to `out/` (git-ignored).

```
npm run device                                   # build + install, all tests at 115% and 130%
npm run device -- --no-build --only sheet-keyboard
npm run device -- --only smoke,stable-controls
```

Read `out/report.txt` first (the "device summary" block at the end), then the images it lists.

| Test | What passes |
|---|---|
| `smoke` | The app opens; Plan, Cook and Gear each open. Images: `out/smoke.png`. |
| `sheet-keyboard` | In a kit Sheet (`pitplanner://dev/kit?sheet=form`) with the keyboard open, the focused field and the pinned Save are fully above the keyboard, and the field is above Save. Weight (bottom) first, then Name (top). D-4 condition. Images: `out/sheet-keyboard.png`. |
| `stable-controls` | For each step in `targets.tsv`: tapping the control moves neither it, its row nor anything above it (T-017 PR-3). `expect moves` marks a detector self-test (the spike must report a move). |

## Safety

The phone is Jason's own. `run.sh` wakes it and stops if it is locked; backs up the dev build's data
(`db.sh backup`, `out/data-<time>.tar`) and restores it on exit; turns heads-up banners off and keeps the
screen on while plugged in; restores font scale and settings on exit. It never touches the release app.
A dump of any window that is not the app (the notification shade, another app) is refused: the shade is
collapsed, the step fails and nothing is written.

## Pieces

| File | Role |
|---|---|
| `run.sh` | The pass: options, safety, build, Metro, tests, summary. |
| `lib.sh` | adb wrapper, cold launch through the dev-client link, `dump`, `tap`, `scroll_to`, status bar and keyboard edges. |
| `db.sh` | `backup [file]` / `restore <file>` of the app's data dirs over `run-as`. |
| `check.mjs`, `ui.mjs` | Checks over dumps (`find`, `stable`, `keyboard`); pure logic tested in `ui.test.mjs` (`npm run test:gate`). |
| `targets.tsv` | `stable-controls` steps: target, route, expect, label, times (tab separated). |
| `crop.py`, `compose.py` | Crop the status bar; put screenshots side by side. |

Notes: Metro is started when it is not running. A cold start with a plain deep link opens the dev launcher, so
`launch` loads the bundle through `pitplanner://expo-development-client/?url=...` and then opens the route.
Maestro reads stdin, so it always gets `/dev/null`. Use bash, not zsh one-liners (zsh does not word-split).
Alarm device tests: `docs/alarm-testing.md` (re-run on the Expo build in T-016).
