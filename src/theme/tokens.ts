// Design tokens: the one place colors, type and radii are defined (TECH-DESIGN section 8). Values come from the
// mockup artboards (docs/mockups/source/*.dc.html) via the 0.2.0 kit, legacy/src/ui/ui.css; tokens.test.ts
// checks they still match it. tailwind.config.js builds the NativeWind theme from this file, and the
// React Navigation theme (src/theme/navTheme.ts) reads it too. Dark only. No imports: Tailwind loads this
// file at build time.

/** Colors, named as in ui.css (`--text-1` is `text1`). */
export const colors = {
  bg: '#131211',
  bgDeep: '#0a0909',
  surface: '#1f1d1b',
  surface2: '#2a2725',
  surface3: '#2e2b28',
  fieldOpen: '#171514',
  nav: '#1b1917',
  outline: '#4a4541',
  outline2: '#5a544f',
  divider: '#3a3633',
  text: '#f1ebe5',
  text1: '#d8cfc7',
  text2: '#b5aba2',
  text3: '#8a8079',
  accent: '#ff8f4a',
  accentHi: '#ffb07f',
  onAccent: '#23130a',
  accentContainer: '#4a2e1c',
  onAccentContainer: '#ffd3b5',
  emberSoft: '#3a2619',
  result: '#2b1d14',
  griddle: '#8ec2f0',
  griddleContainer: '#1c2b38',
  ok: '#9bd18b',
  warn: '#ffd27a',
  error: '#ff9a86',
  scrim: 'rgba(10, 9, 9, 0.6)',
} as const;

export type ColorName = keyof typeof colors;

/**
 * Container colors ui.css writes as literals on the components that use them (status chips, avatars,
 * banners), not as `:root` variables. Kept apart from `colors` so `colors` stays equal to ui.css `:root`.
 */
export const statusColors = {
  okContainer: '#1f2a1c', // .avatar-ok, .status-ok
  warnContainer: '#2e221a', // .avatar-warn, .status-warn, .banner-warn
  goldContainer: '#3a3018', // .avatar-gold
  errorContainer: '#3a1c18', // .status-error, .banner-error
  onErrorContainer: '#ffd9d2', // .banner-error text
  scrimMenu: 'rgba(10, 9, 9, 0.7)', // .scrim-menu: darker than the sheet scrim, the field shows over it
} as const;

/** Font family registered natively by the expo-font config plugin (app.config.ts) with these weights. */
export const fontFamily = 'Roboto';
export const fontWeights = { regular: '400', medium: '500', bold: '700' } as const;

/** ui.css sets `line-height: 1.25` on body; a few styles override it. */
export const lineHeightRatio = 1.25;
/** ui.css `.lh` (secondary lines under a title, notes, info boxes): wrapped text gets more air. */
export const relaxedLineHeightRatio = 1.4;
/** ui.css `.chip-hint`: the small second line in a chip. Not a `.t-*` style, so not in `type`. */
export const chipHintSize = 11;

/**
 * Type scale in dp (ui.css `.t-*`; the Android font scale applies on top, never capped).
 * `lh` is the line-height ratio where ui.css overrides the 1.25 default.
 */
export const type = {
  countdown: { size: 40, weight: fontWeights.medium, lh: 1.1 },
  display: { size: 28, weight: fontWeights.medium },
  nextTitle: { size: 28, weight: fontWeights.medium, lh: 1.15 },
  when: { size: 24, weight: fontWeights.medium },
  title: { size: 22, weight: fontWeights.medium },
  headline: { size: 22, weight: fontWeights.medium },
  value: { size: 22, weight: fontWeights.medium },
  sheetTitle: { size: 20, weight: fontWeights.medium },
  result: { size: 20, weight: fontWeights.medium },
  select: { size: 18, weight: fontWeights.medium },
  tile: { size: 17, weight: fontWeights.medium },
  section: { size: 16, weight: fontWeights.medium },
  bodyL: { size: 16, weight: fontWeights.regular },
  bodyM: { size: 15, weight: fontWeights.regular },
  body: { size: 14, weight: fontWeights.regular },
  label: { size: 13, weight: fontWeights.regular },
  overline: { size: 13, weight: fontWeights.medium },
  caption: { size: 12, weight: fontWeights.regular },
} as const;

export type TypeName = keyof typeof type;

/** Corner radii in dp (ui.css, by component). */
export const radii = {
  statusDot: 4,
  small: 12, // when button, action row
  inset: 14, // inset card, info box, small chips
  control: 16, // tile, select, stepper, banner, menu, nav pill
  card: 20, // card, chip, group card
  pill: 24, // outline / tonal / text buttons, icon button, segmented
  search: 26,
  primary: 28, // primary button, sheet top corners
} as const;
