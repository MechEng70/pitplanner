import { useCallback, useEffect, useState } from 'preact/hooks';
import { App as CapApp } from '@capacitor/app';
import type { Cookers, SmokerProfile } from '../../../engine/types.ts';
import { kgToLb, lbToKg, showTemp } from '../../../engine/units.ts';
import { Avatar, CheckRow, DashedButton, Field, GroupCard, InputField, OptionCard, Row, Segmented, SelectField, SetupActions, SetupPage } from '../../ui/components.tsx';
import { ChevronRight } from '../../ui/icons.tsx';
import { useBack } from '../../ui/back.ts';
import { useStore } from '../../lib/store.tsx';
import type { Units } from '../../lib/format.ts';
import { catalogSmokers, defaultGriddle, defaultOven, hasHopper, smokerTypeInfo } from '../../lib/gear.ts';
import { AlertChecks, TestAlertButton, useAlarmStatus } from '../shared/AlertChecks.tsx';
import { AddCooker } from '../shared/AddCooker.tsx';
import { SmokerPicker } from './SmokerPicker.tsx';

const STEPS = 3;

/** First launch (mockups 01-03): welcome and units, cookers, alert permissions. Saves on Finish setup. */
export function Setup() {
  const { state, finishSetup } = useStore();
  const [step, setStep] = useState(1);
  const [units, setUnits] = useState<Units>(state.units);
  const [smoker, setSmoker] = useState<SmokerProfile | null>(state.gear.smoker ?? null);
  const [useSmoker, setUseSmoker] = useState(true);
  const [griddle, setGriddle] = useState(!!state.gear.griddle);
  const [oven, setOven] = useState(true);
  const [sheet, setSheet] = useState<'picker' | 'add' | null>(null);

  const back = useCallback(() => setStep(s => s - 1), []);
  const gear = (): Cookers => ({
    ...(useSmoker && smoker ? { smoker } : {}),
    ...(griddle ? { griddle: state.gear.griddle ?? defaultGriddle() } : {}),
    ...(oven ? { oven: state.gear.oven ?? defaultOven() } : {}),
  });
  const hasCooker = (useSmoker && !!smoker) || griddle;

  return (
    <div class="overlay-screen">
      <BackHandler onBack={step > 1 ? back : () => CapApp.minimizeApp()} />
      {step === 1 && (
        <SetupPage step={1} steps={STEPS} title="Welcome to Pit Planner"
          intro="Pick when you want to eat. Pit Planner works out when to fire the smoker and when each food goes on, and alerts you at every step."
          footer={<SetupActions next="Continue" onNext={() => setStep(2)} />}>
          <Field label="Temperature">
            <Segmented label="Temperature unit" value={units.temp} onChange={v => setUnits({ ...units, temp: v as Units['temp'] })}
              options={[{ id: 'F', label: 'Fahrenheit' }, { id: 'C', label: 'Celsius' }]} />
          </Field>
          <Field label="Weight">
            <Segmented label="Weight unit" value={units.weight} onChange={v => setUnits({ ...units, weight: v as Units['weight'] })}
              options={[{ id: 'lb', label: 'Pounds' }, { id: 'kg', label: 'Kilograms' }]} />
          </Field>
        </SetupPage>
      )}
      {step === 2 && (
        <SetupPage step={2} steps={STEPS} title="What do you cook on?"
          intro="Times and alerts are planned around your gear. You can change this later."
          footer={<SetupActions onBack={back} next="Continue" disabled={!hasCooker} onNext={() => setStep(3)} />}>
          <SmokerCard smoker={smoker} selected={useSmoker && !!smoker} units={units} onChange={setSmoker}
            onToggle={() => smoker ? setUseSmoker(!useSmoker) : setSheet('picker')} onPick={() => setSheet('picker')} />
          <GroupCard>
            <CheckRow leading={<Avatar kind="griddle" size={40} />} title="Griddle" subtitle="Searing, chicken, wings" checked={griddle} onChange={setGriddle} />
            <CheckRow leading={<Avatar kind="oven" size={40} />} title="Oven for holding"
              subtitle={`Lowest setting ${showTemp((state.gear.oven ?? defaultOven()).lowestTempF, units.temp, true)}`} checked={oven} onChange={setOven} />
          </GroupCard>
          <DashedButton onClick={() => setSheet('add')}>Add another cooker</DashedButton>
        </SetupPage>
      )}
      {step === 3 && <AlertsStep onBack={back} onFinish={() => finishSetup(gear(), units)} />}

      {sheet === 'picker' && (
        <SmokerPicker selectedId={smoker?.id} units={units} onClose={() => setSheet(null)}
          onPick={s => { setSmoker(s); setUseSmoker(true); }} />
      )}
      {sheet === 'add' && (
        <AddCooker onClose={() => setSheet(null)} hide={[...(griddle ? ['griddle' as const] : []), ...(oven ? ['oven' as const] : [])]}
          onPick={k => k === 'smoker' ? setSheet('picker') : k === 'griddle' ? setGriddle(true) : setOven(true)} />
      )}
    </div>
  );
}

