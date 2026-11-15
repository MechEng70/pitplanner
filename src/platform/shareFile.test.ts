import { REPORT_SUBJECT, shareFilesAsTar, shareReport, shareTextFile } from './shareFile';

const mockCalls: unknown[][] = [];
/** What the native sendFile does next: nothing (it opened the sheet), or throw this. */
let mockSendFails: Error | null = null;
/** False for a build made before the function existed: the native module has no sendFile. */
let mockHasSendFile = true;
// The native module is not in Jest.
jest.mock('../../modules/pit-share', () => ({
  pitShare: {
    sendFile: async (...args: unknown[]) => {
      if (!mockHasSendFile) throw new TypeError('native.sendFile is not a function');
      mockCalls.push(['sendFile', ...args]);
      if (mockSendFails) throw mockSendFails;
    },
  },
}));
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

beforeEach(() => {
  mockCalls.splice(0);
  mockSendFails = null;
  mockHasSendFile = true;
});

test('writes the text to a cache file (replacing an old one), then opens the share sheet for it', async () => {
  await shareTextFile('pitplanner-export.json', '{"a":1}', 'application/json', 'Export my data');
  expect(mockCalls).toEqual([
    ['create', { overwrite: true }],
    ['write', '{"a":1}'],
    ['share', 'file:///CACHE/pitplanner-export.json', { mimeType: 'application/json', dialogTitle: 'Export my data' }],
  ]);
});

describe('Send to developer (T-065)', () => {
  const written = [
    ['create', { overwrite: true }],
    ['write', '{"a":1}'],
  ];
  const sendFile = [
    'sendFile',
    'file:///CACHE/pitplanner-debug.json',
    'application/json',
    'dev@example.com',
    REPORT_SUBJECT,
    'Send to dev@example.com',
  ];
  const oldShare = [
    'share',
    'file:///CACHE/pitplanner-debug.json',
    { mimeType: 'application/json', dialogTitle: 'Send to dev@example.com' },
  ];

  test('one JSON file through the native share sheet, with the address as the recipient', async () => {
    await shareReport('pitplanner-debug.json', '{"a":1}', 'dev@example.com');
    expect(mockCalls).toEqual([...written, sendFile]);
  });

  test('the subject is plain and one line', () => {
    expect(REPORT_SUBJECT).toBe('Pit Planner debug file');
  });

  test('a build without the native function still shares the file, the address in the sheet title', async () => {
    mockHasSendFile = false;
    await shareReport('pitplanner-debug.json', '{"a":1}', 'dev@example.com');
    expect(mockCalls).toEqual([...written, oldShare]);
  });

  test('when the native function throws, the same file goes to the old share sheet, written once', async () => {
    mockSendFails = new Error('no activity');
    await shareReport('pitplanner-debug.json', '{"a":1}', 'dev@example.com');
    expect(mockCalls).toEqual([...written, sendFile, oldShare]);
  });
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
