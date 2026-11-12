// Button (React Native Reusables `button`, rewritten for the Pit Planner tokens): the four kinds of the
// 0.2.0 kit (legacy/src/ui/ui.css `.btn-*`). Android ripple on press, 48 dp minimum touch height.
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable } from 'react-native';
import { TextContext, type TextTone, type TextVariant, type TextWeight } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

const buttonVariants = cva('flex-row items-center justify-center gap-2 overflow-hidden', {
  variants: {
    kind: {
      primary: 'min-h-[56px] rounded-primary bg-primary px-6',
      outline: 'min-h-[48px] rounded-pill border border-outline px-5',
      tonal: 'min-h-[48px] rounded-pill bg-ember-container px-[18px]',
      text: 'min-h-[48px] rounded-pill px-3',
    },
    block: { true: 'w-full', false: 'self-start' },
  },
  defaultVariants: { kind: 'primary', block: false },
});

type Kind = NonNullable<VariantProps<typeof buttonVariants>['kind']>;

/** Label type per kind (ui.css: primary 17/500, outline and text 15, tonal 14/500, text 400). */
const LABEL: Record<Kind, { variant: TextVariant; weight: TextWeight; tone: TextTone }> = {
  primary: { variant: 'tile', weight: '500', tone: 'onAccent' },
  outline: { variant: 'bodyM', weight: '500', tone: 'primary' },
  tonal: { variant: 'body', weight: '500', tone: 'onAccentContainer' },
  text: { variant: 'bodyM', weight: '400', tone: 'accent' },
};

const RIPPLE: Record<Kind, string> = {
  primary: withAlpha(colors.onAccent, 0.16),
  outline: withAlpha(colors.text, 0.12),
  tonal: withAlpha(colors.onAccentContainer, 0.16),
  text: withAlpha(colors.accent, 0.16),
};

type ButtonProps = React.ComponentProps<typeof Pressable> & VariantProps<typeof buttonVariants>;

function Button({ className, kind, block, disabled, ...props }: ButtonProps) {
  const k = kind ?? 'primary';
  return (
    <TextContext.Provider value={LABEL[k]}>
      <Pressable
        className={cn(buttonVariants({ kind: k, block }), disabled && 'opacity-50', className)}
        android_ripple={{ color: RIPPLE[k] }}
        role="button"
        disabled={disabled}
        {...props}
      />
    </TextContext.Provider>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
