// Bottom navigation (legacy/src/ui/components.tsx BottomNav; ui.css `.bottom-nav`, `.nav-item`, `.nav-pill`):
// three equal columns, each an icon in a 64x32 pill over a 12 dp label. The open tab's pill is the accent
// container with the icon in accent-hi and its label in primary text, medium. Items are at least 80 dp tall
// and grow with the font size, never cut; the bar pads itself by the bottom safe-area inset.
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconColor } from '@/components/kit/icons';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const RIPPLE = { color: withAlpha(colors.text, 0.12), borderless: false };

export function BottomNav({
  items,
  value,
  onChange,
}: {
  items: NavItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const pad = React.useMemo(() => ({ paddingBottom: insets.bottom }), [insets.bottom]);
  return (
    <View role="tablist" aria-label="Main" className="flex-row bg-nav" style={pad}>
      {items.map(it => {
        const on = it.id === value;
        return (
          <Pressable
            key={it.id}
            role="tab"
            aria-label={it.label}
            aria-selected={on}
            onPress={() => onChange(it.id)}
            android_ripple={RIPPLE}
            className="min-h-20 flex-1 basis-0 items-center justify-center gap-1 py-2"
          >
            <View
              className={cn(
                'h-8 w-16 items-center justify-center overflow-hidden rounded-control',
                on && 'bg-ember-container',
              )}
            >
              <IconColor.Provider value={on ? colors.accentHi : colors.text2}>{it.icon}</IconColor.Provider>
            </View>
            <Text
              variant="caption"
              weight={on ? '500' : '400'}
              tone={on ? 'primary' : 'secondary'}
              className="text-center"
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
