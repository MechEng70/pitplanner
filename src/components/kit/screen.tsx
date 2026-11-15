// Screen frame (legacy/src/ui/components.tsx "Screen" and "AppBar"; sizes from ui.css): the title bar with
// its actions, a scrolling body (16 dp sides, 12 dp between blocks) and an optional footer pinned over the
// end of the body behind a fade. The tab bar below is the tabs layout's.
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FooterScroll } from '@/components/kit/sheet';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const TOP = ['top'] as const;

/**
 * 64 dp title bar: the title on the left, icon buttons (or a status chip) on the right. With a `subtitle`
 * (Cooking: "Smoker 225F, serve 5:00 PM") the line sits under the title and the actions stay at the top.
 */
export function AppBar({
  title,
  subtitle,
  overline,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  /** Accent line above the title (Cook finished: the day of the cook). */
  overline?: string;
  actions?: React.ReactNode;
}) {
  const sub = subtitle != null || overline != null;
  return (
    <View
      className={cn(
        'min-h-[64px] shrink-0 flex-row justify-between gap-2 pl-5 pr-2',
        sub ? 'items-start py-2' : 'items-center',
      )}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        {overline != null ? (
          <Text variant="overline" tone="accentHi" className="uppercase">
            {overline}
          </Text>
        ) : null}
        <Text variant="title" role="heading">
          {title}
        </Text>
        {subtitle != null ? (
          <Text variant="bodyM" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions != null ? <View className="min-h-[48px] shrink-0 flex-row items-center">{actions}</View> : null}
    </View>
  );
}

export function Screen({
  title,
  subtitle,
  overline,
  actions,
  footer,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  overline?: string;
  actions?: React.ReactNode;
  /** Pinned at the bottom (Start cook); the body scrolls under it. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={TOP} className="flex-1 bg-bg">
      <AppBar title={title} subtitle={subtitle} overline={overline} actions={actions} />
      <FooterScroll fill fadeTo="bg" footer={footer} contentClassName="gap-3 px-4">
        {children}
      </FooterScroll>
    </SafeAreaView>
  );
}
