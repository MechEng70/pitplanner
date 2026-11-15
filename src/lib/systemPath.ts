// Where a link that started or resumed the app goes (Expo Router `+native-intent`). A shared .pitplan
// arrives as a VIEW intent whose data is a content:// or file:// URI; that is a file for the pit-share
// module, not a route, so the router is sent to Plan, where the Shared plan sheet opens (T-030). Every
// other path (pitplanner:// links) is left as it is. Pure.
export function systemPath(path: string): string {
  return /^(content|file):/i.test(path.trim()) ? '/plan' : path;
}
