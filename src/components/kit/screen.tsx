// Screen frame (legacy/src/ui/components.tsx "Screen" and "AppBar"; sizes from ui.css): the title bar with
// its actions, a scrolling body (16 dp sides, 12 dp between blocks) and an optional footer pinned over the
// end of the body behind a fade. The tab bar below is the tabs layout's.
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FooterScroll } from '@/components/kit/sheet';
import { Text } from '@/components/ui/text';

const TOP = ['top'] as const;

/** 64 dp title bar: the title on the left, icon buttons on the right. */
export function AppBar({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <View className="min-h-[64px] shrink-0 flex-row items-center justify-between gap-2 pl-5 pr-2">
      <Text variant="title" role="heading" className="min-w-0 shrink">
        {title}
      </Text>
      {actions != null ? <View className="shrink-0 flex-row items-center">{actions}</View> : null}
    </View>
  );
}

export function Screen({
  title,
  actions,
  footer,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  /** Pinned at the bottom (Start cook); the body scrolls under it. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={TOP} className="flex-1 bg-bg">
      <AppBar title={title} actions={actions} />
      <FooterScroll fill fadeTo="bg" footer={footer} contentClassName="gap-3 px-4">
        {children}
      </FooterScroll>
    </SafeAreaView>
  );
}
