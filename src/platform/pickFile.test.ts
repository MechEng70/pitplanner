// The file picker for Restore from a file (T-036), over mocked expo-document-picker and expo-file-system.
import { pickTextFile } from './pickFile';

const mockCalls: unknown[][] = [];
/** What the picker answers next: a result, or an Error it throws. */
let mockPicked: unknown;
/** The picked file on disk: its size and text, or an Error the read throws. */
let mockFile: { size: number; text: string | Error };

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async (options: unknown) => {
    mockCalls.push(['pick', options]);
    if (mockPicked instanceof Error) throw mockPicked;
    return mockPicked;
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///data/cache/' } },
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockFile.size;
    }
    async text() {
      mockCalls.push(['read', this.uri]);
      if (mockFile.text instanceof Error) throw mockFile.text;
      return mockFile.text;
    }
    delete() {
      mockCalls.push(['delete', this.uri]);
    }
  },
}));

const COPY = 'file:///data/cache/DocumentPicker/abc.json';
const picked = (asset: Record<string, unknown> = {}) => ({
  canceled: false,
  assets: [{ name: 'pitplanner-data.json', uri: COPY, size: 9, lastModified: 0, ...asset }],
});

beforeEach(() => {
  mockCalls.splice(0);
  mockPicked = picked();
  mockFile = { size: 9, text: '{"a":"b"}' };
});

test('opens the picker for one file of any type, copied to the cache; reads it, then deletes the copy', async () => {
  expect(await pickTextFile(100)).toEqual({ text: '{"a":"b"}' });
  expect(mockCalls).toEqual([
    ['pick', { type: '*/*', copyToCacheDirectory: true, multiple: false }],
    ['read', COPY],
    ['delete', COPY],
  ]);
});

test('a cancelled picker reads nothing', async () => {
  mockPicked = { canceled: true, assets: null };
  expect(await pickTextFile(100)).toEqual({ canceled: true });
  expect(mockCalls.map(c => c[0])).toEqual(['pick']);
});

test('a size over the cap is refused before the file is read', async () => {
  mockPicked = picked({ size: 101 });
  expect(await pickTextFile(100)).toEqual({ error: 'tooBig' });
  expect(mockCalls.map(c => c[0])).toEqual(['pick', 'delete']);
});

test('no size from the picker: the file size is checked, then the text', async () => {
  mockPicked = picked({ size: undefined });
  mockFile = { size: 101, text: 'x' };
  expect(await pickTextFile(100)).toEqual({ error: 'tooBig' });
  expect(mockCalls.map(c => c[0])).toEqual(['pick', 'delete']);

  mockCalls.splice(0);
  mockFile = { size: 0, text: 'x'.repeat(101) };
  expect(await pickTextFile(100)).toEqual({ error: 'tooBig' });
  expect(mockCalls.map(c => c[0])).toEqual(['pick', 'read', 'delete']);
});

test('a picker or read that fails is unreadable, never a throw', async () => {
  mockPicked = new Error('no activity');
  expect(await pickTextFile(100)).toEqual({ error: 'unreadable' });

  mockPicked = picked();
  mockFile = { size: 9, text: new Error('gone') };
  expect(await pickTextFile(100)).toEqual({ error: 'unreadable' });
});

test('only a copy in the app cache is deleted, never the file the user picked', async () => {
  mockPicked = picked({ uri: 'content://com.android.providers.downloads/document/12' });
  expect(await pickTextFile(100)).toEqual({ text: '{"a":"b"}' });
  expect(mockCalls.map(c => c[0])).toEqual(['pick', 'read']);
});
