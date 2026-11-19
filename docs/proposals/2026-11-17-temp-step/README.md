# Proposal: temp step question on Setup's smoker card and in Gear (T-082)

Mockups only (Jason's decisions of 2026-11-17). Nothing in `docs/mockups/`, SPEC, TASKS or `src/` is changed.
Each PNG is 390x844 at 2x with its `.html` source next to it (plain HTML, no canvas runtime; render with
`google-chrome --headless=new --force-device-scale-factor=2 --window-size=390,844 --screenshot=out.png file.html`).

Jason named "mockup 02/03". The smoker card is on mockup 01 (Setup, cookers) and Gear is mockup 16, so the
question is mocked there. The pictures follow the built screens (`docs/fidelity/rn-01-setup-cookers.png`,
`rn-16-gear.png`, `rn-18-griddle.png`) where they differ from the approved mockups: checkboxes for griddle and
oven, no "Add another cooker", the built Gear rows.

The choices are 5 / 10 / 15 / 25 / Other in the user's display unit, stored as F (5C = 9F, 10C = 18F,
15C = 27F, 25C = 45F). Other opens a two-field sheet (Temp step, Dial settings), not the whole manual form.

Kit parts used: `Field` (label 13), `Segmented`, `SelectField`, `InputField`, `Chips`, `Sheet`, `Button`. Nothing new.

## Pictures

