# Installing Pit Planner

Pit Planner is an Android app. It is not in the Play Store. You download one file from GitHub and open it.
It takes about five minutes.

The wording of Android's own questions differs a little from phone to phone. The steps are the same.

## Install

1. On your phone, open this page in your browser:
   https://github.com/MechEng70/pitplanner/releases/latest
2. Under "Assets", tap the file that ends in `.apk` (for example `pitplanner-0.3.0.apk`). If the browser
   warns that the file might be harmful, choose to download it anyway.
3. When the download is done, tap "Open" (or tap the file in your notifications or your Downloads).
4. The first time, Android says your browser is not allowed to install apps. Tap "Settings", turn on
   "Allow from this source", then go back.
5. Tap "Install", then "Open".

You only do step 4 once.

## First run

Setup has three short steps:

1. **Welcome to Pit Planner:** pick Fahrenheit or Celsius, and pounds or kilograms. Tap Continue.
2. **What do you cook on?** Pick your smoker model, and turn on Griddle or Oven for holding if you have
   them. You need a smoker or a griddle to continue. You can change all of this later in Gear.
3. **Make sure alerts get through:** see below. Then tap Finish setup.

## Allow the alerts

Pit Planner rings at each step of a cook: fire the smoker, wrap, pull. Some of those come at 6 AM with the
phone asleep. Android only lets that happen if you allow it.

On the last Setup step, tap Allow on each row until it shows as on:

- **Notifications:** shows each step on your lock screen.
- **Alarms and reminders:** rings at the exact time, not "around then".
- **No battery limits:** keeps overnight alerts from being delayed. Allow opens Pit Planner's App info.
  From there tap App battery usage, then the words Allow background usage (not the switch), then
  Unrestricted. Then go back to Pit Planner. Your phone may name these a little differently.

Some phones show a fourth row, **Full-screen alerts**, which wakes the screen for overnight steps. Allow
that too.

Then tap "Send a test alert in 10 sec" and lock the phone. It should ring.

You can finish Setup without these, and the app asks again when you start a cook. To see them later, open
Gear and tap Alerts.

If alerts come late or not at all, check the battery settings for Pit Planner in your phone's settings.

## Updating from an older version

Install the new version the same way, over the old one. Do not uninstall first. Your smokers, cook rates,
plan and history are kept.

When a newer version is out, Gear shows an "Update available" row. Tap it to download, then open the file
to install.

If you were sent a test version (a beta), Gear also offers newer test versions and the finished release
when they come out.

### "Pit Planner has a new look"

Version 0.3.0 was rebuilt from the ground up. The first time you open it after updating from 0.2.0, it
moves your old data across and shows this notice once, with one of three lines:

- **"Your smokers, cook rates, plan and history came over."** Everything moved. Nothing to do.
- **"Some of your old settings couldn't be read. Check Gear before your next cook."** Most things moved.
  Open Gear and check that your smoker and other cookers look right.
- **"Your old data couldn't be brought over. Set up your smoker in Gear to start."** The old data could not
  be read. Set up your smoker again in Gear.

If your oven's holding temperature in 0.2.0 was set below 140F, the notice has one more line: **"Oven hold
raised to 140F, the safe minimum."** Nothing to do. (In Celsius it reads 60C.)

Tap OK to close it.

## If something goes wrong

**The file will not open, or there is no Install button.** Open your Files or Downloads app and tap the
`.apk` file there. If Android asks, allow that app to install from this source.

**"Install blocked" or a Play Protect warning.** The app does not come from the Play Store, so Android may
ask if you are sure. Choose "More details", then "Install anyway".

**"App not installed" when updating.** Try these in order:

1. Download the file again from the page above. The download may have been cut short.
2. Free up some storage and try again.
3. Check that the file is newer than the version you have. The version is at the bottom of Gear. Android
   will not install an older version over a newer one.

If it still will not install, do not uninstall the app: that erases your smokers, cook rates and history.
Email pitplanapp@gmail.com with the version you have and what the phone said.
