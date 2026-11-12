import { useState } from 'preact/hooks';
import type { SmokerProfile } from '../../../engine/types.ts';
import { cToF, fToC, kgToLb } from '../../../engine/units.ts';
import {
  Button,
  Chips,
  DashedButton,
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
} from '../../ui/components.tsx';
import {
  catalogName,
  catalogSmokers,
  hasHopper,
  manualSmoker,
  smokerFromCatalog,
  smokerTypes,
  type CatalogSmoker,
  type ManualSmoker,
  type SmokerType,
} from '../../lib/gear.ts';
import type { Units } from '../../lib/format.ts';

/**
 * Smoker picker (mockup 02). Verified models fill their specs; an unverified model or "Not listed?"
 * opens the manual form so the user copies specs from the manual (CLAUDE.md: no unsourced specs).
 */
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
  const [form, setForm] = useState<Partial<ManualSmoker> | null>(null);
  if (form)
    return (
      <SmokerForm
        initial={form}
        units={units}
        onSave={s => {
          onPick(s);
          onClose();
        }}
        onClose={onClose}
      />
    );
  return (
    <Sheet
      title="Pick your smoker"
      onClose={onClose}
      flush
      footer={<PickerFooter onManual={() => setForm({ type: 'pellet' })} />}
    >
      <PickerList selectedId={selectedId} onPick={onPick} onManual={setForm} />
    </Sheet>
  );
}

// The form replaces the picker in place: closing the picker sheet would close the whole flow.
function PickerFooter({ onManual }: { onManual: () => void }) {
  return <DashedButton onClick={onManual}>Not listed? Enter it yourself</DashedButton>;
}

function PickerList({
  selectedId,
  onPick,
  onManual,
}: {
  selectedId?: string;
  onPick: (s: SmokerProfile) => void;
  onManual: (m: Partial<ManualSmoker>) => void;
}) {
  const { close } = useSheet();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const needle = q.trim().toLowerCase();
  const match = (e: CatalogSmoker) =>
    (type === 'all' || e.type === type) && (!needle || catalogName(e).toLowerCase().includes(needle));
  const groups = smokerTypes
    .map(([t, info]) => ({ t, info, list: catalogSmokers.filter(e => e.type === t && match(e)) }))
    .filter(g => g.list.length);
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
      <div role="listbox" aria-label="Smokers">
        {groups.map(({ t, info, list }) => (
          <div key={t}>
            <GroupLabel note={info.note}>{info.group}</GroupLabel>
            {list.map(e => (
              <PickRow key={e.id} label={catalogName(e)} selected={e.id === selectedId} onClick={() => pick(e)} />
            ))}
          </div>
        ))}
      </div>
      {!groups.length && (
        <Inset>
          <Text v="label" tone="secondary">
            No smokers match "{q}". Enter it yourself below.
          </Text>
        </Inset>
      )}
    </>
  );
}

/* ---------- Manual entry ---------- */

const numOrNull = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Smoker specs typed by the user. Temps show in the user's unit; stored in F. */
function SmokerForm({
  initial,
  units,
  onSave,
  onClose,
}: {
  initial: Partial<ManualSmoker>;
  units: Units;
  onSave: (s: SmokerProfile) => void;
  onClose: () => void;
}) {
  const C = units.temp === 'C';
  const showT = (f?: number | null) => (f == null ? '' : String(Math.round(C ? fToC(f) : f)));
  const toF = (v: string) => {
    const n = numOrNull(v);
    return n == null ? null : Math.round(C ? cToF(n) : n);
  };
  const kg = units.weight === 'kg';
  const [name, setName] = useState(initial.name ?? '');
  const [type, setType] = useState<SmokerType>(initial.type ?? 'pellet');
  const [min, setMin] = useState(showT(initial.minTempF));
  const [max, setMax] = useState(showT(initial.maxTempF));
  const [stepS, setStepS] = useState(
    initial.tempStepF ? String(Math.round(C ? (initial.tempStepF * 5) / 9 : initial.tempStepF)) : '',
  );
  const [presets, setPresets] = useState('');
  const [hopper, setHopper] = useState('');
  const [grate, setGrate] = useState('');

  const minF = toF(min),
    maxF = toF(max);
  const stepN = numOrNull(stepS);
  const stepF = stepN == null ? null : Math.max(1, Math.round(C ? (stepN * 9) / 5 : stepN));
  const presetsF = presets
    .split(/[\s,;]+/)
    .map(toF)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  const hopperN = numOrNull(hopper);
  const ok = name.trim() && minF != null && maxF != null && minF < maxF && (stepF != null || presetsF.length >= 2);
  const unitT = units.temp;

  const save = () =>
    ok &&
    onSave(
      manualSmoker({
        id: initial.id,
        name: name.trim(),
        type,
        minTempF: minF!,
        maxTempF: maxF!,
        tempStepF: stepF,
        tempPresetsF: presetsF,
        hopperLb: hopperN == null ? null : kg ? kgToLb(hopperN) : hopperN,
        mainGrateSqIn: numOrNull(grate),
      }),
    );

  return (
    <Sheet
      title={initial.name ?? 'Your smoker'}
      onClose={onClose}
      footer={
        <Button block disabled={!ok} onClick={save}>
          Save smoker
        </Button>
      }
    >
      <Stack gap={16}>
        {initial.id && (
          <InfoBox>No checked specs for this model yet. Copy them from the manual or the label on the grill.</InfoBox>
        )}
        {!initial.id && <InputField label="Name" value={name} onInput={setName} placeholder="Brand and model" />}
        <Stack gap={8}>
          <Text v="label" tone="secondary">
            Type
          </Text>
          <Chips
            scroll
            label="Smoker type"
            value={type}
            onChange={v => setType(v as SmokerType)}
            options={smokerTypes.map(([t, i]) => ({ id: t, label: i.chip }))}
          />
        </Stack>
        <Row gap={12} align="start">
          <InputField numeric label={`Lowest temp (${unitT})`} value={min} onInput={setMin} />
          <InputField numeric label={`Highest temp (${unitT})`} value={max} onInput={setMax} />
        </Row>
        <InputField
          numeric
          label={`Temp step (${unitT})`}
          value={stepS}
          onInput={setStepS}
          note="How far one press moves the setting. Leave blank if the dial has fixed settings."
        />
        {stepF == null && (
          <InputField
            label={`Dial settings (${unitT})`}
            value={presets}
            onInput={setPresets}
            placeholder={C ? '80, 105, 120, 150' : '180, 225, 250, 300'}
          />
        )}
        <Row gap={12} align="start">
          {hasHopper(type) && (
            <InputField numeric label={`Hopper (${units.weight})`} value={hopper} onInput={setHopper} />
          )}
          <InputField numeric label="Main grate (sq in)" value={grate} onInput={setGrate} />
        </Row>
      </Stack>
    </Sheet>
  );
}
