// Text: every piece of text in the app goes through this (React Native Reusables `text`, rewritten for the
// Pit Planner tokens). Type (Roboto, size, weight, line height) is a style from src/theme/tokens.ts, so it
// follows the system font scale (never capped) and tests can read it. Color and layout are NativeWind classes.
// Buttons and other containers set defaults for the text inside them through TextContext, and a Text passes
// its own type and tone to Text nested in it (like CSS inheritance), so `<Num>` inside a sentence matches it.
import { Slot } from '@rn-primitives/slot';
import * as React from 'react';
import { Text as RNText, type TextStyle } from 'react-native';
import { cn } from '@/lib/utils';
import { colors, fontFamily, lineHeightRatio, relaxedLineHeightRatio, type, type TypeName } from '@/theme/tokens';

export type TextVariant = TypeName;
export type TextWeight = '400' | '500' | '700';
export type TextTone =
  | 'primary'
  | 'soft'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'accentHi'
  | 'onAccent'
  | 'onAccentContainer'
  | 'ok'
  | 'warn'
  | 'error'
  | 'griddle';

const TONE: Record<TextTone, string> = {
  primary: 'text-ink',
  soft: 'text-ink-1',
  secondary: 'text-ink-2',
  tertiary: 'text-ink-3',
  accent: 'text-ember',
  accentHi: 'text-ember-hi',
  onAccent: 'text-ember-on',
  onAccentContainer: 'text-ember-on-container',
  ok: 'text-ok',
  warn: 'text-warn',
  error: 'text-error',
  griddle: 'text-griddle',
};

/** The hex value behind each tone, for things drawn in the text color (icons). */
export const toneColor: Record<TextTone, string> = {
  primary: colors.text,
  soft: colors.text1,
  secondary: colors.text2,
  tertiary: colors.text3,
  accent: colors.accent,
  accentHi: colors.accentHi,
  onAccent: colors.onAccent,
  onAccentContainer: colors.onAccentContainer,
  ok: colors.ok,
  warn: colors.warn,
  error: colors.error,
  griddle: colors.griddle,
};

/** Font, size, weight and line height for a type-scale entry (ui.css `.t-*`); `relaxed` is ui.css `.lh`. */
export function textStyle(variant: TextVariant, weight?: TextWeight, relaxed?: boolean): TextStyle {
  const t = type[variant];
  const ratio = relaxed ? relaxedLineHeightRatio : 'lh' in t ? t.lh : lineHeightRatio;
  return { fontFamily, fontSize: t.size, fontWeight: weight ?? t.weight, lineHeight: Math.round(t.size * ratio) };
}

/** Defaults a container (a button, a chip, an outer Text) gives the text inside it. Props on Text win. */
export const TextContext = React.createContext<{ variant?: TextVariant; weight?: TextWeight; tone?: TextTone }>({});

export type TextProps = React.ComponentProps<typeof RNText> & {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextWeight;
  center?: boolean;
  /** One line with an ellipsis. Secondary text only: never around a `Num` (lint rule num-text-size). */
  clamp?: boolean;
  /** ui.css `.lh`: 1.4 line height for wrapped secondary lines and notes. */
  relaxed?: boolean;
  asChild?: boolean;
};

function Text({
  variant,
  tone,
  weight,
  center,
  clamp,
  relaxed,
  asChild = false,
  className,
  style,
  ...props
}: TextProps) {
  const ctx = React.useContext(TextContext);
  const v = variant ?? ctx.variant ?? 'body';
  const w = weight ?? ctx.weight;
  const t = tone ?? ctx.tone ?? 'primary';
  const inner = React.useMemo(() => ({ variant: v, weight: w, tone: t }), [v, w, t]);
  const Component = asChild ? Slot : RNText;
  return (
    <TextContext.Provider value={inner}>
      <Component
        className={cn(TONE[t], center && 'text-center', className)}
        style={[textStyle(v, w, relaxed), style]}
        numberOfLines={clamp ? 1 : undefined}
        {...props}
      />
    </TextContext.Provider>
  );
}

export { Text };
