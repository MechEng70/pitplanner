import { shareFilesAsTar, shareTextFile } from './shareFile';

const mockCalls: unknown[][] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'CACHE' },
  File: class {
    uri: string;
    constructor(dir: string, name?: string) {
      this.uri = name ? `file:///${dir}/${name}` : dir;
    }
    get exists() {
      return !this.uri.includes('missing');
    }
    get name() {
      return this.uri.split('/').pop();
    }
    bytesSync() {
      return new Uint8Array(Buffer.from(`bytes of ${this.name}`));
    }
    create(options: unknown) {
      mockCalls.push(['create', options]);
    }
    writeSync(content: string | Uint8Array) {
      mockCalls.push(['write', content]);
    }
  },
}));
jest.mock('expo-sharing', () => ({
  shareAsync: async (uri: string, options: unknown) => void mockCalls.push(['share', uri, options]),
}));

beforeEach(() => mockCalls.splice(0));

test('writes the text to a cache file (replacing an old one), then opens the share sheet for it', async () => {
  await shareTextFile('pitplanner-export.json', '{"a":1}', 'application/json', 'Export my data');
  expect(mockCalls).toEqual([
    ['create', { overwrite: true }],
    ['write', '{"a":1}'],
    ['share', 'file:///CACHE/pitplanner-export.json', { mimeType: 'application/json', dialogTitle: 'Export my data' }],
  ]);
});

test('shares the files that exist as one tar; the originals are only read', async () => {
  const uris = [
    'file:///files/SQLite/pitplanner.db',
    'file:///files/SQLite/pitplanner.db-wal',
    'file:///files/SQLite/missing-journal',
  ];
  await shareFilesAsTar(uris, 'pitplanner-database.tar', 'Export my data', 1794500000000);
  expect(mockCalls.map(c => c[0])).toEqual(['create', 'write', 'share']);
  const archive = Buffer.from(mockCalls[1]![1] as Uint8Array);
  // Two entries (header + one data block each) and the two closing blocks.
  expect(archive.length).toBe(2 * 1024 + 1024);
  expect(archive.subarray(0, 13).toString()).toBe('pitplanner.db');
  expect(archive.subarray(512, 534).toString()).toBe('bytes of pitplanner.db');
  expect(archive.subarray(1024, 1041).toString()).toBe('pitplanner.db-wal');
  expect(mockCalls[2]).toEqual([
    'share',
    'file:///CACHE/pitplanner-database.tar',
    { mimeType: 'application/x-tar', dialogTitle: 'Export my data' },
  ]);
});

test('no file at all is an error, not an empty share', async () => {
  await expect(shareFilesAsTar(['file:///files/missing.db'], 'x.tar', 'x', 0)).rejects.toThrow(/nothing to share/);
  expect(mockCalls).toEqual([]);
});
