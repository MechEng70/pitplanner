// Layout primitives (legacy/src/ui/components.tsx "Layout"): screens arrange the kit with these, never with
// their own classes. Gaps are the ui.css `.gap-*` steps in dp.
import * as React from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';

export type Gap = 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 20 | 24;

// Whole class names (NativeWind only compiles classes it finds written out in the source). 1rem = 16 dp.
const GAP: Record<Gap, string> = {
  0: 'gap-0',
  2: 'gap-0.5',
  4: 'gap-1',
  6: 'gap-1.5',
  8: 'gap-2',
  10: 'gap-2.5',
  12: 'gap-3',
  14: 'gap-3.5',
  16: 'gap-4',
  20: 'gap-5',
  24: 'gap-6',
};
export const gapClass = (g: Gap) => GAP[g];

type Kids = { children?: React.ReactNode };

export function Stack({ gap = 0, grow, center, children }: Kids & { gap?: Gap; grow?: boolean; center?: boolean }) {
  return (
    <View className={cn('min-w-0 flex-col', GAP[gap], grow && 'flex-1', center && 'items-center')}>{children}</View>
  );
}

const JUSTIFY = { between: 'justify-between', end: 'justify-end', center: 'justify-center' } as const;
const ALIGN = { center: 'items-center', baseline: 'items-baseline', start: 'items-start' } as const;

export function Row({
  gap = 0,
  justify,
  align = 'center',
  wrap,
  grow,
  children,
}: Kids & {
  gap?: Gap;
  justify?: keyof typeof JUSTIFY;
  align?: keyof typeof ALIGN;
  wrap?: boolean;
  grow?: boolean;
}) {
  return (
    <View
      className={cn(
        'min-w-0 flex-row',
        GAP[gap],
        justify && JUSTIFY[justify],
        ALIGN[align],
        wrap && 'flex-wrap',
        grow && 'flex-1',
      )}
    >
      {children}
    </View>
  );
}

/** Shrinkable text column next to fixed number columns. */
export const Fill = ({ children }: Kids) => <View className="min-w-0 flex-1 basis-0">{children}</View>;

/** Fixed column for numbers: never shrinks; right-aligned unless `end` is false. */
export const Fixed = ({ children, end = true, gap = 0 }: Kids & { end?: boolean; gap?: Gap }) => (
  <View className={cn('shrink-0 flex-col', GAP[gap], end && 'items-end')}>{children}</View>
);

export const Spacer = () => <View className="flex-1" />;

export const Divider = () => <View role="separator" className="my-1 h-px shrink-0 bg-surface-3" />;
