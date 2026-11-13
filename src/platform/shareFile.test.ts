import { shareTextFile } from './shareFile';

const mockCalls: unknown[][] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'CACHE' },
  File: class {
    uri: string;
    constructor(dir: string, name: string) {
      this.uri = `file:///${dir}/${name}`;
    }
    create(options: unknown) {
      mockCalls.push(['create', options]);
    }
    writeSync(text: string) {
      mockCalls.push(['write', text]);
    }
  },
}));
jest.mock('expo-sharing', () => ({
  shareAsync: async (uri: string, options: unknown) => void mockCalls.push(['share', uri, options]),
}));

test('writes the text to a cache file (replacing an old one), then opens the share sheet for it', async () => {
  await shareTextFile('pitplanner-export.json', '{"a":1}', 'application/json', 'Export my data');
  expect(mockCalls).toEqual([
    ['create', { overwrite: true }],
    ['write', '{"a":1}'],
    ['share', 'file:///CACHE/pitplanner-export.json', { mimeType: 'application/json', dialogTitle: 'Export my data' }],
  ]);
});
