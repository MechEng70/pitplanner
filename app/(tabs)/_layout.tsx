// Bottom tabs: Plan, Cook, Gear, drawn by the kit BottomNav (the 0.2.0 nav: icon pill over the label).
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { BottomNav, ListIcon, Sliders, Timer } from '@/components/kit';
import { useStore } from '@/lib/store';
import { TABS, type Tab } from '@/lib/uiState';
import { colors } from '@/theme/tokens';

const ICONS: Record<string, React.ReactNode> = { plan: <ListIcon />, cook: <Timer />, gear: <Sliders /> };

function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  // The open tab is saved as it changes, so the app comes back to it (T-058).
  const { ui } = useStore();
  const open = state.routes[state.index]?.name;
  useEffect(() => {
    if (TABS.includes(open as Tab)) ui.write({ tab: open as Tab });
  }, [ui, open]);
  const items = state.routes.map(r => ({
    id: r.key,
    label: descriptors[r.key]?.options.title ?? r.name,
    icon: ICONS[r.name],
  }));
  return <BottomNav items={items} value={state.routes[state.index]?.key ?? ''} onChange={navigateToTab} />;
}

export default function TabLayout() {
  // A first run has no tabs yet, however the app was opened (a link, a notification): Setup first (T-024).
  const { state } = useStore();
  if (state.firstRun) return <Redirect href="/setup" />;
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
