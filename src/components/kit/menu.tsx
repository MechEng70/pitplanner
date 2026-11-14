// Dropdown menu (legacy/src/ui/components.tsx Menu and MenuRow; ui.css `.menu`): a darker scrim over the
// screen, the opened field drawn again over the one that opened it, and under it a list as wide as the field
// with an optional intro line and footer. It closes from the scrim, a tap on the field, or Android back.
// Like the Sheet it is a React Native Modal (D-4), so it covers the tab bar and the status bar.
import * as React from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

/** Where the field that opens the menu is, in window coordinates (dp), from `measureInWindow`. */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const RIPPLE = { color: withAlpha(colors.text, 0.12) };
/** ui.css: the list starts 8 dp under the field and stops 16 dp above the bottom inset. */
const GAP = 8;
const END_GAP = 16;

export function Menu({
  anchor,
  onClose,
  field,
  intro,
  footer,
  startRow,
  rowCount,
  children,
}: {
  anchor: Anchor;
  onClose: () => void;
  field: React.ReactNode;
  intro?: React.ReactNode;
  footer?: React.ReactNode;
  /** With `rowCount`: the list opens scrolled so this row (0-based) is the first one showing. */
  startRow?: number;
  rowCount?: number;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = React.useRef<ScrollViewInstance>(null);
  const placed = React.useRef<string | null>(null);
  const top = anchor.y + anchor.height + GAP;
  const fieldAt = React.useMemo(
    () => ({ top: anchor.y, left: anchor.x, width: anchor.width }),
    [anchor.y, anchor.x, anchor.width],
  );
  const menuAt = React.useMemo(
    () => ({ top, left: anchor.x, width: anchor.width, maxHeight: height - top - END_GAP - insets.bottom }),
    [top, anchor.x, anchor.width, height, insets.bottom],
  );
  // The rows are equal height, so the content height over the row count is one row. Placed once per list
  // (the key changes when the list does, as with Show all), never while the user scrolls.
  const place = (_w: number, contentHeight: number) => {
    const key = `${startRow}/${rowCount}`;
    if (startRow == null || !rowCount || placed.current === key) return;
    placed.current = key;
    list.current?.scrollTo({ y: Math.max(0, (contentHeight / rowCount) * startRow), animated: false });
  };

  return (
    <Modal
      testID="menu-modal"
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1">
        <Pressable className="flex-1 bg-scrim-menu" aria-label="Close menu" onPress={onClose} />
        <View testID="menu-anchor" className="absolute" style={fieldAt}>
          {field}
        </View>
        <View testID="menu" className="absolute overflow-hidden rounded-control bg-surface-2" style={menuAt}>
          {intro != null ? (
            <View className="shrink-0 px-4 pb-1.5 pt-2.5">
              <Text variant="caption" tone="secondary">
                {intro}
              </Text>
            </View>
          ) : null}
          <ScrollView ref={list} className="shrink" onContentSizeChange={place}>
            {children}
          </ScrollView>
          {footer != null ? <View className="shrink-0 border-t border-divider">{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/** One choice: a check when selected, the label, and what choosing it does at the end of the row. */
export function MenuRow({
  selected,
  label,
  trailing,
  check,
  onPress,
}: {
  selected?: boolean;
  label: React.ReactNode;
  trailing?: React.ReactNode;
  check?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      role="option"
      aria-selected={!!selected}
      onPress={onPress}
      android_ripple={RIPPLE}
      className={cn('min-h-[48px] w-full flex-row items-center gap-2 px-4 py-1', selected && 'bg-ember-soft')}
    >
      <View className="w-[26px] shrink-0">{selected ? check : null}</View>
      <View className="min-w-0 flex-1">
        <Text variant="bodyL" weight={selected ? '500' : undefined}>
          {label}
        </Text>
      </View>
      {trailing != null ? (
        <Text variant="label" tone="secondary">
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}
