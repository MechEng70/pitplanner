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
            {/* The selected label is medium weight and wider. An unseen copy in that weight sizes every
                chip, selected or not, so selecting one moves nothing (T-017 PR-3). */}
            <View>
              <View aria-hidden importantForAccessibility="no-hide-descendants" style={styles.unseen}>
                <Text variant={small ? 'caption' : 'body'} weight="500">
                  {o.label}
                </Text>
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

/** Joined buttons, one selected (ui.css .segmented). */
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
  return (
    <View
      role="radiogroup"
      aria-label={label}
      className="min-h-[48px] flex-row overflow-hidden rounded-pill border border-outline"
    >
      {options.map((o, i) => {
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
            android_ripple={RIPPLE}
            className={cn(
              'flex-1 basis-0 items-center justify-center px-2 py-1',
              i > 0 && 'border-l border-outline',
              on && 'bg-ember',
            )}
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
 * a tap never moves the button under the finger (T-017 PR-3).
 */
export function Stepper({
  value,
  unit,
  label,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}: {
  value: string;
  unit?: string;
  label: string;
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
      <StepButton label={`Less ${name}`} disabled={decDisabled} onPress={onDec}>
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
      <StepButton label={`More ${name}`} disabled={incDisabled} onPress={onInc}>
        <Plus />
      </StepButton>
    </View>
  );
}

/** Label above a control, optional note below. */
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
    open ? 'border-2 border-ember bg-field-open px-[15px] py-[7px]' : 'border border-outline px-4 py-2',
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
  // The label's own box is the chip's full width, so its bounds do not change with its weight either.
  over: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  hint: { fontSize: chipHintSize, lineHeight: Math.round(chipHintSize * lineHeightRatio) },
  pressed: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(colors.text, 0.08), pointerEvents: 'none' },
});
