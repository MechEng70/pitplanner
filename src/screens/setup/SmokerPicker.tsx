// Smoker picker (mockup 02; a port of legacy/src/screens/setup/SmokerPicker.tsx). A verified model fills its
// specs from data/cookers.json. A model with no checked specs, or "Not listed?", opens the manual form with
// every spec blank, for the user to copy from the manual (CLAUDE.md: no smoker specs without a source).
// StepSheet is the form's step and dial fields alone, for Other on the temp step question (T-082).
import { useState } from 'react';
import type { SmokerProfile } from '../../../engine/types';
import { kgToLb, type TempUnit } from '../../../engine/units';
import {
  Button,
  Chips,
  DashedButton,
  Field,
  Fill,
  GroupLabel,
  InfoBox,
  InputField,
  Inset,
  PickRow,
  Row,
  SearchField,
  Sheet,
  Stack,
  Text,
  useSheet,
} from '@/components/kit';
import type { Units } from '@/lib/format';
import {
  catalogName,
  catalogSmokers,
  hasHopper,
  manualSmoker,
  positiveNum,
  smokerFromCatalog,
  smokerTypes,
  stepSheetStart,
  typedPresetsF,
  typedStepF,
  typedTempF,
  typedTemps,
  withTemps,
  type CatalogSmoker,
  type SmokerType,
} from '@/lib/gear';

/** What the manual form starts from: nothing, or the name and type of a catalog model without checked specs. */
interface FormStart {
  id?: string;
  name?: string;
  type: SmokerType;
}

