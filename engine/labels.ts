// Default labels that tell two of the same food apart on one menu (T-061; Jason, 2026-11-14).
import type { Rules } from './rules.ts';
import type { ItemInput } from './types.ts';

/** "Brisket" -> "brisket", "Baby back ribs" -> "baby back ribs"; "St. Louis ribs" keeps its capitals. */
const inSentence = (name: string) => (/^St\. /.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

/**
 * Labels for the items that share their food with another item on the menu, by item id: "11.5 lb brisket",
 * "3 racks St. Louis ribs", "4 chicken breasts". An item that is the only one of its food has no entry and
 * reads as it always did. Items whose labels would still match are numbered in menu order ("6 lb brisket 1",
 * "6 lb brisket 2"). Weights are written in lb, like every engine text; localizeText converts them for display.
 * A food the rules do not know gets no label.
 */
export function itemLabels(rules: Rules, items: ItemInput[]): Map<string, string> {
  const base = new Map<string, string>();
  for (const it of items) {
    if (items.filter(x => x.foodId === it.foodId).length < 2) continue;
    const f = rules.foods.find(x => x.id === it.foodId);
    if (!f) continue;
    const name = inSentence(f.name);
    const unit = f.quantity.unit;
    const qty = name.toLowerCase().endsWith(unit.toLowerCase()) ? String(it.quantity) : `${it.quantity} ${unit}`;
    base.set(it.id, `${qty} ${name}`);
  }
  const out = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const [id, label] of base) {
    const same = [...base.values()].filter(l => l === label).length;
    if (same < 2) {
      out.set(id, label);
      continue;
    }
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    out.set(id, `${label} ${n}`);
  }
  return out;
}
