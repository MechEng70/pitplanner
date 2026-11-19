// Controls (legacy/src/ui/components.tsx "Buttons" and "Inputs"; sizes from ui.css): icon button, chips,
// segmented, stepper, field. Every target is at least 48 dp. Accessibility roles and labels are the legacy
// kit's (radiogroup/radio, group, "Less x"/"More x"), so tests and Maestro flows find them the same way.
import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Minus, Plus } from '@/components/kit/icons';
import { Num } from '@/components/kit/num';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { chipHintSize, colors, lineHeightRatio } from '@/theme/tokens';

const RIPPLE = { color: withAlpha(colors.text, 0.12) };

/** 48 dp round icon button. `bleed` keeps the 48 dp target but takes no extra height in a tight row. */
export function IconButton({
  label,
  onPress,
  bleed,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  bleed?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={!!disabled}
      disabled={disabled}
      onPress={onPress}
      android_ripple={RIPPLE}
      className={cn(
        'h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-pill',
        bleed && '-my-2.5 -mr-2.5',
        disabled && 'opacity-50',
      )}
    >
      {children}
    </Pressable>
  );
}

export interface ChipOpt {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

/**
 * Single-select chips. The pill is 40 dp (28 dp when `small`) inside a 48 dp touch target; the press shade
 * sits on the pill, not the target (ui.css .chip-hit). `scroll` keeps them on one line that scrolls sideways.
 * A chip is as wide as its label needs in either weight: a label is never cut off, at any font scale.
 */
export function Chips({
  options,
  value,
  onChange,
  label,
  small,
  scroll,
}: {
  options: ChipOpt[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  small?: boolean;
  scroll?: boolean;
}) {
  const chips = options.map(o => {
    const on = o.id === value;
    return (
      <Pressable
        key={o.id}
        role="radio"
        aria-checked={on}
        aria-label={o.label}
        aria-disabled={!!o.disabled}
        disabled={o.disabled}
        onPress={() => onChange(o.id)}
        className="min-h-[48px] shrink-0 justify-center"
      >
        {({ pressed }) => (
          <View
            className={cn(
              'justify-center overflow-hidden border',
              small ? 'min-h-[28px] rounded-inset px-2.5' : 'min-h-[40px] rounded-card px-3.5',
              on ? 'border-transparent bg-ember-container' : 'border-outline',
              o.disabled && 'border-dashed',
            )}
          >
            {/* The selected label is medium weight. Unseen copies in both weights size every chip,
                selected or not, so selecting one moves nothing (T-017 PR-3) and no label is cut off:
                neither weight is always the wider (in Roboto the regular "Kamado" is wider than the
                medium one, and at 115% the chip read "Kamad"). The regular copy adds width only. */}
            <View>
              <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.unseen}>
                <Text variant={small ? 'caption' : 'body'} weight="500">
                  {o.label}
                </Text>
                <View style={styles.widthOnly}>
                  <Text variant={small ? 'caption' : 'body'} weight="400">
                    {o.label}
                  </Text>
                </View>
              </View>
              <View style={styles.over}>
                <Text
                  center
                  variant={small ? 'caption' : 'body'}
                  weight={on ? '500' : '400'}
                  tone={o.disabled ? 'tertiary' : on ? 'onAccentContainer' : 'soft'}
                >
                  {o.label}
                </Text>
              </View>
            </View>
            {o.hint ? (
              <Text tone="tertiary" weight="400" style={styles.hint}>
                {o.hint}
              </Text>
            ) : null}
            {pressed && !o.disabled ? <View style={styles.pressed} /> : null}
          </View>
        )}
      </Pressable>
    );
  });
  if (scroll)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        role="radiogroup"
        aria-label={label}
        className="-mx-4 shrink-0 grow-0"
        contentContainerClassName="gap-x-2 px-4"
      >
        {chips}
      </ScrollView>
    );
  return (
    <View
      role="radiogroup"
      aria-label={label}
      className={cn('flex-row flex-wrap gap-x-2', small ? '-my-2.5' : '-my-1')}
    >
      {chips}
    </View>
  );
}

/** A segment's side padding (ui.css .segmented: 8 px) and the divider on every segment but the first. */
const SEG_PAD = 8;
const SEG_DIVIDER = 1;

