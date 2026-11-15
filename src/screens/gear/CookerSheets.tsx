// Cooker sheets opened from Gear (a port of legacy/src/screens/gear/CookerSheets.tsx): Griddle (mockup 18),
// Oven (mockup 19), and for the smoker the Setup picker with its manual form (mockup 02, T-024). Nothing is
// saved until Save; closing a sheet changes nothing, and closing one opened from Add a cooker adds nothing.
// Remove is there only for a saved cooker that leaves another one behind, and never for the last cooker
// that can cook (0.2.0: the griddle goes only while there is a smoker; the smoker is replaced, not removed).
import { useState } from 'react';
import type { Cookers, GriddleProfile, OvenProfile } from '../../../engine/types';
import { cToF, fToC } from '../../../engine/units';
import { Button, Chips, Field, Fill, InputField, Num, Sheet, Stack, Stepper, Text, useSheet } from '@/components/kit';
import { fmtTemp, type Units } from '@/lib/format';
import { defaultGriddle, defaultOven } from '@/lib/gear';
import { useStore } from '@/lib/store';
import { SmokerPicker } from '@/screens/setup/SmokerPicker';
import type { CookerKind } from '@/screens/shared/AddCooker';

const SIZES = [17, 22, 28, 36];
const BURNERS = [1, 2, 3, 4];
const YES_NO = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
];

/**
 * The sheet for one kind of cooker, over the store: the one the user has (edit) or a new one (add).
 * Save writes through `setGear`, so the plan is built with the new values.
 */
export function CookerSheets({ kind, onClose }: { kind: CookerKind; onClose: () => void }) {
  const { state, setGear } = useStore();
  const { gear, units } = state;
  if (kind === 'smoker')
    return (
      <SmokerPicker
        selectedId={gear.smoker?.id}
        units={units}
        onClose={onClose}
        onPick={smoker => setGear({ ...gear, smoker })}
      />
    );
  if (kind === 'griddle')
    return (
      <GriddleSheet
        initial={gear.griddle ?? defaultGriddle()}
        onClose={onClose}
        onSave={griddle => setGear({ ...gear, griddle })}
        onRemove={gear.griddle && gear.smoker ? () => setGear(without(gear, 'griddle')) : undefined}
      />
    );
  return (
    <OvenSheet
      initial={gear.oven ?? defaultOven()}
      units={units}
      onClose={onClose}
      onSave={oven => setGear({ ...gear, oven })}
      onRemove={gear.oven && (gear.smoker || gear.griddle) ? () => setGear(without(gear, 'oven')) : undefined}
    />
  );
}

function without(gear: Cookers, k: CookerKind): Cookers {
  const rest = { ...gear };
  delete rest[k];
  return rest;
}

/** Griddle details (mockup 18). A griddle still called "Griddle" shows an empty Name with that placeholder. */
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
  // A size that is not one of the four (an imported backup) keeps its chip.
  const sizes = SIZES.includes(g.sizeIn) ? SIZES : [...SIZES, g.sizeIn].sort((a, b) => a - b);
  return (
    <Sheet
      title="Griddle"
      onClose={onClose}
      footer={
        <Actions what="griddle" onSave={() => onSave({ ...g, name: g.name.trim() || 'Griddle' })} onRemove={onRemove} />
      }
    >
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
          options={YES_NO}
        />
      </Field>
    </Sheet>
  );
}

const HOLD_MIN_F = 140; // food safety floor for holding
const TYPICAL_LOW_F = 170; // where most ovens bottom out
const OVEN_MAX_F = 250;
const STEP = 5; // 5F, or 5C in Celsius

/** Oven details (mockup 19). The lowest setting steps by 5F, or by 5C in Celsius, and is stored in F. */
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
  const shown = Math.round((C ? fToC(o.lowestTempF) : o.lowestTempF) / STEP) * STEP;
  const toF = (v: number) => (C ? cToF(v) : v);
  const step = (d: number) =>
    setO({ ...o, lowestTempF: Math.min(OVEN_MAX_F, Math.max(HOLD_MIN_F, toF(shown + d * STEP))) });
  return (
    <Sheet title="Oven" onClose={onClose} footer={<Actions what="oven" onSave={() => onSave(o)} onRemove={onRemove} />}>
      <Field
        label="Lowest oven setting"
        note={
          <Temps
            text={`Holding needs at least ${fmtTemp(HOLD_MIN_F, units)}. Most ovens bottom out at ${fmtTemp(TYPICAL_LOW_F, units, true)}.`}
          />
        }
      >
        <Stepper
          label="Lowest oven setting"
          value={String(shown)}
          unit={units.temp}
          onDec={() => step(-1)}
          onInc={() => step(1)}
          decDisabled={toF(shown - STEP) < HOLD_MIN_F - 0.5}
          incDisabled={toF(shown + STEP) > OVEN_MAX_F + 0.5}
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
          options={YES_NO}
        />
      </Field>
    </Sheet>
  );
}

/** A sentence with each temp in it as a Num, so none breaks across lines. Goes inside a Text. */
function Temps({ text }: { text: string }) {
  return <>{text.split(/(\d+[FC])\b/).map((part, i) => (i % 2 ? <Num key={i}>{part}</Num> : part))}</>;
}

/** Save, and under it Remove when the cooker may go. Each closes the sheet first, then acts. */
function Actions({ what, onSave, onRemove }: { what: string; onSave: () => void; onRemove?: () => void }) {
  const { close } = useSheet();
  return (
    <Fill>
      <Stack gap={4}>
        <Button block onPress={() => close(onSave)}>
          <Text>{`Save ${what}`}</Text>
        </Button>
        {onRemove ? (
          <Button kind="text" block tone="danger" onPress={() => close(onRemove)}>
            <Text>{`Remove ${what}`}</Text>
          </Button>
        ) : null}
      </Stack>
    </Fill>
  );
}
