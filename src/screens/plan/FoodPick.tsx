import { useState } from 'preact/hooks';
import { Avatar, GroupLabel, Inset, ListRow, SearchField, Sheet, Text, useSheet } from '../../ui/components.tsx';
import { foods, groups, foodBlurb } from '../../lib/rules.ts';

/** Add food (mockup 07): searchable list grouped by the rules file's groups. */
export function FoodPick({ onPick, onClose }: { onPick: (foodId: string) => void; onClose: () => void }) {
  return <Sheet title="Add food" onClose={onClose} flush><FoodList onPick={onPick} /></Sheet>;
}

function FoodList({ onPick }: { onPick: (foodId: string) => void }) {
  const { close } = useSheet();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (f: (typeof foods)[number]) => !needle || f.name.toLowerCase().includes(needle) || f.group.toLowerCase().includes(needle);
  const shown = groups().map(g => ({ g, list: foods.filter(f => f.group === g && match(f)) })).filter(x => x.list.length);

  return (
    <>
      <Inset><SearchField placeholder="Search foods" value={q} onInput={setQ} /></Inset>
      {shown.map(({ g, list }) => (
        <div key={g}>
          <GroupLabel>{g}</GroupLabel>
          {list.map(f => (
            <ListRow key={f.id} leading={<Avatar kind={f.methods[0].cooker} size={40} />} title={f.name} subtitle={foodBlurb(f)}
              onClick={() => close(() => onPick(f.id))} />
          ))}
        </div>
      ))}
      {!shown.length && <Inset><Text v="label" tone="secondary">No foods match "{q}".</Text></Inset>}
    </>
  );
}
