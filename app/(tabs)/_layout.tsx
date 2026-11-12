// Bottom tabs: Plan, Cook, Gear. Colors and font from the tokens; the mockup tab bar (icons, active pill)
// comes with the kit in T-005.
import { Tabs } from 'expo-router';
import { textStyle } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.nav, borderTopColor: colors.nav },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.text2,
        tabBarLabelStyle: textStyle('label', '500'),
      }}
    >
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="cook" options={{ title: 'Cook' }} />
      <Tabs.Screen name="gear" options={{ title: 'Gear' }} />
    </Tabs>
  );
}
