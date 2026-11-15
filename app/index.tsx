// The app opens on the tab it was left on (T-058: the tab survives the app being killed in the background),
// or on Setup while no cookers are saved (first run, T-024).
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function Index() {
  const { ui, state } = useStore();
  const [tab] = useState(() => ui.read().tab);
  if (state.firstRun) return <Redirect href="/setup" />;
  return <Redirect href={`/${tab}`} />;
}
