// Text input with a label above and an optional note below (legacy/src/ui/components.tsx InputField; ui.css
// `.input`): 52 dp tall, 16 dp radius, outline border that turns 2 dp accent on a darker fill while focused.
// The label is also the input's accessibility label, so tests and Maestro flows find the field by it.
import * as React from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { useReveal } from '@/components/kit/sheet';
import { textStyle, Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

export function InputField({
  label,
  value,
  onInput,
  numeric,
  placeholder,
  note,
}: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
  note?: React.ReactNode;
}) {
  const [focused, setFocused] = React.useState(false);
  const ref = React.useRef<TextInputInstance>(null);
  const reveal = useReveal();
  return (
    <View className="gap-2">
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <TextInput
        aria-label={label}
        value={value}
        onChangeText={onInput}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        ref={ref}
        onFocus={() => {
          setFocused(true);
          reveal(ref.current);
        }}
        onBlur={() => setFocused(false)}
        style={[styles.input, numeric && styles.num, focused ? styles.focused : styles.idle]}
      />
      {note != null ? (
        <Text variant="caption" tone="secondary" relaxed>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    ...textStyle('select', '400'),
    minHeight: 52,
    borderRadius: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  num: { fontVariant: ['tabular-nums'] },
  idle: { borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 16 },
  focused: { borderWidth: 2, borderColor: colors.accent, paddingHorizontal: 15, backgroundColor: colors.fieldOpen },
});
