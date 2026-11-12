// Text: every piece of text in the app goes through this (React Native Reusables `text`, rewritten for the
// Pit Planner tokens). Type (Roboto, size, weight, line height) is a style from src/theme/tokens.ts, so it
// follows the system font scale (never capped) and tests can read it. Color and layout are NativeWind classes.
// Buttons and other containers set defaults for the text inside them through TextContext.
import { Slot } from '@rn-primitives/slot';
import * as React from 'react';
import { Text as RNText, type TextStyle } from 'react-native';
import { cn } from '@/lib/utils';
import { fontFamily, lineHeightRatio, type, type TypeName } from '@/theme/tokens';

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

/** Font, size, weight and line height for a type-scale entry (ui.css `.t-*`). */
export function textStyle(variant: TextVariant, weight?: TextWeight): TextStyle {
  const t = type[variant];
  const ratio = 'lh' in t ? t.lh : lineHeightRatio;
  return { fontFamily, fontSize: t.size, fontWeight: weight ?? t.weight, lineHeight: Math.round(t.size * ratio) };
}

/** Defaults a container (a button, a chip) gives the text inside it. Props on Text win. */
export const TextContext = React.createContext<{ variant?: TextVariant; weight?: TextWeight; tone?: TextTone }>({});

type TextProps = React.ComponentProps<typeof RNText> & {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextWeight;
  center?: boolean;
  asChild?: boolean;
};

function Text({ variant, tone, weight, center, asChild = false, className, style, ...props }: TextProps) {
  const ctx = React.useContext(TextContext);
  const v = variant ?? ctx.variant ?? 'body';
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(TONE[tone ?? ctx.tone ?? 'primary'], center && 'text-center', className)}
      style={[textStyle(v, weight ?? ctx.weight), style]}
      {...props}
    />
  );
}

export { Text };
