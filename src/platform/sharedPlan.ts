// Bridge for opened .pitplan files (android .../share/SharedPlanPlugin.kt). Native only; the browser build
// has nothing to receive.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface Taken {
  text?: string;
  name?: string;
  error?: string;
}
interface PitSharedPlanPlugin {
  take(): Promise<Taken>;
  addListener(event: 'sharedPlan', fn: () => void): Promise<PluginListenerHandle>;
}

const native = Capacitor.isNativePlatform();
const plugin = native ? registerPlugin<PitSharedPlanPlugin>('PitSharedPlan') : null;

/** The opened file's text, once; null when nothing was opened. */
export async function takeSharedPlan(): Promise<Taken | null> {
  if (!plugin) return null;
  const t = await plugin.take();
  return t.text != null || t.error ? t : null;
}

export function onSharedPlan(fn: () => void): () => void {
  if (!plugin) return () => {};
  const h = plugin.addListener('sharedPlan', fn);
  return () => {
    h.then(x => x.remove());
  };
}