/**
 * Which segments need a width of their own so that every label is whole, and the side padding that goes
 * with it. `labels` are the labels' own widths (as the phone measured them), `row` the whole control's
 * width, both in dp. A segment's need is its label, rounded up, plus padding and divider. While every need
 * fits an equal share, no segment is fixed (`null`: they share the row equally, as ui.css has it). A segment
 * that needs more than its share is fixed at what it needs, and the others share what is left; that can
 * leave another one short, which is then fixed too. The padding is the full 8 dp unless the labels with it
 * are wider than the control; then it gives way, down to none, before any label does.
 */
export function segmentFit(labels: number[], row: number): { pad: number; width: (number | null)[] } {
  const text = labels.map(w => Math.ceil(w));
  const n = text.length;
  // Inside the control's own 1 dp border either side.
  const inner = row - 2;
  const room = inner - (n - 1) * SEG_DIVIDER - text.reduce((a, w) => a + w, 0);
  const pad = Math.max(0, Math.min(SEG_PAD, Math.floor(room / (2 * n))));
  const need = text.map((w, i) => w + 2 * pad + (i > 0 ? SEG_DIVIDER : 0));
  const width: (number | null)[] = need.map(() => null);
  let free = inner;
  let open = n;
  while (open > 0) {
    const share = free / open;
    const short = need.map((w, i) => (width[i] === null && w > share ? i : -1)).filter(i => i >= 0);
    if (short.length === 0) break;
    for (const i of short) {
      width[i] = need[i]!;
      free -= need[i]!;
      open -= 1;
    }
  }
  return { pad, width };
}

/**
 * Joined buttons, one selected (ui.css .segmented). Segments are equal in width while every label fits.
 * No label ever breaks or is cut, at any font scale (Jason, 2026-11-19; T-082: "Other" broke onto two lines
 * on Setup's smoker card at 115%): a label that needs more than an equal share gets a width of its own and
 * the others share what is left (`segmentFit`). The labels are measured by unseen copies in both weights
 * (the selected label is medium, and neither weight is always the wider). A minimum width alone does not do
 * this: React Native's layout adds each segment's minimum to an equal share, so segments with different
 * labels would never be equal.
 */
