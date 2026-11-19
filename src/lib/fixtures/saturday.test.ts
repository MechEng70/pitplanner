import { smokerFromCatalog } from '../gear';
import { saturday } from './saturday';

// The fixture is a plain literal (no JSON import) so engine-side code can use it; this keeps it from drifting
// from Jason's smoker in the catalog.
test("the Saturday smoker is the catalog's Pit Boss Sportsman 850", () => {
  expect(saturday.cookers.smoker).toEqual(smokerFromCatalog('pitboss-sportsman-850'));
});
