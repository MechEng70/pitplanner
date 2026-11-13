# Device tests

Unattended passes on the dev build (`io.github.mecheng70.pitplanner.debug`, "Pit Planner dev") over adb. The
default target is the test emulator (`avd.sh`: AVD `pitplanner`, Android 16 / API 36, Google APIs x86_64 on
KVM, 1080x2376 at 480 dpi = 360x792 dp like the phone), started headless when it is not running and stopped
again. Jason's phone (`--phone`) is only for tests that need real hardware (TASKS "Real phone"). Maestro taps by accessibility label; `uiautomator dump` gives the bounds the checks compare;
screenshots are `adb exec-out screencap`, cropped below the status bar, never showing the keyboard (closed first,
or for `sheet-keyboard` cut at its top edge). Output goes to `out/` (git-ignored).

```
npm run device                                   # emulator: build + install, all tests at 115% and 130%
npm run device -- --phone --only smoke           # the real phone (only when a task needs it)
tools/device/avd.sh start | stop                 # the emulator by hand
npm run device -- --no-build --only sheet-keyboard
npm run device -- --only smoke,stable-controls
```

Read `out/report.txt` first (the "device summary" block at the end), then the images it lists.

| Test | What passes |
|---|---|
| `smoke` | The app opens; Plan, Cook and Gear each open. Images: `out/smoke.png`. |
| `sheet-keyboard` | In a kit Sheet (`pitplanner://dev/kit?sheet=form`) with the keyboard open, the focused field and the pinned Save are fully above the keyboard, and the field is above Save. Weight (bottom) first, then Name (top). D-4 condition. Images: `out/sheet-keyboard.png`. |
| `db` | The real expo-sqlite database (`pitplanner://dev/db`): `user_version`, WAL and the six tables; units saved through the store are still there after the app is killed and restarted (C, then F). |
| `migration-error` | A forced migration failure (dev builds only, armed by `pitplanner://dev/db?fail=1`, used up by the next start) shows the error screen: the sentence and Export my data, details only after Show details, Export my data opens the share sheet (window focus only; never dumped or photographed, it lists other apps). The start after is normal with the same version and data. Images: `out/migration-error.png`. |
| `stable-controls` | For each step in `targets.tsv`: tapping the control moves neither it, its row nor anything above it (T-017 PR-3). A target starts as opened (`top`) or scrolled to the end (`bottom`: content shrinking below a control makes the view clamp and jump). `expect moves` marks a detector self-test (the spike must report a move). |

## Safety

The phone is Jason's own. With `--phone`, `run.sh` wakes it and stops if it is locked; backs up the dev build's data
(`db.sh backup`, `out/data-<time>.tar`, the two newest kept) and restores it on exit; turns heads-up banners off and keeps the
screen on while plugged in; restores font scale and settings on exit. It never touches the release app.
A dump of any window that is not the app (the notification shade, another app) is refused: the shade is
collapsed, the step fails and nothing is written. Maestro's own output includes the phone's whole logcat
(other apps' logs, which can hold their tokens), so each Maestro call writes it to a temp dir that is deleted
right after; it never lands in `out/` or `~/.maestro/tests`. The device log is cleared (`adb logcat -c`)
before and after every run and saved only when a test fails: the app's own lines (by its uid), redacted for
token patterns (`redact.mjs`), to `out/logcat-failed.txt`.

## Pieces

| File | Role |
|---|---|
| `run.sh` | The pass: options, safety, build, Metro, tests, summary. |
| `lib.sh` | adb wrapper, cold launch through the dev-client link, `dump`, `tap`, `scroll_to`, status bar and keyboard edges. |
| `db.sh` | `backup [file]` / `restore <file>` of the app's data dirs over `run-as`. |
| `avd.sh` | Create, start (headless) and stop the test emulator. |
| `redact.mjs` | Token redaction for the failure log (tested in `redact.test.mjs`). |
| `check.mjs`, `ui.mjs` | Checks over dumps (`find`, `stable`, `keyboard`); pure logic tested in `ui.test.mjs` (`npm run test:gate`). |
| `targets.tsv` | `stable-controls` steps: target, route, start, expect, label, times (tab separated). |
| `crop.py`, `compose.py` | Crop the status bar; put screenshots side by side. |

Notes: Metro is started when it is not running. `launch` closes the dev menu's first-launch intro, and both
`launch` and every screenshot wait for the dev build's "Refreshing..." banner to clear. A cold start with a plain deep link opens the dev launcher, so
`launch` loads the bundle through `pitplanner://expo-development-client/?url=...` and then opens the route.
Maestro reads stdin, so it always gets `/dev/null`. Use bash, not zsh one-liners (zsh does not word-split).
Alarm device tests: `docs/alarm-testing.md` (re-run on the Expo build in T-016).
