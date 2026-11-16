// Share a text file through the Android share sheet: written to the app's cache, then handed to
// expo-sharing. Used by "Export my data" (T-010, and Gear's data file in T-036); T-029 builds plan sharing on
// it. "Send to developer" (T-065) goes through the pit-share native module instead, which can offer a
// recipient.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { pitShare } from '../../modules/pit-share';
import { tar } from '../lib/tar.ts';
import type { ShareFile, ShareReport } from './types';

function writeCacheFile(name: string, text: string): File {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.writeSync(text);
  return file;
}

export async function shareTextFile(name: string, text: string, mimeType: string, title: string): Promise<void> {
  const file = writeCacheFile(name, text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: title });
}

/** Gear's "Export my data" (T-036): the pitplanner-data file through the share sheet. */
export const shareDataFile: ShareFile = (name, text) => shareTextFile(name, text, 'application/json', 'Export my data');

/** The subject offered to the email app the tester picks. */
export const REPORT_SUBJECT = 'Pit Planner debug file';

/** The native share sheet with a recipient (modules/pit-share `sendFile`), so tests can pass a fake. */
export type SendFile = (
  fileUri: string,
  mimeType: string,
  recipient: string,
  subject: string,
  title: string,
) => Promise<void>;

/**
 * "Send to developer" (T-065): one JSON file in the share sheet. expo-sharing has no way to hand an email
 * app a recipient (Android's EXTRA_EMAIL), so the file goes through `sendFile`, which offers the address
 * and a subject to the app the tester picks. Still the share sheet, still one file. If the native function
 * is missing (a build made before it) or throws, the same file goes through expo-sharing with the address
 * in the sheet's title; the debug screen shows the address either way.
 */
export function reportSharer(sendFile: SendFile): ShareReport {
  return async (name, text, recipient) => {
    const file = writeCacheFile(name, text);
    const title = `Send to ${recipient}`;
    try {
      await sendFile(file.uri, 'application/json', recipient, REPORT_SUBJECT, title);
      return;
    } catch {
      // Fall through to the share sheet without a recipient.
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: title });
  };
}

export const shareReport: ShareReport = reportSharer((...args) => pitShare.sendFile(...args));

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
