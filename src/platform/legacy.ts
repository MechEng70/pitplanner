// The 0.2.0 app's saved preferences, through the pit-legacy native module (T-011). Used once, by the import
// in T-012 (src/db/legacyImport.ts takes a LegacyStore, so its tests use a fake).
import { readCapacitorPrefs, retireCapacitorPrefs } from '../../modules/pit-legacy';
import type { LegacyStore } from './types';

export const legacyStore: LegacyStore = { readCapacitorPrefs, retireCapacitorPrefs };
