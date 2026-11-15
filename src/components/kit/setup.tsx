// Setup and picker pieces (legacy/src/ui/components.tsx SetupPage, SetupActions, OptionCard, DashedButton,
// PickRow; sizes from ui.css): the first-run page with its step bar and pinned actions, the smoker card that
// selects itself, the dashed "add" button and the plain picker row.
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from '@/components/kit/icons';
import { FooterScroll } from '@/components/kit/sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

const RIPPLE = { color: withAlpha(colors.text, 0.12) };
const EDGES = ['top', 'bottom'] as const;

/**
 * One page of first-run setup: a bar with one segment per step (lit up to this one), the title, an intro
 * line, the page's content and its actions pinned at the bottom (ui.css `.setup-*`: 20 dp sides, 16 dp
 * between blocks).
 */
export function SetupPage({
  step,
  steps,
  title,
  intro,
  footer,
  children,
}: {
  step: number;
  steps: number;
  title: string;
  intro?: React.ReactNode;
  footer: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={EDGES} className="flex-1 bg-bg">
      <View
        role="progressbar"
        accessible
        aria-label={`Step ${step} of ${steps}`}
        aria-valuemin={1}
        aria-valuemax={steps}
        aria-valuenow={step}
        className="shrink-0 flex-row gap-1.5 px-5 pb-5 pt-8"
      >
        {Array.from({ length: steps }, (_, i) => (
          <View
            key={i}
            testID={i < step ? 'setup-step-on' : 'setup-step-off'}
            className={cn('h-1 flex-1 rounded-[2px]', i < step ? 'bg-ember' : 'bg-surface-3')}
          />
        ))}
      </View>
      <FooterScroll fill fadeTo="bg" footer={footer} contentClassName="gap-4 px-5">
        <Text variant="display" role="heading">
          {title}
        </Text>
        {intro != null ? (
          <View className="-mt-1 mb-2">
            <Text variant="bodyM" tone="secondary">
              {intro}
            </Text>
          </View>
        ) : null}
        {children}
      </FooterScroll>
    </SafeAreaView>
  );
}

/** Back and the main action at the bottom of a setup page (1:2 widths). No Back on the first page. */
export function SetupActions({
  onBack,
  next,
  onNext,
  disabled,
}: {
  onBack?: () => void;
  next: string;
  onNext: () => void;
  disabled?: boolean;
}) {
  return (
    <View className="min-w-0 flex-1 flex-row gap-3 px-1 pb-1">
      {onBack ? (
        <Button kind="outline" onPress={onBack} className="min-h-[56px] flex-1 basis-0 self-auto rounded-primary">
          <Text variant="tile">Back</Text>
        </Button>
      ) : null}
      <Button onPress={onNext} disabled={disabled} className="min-w-0 flex-[2] basis-0 self-auto">
        <Text>{next}</Text>
      </Button>
    </View>
  );
}

/**
 * Card whose header selects it (a round check; accent border while selected) over a body of its settings
 * (Setup's smoker). The body stays while there is one, selected or not, so turning the card off moves
 * nothing under it.
 */
export function OptionCard({
  selected,
  leading,
  title,
  subtitle,
  onToggle,
  children,
}: {
  selected: boolean;
  leading?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View
      className={cn(
        'shrink-0 overflow-hidden rounded-card border-2 bg-surface',
        selected ? 'border-ember' : 'border-transparent',
      )}
    >
      <Pressable
        role="checkbox"
        aria-checked={selected}
        aria-label={title}
        onPress={onToggle}
        android_ripple={RIPPLE}
        className="min-h-[72px] w-full flex-row items-center gap-3.5 px-4 py-3.5"
      >
        {leading}
        <View className="min-w-0 flex-1 basis-0 gap-0.5">
          <Text variant="bodyL" weight="500">
            {title}
          </Text>
          {subtitle != null ? (
            <Text variant="label" tone="secondary" relaxed>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View
          className={cn(
            'h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2',
            selected ? 'border-ember bg-ember' : 'border-outline-2',
          )}
        >
          {selected ? <Check size={16} color={colors.onAccent} /> : null}
        </View>
      </Pressable>
      {children ? <View className="gap-4 px-4 pb-4">{children}</View> : null}
    </View>
  );
}

/** Dashed full-width button for "add" and "enter it yourself" actions (ui.css `.btn-dashed`). */
export function DashedButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      android_ripple={RIPPLE}
      className="min-h-[48px] w-full shrink-0 items-center justify-center overflow-hidden rounded-pill border border-dashed border-outline-2 px-5 py-2"
    >
      <Text variant="bodyM" tone="soft" center>
        {label}
      </Text>
    </Pressable>
  );
}

/** Plain picker row: a name, with a tint and an accent check when it is the chosen one (smoker picker). */
export function PickRow({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      role="option"
      aria-selected={!!selected}
      aria-label={label}
      onPress={onPress}
      android_ripple={RIPPLE}
      className={cn('min-h-[48px] w-full flex-row items-center gap-3 px-5 py-2', selected && 'bg-ember-soft')}
    >
      <View className="min-w-0 flex-1 basis-0">
        <Text variant="bodyL">{label}</Text>
      </View>
      {selected ? <Check size={22} color={colors.accent} /> : null}
    </Pressable>
  );
}