export function SmokerPicker({
  selectedId,
  units,
  onPick,
  onClose,
}: {
  selectedId?: string;
  units: Units;
  onPick: (s: SmokerProfile) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormStart | null>(null);
  // The form takes the picker's place: the list is not under it, so Close ends the whole flow.
  if (form) return <SmokerForm start={form} units={units} onSave={onPick} onClose={onClose} />;
  return (
    <Sheet
      title="Pick your smoker"
      onClose={onClose}
      flush
      tall
      footer={<DashedButton label="Not listed? Enter it yourself" onPress={() => setForm({ type: 'pellet' })} />}
    >
      <PickerList selectedId={selectedId} onPick={onPick} onManual={setForm} />
    </Sheet>
  );
}

function PickerList({
  selectedId,
  onPick,
  onManual,
}: {
  selectedId?: string;
  onPick: (s: SmokerProfile) => void;
  onManual: (start: FormStart) => void;
}) {
  const { close } = useSheet();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const needle = q.trim().toLowerCase();
  const match = (e: CatalogSmoker) =>
    (type === 'all' || e.type === type) && (!needle || catalogName(e).toLowerCase().includes(needle));
  const groups = smokerTypes
    .map(([t, info]) => ({ t, info, list: catalogSmokers.filter(e => e.type === t && match(e)) }))
    .filter(g => g.list.length > 0);
  const chips = [
    { id: 'all', label: 'All' },
    ...smokerTypes.filter(([t]) => catalogSmokers.some(e => e.type === t)).map(([t, i]) => ({ id: t, label: i.chip })),
  ];

  const pick = (e: CatalogSmoker) => {
    const s = smokerFromCatalog(e.id);
    if (s) close(() => onPick(s));
    else onManual({ id: e.id, name: catalogName(e), type: e.type });
  };
  return (
    <>
      <Inset>
        <Stack gap={12}>
          <SearchField placeholder="Search brand or model" value={q} onInput={setQ} />
          <Chips scroll label="Smoker type" value={type} onChange={setType} options={chips} />
        </Stack>
      </Inset>
      {groups.flatMap(({ t, info, list }) => [
        <GroupLabel key={t} label={info.group} note={info.note} />,
        ...list.map(e => (
          <PickRow key={e.id} label={catalogName(e)} selected={e.id === selectedId} onPress={() => pick(e)} />
        )),
      ])}
      {groups.length === 0 ? (
        <Inset>
          <Text variant="label" tone="secondary">
            {`No smokers match "${q}". Enter it yourself below.`}
          </Text>
        </Inset>
      ) : null}
    </>
  );
}

/* ---------- Manual entry ---------- */

/**
 * Smoker specs typed by the user: every field starts blank. Temps and the hopper are typed in the user's
 * units and stored in F and lb. The sheet keeps its full height and the field that comes and goes (the dial
 * settings, while there is no temp step) is the last one, so typing moves nothing.
 */
function SmokerForm({
  start,
  units,
  onSave,
  onClose,
}: {
  start: FormStart;
  units: Units;
  onSave: (s: SmokerProfile) => void;
  onClose: () => void;
}) {
  const unitT = units.temp;
  const kg = units.weight === 'kg';
  const [name, setName] = useState(start.name ?? '');
  const [type, setType] = useState<SmokerType>(start.type);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [stepS, setStepS] = useState('');
  const [presets, setPresets] = useState('');
  const [hopper, setHopper] = useState('');
  const [grate, setGrate] = useState('');

  const minF = typedTempF(min, unitT);
  const maxF = typedTempF(max, unitT);
  const stepF = typedStepF(stepS, unitT);
  const temps = typedTemps(stepF, typedPresetsF(presets, unitT));
  const hopperN = positiveNum(hopper);
  const smoker =
    name.trim() && minF != null && maxF != null && minF < maxF && temps
      ? manualSmoker({
          id: start.id,
          name: name.trim(),
          type,
          minTempF: minF,
          maxTempF: maxF,
          ...temps,
          hopperLb: hopperN == null ? null : kg ? kgToLb(hopperN) : hopperN,
          mainGrateSqIn: positiveNum(grate),
        })
      : null;

  return (
    <Sheet
      title={start.name ?? 'Your smoker'}
      onClose={onClose}
      tall
      footer={<SaveButton smoker={smoker} onSave={onSave} />}
    >
      <Stack gap={16}>
        {start.id ? (
          <InfoBox>No checked specs for this model yet. Copy them from the manual or the label on the grill.</InfoBox>
        ) : (
          <InputField label="Name" value={name} onInput={setName} placeholder="Brand and model" />
        )}
        <Field label="Type">
          <Chips
            scroll
            label="Smoker type"
            value={type}
            onChange={v => setType(v as SmokerType)}
            options={smokerTypes.map(([t, i]) => ({ id: t, label: i.chip }))}
          />
        </Field>
        <Row gap={12} align="start">
          <Fill>
            <InputField numeric label={`Lowest temp (${unitT})`} value={min} onInput={setMin} />
          </Fill>
          <Fill>
            <InputField numeric label={`Highest temp (${unitT})`} value={max} onInput={setMax} />
          </Fill>
        </Row>
        <StepField unit={unitT} value={stepS} onInput={setStepS} />
        {/* The grate keeps its half of the row when the type has no hopper. */}
        <Row gap={12} align="start">
          <Fill>
            <InputField numeric label="Main grate (sq in)" value={grate} onInput={setGrate} />
          </Fill>
          <Fill>
            {hasHopper(type) ? (
              <InputField numeric label={`Hopper (${units.weight})`} value={hopper} onInput={setHopper} />
            ) : null}
          </Fill>
        </Row>
        {stepF == null ? <DialField unit={unitT} value={presets} onInput={setPresets} /> : null}
      </Stack>
    </Sheet>
  );
}

/**
 * Other on the temp step question (T-082): a picked smoker's step or dial settings only, with the manual form's
 * two fields and parsing. Everything else (name, id, specs) stays. Both fields stay on screen so the short
 * sheet never moves while typing; a step, when typed, wins over the settings, as in the manual form. It opens
 * with the saved step or dial settings when Other is what is saved (stepSheetStart), blank otherwise.
 */
export function StepSheet({
  smoker,
  units,
  onSave,
  onClose,
}: {
  smoker: SmokerProfile;
  units: Units;
  onSave: (s: SmokerProfile) => void;
  onClose: () => void;
}) {
  const unitT = units.temp;
  const [start] = useState(() => stepSheetStart(smoker, unitT));
  const [stepS, setStepS] = useState(start.step);
  const [presets, setPresets] = useState(start.presets);
  const temps = typedTemps(typedStepF(stepS, unitT), typedPresetsF(presets, unitT));
  return (
    <Sheet
      title={smoker.name}
      onClose={onClose}
      footer={<SaveButton smoker={temps ? withTemps(smoker, temps) : null} onSave={onSave} />}
    >
      <StepField unit={unitT} value={stepS} onInput={setStepS} />
      <DialField unit={unitT} value={presets} onInput={setPresets} />
    </Sheet>
  );
}

function StepField({ unit, value, onInput }: { unit: TempUnit; value: string; onInput: (v: string) => void }) {
  return (
    <InputField
      numeric
      label={`Temp step (${unit})`}
      value={value}
      onInput={onInput}
      note="How far one press moves the setting. Leave blank if the dial has fixed settings."
    />
  );
}

const DIAL_PLACEHOLDER: Record<TempUnit, string> = { F: '180, 225, 250, 300', C: '80, 105, 120, 150' };
function DialField({ unit, value, onInput }: { unit: TempUnit; value: string; onInput: (v: string) => void }) {
  return (
    <InputField
      label={`Dial settings (${unit})`}
      value={value}
      onInput={onInput}
      placeholder={DIAL_PLACEHOLDER[unit]}
    />
  );
}

/** Closes the sheet, then hands the smoker over. Off until what the sheet needs is in. */
function SaveButton({ smoker, onSave }: { smoker: SmokerProfile | null; onSave: (s: SmokerProfile) => void }) {
  const { close } = useSheet();
  return (
    <Button block disabled={!smoker} onPress={() => smoker && close(() => onSave(smoker))}>
      <Text>Save smoker</Text>
    </Button>
  );
}
