// Bottom sheet (D-4: a kit Sheet on React Native Modal; TECH-DESIGN section 13). Ported from the legacy Sheet:
// scrim, handle, title, Close, a scrolling body and an optional footer pinned at the bottom. It slides up on
// open and down before `onClose` runs (Close, a tap on the scrim, or Android back, which the system sends to
// the top Modal, so back closes the top sheet first). `useSheet().close(after)` closes it from inside and
// then runs `after`.
import * as React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/kit/controls';
import { Close } from '@/components/kit/icons';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { colors } from '@/theme/tokens';

export const SHEET_IN_MS = 300;
export const SHEET_OUT_MS = 200;
/** ui.css: the sheet stops 24 dp short of the top; the footer fades in over 14 dp; 16 dp under the content. */
const TOP_GAP = 24;
const FADE = 14;
const BODY_END = 16;

interface SheetCtl {
  close: (after?: () => void) => void;
}
const SheetContext = React.createContext<SheetCtl>({ close: after => after?.() });
/** Inside a Sheet: close it (slide down), then run `after`. */
export const useSheet = () => React.useContext(SheetContext);

/** Vertical fade from transparent to `color`, for the top edge of a pinned footer or the end of a list. */
function Fade({ color, height }: { color: string; height: number }) {
  const id = `fade${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width="100%" height={height} style={styles.noTouch}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * The legacy ScrollWithFooter rule: the footer floats over the bottom of the scroll area behind a fade, and
 * the scroll content gets bottom padding equal to the footer's measured height, so nothing can end up hidden
 * behind it at any font size. Without a footer the content fades out at the bottom edge instead.
 */
const FADE_TO = {
  surface: { color: colors.surface, bg: 'bg-surface' },
  bg: { color: colors.bg, bg: 'bg-bg' },
} as const;

export function FooterScroll({
  footer,
  fadeTo,
  contentClassName,
  children,
}: {
  footer?: React.ReactNode;
  /** The background the content fades into: the sheet's surface or the screen's bg. */
  fadeTo: keyof typeof FADE_TO;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const to = FADE_TO[fadeTo];
  const [footH, setFootH] = React.useState(0);
  const onFootLayout = (e: LayoutChangeEvent) => setFootH(e.nativeEvent.layout.height);
  const pad = React.useMemo(() => ({ paddingBottom: (footer ? footH : 0) + BODY_END }), [footer, footH]);
  return (
    <View className="min-h-0 shrink">
      <ScrollView className="shrink grow-0" contentContainerClassName={contentClassName} contentContainerStyle={pad}>
        {children}
      </ScrollView>
      {footer ? (
        <View onLayout={onFootLayout} style={styles.foot}>
          <Fade color={to.color} height={FADE} />
          <View className={cn('flex-row items-center gap-2 px-4 pb-4 pt-2.5', to.bg)}>{footer}</View>
        </View>
      ) : (
        <View style={[styles.foot, styles.noTouch]}>
          <Fade color={to.color} height={BODY_END + 8} />
        </View>
      )}
    </View>
  );
}

export function Sheet({
  title,
  onClose,
  footer,
  flush,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [shown] = React.useState(() => new Animated.Value(0)); // 0 = off screen, 1 = up
  const [closing, setClosing] = React.useState(false);
  const after = React.useRef<(() => void) | undefined>(undefined);
  const reduceMotion = React.useRef(false);

  React.useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduce => {
        if (!live) return;
        reduceMotion.current = reduce;
        Animated.timing(shown, {
          toValue: 1,
          duration: reduce ? 1 : SHEET_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      live = false;
    };
  }, [shown]);

  const close = React.useCallback((fn?: () => void) => {
    after.current = fn;
    setClosing(true);
  }, []);

  React.useEffect(() => {
    if (!closing) return;
    Animated.timing(shown, {
      toValue: 0,
      duration: reduceMotion.current ? 1 : SHEET_OUT_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      onClose();
      after.current?.();
    }, SHEET_OUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start the close once, when closing begins.
  }, [closing]);

  const ctl = React.useMemo(() => ({ close }), [close]);
  const slide = React.useMemo(
    () => ({ transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }),
    [shown, height],
  );
  const fade = React.useMemo(() => ({ opacity: shown }), [shown]);
  const frame = React.useMemo(
    () => ({ maxHeight: height - insets.top - TOP_GAP, paddingBottom: insets.bottom }),
    [height, insets.top, insets.bottom],
  );

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close()}
    >
      <SheetContext.Provider value={ctl}>
        <View className="flex-1 justify-end">
          <Animated.View style={[StyleSheet.absoluteFill, fade]}>
            <Pressable className="flex-1 bg-scrim" aria-label="Close sheet" onPress={() => close()} />
          </Animated.View>
          <Animated.View role="dialog" aria-modal aria-label={title} style={slide}>
            <View className="overflow-hidden rounded-t-primary bg-surface" style={frame}>
              <View className="items-center pb-1 pt-2.5">
                <View className="h-1 w-8 rounded-full bg-outline-2" />
              </View>
              <View className="flex-row items-center justify-between gap-2 pb-2 pl-5 pr-2 pt-1">
                <Text variant="sheetTitle" role="heading" className="min-w-0 flex-1">
                  {title}
                </Text>
                <IconButton label="Close" onPress={() => close()}>
                  <Close />
                </IconButton>
              </View>
              <FooterScroll footer={footer} fadeTo="surface" contentClassName={cn(flush ? 'gap-0' : 'gap-4 px-4 pt-1')}>
                {children}
              </FooterScroll>
            </View>
          </Animated.View>
        </View>
      </SheetContext.Provider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  noTouch: { pointerEvents: 'none' },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
