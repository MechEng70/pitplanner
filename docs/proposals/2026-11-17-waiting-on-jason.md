# Waiting on Jason, 2026-11-17

Every open question and every look owed, found by reading parity.md, TASKS.md, HANDOFF.md, SPEC.md, BACKLOG.md,
the t037 checklist and the proposals. Nothing here is new: each line names its source. Decided today and left
out: where "Tri-tip will be seared on the griddle." shows (same box style, sentence alone, no heading); T-057
held until after 0.3.0; nothing merges to main after 0.3.0-beta.1 is built until Sunday's readout, except
test-blocking fixes with his yes. Also decided today: review finding 6's sentence is approved as built;
finding 7's oven raise on load is silent, with a notice at import only; the Kotlin test floor is 117.

**Answered by Jason, 2026-11-17.** Each item below keeps its question and has an "Answer (2026-11-17)" line.

Still open:

- The app icon (A close / B he will check it).
- Two facts for T-060: what the smoker went back up to 250F for at the end of the 2026-11-14 cook, and which
  Pit Boss probe pairs with which Chef iQ probe.
- The stacked looks: one review after the re-shoots (see "Needs your eyes").
- The Samsung tester's reply (the request to send is under the locked-reboot item).
- Phone yeses, on the day, action by action.

Order of the days (second answer, 2026-11-17): Saturday 2026-11-21 the staged cook; Sunday 2026-11-22 the
readout, then in the afternoon T-033 and T-031 on his wife's phone; Monday 2026-11-23 the 0.3.0 release.

## Blocks 0.3.0

- [source: t037-checklist.md, CLAUDE.md, TASKS T-037] A yes for every phone action, on the day: Friday the
  beta.1 install over 0.2.0 (he screenshots 0.2.0 first), Saturday the staged cook and the 12:05 PM reboot.
  The checklist lists every action; he answers each (memory rule: reboots need him present).
  Answer (2026-11-17): unchanged. A standing rule, not a question: yes is given on the day, action by action.
- [source: TASKS T-038, docs/RELEASING.md] His yes to push, tag and publish v0.3.0 on GitHub Releases, and to be
  walked through the first release step by step. Options: A on the day the readout passes / B later.
  Answer (2026-11-17): first A, release on the day the readout passes; replaced the same day by a second
  answer: the release WAITS. Sunday 2026-11-22 the readout passes; Sunday afternoon T-033 and T-031;
  Monday 2026-11-23 the 0.3.0 release. T-038 keeps depending on T-033.
- [source: TASKS T-031, SPEC section 13] The real two-phone share test (Gmail and Drive) is still open. It is
  in SPEC's definition of done. Options: A run it with a second phone before 0.3.0 / B accept the single-phone
  stand-in of 2026-11-16 (a plan emailed to himself opened on the dev build) and write that down.
  Answer (2026-11-17): the real test is done, together with T-033 below, after Sunday's readout. The steps
  are one checklist, `docs/after-readout-checklist.md`. T-031 stays open until it is ticked.
- [source: TASKS T-033] Follow INSTALL.md once on his wife's phone. Options: A before 0.3.0 / B after beta.1
  only. T-033 is not done until he has.
  Answer (2026-11-17): after Sunday's readout, together with T-031: INSTALL.md with 0.3.0-beta.1 on his wife's
  phone, an upgrade over her 0.2.0, with his yes. Same checklist, `docs/after-readout-checklist.md`.
- [source: parity.md P4, TASKS T-072] The locked-reboot check once on the tester's Samsung, at T-037, after the
  T-072 fix. Options: A on the tester's phone during the staged cook week / B skip for 0.3.0 and say so in
  the release notes. Only one tester has a Samsung.
  Answer (2026-11-17): he will ask that tester. If the tester declines: B, with a line in the release notes
  (drafted in `docs/release-notes/0.3.0.md`, "Check before release", marked "if declined"). Draft request:

  ```text
  Hi! I have a test version of Pit Planner (0.3.0-beta.1), my BBQ timing app for Android. It rings an alert
  at each step of a cook, even with the phone locked.
  I would like to know if it still rings after a restart on a Samsung. Could you try one thing?
  Start a cook with a step due in about 20 minutes. Restart the phone and leave it locked. Do not open the
  app. See if the alert for that step rings on time.
  Please send back: yes or no, the phone model and Android version, and what time it rang (or did not).
  Thank you.
  ```

## Needs your eyes on a device or picture

- [source: TASKS T-081, HANDOFF section 1 item 1] Look: `docs/fidelity/rn-12-live-warned.png` and
  `rn-12-live-conflict.png` (re-shot at 115% from the emulator) against mockup 12 in `docs/mockups`. Judge the
  header, now about 20 dp taller with the subtitle on its own line, and the line break between the conflict
  and the long-hold sentence. Also Cook finished's header against mockup 15.
  Answer (2026-11-17): looks are stacked into ONE review after the re-shoots. This item and every look below
  belong to that group. `rn-12-live-warned.png` and `rn-12-live-conflict.png` were re-shot today (2026-11-17)
  and the device test `live-warnings` passes at 115%.
