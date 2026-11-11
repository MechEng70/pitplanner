import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet.tsx';
import { ChevronRight, CookerAvatar, Search } from '../../components/icons.tsx';
import { foods, groups, foodBlurb } from '../../lib/rules.ts';

/** Add food: searchable list grouped by the rules file's groups (Beef, Pork, Chicken). */
export function FoodPick({ onPick, onClose }: { onPick: (foodId: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (f: (typeof foods)[number]) => !needle || f.name.toLowerCase().includes(needle) || f.group.toLowerCase().includes(needle);
  const shown = groups().map(g => ({ g, list: foods.filter(f => f.group === g && match(f)) })).filter(x => x.list.length);

  return (
    <Sheet title="Add food" onClose={onClose}>
      <label class="search">
        <Search color="var(--text-2)" />
        <input type="search" placeholder="Search foods" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search foods" />
      </label>
      {shown.map(({ g, list }) => (
        <div key={g}>
          <h3 class="group-label">{g}</h3>
          {list.map(f => (
            <button key={f.id} class="list-row" onClick={() => onPick(f.id)}>
              <CookerAvatar kind={f.methods[0].cooker} size={40} />
              <span class="list-text"><span class="t1">{f.name}</span><span class="t2">{foodBlurb(f)}</span></span>
              <ChevronRight color="var(--text-2)" />
            </button>
          ))}
        </div>
      ))}
      {!shown.length && <p class="muted pad">No foods match "{q}".</p>}
    </Sheet>
  );
}
