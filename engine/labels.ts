// Default labels that tell two of the same food apart on one menu (T-061; Jason, 2026-11-14).
import type { Rules } from './rules.ts';
import type { ItemInput } from './types.ts';
import { durationText } from './units.ts';

/** "Brisket" -> "brisket", "Baby back ribs" -> "baby back ribs"; "St. Louis ribs" keeps its capitals. */
export const inSentence = (name: string) => (/^St\. /.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

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

/** A food whose hold is past its limit; `name` as it reads mid-sentence ("brisket", "11.5 lb brisket"). */
export interface HeldFood {
  name: string;
  holdMin: number;
  limitMin: number;
  /** The food's hold note as it reads inside its brackets ("keep above 140F"); used only for several foods. */
  holdNoteInline?: string;
}

/**
 * The long-hold sentence, with no verb to agree (Jason, 2026-11-16), on Plan and on the Live cook banner.
 * One food: "Long hold: brisket 6 hr 10 min, limit 4 hr." (the caller adds the food's full hold note after
 * it). Several foods share one line with each limit in brackets: "Long hold: chicken wings 35 min (limit
 * 30), chicken breasts 25 min (limit 20)." There the limit drops its unit only when the hold just before it
 * is written in that one unit; otherwise it keeps it: "chicken wings 1 hr 5 min (limit 30 min)", "brisket
 * 6 hr 10 min (limit 4 hr)". A food's hold note goes inside its own brackets after the limit: "brisket 5 hr
 * 10 min (limit 4 hr, keep above 140F), chicken wings 35 min (limit 30)."
 */
export function longHold(foods: HeldFood[]): string {
  if (foods.length === 1) {
    const f = foods[0];
    return `Long hold: ${f.name} ${durationText(f.holdMin)}, limit ${durationText(f.limitMin)}.`;
  }
  const parts = foods.map(f => {
    const hold = durationText(f.holdMin),
      limit = durationText(f.limitMin);
    const h = hold.split(' '),
      l = limit.split(' ');
    const sameUnit = h.length === 2 && l.length === 2 && h[1] === l[1];
    const note = f.holdNoteInline ? `, ${f.holdNoteInline}` : '';
    return `${f.name} ${hold} (limit ${sameUnit ? l[0] : limit}${note})`;
  });
  return `Long hold: ${parts.join(', ')}.`;
}
