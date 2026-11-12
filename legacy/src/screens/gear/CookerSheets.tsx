import { useState } from 'preact/hooks';
import type { GriddleProfile, OvenProfile } from '../../../engine/types.ts';
import { cToF, fToC, showTemp } from '../../../engine/units.ts';
import { Button, Chips, Field, InputField, Sheet, Stack, Stepper, useSheet } from '../../ui/components.tsx';
import type { Units } from '../../lib/format.ts';

const SIZES = [17, 22, 28, 36];
const BURNERS = [1, 2, 3, 4];

/** Griddle details (mockup 18). Nothing is saved until Save griddle; closing an added one adds nothing. */
export function GriddleSheet({
  initial,
  onSave,
  onRemove,
  onClose,
}: {
  initial: GriddleProfile;
  onSave: (g: GriddleProfile) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [g, setG] = useState(initial);
  const sizes = SIZES.includes(g.sizeIn) ? SIZES : [...SIZES, g.sizeIn].sort((a, b) => a - b);
  return (
    <Sheet
      title="Griddle"
      onClose={onClose}
      footer={
        <Actions what="griddle" onSave={() => onSave({ ...g, name: g.name.trim() || 'Griddle' })} onRemove={onRemove} />
      }
    >
      <Stack gap={16}>
        <InputField
          label="Name"
          value={g.name === 'Griddle' ? '' : g.name}
          placeholder="Griddle"
          onInput={name => setG({ ...g, name })}
        />
        <Field label="Cooking surface">
          <Chips
            label="Cooking surface"
            value={String(g.sizeIn)}
            onChange={v => setG({ ...g, sizeIn: +v })}
            options={sizes.map(n => ({ id: String(n), label: `${n} in` }))}
          />
        </Field>
        <Field label="Burners (heat zones)">
          <Chips
            label="Burners"
            value={String(g.burners)}
            onChange={v => setG({ ...g, burners: +v })}
            options={BURNERS.map(n => ({ id: String(n), label: String(n) }))}
          />
        </Field>
        <Field label="Dome or cover" note="Used to finish thick chicken and wings.">
          <Chips
            label="Dome or cover"
            value={g.hasDome ? 'yes' : 'no'}
            onChange={v => setG({ ...g, hasDome: v === 'yes' })}
            options={[
              { id: 'yes', label: 'Yes' },
              { id: 'no', label: 'No' },
            ]}
          />
        </Field>
      </Stack>
    </Sheet>
  );
}

const HOLD_MIN_F = 140; // food safety floor for holding
const TYPICAL_LOW_F = 170; // where most ovens bottom out
const OVEN_MAX_F = 250;

/** Oven details (mockup 19). Steps 5F, or 5C in Celsius; stored in F. */
export function OvenSheet({
  initial,
  units,
  onSave,
  onRemove,
  onClose,
}: {
  initial: OvenProfile;
  units: Units;
  onSave: (o: OvenProfile) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [o, setO] = useState(initial);
  const C = units.temp === 'C';
  const shown = C ? Math.round(fToC(o.lowestTempF) / 5) * 5 : Math.round(o.lowestTempF / 5) * 5;
  const toF = (v: number) => (C ? cToF(v) : v);
  const step = (d: number) =>
    setO({ ...o, lowestTempF: Math.min(OVEN_MAX_F, Math.max(HOLD_MIN_F, toF(shown + d * 5))) });
  return (
    <Sheet title="Oven" onClose={onClose} footer={<Actions what="oven" onSave={() => onSave(o)} onRemove={onRemove} />}>
      <Stack gap={16}>
        <Field
          label="Lowest oven setting"
          note={`Holding needs at least ${showTemp(HOLD_MIN_F, units.temp)}. Most ovens bottom out at ${showTemp(TYPICAL_LOW_F, units.temp, true)}.`}
        >
          <Stepper
            label="Lowest oven setting"
            value={String(shown)}
            unit={units.temp}
            onDec={() => step(-1)}
            onInc={() => step(1)}
            decDisabled={toF(shown - 5) < HOLD_MIN_F - 0.5}
            incDisabled={toF(shown + 5) > OVEN_MAX_F + 0.5}
          />
        </Field>
        <Field label="Hold food in">
          <Chips
            label="Hold food in"
            value={o.holdIn}
            onChange={v => setO({ ...o, holdIn: v as OvenProfile['holdIn'] })}
            options={[
              { id: 'oven', label: 'Oven' },
              { id: 'cooler', label: 'Towel-lined cooler' },
              { id: 'ask', label: 'Ask each time' },
            ]}
          />
        </Field>
        <Field label="Warming drawer">
          <Chips
            label="Warming drawer"
            value={o.warmingDrawer ? 'yes' : 'no'}
            onChange={v => setO({ ...o, warmingDrawer: v === 'yes' })}
            options={[
              { id: 'yes', label: 'Yes' },
              { id: 'no', label: 'No' },
            ]}
          />
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
      <Button block onClick={() => close(onSave)}>
        Save {what}
      </Button>
      {onRemove && (
        <Button kind="text" block tone="danger" onClick={() => close(onRemove)}>
          Remove {what}
        </Button>
      )}
    </Stack>
  );
}
