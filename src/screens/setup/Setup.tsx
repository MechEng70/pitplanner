// First launch (mockups 01-03; a port of legacy/src/screens/setup/Setup.tsx): welcome and units, cookers,
// then the alerts step. Nothing is saved until the last step's button. The alerts step is T-025's: it comes
// in as `alertsStep`; without it Setup finishes on the cookers step.
import { useEffect, useState, type ReactNode } from 'react';
import type { Cookers, SmokerProfile } from '../../../engine/types';
import { kgToLb, lbToKg } from '../../../engine/units';
import {
  Avatar,
  CheckRow,
  ChevronRight,
  DashedButton,
  Field,
  Fill,
  GroupCard,
  InputField,
  Num,
  OptionCard,
  Row,
  Segmented,
  SelectField,
  SetupActions,
  SetupPage,
} from '@/components/kit';
import { fmtTemp, type Units } from '@/lib/format';
import { catalogSmokers, defaultGriddle, defaultOven, hasHopper, smokerTypeInfo } from '@/lib/gear';
import { useStore } from '@/lib/store';
import { AddCooker } from '@/screens/shared/AddCooker';
import { colors } from '@/theme/tokens';
import { SmokerPicker } from './SmokerPicker';

export const SETUP_STEPS = 3;

/** The last step (mockup 03), drawn by T-025 as a `SetupPage` with step 3 of `SETUP_STEPS`. */
export type AlertsStep = (p: { onBack: () => void; onFinish: () => void }) => ReactNode;

export function Setup({
  alertsStep,
  onBackPress,
}: {
  alertsStep?: AlertsStep;
  /** The phone's back button: `handler` returns true when it used the press. Returns the unsubscribe. */
  onBackPress?: (handler: () => boolean) => () => void;
}) {
  const { state, finishSetup } = useStore();
  const [step, setStep] = useState(1);
  const [units, setUnits] = useState<Units>(state.units);
  const [smoker, setSmoker] = useState<SmokerProfile | null>(state.gear.smoker ?? null);
  const [picks, setPicks] = useState(0);
  const [useSmoker, setUseSmoker] = useState(true);
  const [griddle, setGriddle] = useState(!!state.gear.griddle);
  const [oven, setOven] = useState(true);
  const [sheet, setSheet] = useState<'picker' | 'add' | null>(null);

  const back = () => setStep(s => s - 1);
  // Back on a later step goes one step back; on the first step the press is the system's (leaves the app).
  useEffect(() => {
    if (step === 1) return undefined;
    return onBackPress?.(() => {
      setStep(s => s - 1);
      return true;
    });
  }, [step, onBackPress]);

  const ovenProfile = state.gear.oven ?? defaultOven();
  const gear = (): Cookers => ({
    ...(useSmoker && smoker ? { smoker } : {}),
    ...(griddle ? { griddle: state.gear.griddle ?? defaultGriddle() } : {}),
    ...(oven ? { oven: ovenProfile } : {}),
  });
  const hasCooker = (useSmoker && !!smoker) || griddle;
  const finish = () => finishSetup(gear(), units);

  return (
    <>
      {step === 1 ? (
        <SetupPage
          step={1}
          steps={SETUP_STEPS}
          title="Welcome to Pit Planner"
          intro="Pick when you want to eat. Pit Planner works out when to fire the smoker and when each food goes on, and alerts you at every step."
          footer={<SetupActions next="Continue" onNext={() => setStep(2)} />}
        >
          <Field label="Temperature">
            <Segmented
              label="Temperature unit"
              value={units.temp}
              onChange={v => setUnits({ ...units, temp: v as Units['temp'] })}
              options={[
                { id: 'F', label: 'Fahrenheit' },
                { id: 'C', label: 'Celsius' },
              ]}
            />
          </Field>
          <Field label="Weight">
            <Segmented
              label="Weight unit"
              value={units.weight}
              onChange={v => setUnits({ ...units, weight: v as Units['weight'] })}
              options={[
                { id: 'lb', label: 'Pounds' },
                { id: 'kg', label: 'Kilograms' },
              ]}
            />
          </Field>
        </SetupPage>
      ) : null}
      {step === 2 ? (
        <SetupPage
          step={2}
          steps={SETUP_STEPS}
          title="What do you cook on?"
          intro="Times and alerts are planned around your gear. You can change this later."
          footer={
            <SetupActions
              onBack={back}
              next="Continue"
              disabled={!hasCooker}
              onNext={alertsStep ? () => setStep(3) : finish}
            />
          }
        >
          <SmokerCard
            key={picks}
            smoker={smoker}
            selected={useSmoker && !!smoker}
            units={units}
            onChange={setSmoker}
            onToggle={() => (smoker ? setUseSmoker(!useSmoker) : setSheet('picker'))}
            onPick={() => setSheet('picker')}
          />
          <GroupCard>
            <CheckRow
              leading={<Avatar kind="griddle" size={40} />}
              title="Griddle"
              subtitle="Searing, chicken, wings"
              checked={griddle}
              onChange={setGriddle}
            />
            <CheckRow
              leading={<Avatar kind="oven" size={40} />}
              title="Oven for holding"
              subtitle={<Num>{`Lowest setting ${fmtTemp(ovenProfile.lowestTempF, units, true)}`}</Num>}
              checked={oven}
              onChange={setOven}
            />
          </GroupCard>
          <DashedButton label="Add another cooker" onPress={() => setSheet('add')} />
        </SetupPage>
      ) : null}
      {step === 3 && alertsStep ? alertsStep({ onBack: back, onFinish: finish }) : null}

      {sheet === 'picker' ? (
        <SmokerPicker
          selectedId={smoker?.id}
          units={units}
          onClose={() => setSheet(null)}
          onPick={s => {
            setSmoker(s);
            setUseSmoker(true);
            setPicks(n => n + 1);
          }}
        />
      ) : null}
      {sheet === 'add' ? (
        <AddCooker
          onClose={() => setSheet(null)}
          hide={[...(griddle ? ['griddle' as const] : []), ...(oven ? ['oven' as const] : [])]}
          onPick={k => (k === 'smoker' ? setSheet('picker') : k === 'griddle' ? setGriddle(true) : setOven(true))}
        />
      ) : null}
    </>
  );
}

