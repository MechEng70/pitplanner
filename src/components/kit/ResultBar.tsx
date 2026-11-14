// Result bar (T-019; Jason, 2026-11-12): the plan's answer for one food in a strip pinned above the sheet's
// buttons, so it shows while any control is changed without the screen scrolling to it. One line of caption
// and one line of tabular digits per cell, in equal parts: its height and the cells' places do not change
// with the values (T-017 PR-3). The whole bar is one button; a tap asks for the full result card.
import { Pressable, View } from 'react-native';
import { Num } from '@/components/kit/num';
import { Text } from '@/components/ui/text';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

const RIPPLE = { color: withAlpha(colors.text, 0.12) };

export interface ResultCell {
  label: string;
  value: string;
}

export function ResultBar({ cells, onPress }: { cells: ResultCell[]; onPress: () => void }) {
  return (
    <Pressable
      testID="result-bar"
      role="button"
      aria-label={cells.map(c => `${c.label} ${c.value}`).join(', ')}
      onPress={onPress}
      android_ripple={RIPPLE}
      className="min-h-[48px] w-full shrink-0 flex-row items-center overflow-hidden rounded-control bg-result px-3 py-1.5"
    >
      {cells.map(c => (
        <View key={c.label} className="min-w-0 flex-1 basis-0 items-center">
          <Text variant="caption" tone="secondary" clamp>
            {c.label}
          </Text>
          <Num variant="bodyM" weight="500">
            {c.value}
          </Num>
        </View>
      ))}
    </Pressable>
  );
}
