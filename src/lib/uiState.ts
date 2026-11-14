// What the user was looking at (T-058): the open tab and, on Plan, food details with its unsaved changes.
// Saved on every change and read back before the first render, so the app comes back to the same place
// after Android kills it in the background or recreates its activity. Pure: types, validation and the
// rules for what may be restored; the store saves it through the settings repository.

import type { ItemInput } from '../../engine/types.ts';
import { isItem } from './draft.ts';

export const TABS = ['plan', 'cook', 'gear'] as const;
export type Tab = (typeof TABS)[number];

/** Food details as it was left: the item with its unsaved changes, and whether "Use for future" is on. */
export interface FoodEditState {
  item: ItemInput;
  /** Not on the menu yet (opened from Add food). */
  isNew: boolean;
  remember: boolean;
}

export interface UiState {
  tab: Tab;
  food: FoodEditState | null;
}

export const DEFAULT_UI: UiState = { tab: 'plan', food: null };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parseFood(raw: unknown): FoodEditState | null {
  if (!isObj(raw) || !isItem(raw.item) || typeof raw.isNew !== 'boolean') return null;
  return { item: raw.item, isNew: raw.isNew, remember: raw.remember === true };
}

/** A stored UI state, or null when it is not one. A food edit that does not parse is dropped, not the tab. */
export function parseUiState(raw: unknown): UiState | null {
  if (!isObj(raw) || !TABS.includes(raw.tab as Tab)) return null;
  return { tab: raw.tab as Tab, food: parseFood(raw.food) };
}

/**
 * The food edit to reopen, or null when it no longer has a place: its food or method is gone from the rules
 * file, or it was an edit of a menu item that is not on the menu any more. A new food needs no menu item.
 */
export function restorableFood(
  food: FoodEditState | null,
  menuIds: string[],
  known: (foodId: string, methodId: string) => boolean,
): FoodEditState | null {
  if (!food || !known(food.item.foodId, food.item.methodId)) return null;
  if (!food.isNew && !menuIds.includes(food.item.id)) return null;
  // A new food whose id is now taken was saved already (the app was killed between Save and the close).
  if (food.isNew && menuIds.includes(food.item.id)) return null;
  return food;
}