function BackHandler({ onBack }: { onBack: () => void }) {
  useBack(onBack);
  return null;
}

/** Smoker card (mockup 01): model field opens the picker; hopper and grate stay editable. */
function SmokerCard({ smoker, selected, units, onToggle, onPick, onChange }: {
  smoker: SmokerProfile | null; selected: boolean; units: Units; onToggle: () => void; onPick: () => void; onChange: (s: SmokerProfile) => void;
}) {
  const verified = !!smoker && catalogSmokers.some(e => e.id === smoker.id && e.verified);
  const kg = units.weight === 'kg';
  const fmt = (n: number | null) => n == null ? '' : String(Math.round(n * 10) / 10);
  const [hopper, setHopper] = useState('');
  const [grate, setGrate] = useState('');
  // Fresh text when a different smoker is picked or the unit changes.
  useEffect(() => {
    setHopper(fmt(smoker?.hopperLb == null ? null : kg ? lbToKg(smoker.hopperLb) : smoker.hopperLb));
    setGrate(fmt(smoker?.mainGrateSqIn ?? null));
  }, [smoker?.id, kg]);
  const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

  return (
    <OptionCard selected={selected} leading={<Avatar kind="smoker" size={40} />}
      title={smoker ? smokerTypeInfo(smoker.type).title : 'Smoker'}
      subtitle={!smoker ? 'Pick your model' : verified ? 'Hopper and grate filled from the model' : 'Specs entered by you'}
      onToggle={onToggle}>
      {smoker && <>
        <SelectField label="Model" value={smoker.name} onClick={onPick} trailing={<ChevronRight color="var(--text-2)" />} />
        <Row gap={12} align="start">
          {hasHopper(smoker.type) && (
            <InputField numeric label={`Hopper (${units.weight})`} value={hopper} onInput={v => {
              setHopper(v); const n = num(v); onChange({ ...smoker, hopperLb: n == null ? null : kg ? kgToLb(n) : n });
            }} />
          )}
          <InputField numeric label="Main grate (sq in)" value={grate} onInput={v => { setGrate(v); onChange({ ...smoker, mainGrateSqIn: num(v) }); }} />
        </Row>
      </>}
    </OptionCard>
  );
}

function AlertsStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const [status, refresh] = useAlarmStatus();
  return (
    <SetupPage step={3} steps={STEPS} title="Make sure alerts get through"
      intro={'A 6 AM "wrap the brisket" alert has to ring even with the phone asleep. Android needs three permissions for that.'}
      footer={<SetupActions onBack={onBack} next="Finish setup" onNext={onFinish} />}>
      {status && <AlertChecks status={status} onChange={refresh} />}
      <TestAlertButton />
    </SetupPage>
  );
}
