// Screen frame (legacy/src/ui/components.tsx "Screen" and "AppBar"; sizes from ui.css): the title bar with
// its actions, a scrolling body (16 dp sides, 12 dp between blocks) and an optional footer pinned over the
// end of the body behind a fade. The tab bar below is the tabs layout's.
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@/components/kit/controls';
import { ChevronLeft } from '@/components/kit/icons';
import { FooterScroll } from '@/components/kit/sheet';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const TOP = ['top'] as const;

/**
 * 64 dp title bar: the title on the left, icon buttons (or a status chip) on the right. A `subtitle`
 * (Cooking: "Smoker 225F, serve 5:00 PM") is a full-width line of its own under the title row, so the width
 * of the actions never changes how it wraps: on Live cook a new status (On plan, Ahead, Behind) does not move
 * the banners or Done (T-081, Jason 2026-11-16). With `onBack` (Cook history, mockup 20) a back arrow sits
 * before the title.
 */
export function AppBar({
  title,
  subtitle,
  overline,
  actions,
  onBack,
}: {
  title: string;
  subtitle?: React.ReactNode;
  /** Accent line above the title (Cook finished: the day of the cook). */
  overline?: string;
  actions?: React.ReactNode;
  onBack?: () => void;
}) {
  const sub = subtitle != null || overline != null;
  const row = (
    <View
      className={cn(
        'shrink-0 flex-row justify-between',
        !onBack && 'gap-2',
        // Under a subtitle the title sits level with the actions; an overline alone keeps them at the top.
        overline != null && subtitle == null ? 'items-start' : 'items-center',
      )}
    >
      {onBack ? (
        <IconButton label="Back" onPress={onBack}>
          <ChevronLeft />
        </IconButton>
      ) : null}
      <View className="min-w-0 flex-1 gap-0.5">
        {overline != null ? (
          <Text variant="overline" tone="accentHi" className="uppercase">
            {overline}
          </Text>
        ) : null}
        <Text variant="title" role="heading">
          {title}
        </Text>
      </View>
      {actions != null ? <View className="min-h-[48px] shrink-0 flex-row items-center">{actions}</View> : null}
    </View>
  );
  return (
    <View className={cn('min-h-[64px] shrink-0 pr-2', onBack ? 'pl-2' : 'pl-5', sub ? 'py-2' : 'justify-center')}>
      {row}
      {subtitle != null ? (
        // In line with the title: past the back arrow (48 dp) when there is one.
        <Text variant="bodyM" tone="secondary" className={cn('mt-0.5', onBack && 'pl-12')}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  overline,
  actions,
  onBack,
  footer,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  overline?: string;
  actions?: React.ReactNode;
  /** Shows the back arrow before the title. */
  onBack?: () => void;
  /** Pinned at the bottom (Start cook); the body scrolls under it. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={TOP} className="flex-1 bg-bg">
      <AppBar title={title} subtitle={subtitle} overline={overline} actions={actions} onBack={onBack} />
      <FooterScroll fill fadeTo="bg" footer={footer} contentClassName="gap-3 px-4">
        {children}
      </FooterScroll>
    </SafeAreaView>
  );
}