- [source: TASKS T-073] Look: `docs/fidelity/rn-11-open-shared-plan-note.png` against mockup 11. Judge the
  line under "Serve on" ("That's less than an hour away. Set for Mon, Nov 23. Pick a date to keep today.").
  His look is marked open.
  Answer (2026-11-17): part of the one stacked review after the re-shoots.
- [source: HANDOFF section 3, parity.md 1c, TASKS T-023] Look: the two-button lock-screen alert (Done and
  +15 min, no Open) on the phone against mockup 14. Mockup 14 has no fidelity sheet. Also the Serve alert
  reading "Time to serve" there (T-074 is merged and not seen on a device).
  Answer (2026-11-17): part of the one stacked review after the re-shoots.
- [source: TASKS T-075, HANDOFF section 1 item 7] Look: Food details for tri-tip with no griddle at 115%
  (three method chips, the griddle sear greyed with "Add in Gear"), the import box, the Cook tab lane with the
  dashed hold for the climb, and Conflicts with a 425F smoker in Celsius.
  Answer (2026-11-17): part of the one stacked review after the re-shoots.
- [source: TASKS T-036, HANDOFF section 1 item 7] Look: Gear's two new rows (Export my data, Restore from a
  file), the confirm sheet and one refusal, against mockup 16 in `docs/mockups`. Merged, not seen on a device.
  Answer (2026-11-17): part of the one stacked review after the re-shoots.
- [source: TASKS T-076, HANDOFF section 1 item 7] Look: +15 on a two-food cook until serve moves, and the Live
  cook notice "Serve moved to {time}. The other foods moved with it." Merged, not seen on a device.
  Answer (2026-11-17): part of the one stacked review after the re-shoots.
- [source: HANDOFF section 3, TASKS T-036] Mockup 16 on the live canvas artifact has no Export or Restore rows
  (only the repo source and PNG do). Options: A update the canvas / B leave the repo copy as the source.
  Answer (2026-11-17): B, the repo copy is the source. Closed.

## Wording

- [source: TASKS T-036, "Choices made in the build (not decided by Jason)"] Four strings he has not approved:
  refusals and the "Restored ..." line show in a notice sheet titled "Restore from a file" with OK; the date in
  the confirm text reads "Nov 16" with no year; a file with no cook rates and no cooks says so in the list; one
  new line, "The restore did not work. Nothing was changed.", shown if the database write fails.
  Options: A as built / B change any of them (built today: A).
  Answer (2026-11-17): A, as built. Closed. Recorded in T-036.

## Later versions

- [source: BACKLOG.md, top] The whole backlog is waiting for his triage. Nothing in it is scheduled until he
  does. Options: A triage item by item at a quiet moment / B leave until after 0.3.0.
  Answer (2026-11-17): B, after 0.3.0. This item and every item in this "Later versions" group wait until
  0.3.0 has shipped.
- [source: TASKS T-060, SPEC section 11] Low and slow for tough cuts, after 0.3.0. Which of four candidates:
  (1) thickness input, (2) a recommended smoker temp with a warning, (3) a temp change mid-cook re-times,
  (4) re-time from probes. None decided. Also which sources he trusts for any number.
- [source: TASKS T-060] Confirm what the smoker went back up to 250F for at the end of the 2026-11-14 cook
  (taken to be the smaller brisket; "to confirm"), and which Pit Boss probe pairs with which Chef iQ probe (the
  chart images are deleted, so only he can say).
  Answer (2026-11-17): still OPEN. He will answer both facts separately.
- [source: TASKS T-071] Fish (0.5.0): propose a thickness input to him before building. Also the recipe
  sources he will keep for salmon, catfish and sea bass times (no primary source exists).
- [source: TASKS T-041] Oven warming drawer. Options: A offer it as a hold place at or above 140F / B remove
  the stored field.
- [source: TASKS T-040] Lane chart full screen in landscape. Look: the mockup (not made yet) before any code.
- [source: TASKS T-062] A name of his own for a food. Look: the mockup of the name field (not made yet).
- [source: BACKLOG.md] Go back on the full timeline to set what was missed. Look: a mockup (not made yet).
- [source: BACKLOG.md, TASKS T-024] More than one smoker or griddle. Look: a mockup (not made yet).
- [source: TASKS T-070] The receiver picks their cookers (0.5.0). The design needs his OK first. The earlier
  proposal's questions (a row per food, nothing for foods with no choice, keep the read-only smoker field) went
  with the drop.
- [source: TASKS T-080, T-042] Look: the Bluetooth scan row in Setup alerts (T-080, 0.5.0) and the six Home
  Assistant screens (T-042, 0.4.0). Both need an approved mockup before any code.
