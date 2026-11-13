import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MigrationError } from '@/db/migrate';
import { MigrationErrorScreen } from './MigrationError';

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
