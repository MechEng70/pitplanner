// Share a text file through the Android share sheet: written to the app's cache, then handed to
// expo-sharing. Used by "Export my data" (T-010); T-029 builds plan sharing on it.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { tar } from '../lib/tar.ts';

export async function shareTextFile(name: string, text: string, mimeType: string, title: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.writeSync(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
}

/**
 * Share existing files as one tar (the originals are only read). Files that do not exist are left out; with
 * none at all there is nothing to share and it throws.
 */
export async function shareFilesAsTar(
  sourceUris: readonly string[],
  name: string,
  title: string,
  now: number,
): Promise<void> {
  const entries = sourceUris
    .map(uri => new File(uri))
    .filter(file => file.exists)
    .map(file => ({ name: file.name, data: file.bytesSync(), mtime: now }));
  if (entries.length === 0) throw new Error('nothing to share: no file exists');
  const out = new File(Paths.cache, name);
  out.create({ overwrite: true });
  out.writeSync(tar(entries));
  await Sharing.shareAsync(out.uri, { mimeType: 'application/x-tar', dialogTitle: title });
}
