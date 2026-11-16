# Open decisions, 2026-11-16

Four items that need Jason's answer before any code is written. Nothing here is built. File and line
references are to the working tree on 2026-11-16 (HEAD `25d8fd0`). Another agent is working on T-073 in
`SharedPlanSheet.tsx`, so line numbers in that file may move.

Hours are estimates, not measurements, and leave out the gate run (`npm run check`) and device time.

| # | Item | What Jason decides | Recommendation |
|---|---|---|---|
| 1 | T-069, banner on Live cook | The wording for a new smoker conflict and for a hold past its limit, the button, and whether it rings | One amber banner with the same sentence Plan uses, an `OK` button, no ring |
| 2 | T-070, the receiver picks cookers | Where the choice sits on Open shared plan and what it looks like | A "Cook on" chip row per food that has a choice, under "Serve on"; other foods get no control |
| 3 | Serve alert reads "Serve Serve." | The alert's title and text | Title `Time to serve`, text is the menu |
| 4 | "More quantity" on the turkey weight stepper | The spoken labels for the quantity stepper | `More weight` / `Less weight`, and the unit for count foods (`More breasts`) |

---

## 1. T-069: a banner on Live cook

### Today

- Live cook reads no warnings. A search for `warnings` in `src/screens/cook/`, `src/lib/cook.ts` and
  `src/lib/cookView.ts` finds nothing. The data is there: every live change ends in `derive`
  (`engine/live.ts:52`, `:82`, `:109`, `:125`, `:158`), which rebuilds `plan.warnings`, so
  `cook.plan.warnings` is current after each change.
- A warning is `{ code, level: 'info' | 'warn', message, itemIds? }` (`engine/types.ts:152-157`).
- `PIT_CONFLICT` (`engine/plan.ts:433-438`): level `warn`, `itemIds` holds the two foods, one warning per
  pair of foods. Message template:
  `${a} needs ${tempA}F while ${b} needs ${tempB}F at the same time.`
  With brisket at 225F and wings in their 400F crisp this gives
  `Brisket needs 225F while Chicken wings needs 400F at the same time.` (example values are mine; the
  grammar, "wings needs", is what the template produces). The message does not say when the overlap is.
- `HOLD_TOO_LONG` (`engine/plan.ts:445-451`): `itemIds` holds the one food. Level is `warn` for a food
  marked `holdsPoorly` (only chicken breasts, `data/foods.json:171`) and `info` for the rest. Message
  template: `${name} holds ${min} min, past its ${limit} min limit.` then, for chicken breasts only,
  ` Move it to the griddle or start it later.`, then the food's `holdNote` if it has one. Brisket and pork
  butt have `"holdNote": "Keep it above 140F."` (`data/foods.json:39`, `:161`). Examples from the template:
  - `Brisket holds 300 min, past its 240 min limit. Keep it above 140F.`
  - `Chicken breasts holds 45 min, past its 20 min limit. Move it to the griddle or start it later.`
- With two of the same food the name is the label ("11.5 lb brisket", `engine/plan.ts:359`).
- Plan shows the same warnings in two places. The Conflicts tile counts `warn` level only and reads the
  count or `None` (`src/screens/plan/PlanScreen.tsx:167`, `:311-316`). Its sheet, titled `Conflicts`
  (`src/screens/plan/IssuesSheet.tsx:27`), lists every warning, `warn` first, with the engine message run
  through `tx()` for units (`:60`), and fix buttons: `Move {name} to the griddle`, `Change smoker temp`,
  `Edit {name}` (`:83-97`). With no warnings it says `Nothing to fix. The plan fits your cookers.` (`:54`).
- Live cook already has four banners, all built with the kit `Banner`
  (`src/components/kit/surfaces.tsx:204-220`: full width, tone `error` (red, the default) or `warn`
  (amber), one optional action button, the text announced by the screen reader as an alert, the text wraps):

  | Banner (`src/screens/cook/CookScreen.tsx`) | Tone | Text | Button |
  |---|---|---|---|
  | Alerts off (`:207-216`) | error | `Alerts are off. Steps may not ring.` (`:58`) | `Fix`, opens the Alerts sheet |
  | Alarms refused (`:220-230`) | warn | `Alarms could not be set. Steps will not ring.` (`:59`) | `Try again` |
  | Pit out (`:232-242`) | warn | `Pit out since {time}. Steps are on hold.` | `Back up to temp` |
  | Notice (`:244-254`) | warn | `cook.notice`, for example `{step}: done at {time} from the alert.` (`src/lib/cook.ts:238-241`) | `OK`, clears it |

