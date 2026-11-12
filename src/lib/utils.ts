// Class name helper for NativeWind (React Native Reusables convention: `cn`). tailwind-merge v2 (Tailwind 3)
// is told about the token type scale, so `text-title` (size) and `text-ink-2` (color) never knock each other out.
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { type } from '../theme/tokens.ts';

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: Object.keys(type) }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
