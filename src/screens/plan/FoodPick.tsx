// Add food (mockup 07): a searchable list of the foods in the rules file, under its groups. A port of
// legacy/src/screens/plan/FoodPick.tsx. Choosing a food closes the sheet, then hands the food's id over.
import { useState } from 'react';
import { Avatar, GroupLabel, Inset, ListRow, SearchField, Sheet, Text, useSheet } from '@/components/kit';
import { foodBlurb, foods, groups, type FoodDef } from '@/lib/rules';

export function FoodPick({ onPick, onClose }: { onPick: (foodId: string) => void; onClose: () => void }) {
  return (
    <Sheet title="Add food" onClose={onClose} flush>
      <FoodList onPick={onPick} />
    </Sheet>
  );
}

function FoodList({ onPick }: { onPick: (foodId: string) => void }) {
  const { close } = useSheet();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (f: FoodDef) =>
    !needle || f.name.toLowerCase().includes(needle) || f.group.toLowerCase().includes(needle);
  const shown = groups()
    .map(g => ({ g, list: foods.filter(f => f.group === g && match(f)) }))
    .filter(x => x.list.length > 0);

  return (
    <>
      <Inset>
        <SearchField placeholder="Search foods" value={q} onInput={setQ} />
      </Inset>
      {shown.flatMap(({ g, list }) => [
        <GroupLabel key={g} label={g} />,
        ...list.map(f => (
          <ListRow
            key={f.id}
            leading={<Avatar kind={f.methods[0]!.cooker} size={40} />}
            title={f.name}
            subtitle={foodBlurb(f)}
            onPress={() => close(() => onPick(f.id))}
          />
        )),
      ])}
      {shown.length === 0 ? (
        <Inset>
          <Text variant="label" tone="secondary">
            {`No foods match "${q}".`}
          </Text>
        </Inset>
      ) : null}
    </>
  );
}