- [source: TASKS T-078] Headless JS for lock-screen taps (0.3.x): after the half-day spike, the report goes to
  him before anything is built. Also whether the app should still jump to the Cook tab after a lock-screen tap.
- [source: TASKS T-022 note, BACKLOG.md] Running behind with Keep serve: name every food that would come off
  after serve and select Move serve then. He said "maybe a future update". Options: A schedule it / B drop it.
- [source: SPEC section 12, data/cookers.json] Sources for the smoker specs still marked `verified: false`
  (sixteen picker entries) and the Pit Boss 820's 5F temp step ("not confirmed"). Left blank until he gives a
  source (CLAUDE.md). Not needed for 0.3.0.
  Answer (2026-11-17): his smoker is the Pit Boss Sportsman 850 (PB850SPW2), 180 to 500F in 5F steps, source
  the pitboss-grills.com product page. The check of `data/cookers.json` and SPEC against it is with the main
  session, not this page. Second answer (2026-11-17), the Pit Boss 820: decided A for 0.3.0. The 820 entry
  becomes not verified and its step is blanked (the user fills in a step or presets). The Saturday test
  fixture moves to the `pitboss-sportsman-850` catalog entry, the one his Gear uses. The engine tests' private
  copies and the mockups stay; the blank "Pit Boss 850" entry stays. His grill may be an 820 body with a
  replacement control board that reports PB850SPW2 and sets 180 to 500F in 5F steps; the body stays
  unconfirmed until he reads the data plate. That does not block beta.1: the 820 and Sportsman 850 entries
  carry the same size and hopper numbers. An Opus agent is building it. Dial smokers with fixed presets is
  now in the backlog (after 0.3.0).

## Probably closed, confirm

- [source: parity.md section 5, HANDOFF section 3 of the older restart, TASKS T-034] D2, D9, D10 and D11 are
  listed as open in parity.md section 5 and an old HANDOFF line, but the 1a table records his answers of
  2026-11-16 (keep "Show 180-500F"; banner shows long holds; hold note says keep above 140F; accept the
  imported temp as built). Confirm and fix the stale lines.
  Answer (2026-11-17): A, confirmed as recorded in the 1a table. The stale lines in `docs/parity.md` are fixed.
- [source: TASKS T-022, HANDOFF older table] The -15/+15 control: "keep it for now", then asked again whether he
  means the built stepper or mockup 13's two buttons. No answer is written. He approved Earlier / Later on the
  built stepper in T-074. Options: A keep the stepper (built today) / B mockup 13's two buttons.
  Answer (2026-11-17): A, the built stepper is kept. Closed.
- [source: TASKS T-064] Ending a cook goes back to Plan and erases the cook. It was taken to mean the menu stays
  on Plan too; "ask if he meant the menu too". SPEC says only "goes back to Plan". Options: A menu stays (built
  today) / B menu cleared.
  Answer (2026-11-17): A, ending a cook leaves the menu on Plan, as built. Closed.
- [source: TASKS T-081 vs HANDOFF section 3] T-081 says "Open with Jason: wings have no sources entry". HANDOFF
  says the FSIS chart is now cited for wings and he confirmed the page. Confirm it is closed.
  Answer (2026-11-17): closed. The FSIS chart is cited and he confirmed the page.
- [source: docs/release-notes/0.3.0.md "Check before release" vs TASKS T-023] The notes draft says the Cook
  finished rate card (Use 0.74 / Keep 0.75) is wording he has not seen. T-023 says he approved it on
  2026-11-15. Confirm, then fix the draft.
  Answer (2026-11-17): confirmed, approved 2026-11-15. The notes draft is fixed.
- [source: SPEC section 12] "Confirm the GitHub repo name" (assumed MechEng70/pitplanner) and "App icon". The
  repo name is used throughout RELEASING.md and origin has been pushed. Icon files are set in app.config.ts. No
  written approval of either found. Options: A close both / B he still wants to check the icon.
  Answer (2026-11-17): the repo name is closed (MechEng70/pitplanner). The app icon is NOT answered yet: he left
  the choice blank. Still open, the one remaining item of this line: A close / B he will check it.
- [source: TASKS T-075] "Confirm the Plan warning sentence": later text says "the warning, final". The case
  with a griddle ("Tri-tip will be seared on the griddle.") was decided today. Both closed unless he says
  otherwise.
  Answer (2026-11-17): closed.

## Items of 2026-11-16-open-decisions.md now closed

- T-069 banner (item 1): answered 2026-11-16, A1 + B1 then his own wording, built and reviewed.
- T-070 receiver picks cookers (item 2): dropped from 0.3.0 to 0.5.0; parity D1 closed.
- Serve alert "Serve Serve." (item 3) and turkey stepper "More quantity" (item 4): answered, built as T-074 and
  approved as built.
- Its open-question lists for T-069 and T-070 are covered by those answers.
