// Surfaces (legacy/src/ui/components.tsx "Surfaces"; sizes and colors from ui.css): cards, avatars, tiles,
// info box, result card, banner, empty state, grouped rows.
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { CookerIcon, IconColor, type CookerKind } from '@/components/kit/icons';
import { Num } from '@/components/kit/num';
import { Text, type TextTone } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

type Kids = { children?: React.ReactNode };

const RIPPLE = { color: withAlpha(colors.text, 0.12) };

/* ---------- Card ---------- */

const CARD_TONE = {
  surface: 'bg-surface',
  result: 'bg-result flex-col items-stretch',
  outline: 'border border-outline',
  inset: 'bg-surface-2 rounded-inset',
} as const;
const CARD_PAD = { s: 'p-3', m: 'px-4 py-3.5', l: 'px-[18px] py-4' } as const;

/** Rounded panel; a row by default (`col` stacks). With `onPress` the whole card is one button. */
export function Card({
  tone = 'surface',
  pad = 'm',
  col,
  onPress,
  label,
  children,
}: Kids & {
  tone?: keyof typeof CARD_TONE;
  pad?: keyof typeof CARD_PAD;
  col?: boolean;
  onPress?: () => void;
  label?: string;
}) {
  const className = cn(
    'w-full shrink-0 flex-row items-center gap-3.5 overflow-hidden rounded-card',
    CARD_TONE[tone],
    CARD_PAD[pad],
    col && 'flex-col items-stretch',
  );
  if (!onPress) return <View className={className}>{children}</View>;
  return (
    <Pressable className={className} onPress={onPress} role="button" aria-label={label} android_ripple={RIPPLE}>
      {children}
    </Pressable>
  );
}

/* ---------- Avatars ---------- */

const AVATAR_SIZE = { 40: 'h-10 w-10', 44: 'h-11 w-11', 72: 'h-[72px] w-[72px]' } as const;
const AVATAR_BG: Record<CookerKind, string> = {
  smoker: 'bg-ember-soft',
  griddle: 'bg-griddle-container',
  oven: 'bg-surface-3',
};

/** Round cooker avatar with its icon: flame on ember, griddle on blue, oven on grey (T-017 PR-2). */
export function Avatar({ kind, size = 44 }: { kind: CookerKind; size?: keyof typeof AVATAR_SIZE }) {
  return (
    <View className={cn('shrink-0 items-center justify-center rounded-full', AVATAR_SIZE[size], AVATAR_BG[kind])}>
      <CookerIcon kind={kind} size={size === 72 ? 32 : 22} />
    </View>
  );
}

const ICON_AVATAR = {
  plain: { bg: 'bg-surface-3', color: colors.text1 },
  ok: { bg: 'bg-ok-container', color: colors.ok },
  warn: { bg: 'bg-warn-container', color: colors.warn },
  gold: { bg: 'bg-gold-container', color: colors.warn },
} as const;

/** 40 dp round holder for a non-cooker icon (Gear: rates, alerts, support). */
export function IconAvatar({ tone = 'plain', children }: Kids & { tone?: keyof typeof ICON_AVATAR }) {
  const t = ICON_AVATAR[tone];
  return (
    <View className={cn('h-10 w-10 shrink-0 items-center justify-center rounded-full', t.bg)}>
      <IconColor.Provider value={t.color}>{children}</IconColor.Provider>
    </View>
  );
}

/* ---------- Tiles ---------- */

const TilesInset = React.createContext(false);

/**
 * A label, a value and an optional note. Tiles share a row and wrap to the next one rather than cut a value:
 * each is at least as wide as its content and grows to fill the row.
 */
export function Tile({
  label,
  value,
  sub,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: TextTone;
  onPress?: () => void;
}) {
  const inset = React.useContext(TilesInset);
  const className = cn(
    'shrink-0 grow basis-auto gap-1 overflow-hidden rounded-control p-3',
    inset ? 'bg-bg' : 'bg-surface',
  );
  const body = (
    <>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Num variant="tile" tone={tone}>
        {value}
      </Num>
      {sub ? (
        <Text variant="caption" tone="secondary">
          {sub}
        </Text>
      ) : null}
    </>
  );
  if (!onPress) return <View className={className}>{body}</View>;
  return (
    <Pressable className={className} onPress={onPress} role="button" android_ripple={RIPPLE}>
      {body}
    </Pressable>
  );
}

/** Row of tiles that wraps; `inset` puts them on a card (background-colored tiles). */
export function Tiles({ inset = false, children }: Kids & { inset?: boolean }) {
  return (
    <TilesInset.Provider value={inset}>
      <View className="shrink-0 flex-row flex-wrap gap-2">{children}</View>
    </TilesInset.Provider>
  );
}

/* ---------- Notes and results ---------- */

/** Grey note box with an optional bold lead ("Fire 6:20 AM"). */
export function InfoBox({ lead, children }: Kids & { lead?: React.ReactNode }) {
  return (
    <View className="flex-row flex-wrap gap-x-2.5 gap-y-0.5 rounded-inset bg-surface-2 px-3 py-2.5">
      {lead != null ? (
        <Text variant="label" weight="500" relaxed>
          {lead}
        </Text>
      ) : null}
      <Text variant="label" tone="soft" relaxed>
        {children}
      </Text>
    </View>
  );
}

/** The plan's answer: overline, a large title, then any detail. */
export function ResultCard({
  overline,
  title,
  children,
}: Kids & { overline: React.ReactNode; title: React.ReactNode }) {
  return (
    <View className="w-full shrink-0 gap-1.5 rounded-card bg-result px-4 py-3.5">
      <Text variant="overline" tone="accentHi">
        {overline}
      </Text>
      <Text variant="result">{title}</Text>
      {children}
    </View>
  );
}

const BANNER = {
  error: { box: 'bg-error-container', text: 'text-error-on-container' },
  warn: { box: 'bg-warn-container', text: 'text-warn' },
} as const;

/** Full-width warning strip with an optional action (alerts off, pit out). */
export function Banner({
  tone = 'error',
  action,
  children,
}: Kids & { tone?: keyof typeof BANNER; action?: React.ReactNode }) {
  const b = BANNER[tone];
  return (
    <View className={cn('min-h-[56px] shrink-0 flex-row items-center gap-2 rounded-control py-2 pl-4 pr-2', b.box)}>
      {/* The message is the alert (announced when it appears); the action stays its own button. */}
      <View role="alert" accessible aria-live="polite" className="min-w-0 flex-1">
        <Text className={b.text}>{children}</Text>
      </View>
      {action}
    </View>
  );
}

/** Centered icon, title and line, with actions at the bottom (Plan and Cook with nothing planned). */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: Kids & { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View className="flex-1 justify-between gap-4">
      <View className="flex-1 items-center justify-center gap-3.5 px-6 pt-6">
        {icon}
        <Text variant="headline" role="heading" center>
          {title}
        </Text>
        <Text variant="bodyM" tone="secondary" center>
          {body}
        </Text>
      </View>
      <View className="gap-1">{children}</View>
    </View>
  );
}

/** Card of rows separated by inset hairlines (Setup alerts, Gear lists). */
export function GroupCard({ children }: Kids) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View className="shrink-0 overflow-hidden rounded-card bg-surface">
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View className="mx-4 h-px bg-surface-3" /> : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}
