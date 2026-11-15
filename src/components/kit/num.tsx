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

/** A time ("5:30 PM") or one part of a duration ("1 hr", "45 min", "2 days") inside a sentence. */
const VALUE = /(\d{1,2}:\d{2} [AP]M|\d+ (?:days?|hr|min))/;

/**
 * A sentence built by the pure view code ("Brisket hold drops from 1 hr to 30 min. Still OK."), with each
 * time and duration in it as a Num, so none breaks across lines. Goes inside a Text and takes its type and tone.
 */
export function Nums({ text }: { text: string }) {
  return <>{text.split(VALUE).map((part, i) => (i % 2 ? <Num key={i}>{part}</Num> : part))}</>;
}

const styles = StyleSheet.create({ num: { fontVariant: ['tabular-nums'] } });
