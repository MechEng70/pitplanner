// T-030: the main activity opens a shared .pitplan file (SPEC section 3, Share). Three intent filters, the
// same as 0.2.0 without the BROWSABLE category (a web page has no reason to start this):
//  1. VIEW of a content:// or file:// URI typed as JSON, octet-stream or x-pitplan. Gmail and Drive hand an
//     attachment over as a content:// URI with no file name in it, typed as one of these.
//  2. VIEW of a content:// or file:// URI whose path ends in .pitplan, whatever its type (file managers).
//  3. SEND ("Share to Pit Planner") of one file with one of the three types.
// Nothing else is exported for this: the file is read by the pit-share module, capped at 256 KB, and checked
// by src/lib/sharedPlan.ts. Pure, so it is tested without a prebuild; withPitplanIntents.ts applies it.

interface Attrs {
  $: Record<string, string | undefined>;
}
interface FilterLike {
  action?: Attrs[];
  category?: Attrs[];
  data?: Attrs[];
}
interface ActivityLike extends Attrs {
  'intent-filter'?: FilterLike[];
}
export interface ManifestLike {
  manifest: { application?: { activity?: ActivityLike[] }[] };
}

const MAIN = '.MainActivity';
export const PITPLAN_MIME_TYPES = ['application/json', 'application/octet-stream', 'application/x-pitplan'] as const;
// As written in AndroidManifest.xml: the resource compiler reads `\\.` as `\.`, a literal dot. A pathPattern
// `.*` stops at the first dot it can, so names with more dots need their own pattern.
const PATH_PATTERNS = ['.*\\\\.pitplan', '.*\\\\..*\\\\.pitplan', '.*\\\\..*\\\\..*\\\\.pitplan'];

const named = (name: string): Attrs => ({ $: { 'android:name': name } });
const data = (key: string, values: readonly string[]): Attrs[] => values.map(v => ({ $: { [`android:${key}`]: v } }));
const DEFAULT = [named('android.intent.category.DEFAULT')];
const FILE_SCHEMES = data('scheme', ['content', 'file']);

export const PITPLAN_FILTERS: FilterLike[] = [
  {
    action: [named('android.intent.action.VIEW')],
    category: DEFAULT,
    data: [...FILE_SCHEMES, ...data('mimeType', PITPLAN_MIME_TYPES)],
  },
  {
    action: [named('android.intent.action.VIEW')],
    category: DEFAULT,
    data: [
      ...FILE_SCHEMES,
      ...data('host', ['*']),
      ...data('mimeType', ['*/*']),
      ...data('pathPattern', PATH_PATTERNS),
    ],
  },
  {
    action: [named('android.intent.action.SEND')],
    category: DEFAULT,
    data: data('mimeType', PITPLAN_MIME_TYPES),
  },
];

export function addPitplanIntents<T extends ManifestLike>(manifest: T): T {
  const main = manifest.manifest.application?.[0]?.activity?.find(a => a.$['android:name'] === MAIN);
  if (!main) throw new Error(`withPitplanIntents: ${MAIN} is not in AndroidManifest.xml`);
  const have = new Set((main['intent-filter'] ?? []).map(f => JSON.stringify(f)));
  const missing = PITPLAN_FILTERS.filter(f => !have.has(JSON.stringify(f)));
  // Copies, so a second manifest never shares objects with the first.
  main['intent-filter'] = [...(main['intent-filter'] ?? []), ...structuredClone(missing)];
  return manifest;
}
