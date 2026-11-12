import { render, screen } from '@testing-library/react-native';
import { PlanPlaceholder } from './PlanPlaceholder';

test('the Plan placeholder runs the engine in the app bundle: Saturday brisket fires 6:20 AM', async () => {
  await render(<PlanPlaceholder />);
  expect(screen.getByText('Plan')).toBeOnTheScreen();
  expect(screen.getByText(/serve 5:00 PM\. Fire the smoker at 6:20 AM\./)).toBeOnTheScreen();
});
