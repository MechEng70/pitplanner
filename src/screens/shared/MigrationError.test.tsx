import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MigrationError } from '@/db/migrate';
import { shareFilesAsTar } from '@/platform/shareFile';
import { MigrationErrorScreen } from './MigrationError';

/** expo-sharing under the real database export (shareFilesAsTar): counts each call, then opens or rejects. */
let mockShareFails: Error | null = null;
let mockShareCalls = 0;
jest.mock('expo-sharing', () => ({
  shareAsync: async () => {
    mockShareCalls++;
    if (mockShareFails) throw mockShareFails;
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
      return true;
    }
    get name() {
      return this.uri.split('/').pop();
    }
    bytesSync() {
      return new Uint8Array([1, 2, 3]);
    }
    create() {}
    writeSync() {}
  },
}));
// The native module is not in Jest.
jest.mock('../../../modules/pit-share', () => ({ pitShare: {} }));

const failed = new MigrationError('failed', 2, 'migration 2 (add_notes) failed', new Error('no such column: x'));
const newer = new MigrationError('newer', 7, 'database is version 7, this app knows up to 1');

test('the empty state: title, body, Export my data, and the details hidden until asked for', async () => {
  await render(<MigrationErrorScreen error={failed} onExport={async () => {}} />);
  expect(screen.getByRole('heading', { name: "Pit Planner couldn't update" })).toBeOnTheScreen();
  expect(screen.getByText('Your data is safe. Tap Export my data and send the file to Jason.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Export my data' })).toBeEnabled();
  expect(screen.queryByText(/migration 2/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Show details' }));
  expect(screen.getByText('migration 2 (add_notes) failed: no such column: x')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Hide details' }));
  expect(screen.queryByText(/migration 2/)).toBeNull();
});

test('a database from a newer app: same screen, the details say why', async () => {
  await render(<MigrationErrorScreen error={newer} onExport={async () => {}} />);
  expect(screen.getByRole('heading', { name: "Pit Planner couldn't update" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Show details' }));
  expect(screen.getByText('database is version 7, this app knows up to 1')).toBeOnTheScreen();
});

test('Export my data runs the export once per tap and is off while it runs', async () => {
  let finish = () => {};
  const onExport = jest.fn(() => new Promise<void>(resolve => (finish = resolve)));
  await render(<MigrationErrorScreen error={failed} onExport={onExport} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Export my data' }));
  expect(onExport).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Export my data' })).toBeDisabled();
  finish();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export my data' })).toBeEnabled());
});

test('a failed export says so and can be tried again', async () => {
  const onExport = jest.fn().mockRejectedValueOnce(new Error('no share target')).mockResolvedValueOnce(undefined);
  await render(<MigrationErrorScreen error={failed} onExport={onExport} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Export my data' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The export did not work. Try again.');
  await fireEvent.press(screen.getByRole('button', { name: 'Export my data' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(onExport).toHaveBeenCalledTimes(2);
});

// After-readout checklist, "Share plan failed on the phone": the same second-tap rejection on the error
// screen's Export my data when the database could not be opened (the database files as a tar).
describe('Export my data through the real database export (expo-sharing faked)', () => {
  const onExport = () =>
    shareFilesAsTar(['file:///files/SQLite/pitplanner.db'], 'pitplanner-database.tar', 'Export my data', 0);
  beforeEach(() => {
    mockShareCalls = 0;
  });
  afterEach(() => {
    mockShareFails = null;
  });

  test('the "another share request is being processed" rejection shows no failure', async () => {
    mockShareFails = Object.assign(new Error('Another share request is being processed now.'), {
      code: 'ERR_SHARING_IN_PROGRESS',
    });
    await render(<MigrationErrorScreen error={failed} onExport={onExport} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Export my data' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export my data' })).toBeEnabled());
    expect(mockShareCalls).toBe(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('any other error still says so', async () => {
    mockShareFails = new Error('No Activity found');
    await render(<MigrationErrorScreen error={failed} onExport={onExport} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Export my data' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The export did not work. Try again.');
  });
});
