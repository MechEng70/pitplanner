// Temporary tab body until the screen is ported (Cook T-021, Gear T-026).
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

export function Placeholder({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-2 p-4">
        <Text variant="title" role="heading">
          {title}
        </Text>
        {children}
      </View>
    </SafeAreaView>
  );
}
