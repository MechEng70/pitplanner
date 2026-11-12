// Rows (legacy/src/ui/components.tsx; sizes from ui.css): list row, status row, check row. They sit in a
// GroupCard or on a sheet; the whole row is the touch target.
import * as React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Check, ChevronRight } from '@/components/kit/icons';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

const RIPPLE = { color: withAlpha(colors.text, 0.12) };

function TitleBlock({
  title,
  subtitle,
  strong,
  accent,
  wrap = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  strong?: boolean;
  accent?: boolean;
  wrap?: boolean;
}) {
  return (
    <View className="min-w-0 flex-1 basis-0 gap-0.5">
      <Text variant="bodyL" weight={strong || accent ? '500' : undefined} tone={accent ? 'accent' : undefined}>
        {title}
      </Text>
      {subtitle != null ? (
        <Text variant="label" tone="secondary" relaxed={wrap} clamp={!wrap}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Leading avatar, title, secondary line, chevron. `href` opens an outside page in the browser; with neither
 * `onPress` nor `href` it is a plain row with no chevron. The subtitle is one line unless `wrap`.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  onPress,
  href,
  trailing,
  tone,
  wrap,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onPress?: () => void;
  href?: string;
  trailing?: React.ReactNode;
  tone?: 'accent';
  wrap?: boolean;
}) {
  const tappable = !!(onPress || href);
  const className = 'min-h-[60px] w-full flex-row items-center gap-3.5 px-5 py-2';
  const body = (
    <>
      {leading}
      <TitleBlock title={title} subtitle={subtitle} accent={tone === 'accent'} wrap={!!wrap} />
      {trailing !== undefined ? trailing : tappable ? <ChevronRight color={colors.text2} /> : null}
    </>
  );
  if (!tappable) return <View className={className}>{body}</View>;
  return (
    <Pressable
      role={href ? 'link' : 'button'}
      onPress={href ? () => void Linking.openURL(href) : onPress}
      android_ripple={RIPPLE}
      className={className}
    >
      {body}
    </Pressable>
  );
}

/** Title, secondary line, and a trailing status: a green check and `okLabel` when `ok`, else `action`. */
export function StatusRow({
  title,
  subtitle,
  ok,
  okLabel = 'On',
  action,
}: {
  title: string;
  subtitle?: string;
  ok: boolean;
  okLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="min-h-[72px] flex-row items-center gap-3 px-4 py-3">
      <TitleBlock title={title} subtitle={subtitle} strong />
      {ok ? (
        <View className="shrink-0 flex-row items-center gap-1.5">
          <Check size={18} color={colors.ok} />
          <Text weight="500" tone="ok">
            {okLabel}
          </Text>
        </View>
      ) : (
        action
      )}
    </View>
  );
}

/** Row with a square checkbox at the end; the whole row toggles (Griddle, Oven on Setup). */
export function CheckRow({
  leading,
  title,
  subtitle,
  checked,
  onChange,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={title}
      onPress={() => onChange(!checked)}
      android_ripple={RIPPLE}
      className="min-h-[76px] w-full flex-row items-center gap-3.5 px-4 py-3"
    >
      {leading}
      <TitleBlock title={title} subtitle={subtitle} strong />
      <View
        className={cn(
          'h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border-2',
          checked ? 'border-ember bg-ember' : 'border-outline-2',
        )}
      >
        {checked ? <Check size={22} color={colors.onAccent} /> : null}
      </View>
    </Pressable>
  );
}
