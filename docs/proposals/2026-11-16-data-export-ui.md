# Data export and restore: where it goes on screen (T-036)

For Jason to decide. Nothing on screen is built. The logic under it is built and unit-tested on the T-036
branch: `src/lib/dataFile.ts` (build the file, check a file), `src/db/restore.ts` (write it),
`store.restoreData` in `src/lib/store.tsx`. Line numbers are from the tree on 2026-11-16 (main `ed4d84d`).

## What exists today

- No mockup shows Export or Import. Mockup 16 (Gear) has Cookers, Your numbers (Cook rates), App (Alerts,
  Home Assistant, Buy me a bag of pellets) and the version. Mockup 20 (Cook history) has none either.
- SPEC has no Export or Import control. SPEC.md:72 lists what Gear holds; nothing about data files. The T-036
  entry in TASKS says "SPEC: history exportable", but that line is not in SPEC; it is in the 0.2.0 code
  (`legacy/src/lib/history.ts:1`, "Exportable, survives app updates"). 0.2.0 had no export button either.
- Gear today (`src/screens/gear/GearScreen.tsx`): headings "Cookers" (:97), "Your numbers" (:155) with the
  one row "Cook rates" (:163), "App" (:172) with "Update available" (:181, only when there is one), "Alerts"
  (:193), "Units" (:204), "Home Assistant" / "Coming later" (:215-216), "Buy me a bag of pellets" / "If the
  app saved your brisket" (:224-226), then the version line (:233).
- The migration error screen (`src/screens/shared/MigrationError.tsx`) already has a button
  "Export my data" (:51). Its title is "Pit Planner couldn't update" (:16), its text "Your data is safe. Tap
  Export my data and send the file to Jason." (:17), and a failed share shows "The export did not work. Try
  again." (:49). It calls `exportData` in `app/_layout.tsx:40-48`, which shares the raw table dump
  (`src/db/export.ts`, every row of every table) as `pitplanner-export-<UTC date>-<time>.json` through
  `shareTextFile` (`src/platform/shareFile.ts:18`), share sheet title "Export my data".
- The restore reader takes that dump too, so a file sent from the error screen can be restored on a new
  install.
- Opening a file from another app: the `.pitplan` intent filters (`plugins/pitplanIntents.ts:26`) accept any
  `application/json` file. A data file opened with Pit Planner today reaches the Open shared plan flow, which
  gets "This file is not a Pit Planner plan." (`src/lib/sharedPlan.ts:64`, read only, not run on a device). The native read is capped at
  256 KB (`modules/pit-share/.../OpenedPlan.kt:19`).
- There is no file picker in the app (`expo-document-picker` is not a dependency).

## The file

- Name: `pitplanner-data-2026-11-16-0905.json` (UTC, like the error screen's file). Type `application/json`.
- Holds: cookers, units, saved rates, total hours, rate locks, every saved cook with its foods and notes,
  and the two one-time hints. Not: the running cook, the plan, the event log, the update check, the 0.2.0
  import marker, unreadable (quarantined) values.
- Size: about 0.8 KB per cook with three foods. 256 KB holds about 320 such cooks; the reader's own cap is
  2 MB and 1000 cooks (the newest are kept).

## Option 1: two rows under Your numbers (recommended)

Under "Cook rates" in the "Your numbers" card:

- Row "Export my data", subtitle "Cookers, rates and past cooks in one file". Opens the share sheet (Drive,
  Gmail, Files). A share that fails: "Couldn't export" / "Your data was not shared. Try again." (the same
  pattern as "Couldn't share" on Plan, `src/screens/plan/PlanTab.tsx:56`).
- Row "Restore from a file", subtitle "Replaces the cookers, rates and cooks on this phone". Opens the
  phone's file picker (adds `expo-document-picker`, so a new dev build). After the file is checked, a sheet:
  - title "Replace your data?"
  - text "This file has 2 cookers, 3 cook rates and 30 cooks, from Nov 16. They replace what is on this
    phone. Your plan stays."
  - when something was left out, one more line: "4 parts of the file could not be read and are left out."
  - buttons "Replace" and "Cancel".
  - after: "Restored 2 cookers, 3 cook rates and 30 cooks."
- Messages when the file is refused (the reader returns one reason each):
  - cook running: "End the cook first, then restore."
  - not a data file: "This is not a Pit Planner data file."
  - newer: "This file is from a newer Pit Planner. Update the app to restore it."
  - damaged: "This file is damaged."
  - too big: "This file is too big to restore."
  - nothing in it: "There is nothing to restore in this file."

## Option 2: one row in App, a sheet with both

In the "App" card, above "Home Assistant": one row "Your data", subtitle "Export or restore". It opens a
sheet with a line of text ("A copy of your cookers, rates and past cooks. Keep it in Drive or send it to a new
phone."), the button "Export my data", and the text button "Restore from a file". Restore then works as in
option 1. Restore could also start by opening the file from Files or Gmail ("Open with Pit Planner"): no
file picker and no new dependency, but the opened-file flow (Open shared plan, `SharedPlanSheet.tsx`) has to
tell a data file from a plan, and the 256 KB native cap applies.

## What a restore does to the data on the phone

Built as replace, after the user says yes: the file's cookers, rates and cooks take the place of the
phone's, all in one write (any failure undoes all of it). The plan, a running cook (restore is refused while
one runs) and the app's own records stay. A file with no cookers keeps the phone's cookers. Hints seen on
either phone stay seen. Merge (keep the phone's cooks and add the file's) is not built.

## Recommendation

Option 1: "Export my data" and "Restore from a file" as two rows under Cook rates, the file picker for
restore, replace with the confirm sheet above. Same words as the error screen's button, so a user who was
told to tap Export my data finds the same thing on Gear.

## Questions for Jason

1. Where: option 1 (two rows in Your numbers) or option 2 (one "Your data" row in App with a sheet)?
2. How a restore starts: the file picker (new dependency, new dev build), opening the file from another app,
   or both?
3. Replace (built) or merge, or ask each time?
4. Should Setup's first screen offer "Restore from a file" for a new phone? Today a restore needs Setup done
   first (it is reached from Gear).
5. Gear's Export: the new file (`pitplanner-data`, built) or the same full dump the error screen shares?
6. File name and type: `pitplanner-data-<date>-<time>.json` as built, or its own extension (for example
   `.pitdata`) so it does not look like a plan to the `.pitplan` filter?
7. A history food the app does not know (from a newer app) is left out on restore and listed. Keep it
   instead? The app already shows unknown foods in history without crashing.
8. The wording above: the rows, the confirm sheet and the refusals.
