// Bottom tabs: Plan, Cook, Gear. Placeholder look; the kit tab bar from the mockups comes in T-005.
import { Tabs } from 'expo-router';

const BG = '#131211';
const NAV = '#1b1917';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: BG },
        tabBarStyle: { backgroundColor: NAV, borderTopColor: NAV },
        tabBarActiveTintColor: '#ffb07f',
        tabBarInactiveTintColor: '#b5aba2',
      }}
    >
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="cook" options={{ title: 'Cook' }} />
      <Tabs.Screen name="gear" options={{ title: 'Gear' }} />
    </Tabs>
  );
}
