import { render, screen } from '@testing-library/react-native';
import { NOW, storeWrapper, testRepos } from '@/test/store';
import { DRAFT_LOST, PlanPlaceholder } from './PlanPlaceholder';

test('the Plan placeholder runs the engine in the app bundle: Saturday brisket fires 6:20 AM', async () => {
  await render(<PlanPlaceholder />, { wrapper: storeWrapper() });
  expect(screen.getByText('Plan')).toBeOnTheScreen();
  expect(screen.getByText(/serve 5:00 PM\. Fire the smoker at 6:20 AM\./)).toBeOnTheScreen();
  expect(screen.queryByText(DRAFT_LOST)).toBeNull();
});

test('a saved plan that cannot be loaded is announced, not silently replaced by an empty one', async () => {
  const { db, repos } = testRepos();
  db.run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', ['draft', '{"mode":"readyBy","items":', NOW]);
  await render(<PlanPlaceholder />, { wrapper: storeWrapper(repos) });
  expect(screen.getByRole('alert')).toHaveTextContent(DRAFT_LOST);
});

test('no notice when no plan was ever saved', async () => {
  await render(<PlanPlaceholder />, { wrapper: storeWrapper() });
  expect(screen.queryByRole('alert')).toBeNull();
});
