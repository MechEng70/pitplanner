import type { Cookers, ItemInput, Plan } from '../../../engine/types.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { Warn } from '../../components/icons.tsx';
import { food, method } from '../../lib/rules.ts';

const TEMP_CODES = new Set(['PIT_CONFLICT', 'TEMP_UNTRUSTED', 'TEMP_NOT_SETTABLE']);

/** Conflicts tile: every warning, warn level first, with the fixes that apply. */
export function IssuesSheet({ plan, items, cookers, onMoveToGriddle, onEdit, onChangeTemp, onClose }: {
  plan: Plan; items: ItemInput[]; cookers: Cookers;
  onMoveToGriddle: (itemId: string, methodId: string) => void;
  onEdit: (itemId: string) => void; onChangeTemp: () => void; onClose: () => void;
}) {
  const list = [...plan.warnings].sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));

  const griddleFix = (id: string) => {
    const it = items.find(x => x.id === id);
    if (!it || !cookers.griddle || method(it.foodId, it.methodId).cooker === 'griddle') return null;
    const gm = food(it.foodId).methods.find(m => m.cooker === 'griddle');
    return gm ? { it, gm } : null;
  };

  return (
    <Sheet title="Conflicts" onClose={onClose}>
      {!list.length && <p class="muted pad">Nothing to fix. The plan fits your cookers.</p>}
      {list.map((w, i) => (
        <div key={i} class={`issue issue-${w.level}`}>
          <div class="issue-head">
            <Warn size={18} color={w.level === 'warn' ? 'var(--warn)' : 'var(--text-2)'} />
            <span>{w.message}</span>
          </div>
          <div class="issue-fixes">
            {(w.itemIds ?? []).map(id => {
              const g = griddleFix(id);
              return g && (
                <button key={`g${id}`} class="btn-tonal" onClick={() => onMoveToGriddle(id, g.gm.id)}>
                  Move {food(g.it.foodId).name.toLowerCase()} to the griddle
                </button>
              );
            })}
            {TEMP_CODES.has(w.code) && <button class="btn-tonal" onClick={onChangeTemp}>Change smoker temp</button>}
            {(w.itemIds ?? []).map(id => {
              const it = items.find(x => x.id === id);
              return it && <button key={`e${id}`} class="btn-outline" onClick={() => onEdit(id)}>Edit {food(it.foodId).name.toLowerCase()}</button>;
            })}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