const positive = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fieldText = (n: number | null) => (n == null ? '' : String(Math.round(n * 10) / 10));

/**
 * Smoker card (mockup 01): the model field opens the picker; hopper and grate stay editable. The fields show
 * what the smoker has (a checked model's specs, or what the user typed), blank when it has none. A new pick
 * remounts the card (its key), so the fields start from the new smoker.
 */
function SmokerCard({
  smoker,
  selected,
  units,
  onToggle,
  onPick,
  onChange,
}: {
  smoker: SmokerProfile | null;
  selected: boolean;
  units: Units;
  onToggle: () => void;
  onPick: () => void;
  onChange: (s: SmokerProfile) => void;
}) {
  const verified = !!smoker && catalogSmokers.some(e => e.id === smoker.id && e.verified);
  const kg = units.weight === 'kg';
  const [hopper, setHopper] = useState(() =>
    fieldText(smoker?.hopperLb == null ? null : kg ? lbToKg(smoker.hopperLb) : smoker.hopperLb),
  );
  const [grate, setGrate] = useState(() => fieldText(smoker?.mainGrateSqIn ?? null));

  return (
    <OptionCard
      selected={selected}
      leading={<Avatar kind="smoker" size={40} />}
      title={smoker ? smokerTypeInfo(smoker.type).title : 'Smoker'}
      subtitle={
        !smoker ? 'Pick your model' : verified ? 'Hopper and grate filled from the model' : 'Specs entered by you'
      }
      onToggle={onToggle}
    >
      {smoker ? (
        <>
          <SelectField
            label="Model"
            value={smoker.name}
            onPress={onPick}
            trailing={<ChevronRight color={colors.text2} />}
          />
          <Row gap={12} align="start">
            {hasHopper(smoker.type) ? (
              <Fill>
                <InputField
                  numeric
                  label={`Hopper (${units.weight})`}
                  value={hopper}
                  onInput={v => {
                    setHopper(v);
                    const n = positive(v);
                    onChange({ ...smoker, hopperLb: n == null ? null : kg ? kgToLb(n) : n });
                  }}
                />
              </Fill>
            ) : null}
            <Fill>
              <InputField
                numeric
                label="Main grate (sq in)"
                value={grate}
                onInput={v => {
                  setGrate(v);
                  onChange({ ...smoker, mainGrateSqIn: positive(v) });
                }}
              />
            </Fill>
          </Row>
        </>
      ) : null}
    </OptionCard>
  );
}
