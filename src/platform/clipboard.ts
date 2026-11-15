// The phone's clipboard (T-065: tap the developer's address to copy it). expo-clipboard works on Android and
// iOS; this file is its only import.
import * as Clipboard from 'expo-clipboard';
import type { CopyText } from './types';

export const copyText: CopyText = async text => {
  const copied = await Clipboard.setStringAsync(text);
  if (!copied) throw new Error('not copied');
};