| File | Shows |
| --- | --- |
| `01-setup-cookers-step.png` | Setup, cookers step, Pit Boss Sportsman 850 picked, Fahrenheit. Under Model: "What steps does your smoker set in?" and a Segmented 5F / 10F / 15F / 25F / Other, 5F selected (the catalog's step). |
| `01b-setup-step-other.png` | Other chosen: a short sheet with two fields, Temp step and Dial settings (the manual form's own labels, note, placeholder and Save smoker button, off until a step or two settings are in). The card behind keeps the catalog model's name and specs and still reads "Hopper and grate filled from the model"; only the step changes. |
| `01c-setup-cookers-step-celsius.png` | The same card in Celsius, no F anywhere (oven reads 76C). Segments 5C / 10C / 15C / 25C / Other. The catalog step is 5F, which is none of them exactly, so nothing is selected. |
| `01d-setup-cookers-step-celsius-picked.png` | Celsius after the user taps 5C (stored as 9F). With a C step the smoker's settings start at the first multiple of the step at or above its lowest temp in C: this model's 180F is 82.2C, so a 5C grid starts at 85C. |
| `16-gear-step.png` | Gear: the smoker row opens a small Smoker sheet, like Griddle and Oven, with the Model field (opens the picker), the question with five segments and Save smoker. |

## Decided (Jason, 2026-11-17)

- Choices: 5 / 10 / 15 / 25 / Other in the display unit, stored as F.
- Prefill from the catalog step. In Celsius a choice is selected only when it matches exactly (a stored 9F shows 5C); a 5F catalog smoker in Celsius shows none selected.
- Other opens the two-field sheet. The card keeps the catalog model's name and specs; only the step changes.
- Gear: the smoker row opens a small Smoker sheet (Model field and the question), like Griddle and Oven. Changing the model is one more tap than today (row, then Model).
- Celsius temp menu: when the saved step is a C step, the menu shows the grid's exact C values (85, 90, 95 for a 5C step on this model). Otherwise the 2C rounding rule of 2026-11-14 stays (`engine/units.ts` `SET_POINT_STEP_C = 2`, SPEC section 1 "Units").

## Font scale

Five segments checked in the Setup card (the narrowest place, 62 points per segment) with the type scaled in
the same HTML: they fit on one line at 100%, 115% and 130%, nothing wraps or is cut. At 130% "Other" has
about 2 points to spare, so it should be checked on the emulator at 130% when built. The C labels are the same
width as the F ones. At 130% the model name wraps to two lines and the screen scrolls (the oven row goes under
the buttons).

## Celsius steps, sourced so far

Searched 2026-11-17, stopped on Jason's decision. Only one controller has a stated Celsius step. For the
others a Celsius display exists but no page found says how far one press moves in C. No C step below is worked
out from an F step.

| Brand | Model or controller | C step or C presets | Source and what it says |
| --- | --- | --- | --- |
| Z Grills | "Wireless Controller" by Z Grills Australia, for 450A, 7002B and 700E series sold in Australia | 1C | https://help.zgrills.com.au/?p=3624 : "75 to 240℃ (167 to 465℉) temperature range adjustable in 1 degree increments"; "Rotate the knob faster to change more quickly, or slowly for 1 degree increments"; units menu "Celsius (℃), Fahrenheit (℉)". |
| Z Grills | US controllers (700D4E, 1000D4E Wi-Fi, dial models) | Not found | The app manual says the board can switch to C and gives the range 160 to 450F (71 to 232C), no step (https://bbqgrillpeople.com/wp-content/uploads/2024/06/APP_Instructions.pdf, from the search summary, not read in full). |
| Pit Boss | Sportsman dial board (manual for PB0500SP, PB0820SP, PB1000SP and others) | Ten dial presets between 82 and 260C. The ten values are not listed. | https://cdn.pellet-stove-parts-4less.com//SPFL/manufacturers/Pit%20Boss/Grill/Models/Sportsman%20500/pit-boss-sportsman-500-owners-manual.pdf (read): "select from any of the ten preset temperatures, between 82-260°C / 180-500°F"; "Press and hold the button for two seconds to switch to Celsius (ºC) or to Fahrenheit (ºF)". |
| Pit Boss | Wi-Fi and PID boards (Sportsman 850 PB850SPW2, Pro Series, Navigator) | Not found | Product pages give 5F steps only (for example https://www.pitboss-grills.com/products/pit-boss-pro-series-1600-wood-pellet-grill-1600ps4, search summary). Owners report 25F steps on a PRO850 (https://pitbossforum.com/threads/pb850ps2-temperature-increments.679/page-2, read). Nothing on C. |
| Traeger | WiFIRE, touchscreen, Woodridge controllers | Not found | https://support.traeger.com/hc/en-us/articles/4407213234843 says temperature changes "in 5° increments" with no unit; units can be switched to C on the controller (https://support.traeger.com/hc/en-us/articles/4407213217179). Both pages refused a direct read (403), so this is from the search summaries. |
| Weber | Searwood | Not found | Weber support gives the range 95 to 315C, set by turning the dial (https://contact-emea.weber.com/hc/en-us/articles/36966030002717-Understanding-Temperature-Modes-Set-Temperature-SmokeBoost-and-Manual-Mode, search summary). The Searwood 600 quick start guide (https://content-images.weber.com/downloads/Searwood-600-Quick-setting-guide.pdf, read) gives ranges such as 105 to 135C and 190 to 230C, no step. |
| Weber | SmokeFire | Not found | The 2020 cheat sheet (https://tvwbb.com/docs/2020-weber-smokefire-cheatsheet.pdf, read) says "200-600 degree temperature range", no step and no C. |
| Camp Chef | Gen 2 controller PG24-82WFR | Not found | https://assets.pellet-stove-parts-4less.com/website/instructions/PG24-82WFR.pdf (read): "UNITS: This option is for changing the degrees from Fahrenheit to Celsius". No step in either unit. |
| Green Mountain Grills | Prime, Choice (app) | Not found | The Choice app manual lists "Toggle Temperature Settings °F/°C" (https://greenmountaingrills.com/wp-content/uploads/2024/04/Choice-App-Manual-Web.pdf, search summary). No step. |
| recteq, Oklahoma Joe's | Pellet grills | Not found | No page found that gives a C step. |
| Broil King (found while searching) | Regal and other pellet grills | Not found for C | The manual says the dial moves "in 10-degree increments" with 1 degree fine adjustment and that the grill switches between F and C; it does not say the steps in C (https://manuals.plus/m/9ef107fc3c5c3a7e4c54b004e594a721bda6a59218b5c3aa382f599cf0d3e50b, search summary). |

The Z Grills Australia wireless controller with its 1C steps (source in the first row) is the first real case for a C grid in the 0.3.x Celsius fix. 1C is not one of the segments; such a user picks Other and types 1.

## Open questions for Jason

1. Saved step is none of the four (say 20F, or 9F seen in Fahrenheit display), or the smoker has dial settings. Options: (a) Other selected and the value shown as a caption under the Segmented ("20F" or "Dial settings: 180, 225, 250"), (b) Other selected with no value shown, (c) nothing selected, as for 5F in Celsius.
2. Other is tapped and the sheet is closed without saving. Options: (a) the Segmented goes back to what it had, (b) Other stays selected and Continue is blocked.
3. Nothing selected in Celsius (01c). Options: (a) the user can Continue and the 5F catalog step stays, (b) they must pick first.
4. The two-field sheet in Celsius: the Temp step field takes C ("Temp step (C)") and a typed 1 is kept as a C step. Options: (a) yes, any typed C step is a C grid, (b) only whole C steps, others stored as rounded F.
5. Models that are not checked (they already go through the full form, which asks for the step). Options: (a) show the question on their card too, prefilled from what the user typed, (b) leave it off and keep the form as the one place.
6. Smokers with no step at all (kamado, drum, offset). Options: (a) hide the question, (b) show it.
7. Sheet copy, all reused but in new places. Options: (a) as mocked (two-field sheet titled with the model name, Gear sheet titled "Smoker", both with "Save smoker"), (b) Jason's wording.
8. Gear's Smoker sheet and Hopper and Main grate, which Gear cannot edit today. Options: (a) add them to the sheet, (b) leave them to Setup.
9. Changing the step can leave the plan's smoker temp off the new grid (225F is not a setting when the steps are 10F up from 180F). Options: (a) snap to the nearest setting and say so on Plan, (b) keep the temp until the user next opens the temp menu.
