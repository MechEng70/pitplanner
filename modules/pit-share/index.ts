// pit-share: a .pitplan file handed to the app by Android (VIEW or SEND intent; filters in
// plugins/withPitplanIntents.ts). The native side keeps the file's URI and reads at most 256 KB of it when
// asked. Also the other way (T-065): `sendFile` opens the share sheet for one file the app wrote, with a
// recipient and a subject offered to the email app the tester picks.
// App code reaches this through src/platform/share.ts and src/platform/shareFile.ts, never directly.
import { NativeModule, requireNativeModule } from 'expo';

/** `text` (with `name` when the sender's app gives one), or `error`: 'tooBig' or 'unreadable'. */
export interface PitOpenedPlan {
  text?: string;
  name?: string;
  error?: string;
}

type Events = {
  planOpened(): void;
};

declare class PitShareNative extends NativeModule<Events> {
  takeOpenedPlan(): Promise<PitOpenedPlan | null>;
  sendFile(fileUri: string, mimeType: string, recipient: string, subject: string, title: string): Promise<void>;
}

const native = requireNativeModule<PitShareNative>('PitShare');

export const pitShare = {
  /** The opened file, once; null when none is waiting. */
  takeOpenedPlan: () => native.takeOpenedPlan(),
  /** A file arrived while the app was running. */
  onPlanOpened(fn: () => void): () => void {
    const sub = native.addListener('planOpened', fn);
    return () => sub.remove();
  },
  /**
   * Open the share sheet for one file in the app's cache or files folder (a `file://` URI), offering
   * `recipient` and `subject` to an email app. Resolves once the sheet is open; nothing is sent by this.
   * Rejects for a file outside those folders, and on a build whose native side has no such function.
   */
  sendFile: (fileUri: string, mimeType: string, recipient: string, subject: string, title: string) =>
    native.sendFile(fileUri, mimeType, recipient, subject, title),
};
