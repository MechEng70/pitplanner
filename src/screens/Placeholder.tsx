// Temporary tab body until the screen is ported (Cook T-021, Gear T-026).
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Placeholder({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#131211' }}>
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ color: '#f1ebe5', fontSize: 22, fontWeight: '500' }}>{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}
