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

## What's in 0.3.0

- A new look. The same three tabs (Plan, Cook, Gear), with every screen rebuilt. Text follows your phone's font
  size, and times and temperatures are never cut off.
- Your data comes over from 0.2.0 the first time you open it: smokers and other cookers, cook rates, the plan
  you were working on, and cook history.
- Two of the same food are told apart, as "11.5 lb brisket" and "6 lb brisket".
- Only Start cook on Plan starts a cook, so a running cook is never replaced by accident.
- Next up reads as one sentence with the time left, for example "Check the brisket in 1 hr 12 min".
- Quiet alerts for 30 min also holds back the repeat alerts.
- A cook in progress survives a font size change and the phone closing the app in the background.
- "Send a test alert in 10 sec" in Gear lets you check alerts any time.
- Cook history: a past cook can be edited or removed, and left out of your cook rates.
- Smoker temps can be set in steps of your own, with "Not listed? Enter it yourself".

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
a file yourself. Android's own backup can include the app's database, so your history may follow you to a new
phone.
