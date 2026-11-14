// NativeWind theme, built from src/theme/tokens.ts (the only place values live). Dark only.
// `colors` replaces Tailwind's palette, so only token colors exist as classes. Reusables components use the
// shadcn semantic names (background, primary, muted, accent, border, ...); they map onto the tokens here.
// Our ember accent is `ember` (`primary` in Reusables terms): Reusables' `accent` is a subtle pressed background.
import nativewindPreset from 'nativewind/preset';
import { colors as c, statusColors as sc, radii, type, lineHeightRatio } from './src/theme/tokens.ts';

const fontSize = Object.fromEntries(
  Object.entries(type).map(([name, t]) => [
    name,
    [
      `${t.size}px`,
      { lineHeight: `${Math.round(t.size * ('lh' in t ? t.lh : lineHeightRatio))}px`, fontWeight: t.weight },
    ],
  ]),
);

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [nativewindPreset],
  theme: {
    colors: {
      transparent: 'transparent',
      // Pit Planner tokens
      bg: { DEFAULT: c.bg, deep: c.bgDeep },
      surface: { DEFAULT: c.surface, 2: c.surface2, 3: c.surface3 },
      field: c.fieldOpen,
      nav: c.nav,
      outline: { DEFAULT: c.outline, 2: c.outline2 },
      divider: c.divider,
      ink: { DEFAULT: c.text, 1: c.text1, 2: c.text2, 3: c.text3 },
      ember: {
        DEFAULT: c.accent,
        hi: c.accentHi,
        on: c.onAccent,
        container: c.accentContainer,
        'on-container': c.onAccentContainer,
        soft: c.emberSoft,
      },
      result: c.result,
      griddle: { DEFAULT: c.griddle, container: c.griddleContainer },
      ok: { DEFAULT: c.ok, container: sc.okContainer },
      warn: { DEFAULT: c.warn, container: sc.warnContainer },
      gold: { container: sc.goldContainer },
      error: { DEFAULT: c.error, container: sc.errorContainer, 'on-container': sc.onErrorContainer },
      scrim: { DEFAULT: c.scrim, menu: sc.scrimMenu },
      // React Native Reusables (shadcn) semantic names
      background: c.bg,
      foreground: c.text,
      card: { DEFAULT: c.surface, foreground: c.text },
      popover: { DEFAULT: c.surface2, foreground: c.text },
      primary: { DEFAULT: c.accent, foreground: c.onAccent },
      secondary: { DEFAULT: c.accentContainer, foreground: c.onAccentContainer },
      muted: { DEFAULT: c.surface2, foreground: c.text2 },
      accent: { DEFAULT: c.surface3, foreground: c.text },
      destructive: { DEFAULT: c.error, foreground: c.onAccent },
      border: c.outline,
      input: c.outline,
      ring: c.accentHi,
    },
    fontFamily: { sans: ['Roboto'] },
    fontSize,
    borderRadius: {
      none: '0px',
      ...Object.fromEntries(Object.entries(radii).map(([k, v]) => [k, `${v}px`])),
      full: '9999px',
    },
    extend: {},
  },
  plugins: [],
};
