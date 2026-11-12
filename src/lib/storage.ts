// Settings, gear and the plan draft live in @capacitor/preferences (localStorage on web).
// Cook history will be a JSON file via @capacitor/filesystem (SPEC section 2).

import { Preferences } from '@capacitor/preferences';

export type Key = 'gear' | 'settings' | 'draft' | 'rates' | 'totalHours' | 'rateLocks' | 'update' | 'activeCook' | 'flags';

export async function load<T>(key: Key): Promise<T | null> {
  const { value } = await Preferences.get({ key });
  if (value == null) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

export async function save(key: Key, value: unknown): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export async function remove(key: Key): Promise<void> {
  await Preferences.remove({ key });
}