- The lane chart already marks where foods share the smoker and puts a note under it
  (`overlapNote`, `src/lib/cookView.ts:168-190`): `3:15 to 3:40 PM: brisket and wings share the smoker at 225F.`
  It shows for any overlap, conflict or not, and names the lower of the temps.
- Plan's three fixes do not exist during a cook. I found no way on the Cook tab to move a food to the
  griddle, change the smoker temp or edit a food; SPEC section 11 says the plan has one smoker temp for the
  whole cook. What Live cook has is Cook options (the `Adjust` button and the three-dot button): Running
  behind or ahead, Quiet alerts, Pit went out, Start over, End cook.

### Proposal

One amber banner (`tone="warn"`), placed after the Notice banner and above the Next up card, built like the
Notice banner: text plus an `OK` button.

- **When it shows.** After a change, when `cook.plan.warnings` has a `PIT_CONFLICT` or `HOLD_TOO_LONG` that
  the plan as started (`cook.original.warnings`) did not have, matched by code and foods. A conflict or long
  hold that was already on the plan at Start cook was shown on Plan's Conflicts tile and does not come back
  as a banner.
- **Text.** The engine's sentence, in the user's units, so Plan and Live cook say the same thing. For the
  hold case the sentence `Move it to the griddle or start it later.` is left off on Live cook (neither can
  be done mid-cook), and the hold note from `data/foods.json` stays.
- **Button.** `OK` hides it. It stays hidden for that warning; a different warning later shows again.
- **Both at once, or several foods.** One banner, the sentences one after another, conflicts first, then
  holds. One `OK` for all. This is how the Notice banner already joins its sentences
  (`src/lib/cook.ts:244`).
- **When it goes away by itself.** When a later change removes the warning (the next `derive` no longer
  has it), when the conflict's overlap is in the past, when the step is taken back with Undo, and when the
  cook ends.
- **Sound.** None. The change that makes it is almost always a tap the user just made in the app, with the
  screen in front of them. The banner is announced by the screen reader like the others.
- **Nothing re-times.** The banner only reports. This keeps the task's acceptance line.

Exact strings, case (a), a new smoker conflict:

| Option | Banner text | Notes |
|---|---|---|
| A1 (recommended) | `Brisket needs 225F while Chicken wings needs 400F at the same time.` | The engine message as it is. Same words as Plan's Conflicts sheet. No new wording to keep in step. |
| A2 | `3:15 to 3:40 PM: brisket needs 225F, wings need 400F.` | Says when. Needs new code to find the overlap window (`smokerOverlaps` in `engine/live.ts:188` has most of it). Reads like the lane chart note. |
| A3 | `Smoker conflict: brisket and wings need different temps at the same time.` | Shortest. Leaves the temps out. |

Exact strings, case (b), a hold past its limit:

| Option | Banner text | Notes |
|---|---|---|
| B1 (recommended) | `Brisket holds 5 hr, past its 4 hr limit. Keep it above 140F.` | The engine sentence with the minutes written the way Live cook writes durations elsewhere (`fmtDuration`, as in Keep serve / Move serve), and without the griddle sentence. |
| B2 | `Brisket holds 300 min, past its 240 min limit. Keep it above 140F.` | The engine message as it is. For chicken breasts it would also say `Move it to the griddle or start it later.` |
| B3 | `Long hold: brisket, 5 hr. Keep it above 140F.` | Shortest. Leaves the limit out. |

For foods with no hold note the sentence ends at the limit: `Chicken wings holds 45 min, past its 30 min limit.`

Both at once (A1 + B1):
`Brisket needs 225F while Chicken wings needs 400F at the same time. Brisket holds 5 hr, past its 4 hr limit. Keep it above 140F.`

