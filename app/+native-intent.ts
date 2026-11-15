// Expo Router hook for links that open the app: a shared .pitplan (content:// or file://) is not a route
// (src/lib/systemPath.ts). Not a route itself, so the typed routes do not change.
import { systemPath } from '@/lib/systemPath';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return systemPath(path);
}
