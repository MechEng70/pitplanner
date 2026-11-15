// pit-share: a .pitplan file handed to the app by Android (VIEW or SEND intent; filters in
// plugins/withPitplanIntents.ts). The native side keeps the file's URI and reads at most 256 KB of it when
// asked. App code reaches this through src/platform/share.ts, never directly.
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
};