### Options for the button

1. **`OK`, hides it (recommended).** Same as the Notice banner. No new screen. The `Adjust` button is on the
   Next up card just below.
2. **`Adjust`, opens Cook options.** A real way to act (Running ahead with Move serve shortens a hold), but
   the banner can then only go away by itself, and a long hold would sit there until the cook ends.
3. **`Details`, opens a read-only Conflicts sheet** with the same cards as Plan's sheet and no fix buttons.
   This is a new sheet that is not in the mockups, for text that already fits in the banner.

### Recommendation

A1 and B1, button `OK`, one banner, silent, new warnings only.

### What it would touch

- `src/lib/cookView.ts`: a pure function that returns the banner's sentences from `cook.plan`,
  `cook.original`, the hidden list and `now`. `src/lib/cook.ts`: one new field on `ActiveCook` for the
  warnings hidden with `OK`. I did not check how the running cook is stored in the database; `normalize`
  (`src/lib/cook.ts:56-59`) fills missing fields from defaults, so I expect no migration, but that is an
  inference.
- `src/screens/cook/CookScreen.tsx`: one more `Banner`.
- Tests: an engine test (the live-change tests are in `engine/plan.test.ts`; there is no
  `engine/live.test.ts`) for a live change that makes a new conflict (parity T16 has no test today) and one
  for a hold that grows past its limit; a test for the pure function (`engine/cookview.test.ts` covers
  `cookView.ts` today); RNTL for the banner (shows,
  `OK` hides it, both cases joined, goes away when the warning does, units in Celsius).
- Device: the banner at 115% next to the other banners (the task's device line). I found no device test in
  `tools/device/run.sh` that would need changing.
- Docs: SPEC section 3 (Live cook) and failure modes 3 and 8, `docs/parity.md` D8 and D9, TASKS T-069.
- Estimate: 4 to 6 hours. A2 adds about 1 to 2 hours.

### Open questions for Jason

1. New warnings only, or also ones the plan had at Start cook? I recommend new only.
2. "wings needs 400F": the engine's wording today, on Plan too. Fix it in the engine (both screens change,
   plus tests), or leave it?
3. Done or +15 min tapped on a lock-screen alert can also make a conflict while the app is closed
   (`applyActions`, `src/lib/cook.ts:223-245`). With a silent banner the user sees it only when they next
   open the app. Is that enough, or should that one case ring? I recommend silent for 0.3.0.
