# Visual fidelity audit: Plan tab (mockups 04-08 vs phone)

Phone: OnePlus CPH2583, Android 16, 1440x3168 at density 640 (WebView viewport 360x792 dp),
system font size 115%. Mockups: 390x844. Captured 2026-11-11 with `adb exec-out screencap -p`.
Side-by-side images: mockup left, phone right, phone scaled to the mockup width.

## Cause of most differences

1. **System font scale leaks into the WebView.** Android passes font_scale 1.15 to the WebView as
   `textZoom` 115%. Every font size is 15% larger than the mockup (title 22px renders 25.3px)
   while padding and radii stay in dp. Text wraps where the mockup does not.
2. **Narrower viewport.** 360 dp wide vs the 390 dp artboard: 30 dp less for every row.
   Layouts must hold at 360 dp (and at larger font scales) without wrapping key lines.
3. **Font not bundled.** `font-family: Roboto` resolves to whatever the phone maps it to; no
   guarantee it is Roboto at weights 400/500/700. Digits are not forced to tabular everywhere.

## Global (all screens)

| Area | Mockup | Phone now |
|---|---|---|
| Status bar | Not drawn (artboard starts at the app bar) | Drawn above the app; OK, but app bar sits 8 dp lower than it should because of safe-area + 64 dp bar |
| App bar title | 22px / 500, baseline ~40 dp from top of content | 25.3px (font scale) |
| Body text | 13-16px Roboto, secondary #B5ABA2 | Same colors, all sizes x1.15 |
| Times | `font-variant-numeric: tabular-nums` on every time | Only on some elements; temp menu times jitter column width |
| Touch targets | 48 dp min | Mode chips 28 dp tall, tiles OK, menu rows 48 OK, chips 40 dp |
| Pressed state | n/a in static mockup | Background swap only on some elements; no ripple |
| Bottom nav | 80 dp, label 12px; active pill 64x32 #4A2E1C, icon #FFB07F | Label 13.8px (scale); otherwise close |
| Icons | Inline SVG, stroke 2, 22 px | Same set; minus/plus in steppers drawn as glyph "-" in mockup vs SVG line here (mockup uses text "-"; keep SVG, match weight) |

## 04 Plan empty

- When card: mockup chips 12px with 4/10 padding inside a 20 dp radius card; phone chips larger (scale).
- Empty card has no calendar icon in mockup; phone matches.
- Illustration badge: mockup 72 dp circle centred ~at 40% height; phone same size, sits lower because text is larger.
- Body copy wraps to 3 lines in both; phone line height looser (1.45 vs ~1.4).
- **Missing:** "Cook a past plan again" text button (hidden when history is empty). Mockup always shows it.
- Primary button: 56 dp, radius 28, 17px/500; phone font 19.5px (scale).

## 05 Plan

- **Date wraps to two lines** ("Sat, Nov 14 at 5:00 / PM") at 360 dp + 115%. Mockup: one line, 24px/500.
- When card padding: mockup 16/18; calendar icon is not a 48 dp button in mockup (bare 22px icon). Phone has a 48 dp button which pushes the text.
- Smoker temp field: mockup 60 dp, radius 16, label 12px, value 18px/500, right text 13px; phone sizes x1.15.
- Section head "On the menu" 16px/500 vs "3 items" 13px secondary: OK apart from scale.
- **Food card subtitles wrap** ("12 lb, smoker, paper / wrap", "2 lb, smoke then 400F / crisp"). Mockup: single line. Needs ellipsis and less right-column width.
- Food card: mockup radius 20, padding 14/16, gap 14, avatar 44; phone matches structurally.
- **Breasts summary text differs**: mockup "4, pounded, griddle"; phone "4 breasts, griddle, pounded".
- Right column: mockup time 14px/500 and duration 12px; phone 16.1/13.8 (scale).
- **Tiles and Start cook pushed below the fold** on the phone. Mockup fits the whole plan with 3 items on one screen.
- Add food outline button: 48 dp, radius 24, 15px/500 accent, plus icon 18px stroke 2.2: matches apart from scale.

