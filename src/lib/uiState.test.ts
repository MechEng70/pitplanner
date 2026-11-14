// T-058: the UI state survives the app being killed: a round trip through the real schema (better-sqlite3),
// and the rules for what may be restored.
import type { ItemInput } from '../../engine/types';
import { NOW, testRepos } from '@/test/store';
import { DEFAULT_UI, parseUiState, restorableFood, type FoodEditState, type UiState } from './uiState';

const brisket: ItemInput = {
  id: 'b',
  foodId: 'brisket',
  methodId: 'smoked',
  quantity: 12.5,
  options: { wrap: 'foil' },
  restMin: 60,
  hrPerLb: 0.8,
};
const edit: FoodEditState = { item: brisket, isNew: false, remember: true };
const known = (foodId: string, methodId: string) => foodId === 'brisket' && methodId === 'smoked';

describe('save and restore', () => {
  test('nothing saved reads as Plan with nothing open', () => {
    expect(testRepos().repos.settings.ui()).toEqual(DEFAULT_UI);
  });

  test('the tab and an open food edit come back as saved, unsaved changes included', () => {
    const { repos } = testRepos();
    const ui: UiState = { tab: 'cook', food: edit };
    repos.settings.setUi(ui, NOW);
    expect(repos.settings.ui()).toEqual(ui);
  });

  test('an unreadable value reads as the default and is kept aside when replaced', () => {
    const { db, repos } = testRepos();
    db.run('INSERT INTO kv (key, value, updated_at) VALUES (\'ui\', \'{"tab":"nowhere"}\', ?)', [NOW]);
    expect(repos.settings.ui()).toEqual(DEFAULT_UI);
    repos.settings.setUi({ tab: 'gear', food: null }, NOW);
    expect(repos.settings.ui()).toEqual({ tab: 'gear', food: null });
  });
});

describe('parseUiState', () => {
  test('a food edit that is not one is dropped; the tab is kept', () => {
    expect(parseUiState({ tab: 'gear', food: { item: { id: 'b' }, isNew: false } })).toEqual({
      tab: 'gear',
      food: null,
    });
  });

  test('not an object, or no known tab: nothing', () => {
    expect(parseUiState('plan')).toBeNull();
    expect(parseUiState({ tab: 'setup', food: null })).toBeNull();
  });
});

describe('restorableFood', () => {
  test('an edit of a food still on the menu reopens', () => {
    expect(restorableFood(edit, ['a', 'b'], known)).toBe(edit);
  });

  test('an edit of a food that is no longer on the menu is dropped', () => {
    expect(restorableFood(edit, ['a'], known)).toBeNull();
  });

  test('a food or method the rules file no longer has is dropped', () => {
    expect(restorableFood({ ...edit, item: { ...brisket, foodId: 'gone' } }, ['b'], known)).toBeNull();
    expect(restorableFood({ ...edit, item: { ...brisket, methodId: 'gone' } }, ['b'], known)).toBeNull();
  });

  test('a new food reopens without a menu item; once its id is on the menu it was saved, so it does not', () => {
    const fresh = { ...edit, isNew: true };
    expect(restorableFood(fresh, ['a'], known)).toBe(fresh);
    expect(restorableFood(fresh, ['a', 'b'], known)).toBeNull();
  });

  test('nothing saved, nothing to reopen', () => {
    expect(restorableFood(null, ['b'], known)).toBeNull();
  });
});
