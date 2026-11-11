// UI-side view of data/foods.json and data/cookers.json. The engine reads the rules
// loosely (Rules = any); these types cover only the fields the UI shows.

import foodsJson from '../../data/foods.json';
import cookersJson from '../../data/cookers.json';
import type { CookerKind, Cookers, ItemInput } from '../../engine/types.ts';

export const rules: any = foodsJson;
export const catalog: any = cookersJson;

export interface Choice { label: string; short?: string; note?: string; pullF?: [number, number] }
export interface OptionDef { label: string; default: string; choices: Record<string, Choice> }
export interface MethodDef {
  id: string; label: string; short?: string; note?: string; cooker: CookerKind;
  timing: { kind: string };
  options: Record<string, OptionDef>;
  restMin: { default: number; min: number };
}
export interface FoodDef {
  id: string; name: string; group: string; blurb?: string;
  quantity: { kind: 'weight' | 'count'; unit: string; label?: string; default: number; min: number; max: number; step: number };
  methods: MethodDef[];
}

export const foods: FoodDef[] = rules.foods.map((f: any) => ({ ...f, methods: f.methods.map((m: any) => resolve(f, m)) }));

/** Same merge as the engine: shared fields, then the method's own. */
function resolve(food: any, method: any): MethodDef {
  const shared = food.shared ?? {};
  return { ...shared, ...method, options: { ...(shared.options ?? {}), ...(method.options ?? {}) } };
}

export function food(id: string): FoodDef {
  const f = foods.find(x => x.id === id);
  if (!f) throw new Error(`Unknown food ${id}`);
  return f;
}

export function method(foodId: string, methodId: string): MethodDef {
  const m = food(foodId).methods.find(x => x.id === methodId);
  if (!m) throw new Error(`Unknown method ${methodId} for ${foodId}`);
  return m;
}

export const groups = (): string[] => [...new Set(foods.map(f => f.group))];

export const cookerKinds = (f: FoodDef): CookerKind[] => [...new Set(f.methods.map(m => m.cooker))];

export const hasCooker = (c: Cookers, k: CookerKind) => !!c[k];

export function cookerName(c: Cookers, k: CookerKind): string {
  if (k === 'smoker') return c.smoker?.name ?? 'Smoker';
  if (k === 'griddle') return c.griddle?.name ?? 'Griddle';
  return 'Oven';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Picker subtitle: "Smoker, by weight", "Smoker or griddle". */
export function foodBlurb(f: FoodDef): string {
  if (f.blurb) return f.blurb;
  const kinds = cookerKinds(f);
  if (kinds.length > 1) return cap(kinds.join(' or '));
  return `${cap(kinds[0])}, by ${f.quantity.kind === 'weight' ? 'weight' : f.quantity.unit}`;
}

/** A new item with the rules defaults, on a cooker the user has when possible. */
export function newItem(foodId: string, cookers: Cookers, id: string): ItemInput {
  const f = food(foodId);
  const m = f.methods.find(x => hasCooker(cookers, x.cooker)) ?? f.methods[0];
  return { id, foodId, methodId: m.id, quantity: f.quantity.default, options: defaultOptions(m), restMin: m.restMin.default };
}

export function defaultOptions(m: MethodDef): Record<string, string> {
  return Object.fromEntries(Object.entries(m.options ?? {}).map(([k, o]) => [k, o.default]));
}

/** Card subtitle: "12 lb, smoker, paper wrap". Quantity is formatted by the caller (units). */
export function itemSummary(it: ItemInput, qty: string): string {
  const f = food(it.foodId);
  const m = method(it.foodId, it.methodId);
  const how = m.short ?? (f.methods.length > 1 ? m.label.toLowerCase() : m.cooker);
  const opts = Object.entries(m.options ?? {})
    .map(([k, o]) => o.choices[it.options?.[k] ?? o.default]?.short)
    .filter(Boolean);
  return [qty, how, ...opts].join(', ');
}
