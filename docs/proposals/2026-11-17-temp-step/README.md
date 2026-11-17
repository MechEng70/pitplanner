# Proposal: temp step question on Setup's smoker card and in Gear

Mockups only (Jason's decision of 2026-11-17). Nothing in `docs/mockups/`, SPEC, TASKS or `src/` is changed.
Each PNG is 390x844 at 2x with its `.html` source next to it (plain HTML, no canvas runtime; render with
`google-chrome --headless=new --force-device-scale-factor=2 --window-size=390,844 --screenshot=out.png file.html`).

Jason named "mockup 02/03". The smoker card is on mockup 01 (Setup, cookers) and Gear is mockup 16, so the
question is mocked there. The pictures follow the built screens (`docs/fidelity/rn-01-setup-cookers.png`,
`rn-16-gear.png`, `rn-18-griddle.png`) where they differ from the approved mockups: checkboxes for griddle and
oven, no "Add another cooker", the built Gear rows.

Kit parts used: `Field` (label 13), `Segmented`, `SelectField`, `InputField`, `Chips`, `Sheet`, `Button`. Nothing new.

## Pictures

| File | Shows |
| --- | --- |
| `01-setup-cookers-step.png` | Setup, cookers step, Pit Boss Sportsman 850 picked. Under Model: "What steps does your smoker set in?" and a Segmented 5F / 10F / 25F / Other, 5F selected (the catalog's step). |
| `01b-setup-step-other.png` | Other chosen: the existing manual form (`SmokerForm`) as it would open. Title is the model name (no Name field), range 180 to 500 from the model, grate and hopper from the card, Temp step empty, Dial settings below, Save smoker off until a step or two settings are in. |
| `01d-setup-step-other-small.png` | Not asked for, cheap to add: the smaller alternative for Other (see "Problem with the whole form"). |
| `01c-setup-cookers-step-celsius.png` | The same card with Celsius display: no F anywhere, the oven reads 76C. The Segmented shows only what the research below supports: 1C / Other, nothing selected (see open questions 1 and 2). |
| `16-gear-step.png` | Gear, recommended: the smoker row opens a Smoker sheet with the Model field (opens the picker) and the question. |
| `16b-gear-step-alt.png` | Gear, alternative: the question sits under the smoker row inside the Cookers card. |

## Gear: recommendation

`16-gear-step.png`, the sheet. Griddle and Oven rows already open a details sheet with a Save button, so the
smoker row doing the same is the pattern the screen already has, and the Gear list keeps its rows of equal
height. The inline version (16b) puts a setting most people touch once on top of Gear for good and pushes
every row below it down about 90 points.

Cost of the sheet: changing the model takes one more tap (row, then Model) than today.

## Problem with the whole form for Other (01b)

Shown as decided, but it has real problems for a model picked from the catalog:

- It asks again for Type, the range, grate and hopper, which the catalog already filled. The user came to answer one thing.
- Type chips let a Pit Boss be turned into a kamado.
- Editing the range or saving through `manualSmoker` would make a checked model read "Specs entered by you".
- Today the form shows "No checked specs for this model yet..." whenever it starts from a catalog id. That is false here, so the mock leaves the box out; the build has to as well.
- Close leaves Other selected with no step behind it (see question 4).

Smaller alternative (`01d`): Other opens a short sheet with only the two fields that answer the question,
Temp step and Dial settings, same labels, note and Save smoker button as the form. Range, type, grate and hopper stay as
the catalog has them. The same sheet would serve Gear.

## Font scale

Checked the F card at 115% and 130% (same HTML, type scaled): 5F / 10F / 25F / Other fit on one line with room
left at both. The model name wraps to two lines at 130% and the screen scrolls (the oven row goes under the
buttons); nothing is cut. The Celsius labels in the picture (1C, Other) are shorter. If a Celsius set of four
ever includes a label like "10C" it is the same width as "10F", so it fits too.

## Celsius steps, sourced

Searched 2026-11-17 (manuals, support pages, product pages). Only one controller has a stated Celsius step.
For every other brand a Celsius display exists but no page found says how far one press moves in C. No C step
below is worked out from an F step.

| Brand | Model or controller | C step or C presets | Source and what it says |
| --- | --- | --- | --- |
| Z Grills | "Wireless Controller" by Z Grills Australia, for 450A, 7002B and 700E series sold in Australia | 1C | https://help.zgrills.com.au/?p=3624 : "75 to 240℃ (167 to 465℉) temperature range adjustable in 1 degree increments"; "Rotate the knob faster to change more quickly, or slowly for 1 degree increments"; units menu "Celsius (℃), Fahrenheit (℉)". |
| Z Grills | US controllers (700D4E, 1000D4E Wi-Fi, dial models) | Not found | The app manual says the board can switch to C and gives the range 160 to 450F (71 to 232C), no step (https://bbqgrillpeople.com/wp-content/uploads/2024/06/APP_Instructions.pdf, from the search summary, not read in full). |
| Pit Boss | Sportsman dial board (manual for PB0500SP, PB0820SP, PB1000SP and others) | Ten dial presets between 82 and 260C. The ten values are not listed. | https://cdn.pellet-stove-parts-4less.com//SPFL/manufacturers/Pit%20Boss/Grill/Models/Sportsman%20500/pit-boss-sportsman-500-owners-manual.pdf : "select from any of the ten preset temperatures, between 82-260°C / 180-500°F"; "Press and hold the button for two seconds to switch to Celsius (ºC) or to Fahrenheit (ºF)". |
| Pit Boss | Wi-Fi and PID boards (Sportsman 850 PB850SPW2, Pro Series, Navigator) | Not found | Product pages give 5F steps only (for example https://www.pitboss-grills.com/products/pit-boss-pro-series-1600-wood-pellet-grill-1600ps4). Owners report 25F steps on a PRO850 (https://pitbossforum.com/threads/pb850ps2-temperature-increments.679/page-2). Nothing on C. |
| Traeger | WiFIRE, touchscreen, Woodridge controllers | Not found | https://support.traeger.com/hc/en-us/articles/4407213234843 says temperature changes "in 5° increments" with no unit; units can be switched to C on the controller (https://support.traeger.com/hc/en-us/articles/4407213217179). Both pages refused a direct read (403), so this is from the search summaries. No page says whether Celsius moves in 5C. |
| Weber | Searwood | Not found | Weber support gives the range 95 to 315C, set by turning the dial (https://contact-emea.weber.com/hc/en-us/articles/36966030002717-Understanding-Temperature-Modes-Set-Temperature-SmokeBoost-and-Manual-Mode, search summary). The Searwood 600 quick start guide (https://content-images.weber.com/downloads/Searwood-600-Quick-setting-guide.pdf, read) gives ranges such as 105 to 135C and 190 to 230C, no step. |
| Weber | SmokeFire | Not found | Range 200 to 600F on weber.com; the 2020 cheat sheet (https://tvwbb.com/docs/2020-weber-smokefire-cheatsheet.pdf, read) says "200-600 degree temperature range", no step and no C. |
| Camp Chef | Gen 2 controller PG24-82WFR | Not found | https://assets.pellet-stove-parts-4less.com/website/instructions/PG24-82WFR.pdf (read): "UNITS: This option is for changing the degrees from Fahrenheit to Celsius". No step in either unit. |
| Green Mountain Grills | Prime, Choice (app) | Not found | The Choice app manual lists "Toggle Temperature Settings °F/°C" (https://greenmountaingrills.com/wp-content/uploads/2024/04/Choice-App-Manual-Web.pdf, search summary). No step. |
| recteq | RT-590, RT-700 | Not found | No page found that mentions a Celsius display or a C step. |
| Oklahoma Joe's | Pellet grills | Not found | No page found. |
| Broil King (found while searching, common in Canada) | Regal and other pellet grills | Not found for C | The manual says the dial moves "in 10-degree increments" with 1 degree fine adjustment and that the grill switches between F and C; it does not say the steps in C (https://manuals.plus/m/9ef107fc3c5c3a7e4c54b004e594a721bda6a59218b5c3aa382f599cf0d3e50b, search summary). |

What would settle the rest: an owner switching the controller to Celsius and pressing up once (Jason's PB850SPW2 is the first one to try).

Prefill from the catalog, as the picture has it: the only sourced Celsius choice is 1C, and no catalog entry has
a step it maps from. Both verified catalog models (Pit Boss 820, Sportsman 850) have `tempStepF: 5`, which has no
sourced Celsius partner, so nothing is selected in the picture.

Where the F and C grids do not meet: 5F is 2.78C, 10F is 5.56C, 25F is 13.89C, so a controller that steps in F
never moves a whole number of C per press, and a controller that steps 1C or 5C from a whole-C base lands on
temps that are not whole F (1C is 1.8F, 5C is 9F). Stored temps are whole F today.

## Open questions for Jason

1. Celsius choices: only 1C is sourced. Options: (a) show 1C / Other until more are checked, (b) hold the Celsius Segmented back and send Celsius users to Other, (c) Jason checks his own controller in C mode and we add what it shows.
2. Celsius prefill for a catalog model whose step is 5F. Options: (a) nothing selected, as in the picture, (b) Other selected, (c) decided after the engine check on holding a C step. Not solved here.
3. F and C grids do not map (see above): store the step in the unit it was picked in, or keep F only and accept settings that are not whole C. With the main session's engine check.
4. Saved step is none of 5/10/25 (say 15F), or the smoker has dial settings. Options: (a) Other selected and the value shown as a caption under the Segmented ("15F" or "Dial settings: 180, 225, 250"), (b) Other selected with no value shown, (c) the odd step becomes a fifth segment.
5. Other is tapped and the sheet is closed without saving. Options: (a) the Segmented goes back to the step it had, (b) Other stays selected and Continue is blocked.
6. Choosing a step other than the catalog's on a checked model: does the card still read "Hopper and grate filled from the model"? Options: (a) yes, the line is only about hopper and grate, (b) it changes to "Specs entered by you".
7. Models that are not checked (they already go through the form, which asks for the step): (a) show the question on their card too, prefilled from what the user typed, (b) leave it off and keep the form as the one place.
8. Smokers with no step at all (kamado, drum, offset): (a) hide the question, (b) show it.
9. Other in Setup: the whole form as decided (01b) or the two-field sheet (01d)?
10. Gear: the sheet (16, recommended) or inline (16b)? If the sheet: its title "Smoker" is new copy, and should it also carry Hopper and Main grate, which Gear cannot edit today?
11. Changing the step can leave the plan's smoker temp off the new grid (225F is not a setting when the steps are 10F up from 180F). Options: (a) snap to the nearest setting and say so on Plan, (b) keep the temp until the user next opens the temp menu.
