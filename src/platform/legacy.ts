// What the 0.2.0 (Capacitor) app left behind: its preferences through the pit-legacy native module (T-011)
// and its cook history file, `files/history.json` (Capacitor's Directory.Data is Expo's document directory).
// Used once, by the import (src/db/legacyImport.ts takes a LegacyStore, so its tests use a fake).
import { File, Paths } from 'expo-file-system';
import { readCapacitorPrefs, retireCapacitorPrefs } from '../../modules/pit-legacy';
import type { LegacyStore } from './types';

const HISTORY = 'history.json';
const RETIRED = 'history.json.imported';

export const legacyStore: LegacyStore = {
  readCapacitorPrefs,
  retireCapacitorPrefs,
  readHistoryFile() {
    const file = new File(Paths.document, HISTORY);
    return file.exists ? file.textSync() : null;
  },
  retireHistoryFile() {
    const file = new File(Paths.document, HISTORY);
    if (!file.exists) return;
    const old = new File(Paths.document, RETIRED);
    if (old.exists) old.delete();
    file.rename(RETIRED);
  },
};
