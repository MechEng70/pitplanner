// Battery help per phone maker (SPEC section 7, failure mode 10: some makers' battery savers delay alarms
// even with the battery exemption granted). Pure: the manufacturer string comes from the platform layer
// (Android's Build.MANUFACTURER), the answer is that maker's help link or null. A Pixel (Google) gets none.

/** Help link per maker, keyed by `makerKey`. Empty until Jason approves the list: no link is made up here. */
export const BATTERY_HELP_LINKS: Readonly<Record<string, string>> = {};

/** The manufacturer as a table key: "SAMSUNG", " Samsung " and "samsung" are one maker. */
export const makerKey = (manufacturer: string | null | undefined) => (manufacturer ?? '').trim().toLowerCase();

/** The battery help link for this phone's maker, or null when it has none (or the maker is unknown). */
export function batteryHelpLink(
  manufacturer: string | null | undefined,
  links: Readonly<Record<string, string>> = BATTERY_HELP_LINKS,
): string | null {
  const key = makerKey(manufacturer);
  return key && Object.hasOwn(links, key) ? (links[key] ?? null) : null;
}
