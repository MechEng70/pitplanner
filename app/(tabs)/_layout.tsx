// Bottom tabs: Plan, Cook, Gear, drawn by the kit BottomNav (the 0.2.0 nav: icon pill over the label).
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Tabs } from 'expo-router';
import { BottomNav, ListIcon, Sliders, Timer } from '@/components/kit';
import { colors } from '@/theme/tokens';

const ICONS: Record<string, React.ReactNode> = { plan: <ListIcon />, cook: <Timer />, gear: <Sliders /> };

function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const items = state.routes.map(r => ({
    id: r.key,
    label: descriptors[r.key]?.options.title ?? r.name,
    icon: ICONS[r.name],
  }));
  return <BottomNav items={items} value={state.routes[state.index]?.key ?? ''} onChange={navigateToTab} />;
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="cook" options={{ title: 'Cook' }} />
      <Tabs.Screen name="gear" options={{ title: 'Gear' }} />
    </Tabs>
  );
}