## 06 Smoker temp menu

- **Menu intro wraps to two lines**; mockup one line and the copy is "Times for 12 lb brisket." (names the longest food) vs "Times for this menu."
- **List scrolls the selected row to centre**; mockup shows 215 first with 225 as the third row. Scroll should put the selection third.
- **Times not rounded**: mockup fire times are on 5-minute steps (5:45, 6:00, 6:35); phone shows 5:24, 6:37 etc. (engine output, see note below).
- Row height 48 dp, temp 16px, time 13px: phone x1.15.
- Rows overlap the intro and the "Show 180-500F" footer while scrolling (no clipping/divider; the list bleeds under the header).
- Open field: mockup 2px accent border, label turns accent, chevron up: matches.
- Scrim: mockup dims the screen to ~#0A0909; phone similar.

## 07 Add food

- Sheet top: mockup sheet starts ~167 dp from top with 28 dp top radius; phone starts higher (more rows visible) - fine, but title 22px and search field 52 dp/16px are x1.15 on phone.
- **List rows taller than mockup**: mockup row ~60 dp, avatar 40, name 16px/400, subtitle 13px; phone rows ~66 dp.
- Group labels 13px/500 #FFB07F: matches apart from scale.
- **"Griddle or smoker"** for breasts vs mockup "Smoker or griddle" (method order in foods.json is griddle first). Wings match.
- Chevron color #B5ABA2 OK.
- No slide-up animation on open (only a short fade/rise).

## 08 Brisket details

- Title 22px/500 vs phone 25.3px.
- Stepper: mockup 60 dp tall, radius 20, bg #131211, buttons 48 dp outline, value 22px/500 + unit 15px secondary. Phone matches structurally; minus glyph differs.
- Chips 40 dp, radius 20, 14px; selected #4A2E1C / #FFD3B5 500. Phone: matches apart from scale.
- Segmented control: mockup 44 dp, radius 22, selected solid accent with dark text. Matches.
- Timing note: mockup "0.75 hr/lb from your cooks"; phone "(your setting)" - correct for this data (it is an override), mockup text assumes learned history.
- **Result card cut off by the footer** on the phone; mockup shows the full card above the button. Needs the sheet to size to content and the body to scroll above a pinned footer, with enough room.
- Footer: editing shows "Remove" + "Save"; mockup only shows the add flow ("Add to plan"). Keep, but style Remove as a text button at 48 dp.
- Result card: radius 20, bg #2B1D14, overline 13px/500 #FFB07F uppercase, main 20px/500, sub 13px. Matches apart from scale.

## Engine note (not a styling fix)

Mockup times are on 5-minute steps. The engine returns unrounded minutes. Rounding belongs in the
engine (so alarms equal what the screen shows), with a test; the UI should not round on its own.

## Status after the rebuild (2026-11-11)

Screens now use the kit in `src/ui/` only (no screen CSS). Phone captures: `docs/fidelity/`
(`before-after-*` = mockup | before | after at 115%, `scales-*` = 100/115/130%, `130pct-*`).

Fixed: bundled Roboto 400/500/700; date never splits inside a unit; card subtitles ellipsize,
times and durations never do; tiles wrap instead of clipping; tiles + Start cook pinned above
the nav; compact Ready by / Start at chips with 48 dp hit area; temp menu opens with the current
temp third, names the food ("Times for 12 lb brisket"), times on 5-minute steps (engine);
"Smoker or griddle" order; "4, griddle, pounded"; sheet slide up/down; ripple + pressed layer;
Save no longer overflows next to Remove.

Still different from the mockups, on purpose or open:
- 360 dp x 115% shows about 2.5 food cards above the pinned footer (mockup shows 3 at 390 dp / 100%); the list scrolls.
- When card is ~20 dp taller than the mockup: the date is a 48 dp tap target.
- Breasts subtitle order is "4, griddle, pounded" (mockup "4, pounded, griddle").
- Edit sheet footer adds Remove next to Save; the mockups only draw the add flow.
