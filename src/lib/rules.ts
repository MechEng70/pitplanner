// UI-side view of data/foods.json. The schema lives in engine/rules.ts; FoodDef and MethodDef are the
// resolved forms the screens read (shared fields merged into each method).

import foodsJson from '../../data/foods.json';
import type { CookerKind, Cookers, ItemInput } from '../../engine/types.ts';
import {
  resolveMethod,
  type ResolvedMethod,
  type RuleChoice,
  type RuleFood,
  type RuleOption,
  type Rules,
} from '../../engine/rules.ts';

export const rules = foodsJson as unknown as Rules;

export type Choice = RuleChoice;
export type OptionDef = RuleOption;
export type MethodDef = ResolvedMethod;
export type FoodDef = Omit<RuleFood, 'methods'> & { methods: MethodDef[] };

export const foods: FoodDef[] = rules.foods.map((f: RuleFood) => ({
  ...f,
  methods: f.methods.map(m => resolveMethod(f, m)),
}));

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

const KIND_ORDER: CookerKind[] = ['smoker', 'griddle', 'oven'];
/** Cookers a food can go on, smoker first (the order chips and blurbs read in). */
export const cookerKinds = (f: FoodDef): CookerKind[] => KIND_ORDER.filter(k => f.methods.some(m => m.cooker === k));

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
  return {
    id,
    foodId,
    methodId: m.id,
    quantity: f.quantity.default,
    options: defaultOptions(m),
    restMin: m.restMin.default,
  };
}

export function defaultOptions(m: MethodDef): Record<string, string> {
  return Object.fromEntries(Object.entries(m.options ?? {}).map(([k, o]) => [k, o.default]));
}

/** "4" for 4 chicken breasts (the name already says breasts), "3 racks" otherwise. */
export function countText(f: FoodDef, n: number): string {
  return f.name.toLowerCase().endsWith(f.quantity.unit.toLowerCase()) ? String(n) : `${n} ${f.quantity.unit}`;
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
