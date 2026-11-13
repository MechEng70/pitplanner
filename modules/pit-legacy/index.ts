// pit-legacy: the 0.2.0 (Capacitor) app's saved preferences, for the one-time import into SQLite (T-012).
// App code reaches this through src/platform/legacy.ts, never directly.
import { requireNativeModule } from 'expo';

interface PitLegacyNative {
  readCapacitorPrefs(): Record<string, string>;
  retireCapacitorPrefs(): boolean;
}

const native = requireNativeModule<PitLegacyNative>('PitLegacy');

/** Every entry of the `CapacitorStorage` preferences (one JSON string per key); empty when there are none. */
export function readCapacitorPrefs(): Record<string, string> {
  return native.readCapacitorPrefs();
}

/**
 * Call only after the SQLite import has committed: keeps a copy (`CapacitorStorage.imported`, until 0.4.0)
 * and empties the original. True when there was something to retire.
 */
export function retireCapacitorPrefs(): boolean {
  return native.retireCapacitorPrefs();
}
