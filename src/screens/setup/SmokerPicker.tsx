// Smoker picker (mockup 02; a port of legacy/src/screens/setup/SmokerPicker.tsx). A verified model fills its
// specs from data/cookers.json. A model with no checked specs, or "Not listed?", opens the manual form with
// every spec blank, for the user to copy from the manual (CLAUDE.md: no smoker specs without a source).
import { useState } from 'react';
import type { SmokerProfile } from '../../../engine/types';
import { cToF, kgToLb } from '../../../engine/units';
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
  smokerFromCatalog,
  smokerTypes,
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

const numOrNull = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
  const C = units.temp === 'C';
  const kg = units.weight === 'kg';
  const toF = (v: string) => {
    const n = numOrNull(v);
    return n == null ? null : Math.round(C ? cToF(n) : n);
  };
  const [name, setName] = useState(start.name ?? '');
  const [type, setType] = useState<SmokerType>(start.type);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [stepS, setStepS] = useState('');
  const [presets, setPresets] = useState('');
  const [hopper, setHopper] = useState('');
  const [grate, setGrate] = useState('');

  const minF = toF(min);
  const maxF = toF(max);
  const stepN = numOrNull(stepS);
  const stepF = stepN == null ? null : Math.max(1, Math.round(C ? (stepN * 9) / 5 : stepN));
  const presetsF = presets
    .split(/[\s,;]+/)
    .map(toF)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  const hopperN = numOrNull(hopper);
  const smoker =
    name.trim() && minF != null && maxF != null && minF < maxF && (stepF != null || presetsF.length >= 2)
      ? manualSmoker({
          id: start.id,
          name: name.trim(),
          type,
          minTempF: minF,
          maxTempF: maxF,
          tempStepF: stepF,
          tempPresetsF: presetsF,
          hopperLb: hopperN == null ? null : kg ? kgToLb(hopperN) : hopperN,
          mainGrateSqIn: numOrNull(grate),
        })
      : null;
  const unitT = units.temp;

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
        <InputField
          numeric
          label={`Temp step (${unitT})`}
          value={stepS}
          onInput={setStepS}
          note="How far one press moves the setting. Leave blank if the dial has fixed settings."
        />
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
        {stepF == null ? (
          <InputField
            label={`Dial settings (${unitT})`}
            value={presets}
            onInput={setPresets}
            placeholder={C ? '80, 105, 120, 150' : '180, 225, 250, 300'}
          />
        ) : null}
      </Stack>
    </Sheet>
  );
}

/** Closes the sheet, then hands the smoker over. Off until the name, the range and a step or settings are in. */
function SaveButton({ smoker, onSave }: { smoker: SmokerProfile | null; onSave: (s: SmokerProfile) => void }) {
  const { close } = useSheet();
  return (
    <Button block disabled={!smoker} onPress={() => smoker && close(() => onSave(smoker))}>
      <Text>Save smoker</Text>
    </Button>
  );
}
