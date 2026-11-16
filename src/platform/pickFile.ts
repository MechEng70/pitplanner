// Pick one file in the system file picker and read it as text (T-036: Gear's Restore from a file). The
// picker (expo-document-picker) copies the chosen file into the app's cache; it is read there with
// expo-file-system and the copy is deleted (only a file under the app's cache is ever deleted). The picker is
// the only way a data file gets in: no open-with from another app.
// The text is untrusted: src/lib/dataFile.ts `readDataFile` checks all of it. The cap is kept here twice
// before the text reaches the reader: a size the picker or the file reports over the cap is refused before
// anything is read, and text over the cap is refused after (a provider may report no size, or a wrong one).
// Bytes are compared with the character cap: a file with more bytes than the cap allows characters is never
// one this app wrote (it writes JSON of about 1 KB per cook), so the stricter check costs nothing.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import type { PickTextFile } from './types';

/** Deletes the picker's copy, and only a file in the app's own cache: never the file the user picked. */
function removeCopy(file: File) {
  try {
    if (file.uri.startsWith(Paths.cache.uri)) file.delete();
  } catch {
    // A cache copy that cannot be deleted is cleared with the cache.
  }
}

export const pickTextFile: PickTextFile = async maxChars => {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    // Any type: a provider may call a .json file text/plain or octet-stream. The reader says what it is not.
    result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  } catch {
    return { error: 'unreadable' };
  }
  if (result.canceled) return { canceled: true };
  const asset = result.assets?.[0];
  if (!asset) return { canceled: true };
  let file: File;
  try {
    file = new File(asset.uri);
  } catch {
    return { error: 'unreadable' };
  }
  try {
    if ((asset.size ?? 0) > maxChars || file.size > maxChars) return { error: 'tooBig' };
    const text = await file.text();
    return text.length > maxChars ? { error: 'tooBig' } : { text };
  } catch {
    return { error: 'unreadable' };
  } finally {
    removeCopy(file);
  }
};