4. Is `OK` enough as "a way to the fixes" (the task's goal line), given that Plan's fixes do not exist
   during a cook?
5. The lane chart note says foods "share the smoker at 225F" even when they conflict
   (`src/lib/cookView.ts:179`). Leave it, or reword it for a conflict? Not part of T-069 as written.

Could not determine: how the banner reads at 115% and 130% with two or three sentences (needs the device),
and whether Running ahead with Move serve really shortens a hold once the food is already off the heat (I
did not trace `shiftRemaining` for that case).

---

## 2. T-070: Open shared plan, the receiver picks their cookers

### Today

`src/screens/plan/SharedPlanSheet.tsx`, top to bottom:

1. `Someone shared a {weekday} plan. Times will be worked out for your gear and your cook rates.` (`:55-58`)
2. A card: `Serve at {time}`, then one line per food as the sender set it, for example
   `Brisket, 12 lb, butcher paper`, `Chicken breasts, 4, griddle` (`:59-73`; the method or cooker is in the
   line only for foods with more than one method, `src/lib/sharedPlan.ts:193`).
3. `Serve on`: two chips, the offered day and `Pick a date` (`:75-85`).
4. `Cook the smoker items on`: a read-only field, caption `Your smoker`, value the smoker's name
   (`:87-101`). Shown only when the receiver has a smoker. It has no chevron and does nothing when tapped.
   Under it, when the temp had to change: `Smoker set to {temp}, the closest your smoker allows to {temp}.`
5. One box per missing cooker (`:103-120`).
6. `Replaces the plan you have now.` when the plan has food on it (`:122-126`).
7. Button `Use this plan`.

The mapping (`mapToCookers`, `src/lib/sharedPlan.ts:113-133`): a food stays on the sender's method when the
receiver has that method's cooker. Otherwise it moves to the food's first method on a cooker the receiver
has, with that method's default rest. With no such method it stays as sent and is listed as a gap.

What the receiver sees in each situation:

| Situation | On the sheet |
|---|---|
| Has smoker and griddle | The `Your smoker` field. No box. Nothing says where griddle foods go beyond the sender's menu line. Nothing can be changed. |
| No griddle; shared breasts or wings on the griddle | `No griddle set up.` `Chicken breasts will move to the smoker, or add a griddle in Gear.` Wings move to their first smoker method, "Smoke low, then 400F crisp". |
| No smoker; shared wings on the smoker, or breasts on the smoker | The `Your smoker` field is gone. `No smoker set up.` `Chicken wings will move to the griddle, or add a smoker in Gear.` |
| No smoker; a smoker-only food (brisket) | `No smoker set up.` `Brisket needs a smoker. Add one in Gear.` Use this plan still works; the food stays as sent. |
| A food with one method (brisket, pork butt, turkey) and the receiver has the cooker | Nothing about it beyond its menu line. |
| A food with several methods on the same cooker (ribs, tri-tip) | Nothing. The sender's method is kept. |
| A food with methods on different cookers (breasts, wings) and the receiver has both | Nothing. The sender's cooker is kept. This is the case T-070 is about. |

Two foods in one box are joined with "and" (`names`, `:16`). After Use this plan, if a moved food made a
`warn` level warning, the Conflicts sheet opens on Plan (`src/screens/plan/PlanTab.tsx:212-218`).

Which foods have a choice of cooker (`data/foods.json`, by each method's `cooker`):

| Food | Methods | Choice of cooker |
|---|---|---|
| Chicken breasts | Griddle; Smoker | Yes |
| Chicken wings | Smoke low, then 400F crisp (smoker); Smoker at 350F (smoker); Griddle | Yes |
| Brisket, pork butt, whole turkey | One, smoker | No |
| St. Louis ribs, baby back ribs | Several, all smoker | No |
| Tri-tip | Two, both listed as smoker | No |

So today the choice exists for two foods. Tri-tip's "Smoke, then griddle sear" has a griddle step
(`data/foods.json:60`) but its method is a smoker method, so a receiver with no griddle gets no note about
it on this sheet. I did not check whether the plan itself warns about that.

Mockup 11 shows the same sheet with a chevron on the smoker field and the box
`No griddle set up.` `Breasts will move to the smoker, or add a griddle in Gear.` It has no per-food control.

### Proposal

Reuse the kit `Chips` (`src/components/kit/controls.tsx:59`), the same control Food details uses for
"Cook on" (`src/screens/plan/FoodEdit.tsx:272-284`), with the same chip labels: the cooker's name from
Gear (`cookerName`, `src/lib/rules.ts:47-51`), for example `Pit Boss Sportsman 850` and `Griddle`.

- A food gets a chip row only when it has methods on two or more cookers the receiver has. Today that is
  chicken breasts and chicken wings, and only for a receiver with both a smoker and a griddle.
- The row starts on the cooker the sheet would pick today (the sender's, if the receiver has it).
- Field label: `Cook the {food} on`, lower case food name, matching the existing `Cook the smoker items on`:
  `Cook the chicken breasts on`, `Cook the chicken wings on`. With two of the same food the label uses the
  food's label: `Cook the 4 chicken breasts on`.
- Picking the other cooker uses the food's first method on that cooker with its default rest and options,
  as Food details does (`pickCooker`, `FoodEdit.tsx:243-247`). Picking the sender's cooker again goes back
  to the sender's method and options.
- A food with no alternative shows no control. Its menu line already says how it is cooked.
- The `No griddle set up.` and `No smoker set up.` boxes stay exactly as they are. They only appear when a
  cooker is missing, and in that case there is no choice to offer, so the chips and the boxes never show
  for the same food.
- The sender's menu card does not change when a chip is picked: it stays "what was sent".
- Use this plan hands over the receiver's choices. A food the receiver moved counts as moved, so the
  Conflicts sheet still opens when the move makes a conflict.

### Options

Option A (recommended): a row per food under "Serve on", above the smoker field.

```
Open shared plan                          X
Someone shared a Saturday plan. Times ...

+----------------------------------------+
| SERVE AT 5:00 PM                       |
| Brisket, 12 lb, butcher paper          |
| Chicken wings, 2 lb, smoke then 400F...|
| Chicken breasts, 4, griddle            |
+----------------------------------------+

Serve on
( Sat, Nov 21 )  ( Pick a date )
[room for the T-073 note]

Cook the chicken wings on
( Pit Boss Sportsman 850 )  ( Griddle )

Cook the chicken breasts on
( Pit Boss Sportsman 850 )  ( Griddle )

Cook the smoker items on
[ Your smoker                            ]
[ Pit Boss Sportsman 850                 ]

[            Use this plan               ]
```

Option B: the chips inside the menu card, under each food's line.

```
+----------------------------------------+
| SERVE AT 5:00 PM                       |
| Brisket, 12 lb, butcher paper          |
| Chicken wings, 2 lb, smoke then 400F...|
|   ( Pit Boss Sportsman 850 ) ( Griddle )|
| Chicken breasts, 4, griddle            |
|   ( Pit Boss Sportsman 850 ) ( Griddle )|
+----------------------------------------+

Serve on
( Sat, Nov 21 )  ( Pick a date )
[room for the T-073 note]

Cook the smoker items on
[ Your smoker / Pit Boss Sportsman 850   ]

[            Use this plan               ]
```

- A keeps the card as the sender's menu and puts every choice the receiver makes (date, cookers) in one
  run of fields below it. It adds up to two rows of height.
- B is shorter and keeps the control next to its food, but it turns the card into an editor: the line
  still says "griddle" (as sent) while the chip under it may say the smoker, and the chips sit on the
  orange-tinted card where no other screen puts controls.

### Recommendation

Option A.

### What it would touch

- `src/lib/sharedPlan.ts`: `importPlan` takes the receiver's choices (food id to cooker); a helper lists
  the foods that have a choice. `src/screens/plan/SharedPlanSheet.tsx`: state for the choices and the rows.
- Tests: `SharedPlanSheet.test.tsx` (rows only for foods with a choice, the default, picking, back to the
  sender's method, Use this plan hands over the choice, Conflicts opens for a receiver-made conflict);
  `engine/share.test.ts` for the mapping (the task's test line).
- Device: the sheet against mockup 11 at 115% (the task's device line). The `shared` test in
  `tools/device/run.sh:1686-1720` reads `Someone shared a Saturday plan.`, `Brisket, 12 lb` and taps
  `Use this plan`; none of those change. `tools/device/locked-reboot.sh:170` also taps `Use this plan`.
- Docs: SPEC section 3 (Open shared plan), `docs/parity.md` D1, TASKS T-070.
- T-073 edits the same file (the note under "Serve on"). Build T-070 after T-073 is committed. The `Field`
  kit component already has a `note` slot under its control, so the two do not compete for the same spot.
- Estimate: 5 to 7 hours.

### Open questions for Jason

1. Only two foods have a choice today, and only for a receiver with both cookers. Is a per-food row still
   what you want, or is that too much sheet for two foods?
2. Should a food with no choice show anything (a read-only line)? I recommend nothing.
3. The read-only `Your smoker` field: keep it? Mockup 11 shows it with a chevron, but the app has one
   smoker, so there is nothing to pick.
4. Wings sent on the griddle to a receiver who picks the smoker: they get "Smoke low, then 400F crisp"
   (the first smoker method). The method cannot be changed on this sheet, only afterwards in Food details.
   OK?
5. Tri-tip "Smoke, then griddle sear" for a receiver with no griddle gets no note on this sheet. In scope
   for T-070, or a separate task?

Could not determine: how tall the sheet gets at 115% and 130% with two extra rows and a missing-cooker box,
and whether it then scrolls well (needs the device).

---

## 3. The Serve alert reads "Serve Serve."

### Today

- The app sets alarms from `plan.events` in `syncAlarms` (`src/lib/cook.ts:203`), which calls
  `alarmsFromPlan` (`engine/alarms.ts:59-112`).
- Title (`engine/alarms.ts:69-72`): the food's label or name when the step belongs to a food; otherwise a
  fixed word per kind (`KIND_TITLE`, `:20-28`): `Smoker`, `Griddle`, `Oven`, `Serve`; otherwise
  `Pit Planner`.
- Text (`:107`): the event's label.
- The serve event's label is `Serve.` (`engine/plan.ts:607`). So the alert is title `Serve`, text `Serve.`

| Step | Title | Text |
|---|---|---|
| Serve | `Serve` | `Serve.` |
| Fire the smoker (`engine/plan.ts:502`) | `Smoker` | `Fire the smoker to 225F.` |
| Brisket pull (`data/foods.json:37`) | `Brisket` | `Check tenderness: pull at 200-205F when the probe slides in like butter.` |
| Griddle (`engine/plan.ts:550-555`) | `Griddle` | `Fire the griddle. Set a hot zone and a cooler zone.` |

The repeats are built on the phone from the same two strings
(`modules/pit-alarms/.../Notifications.kt:45-48`, `Receivers.kt:49`), so today they read
`Still waiting: Serve` / `10 min past the step. Serve.` and, as the last one, `Cook needs you` / `Serve: Serve.`

The label `Serve.` is also the step's text on Live cook (Next up reads "Serve in 20 min") and in the
timelines, and device tests check that Next up starts with "Serve" (`tools/device/run.sh:1360`, `:1870`,
`:1881`). So the label should stay; only the alert changes.

### Proposal

- Title: `Time to serve`
- Text: the menu, built from the plan's foods: `Brisket, chicken wings and chicken breasts.` With one food:
  `Brisket.`

The repeats then read `Still waiting: Time to serve` / `10 min past the step. Brisket, chicken wings and chicken breasts.`
and the last one `Cook needs you` / `Time to serve: Brisket, chicken wings and chicken breasts.`

### Options

1. **Title `Time to serve`, text the menu (recommended).** Title and text say different things, and the
   text is a fact about this cook. Needs a few lines in `alarmsFromPlan` for the serve step.
2. **Title `Time to eat`, text `Serve.`** A one-word change in `KIND_TITLE` (`engine/alarms.ts:27`), no new
   code. Reads "Time to eat" / "Serve." on the lock screen, which is better than today but still thin.

### Recommendation

Option 1.

### What it would touch

- `engine/alarms.ts` only. No native change: the phone shows what it is given.
- Tests: `engine/alarms.test.ts:96` asserts the title `Serve` and changes; one new test for the serve
  alert's title and text (written failing first, as a regression test).
- Device: I found no device test that reads the serve alert's text.
- Estimate: 1 hour for option 1, half an hour for option 2.

### Open questions for Jason

1. `Time to serve` or `Time to eat` as the title?
2. With two of the same food, should the text use the labels ("11.5 lb brisket and 6 lb brisket") or the
   plain names once ("Brisket")? I recommend plain names, each once.

Could not determine: whether "Serve Serve." was seen on the lock screen or heard from the screen reader.
`docs/HANDOFF.md:120` only says the alert "reads" that way. The strings above are from the code either way.

---

## 4. The turkey weight stepper is read as "More quantity"

### Today

- The stepper is the kit `Stepper` (`src/components/kit/controls.tsx:229-271`). It takes one `label`; the
  group is announced with that label (`:249`) and the two buttons are `Less {label}` and `More {label}`,
  with the label in lower case (`:246`, `:253`, `:266`).
- Food details (`src/screens/plan/FoodEdit.tsx:260-270`) gives the quantity field two different names. The
  visible caption is `q.label ?? (weight ? 'Weight' : 'How many')` (`:260`). The stepper's spoken label is
  `q.label ?? 'Quantity'` (`:262`). A food with its own quantity label gets it in both places; a food
  without one is shown "Weight" or "How many" and spoken "Quantity".

| Food (`data/foods.json`) | Caption on screen | Buttons read today |
|---|---|---|
| Brisket (`label: "Trimmed weight"`) | `Trimmed weight` | `Less trimmed weight` / `More trimmed weight` |
| St. Louis ribs, baby back ribs (`label: "Racks"`) | `Racks` | `Less racks` / `More racks` |
| Tri-tip, pork butt, chicken wings, whole turkey (weight, no label) | `Weight` | `Less quantity` / `More quantity` |
| Chicken breasts (count, no label) | `How many` | `Less quantity` / `More quantity` |

- Other steppers: `Rest` (`FoodEdit.tsx:327`), `Hours per pound` (`:473`), `Total hours` (`:495`), `Shift`
  (`src/screens/cook/CookOptions.tsx:114`), `Lowest oven setting` (`src/screens/gear/CookerSheets.tsx:161`),
  `Smoker temp` (`src/screens/gear/HistoryScreen.tsx:601`), and in the history edit sheet
  `{food} weight` or `{food} count`, `{food} hours`, `{food} minutes` (`HistoryScreen.tsx:654`, `:665`,
  `:674`), for example `More brisket minutes`.

### Proposal

Change the one line, `FoodEdit.tsx:262`, so the spoken label follows the thing being stepped:

- Weight foods with no label of their own: label `Weight`, so the buttons read `Less weight` / `More weight`.
- Count foods with no label of their own: the food's unit, capitalised, so chicken breasts reads
  `Less breasts` / `More breasts`, the same shape as `More racks`.
- Brisket and ribs do not change.

### Options

1. **`More weight` / `Less weight`, `More breasts` / `Less breasts` (recommended).** One line. Same pattern
   as every other stepper.
2. **Add the unit: `More weight, lb` / `Less weight, lb`** (or `kg`). Names the unit as well. The unit is
   already on screen next to the value ("12.0 lb"); whether the screen reader reads that value text when
   the buttons have focus I could not check without a device.
3. **Name the food, as the history sheet does: `More turkey weight`.** Longer, and the sheet's title already
   names the food.

### Recommendation

Option 1.

### What it would touch

- One place: `src/screens/plan/FoodEdit.tsx:262`. The kit `Stepper` does not change.
- Device test: the `turkey` test checks for the old labels by name, `tools/device/run.sh:1922`
  (`"More quantity" "Less quantity"`), and needs the new ones. No other line in `run.sh`,
  `tools/device/targets.tsv` or `upgrade020.sh` uses "quantity"; they use `More trimmed weight`,
  `More rest`, `More hours per pound`, `More lowest oven setting`, `More smoker temp` and
  `More brisket minutes`, which do not change.
- Unit tests: none use "More quantity" today (`FoodEdit.test.tsx` and `PlanTab.test.tsx` use
  `More trimmed weight`). Add one regression test: the turkey weight buttons are named `More weight` and
  `Less weight`, and the chicken breasts buttons `More breasts` and `Less breasts`.
- Estimate: half an hour to an hour.

### Open questions for Jason

1. `More weight` or `More weight, lb`?
2. The Running behind or ahead stepper in Cook options reads `More shift` / `Less shift`
   (`CookOptions.tsx:114`). Same kind of problem. Change it too (for example `Later` / `Earlier`), or leave
   it? `CookOptions.test.tsx` presses those names in ten lines.


## Jason's answers (2026-11-16)

1. T-069: A1 + B1, an OK button, silent for 0.3.0 (including conflicts caused from the lock screen), new
   warnings only. The engine's conflict wording changes on Plan and Live cook: "Smoker conflict: brisket at
   225F and chicken wings at 400F at the same time." The lane chart note is reworded when the overlap is a
   conflict.
2. T-070: dropped from 0.3.0, moved to After 0.3.0. Parity D1 closed as "handled by Food details after import."
3. Serve alert: title "Time to serve", text the menu with plain names, each once.
4. Stepper labels: "More weight" / "Less weight" for weight foods, the unit for count foods ("More breasts").
   Cook options: "More shift" / "Less shift" become "Later" / "Earlier". Items 3 and 4 are one small task: T-074.

Note on the examples above: "Pit Boss Sportsman 850" is one of the models in `data/cookers.json`, used here
only as an example name. The seed and test data use "Pit Boss 820" (`pb820`).
