// Share a text file through the Android share sheet: written to the app's cache, then handed to
// expo-sharing. Used by "Export my data" (T-010); T-029 builds plan sharing on it.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareTextFile(name: string, text: string, mimeType: string, title: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.writeSync(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
}
