// The app opens on the tab it was left on (T-058: the tab survives the app being killed in the background).
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useStore } from '@/lib/store';

export default function Index() {
  const { ui } = useStore();
  const [tab] = useState(() => ui.read().tab);
  return <Redirect href={`/${tab}`} />;
}