export function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: ChipOpt[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const [row, setRow] = React.useState(0);
  const [sizes, setSizes] = React.useState<Record<string, number>>({});
  const labels = options.map(o => sizes[o.id]);
  const fit = row > 0 && labels.every((w): w is number => w != null) ? segmentFit(labels as number[], row) : null;
  return (
    <View
      role="radiogroup"
      aria-label={label}
      onLayout={e => setRow(e.nativeEvent.layout.width)}
      className="min-h-[48px] flex-row overflow-hidden rounded-pill border border-outline"
    >
      <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.measure}>
        {options.map(o => (
          <View
            key={o.id}
            testID={`segment-size-${o.id}`}
            onLayout={e => {
              const w = e.nativeEvent.layout.width;
              setSizes(old => (old[o.id] === w ? old : { ...old, [o.id]: w }));
            }}
          >
            <Text weight="500">{o.label}</Text>
            <View style={styles.widthOnly}>
              <Text weight="400">{o.label}</Text>
            </View>
          </View>
        ))}
      </View>
      {options.map((o, i) => {
        const on = o.id === value;
        const own = fit ? fit.width[i] : null;
        return (
          <Pressable
            key={o.id}
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            aria-disabled={!!o.disabled}
            disabled={o.disabled}
            onPress={() => onChange(o.id)}
            android_ripple={RIPPLE}
            className={cn('items-center justify-center py-1', i > 0 && 'border-l border-outline', on && 'bg-ember')}
            // Sized by `width`, never `flexBasis`: React Native keeps the flex basis it worked out on the first
            // render, so a basis set after the labels are measured does nothing (seen on the emulator: the
            // segment with its own width stayed as narrow as its padding).
            style={StyleSheet.flatten([
              own == null ? styles.shareRow : styles.ownWidth,
              own == null ? null : { width: own },
              { paddingHorizontal: fit ? fit.pad : SEG_PAD },
            ])}
          >
            <Text center weight={on ? '500' : '400'} tone={o.disabled ? 'tertiary' : on ? 'onAccent' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={!!disabled}
      disabled={disabled}
      onPress={onPress}
      android_ripple={RIPPLE}
      className={cn(
        'h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-pill border border-outline',
        disabled && 'opacity-35',
      )}
    >
      {children}
    </Pressable>
  );
}

/**
 * Minus, value, plus. The buttons sit at the ends and the value is a tabular Num centered between them, so
 * a tap never moves the button under the finger (T-017 PR-3). The buttons are read "Less {label}" and
 * "More {label}" unless they are given their own names (decLabel, incLabel).
 */
export function Stepper({
  value,
  unit,
  label,
  decLabel,
  incLabel,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}: {
  value: string;
  unit?: string;
  label: string;
  decLabel?: string;
  incLabel?: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
}) {
  const name = label.toLowerCase();
  return (
    <View
      role="group"
      aria-label={label}
      className="flex-row items-center justify-between gap-2 rounded-control bg-bg p-1.5"
    >
      <StepButton label={decLabel ?? `Less ${name}`} disabled={decDisabled} onPress={onDec}>
        <Minus />
      </StepButton>
      <View className="min-w-0 flex-1 items-center">
        <Text variant="value" center>
          <Num>{value}</Num>
          {unit ? (
            <Text variant="bodyM" tone="secondary">
              {` ${unit}`}
            </Text>
          ) : null}
        </Text>
      </View>
      <StepButton label={incLabel ?? `More ${name}`} disabled={incDisabled} onPress={onInc}>
        <Plus />
      </StepButton>
    </View>
  );
}

export interface Choice {
  id: string;
  /** A Text (it may hold a Num); it takes the card's type. */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}

/**
 * Two or three cards side by side, one selected (ui.css .choice-cards; Keep serve / Move serve, mockup 13).
 * A card is at least 130 dp wide and they share the row; when they no longer fit (large font) they stack.
 * The text wraps, it is never cut.
 */
export function ChoiceCards({
  options,
  value,
  onChange,
  label,
}: {
  options: Choice[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <View role="radiogroup" aria-label={label} className="flex-row flex-wrap gap-2">
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            role="radio"
            aria-checked={on}
            onPress={() => onChange(o.id)}
            android_ripple={RIPPLE}
            className={cn(
              'min-h-[64px] shrink-0 grow basis-[130px] items-center justify-center gap-0.5 overflow-hidden rounded-control',
              // The selected border is 1 dp thicker; the padding gives that back so nothing moves.
              on ? 'border-2 border-ember bg-ember-soft px-[9px] py-[7px]' : 'border border-outline px-2.5 py-2',
            )}
          >
            <Text variant="bodyM" center>
              {o.title}
            </Text>
            {o.subtitle != null ? (
              <Text variant="label" tone="secondary" center>
                {o.subtitle}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A field that opens a menu (ui.css .select): caption, value, and anything `trailing` before the edge
 * (Plan's smoker temp shows the fire time and a chevron). Without `onPress` it is a read-only field with the
 * same look. `open` is the menu showing: accent border and caption.
 */
export function SelectField({
  label,
  value,
  trailing,
  open,
  onPress,
}: {
  label: string;
  value: React.ReactNode;
  trailing?: React.ReactNode;
  open?: boolean;
  onPress?: () => void;
}) {
  const className = cn(
    'min-h-[60px] w-full shrink-0 flex-row items-center gap-2.5 overflow-hidden rounded-control',
    open ? 'border-2 border-ember bg-field px-[15px] py-[7px]' : 'border border-outline px-4 py-2',
  );
  const body = (
    <>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="caption" tone={open ? 'accent' : 'secondary'}>
          {label}
        </Text>
        <Text variant="select">{value}</Text>
      </View>
      {trailing}
    </>
  );
  if (!onPress) return <View className={className}>{body}</View>;
  return (
    <Pressable
      className={className}
      onPress={onPress}
      role="button"
      aria-label={label}
      aria-expanded={!!open}
      android_ripple={RIPPLE}
    >
      {body}
    </Pressable>
  );
}

/** Label above a control, optional note below. */
export function Field({ label, note, children }: { label: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      {children}
      {note != null ? (
        <Text variant="caption" tone="secondary" relaxed>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  unseen: { opacity: 0 },
  widthOnly: { height: 0, overflow: 'hidden' },
  // A segment shares the row equally with the other free ones (ui.css .segmented button: flex 1 1 0), or has
  // a width of its own (segmentFit) and neither grows nor shrinks.
  shareRow: { flexGrow: 1, flexShrink: 1, width: 0 },
  ownWidth: { flexGrow: 0, flexShrink: 0 },
  // Off to the side and unseen: its children lie in a row at their own widths, however narrow the control is.
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 9999,
    flexDirection: 'row',
    opacity: 0,
    pointerEvents: 'none',
  },
  // The label's own box is the chip's full width, so its bounds do not change with its weight either.
  over: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  hint: { fontSize: chipHintSize, lineHeight: Math.round(chipHintSize * lineHeightRatio) },
  pressed: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(colors.text, 0.08), pointerEvents: 'none' },
});
