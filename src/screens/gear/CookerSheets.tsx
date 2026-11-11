import { useState } from 'preact/hooks';
import type { GriddleProfile } from '../../../engine/types.ts';
import { Button, Chips, Field, InputField, Sheet, Stack, useSheet } from '../../ui/components.tsx';

const SIZES = [17, 22, 28, 36];
const BURNERS = [1, 2, 3, 4];

/** Griddle details (mockup 18). Nothing is saved until Save griddle; closing an added one adds nothing. */
export function GriddleSheet({ initial, onSave, onRemove, onClose }: {
  initial: GriddleProfile; onSave: (g: GriddleProfile) => void; onRemove?: () => void; onClose: () => void;
}) {
  const [g, setG] = useState(initial);
  const sizes = SIZES.includes(g.sizeIn) ? SIZES : [...SIZES, g.sizeIn].sort((a, b) => a - b);
  return (
    <Sheet title="Griddle" onClose={onClose} footer={<Actions what="griddle" onSave={() => onSave({ ...g, name: g.name.trim() || 'Griddle' })} onRemove={onRemove} />}>
      <Stack gap={16}>
        <InputField label="Name" value={g.name === 'Griddle' ? '' : g.name} placeholder="Griddle" onInput={name => setG({ ...g, name })} />
        <Field label="Cooking surface">
          <Chips label="Cooking surface" value={String(g.sizeIn)} onChange={v => setG({ ...g, sizeIn: +v })}
            options={sizes.map(n => ({ id: String(n), label: `${n} in` }))} />
        </Field>
        <Field label="Burners (heat zones)">
          <Chips label="Burners" value={String(g.burners)} onChange={v => setG({ ...g, burners: +v })}
            options={BURNERS.map(n => ({ id: String(n), label: String(n) }))} />
        </Field>
        <Field label="Dome or cover" note="Used to finish thick chicken and wings.">
          <Chips label="Dome or cover" value={g.hasDome ? 'yes' : 'no'} onChange={v => setG({ ...g, hasDome: v === 'yes' })}
            options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} />
        </Field>
      </Stack>
    </Sheet>
  );
}

/** Save, plus Remove when the cooker is already saved and is not the last one that can cook. */
function Actions({ what, onSave, onRemove }: { what: string; onSave: () => void; onRemove?: () => void }) {
  const { close } = useSheet();
  return (
    <Stack gap={4} grow>
      <Button block onClick={() => close(onSave)}>Save {what}</Button>
      {onRemove && <Button kind="text" block tone="danger" onClick={() => close(onRemove)}>Remove {what}</Button>}
    </Stack>
  );
}
