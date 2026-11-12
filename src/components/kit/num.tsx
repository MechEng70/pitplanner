// Num: a time, temp, weight or countdown with its unit ("6:40 AM", "225F", "12.0 lb", "1 hr 40 min").
// Font scale rule (TECH-DESIGN section 8): it never truncates, shrinks or breaks across lines. Spaces become
// no-break spaces (CSS `white-space: nowrap`), digits are tabular so a changing value keeps its width
// (T-017 PR-3), and the props that would cut it are not accepted (lint rule num-text-size also checks the
// Text around it). Nested in a Text it takes that Text's type and tone.
import { StyleSheet } from 'react-native';
import { Text, type TextProps } from '@/components/ui/text';

type Cut =
  'numberOfLines' | 'adjustsFontSizeToFit' | 'ellipsizeMode' | 'maxFontSizeMultiplier' | 'allowFontScaling' | 'clamp';

export type NumProps = Omit<TextProps, Cut | 'children'> & {
  children: string | number | (string | number)[];
};

const NBSP = '\u00a0';

/** The value as one unbreakable string. */
export function numText(children: NumProps['children']): string {
  return (Array.isArray(children) ? children : [children]).join('').replace(/ /g, NBSP);
}

export function Num({ children, style, ...props }: NumProps) {
  return (
    <Text {...props} style={[styles.num, style]}>
      {numText(children)}
    </Text>
  );
}

const styles = StyleSheet.create({ num: { fontVariant: ['tabular-nums'] } });
