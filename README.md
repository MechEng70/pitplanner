# Pit Planner

Pit Planner plans a cook backward from the time you want to eat, and rings a real alarm at each step. It learns
how fast your own smoker cooks and uses those rates in the next plan.

## Screenshots

<!-- SCREENSHOT: readme-plan | Plan with the Saturday menu, 115% font -->

Plan: the menu, the serve time and the steps worked out backward from it.

<!-- SCREENSHOT: readme-live-cook | Live cook with the Saturday menu running, 115% font -->

Live cook: what is next, how long until it, and the lanes for each food.

<!-- SCREENSHOT: readme-lock-screen-alert | Lock-screen alert for a cook step, status bar cropped -->

The alert on the lock screen. It rings even when the app is closed.

<!-- SCREENSHOT: readme-cook-finished | Cook finished with the rate card, 115% font -->

Cook finished: the new rate is offered, and you choose whether to use it.

## Install

Android only for now. Steps are in [docs/INSTALL.md](docs/INSTALL.md), and the file is on the
[Releases page](https://github.com/MechEng70/pitplanner/releases).

Good to know: if the phone restarts during a cook, unlock it once. The app puts its alarms back by itself, but
on some phones (seen on a OnePlus) no alert sounds until the first unlock after a restart. More in the
[user guide](docs/USER-GUIDE.md), section 10.

## What's in 0.3.0

- A rebuilt app on the same three tabs, with text that follows your font size
- Your 0.2.0 smokers, rates, plan, history and a running cook come across
- Open a plan someone shared with you, and see what changes if you don't have one of their cookers
- Export my data and Restore from a file, in Gear
- Whole turkey, and tri-tip smoked then seared on the smoker when you have no griddle
- Undo for a step you marked Done by mistake
- Warnings during a cook when the smoker is asked for two temps at once or food will hold too long
- When serve moves for one food, the others move with it
- Done and +15 min right on the lock-screen alert, and alarms that come back after the phone restarts
- The app checks GitHub for a newer version

The full notes are in [docs/release-notes/0.3.0.md](docs/release-notes/0.3.0.md).

## Coming next

Planned, not promised.

- 0.3.x: bug fixes.
- 0.4.0: Home Assistant probe temps, read-only.
- 0.5.0: fish, Chef iQ probes over Bluetooth, and a choice of cooker for shared plans.
- iOS: later.

## Food safety

The app suggests times. A thermometer decides when food is done, so check the temperature before you serve it.
Safe temperatures come from the USDA FSIS
[Safe Minimum Internal Temperature Chart](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart).

## Privacy

There is no account and no server. Your cookers, plans, cook rates and history stay on your phone. The app asks
GitHub for the latest release to see if an update is out. A plan or your data leaves the phone only when you send
a file yourself. If Android backup is on, your Pit Planner data can come back when you set up a new phone.

Building it yourself: see [docs/DEVELOPING.md](docs/DEVELOPING.md).
