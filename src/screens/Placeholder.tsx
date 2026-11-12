// Temporary tab body until the screen is ported (Cook T-021, Gear T-026). Colors are the mockup values;
// T-004 replaces them with src/theme/tokens.ts.
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const placeholderColors = { bg: '#131211', text: '#f1ebe5', text1: '#d8cfc7' };

export function Placeholder({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: placeholderColors.bg },
  body: { padding: 16, gap: 8 },
  title: { color: placeholderColors.text, fontSize: 22, fontWeight: '500' },
});
