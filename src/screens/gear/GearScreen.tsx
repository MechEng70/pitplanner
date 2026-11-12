import { useState } from 'preact/hooks';
import type { Cookers } from '../../../engine/types.ts';
import { lbToKg } from '../../../engine/units.ts';
import { Avatar, Field, GroupCard, IconAvatar, ListRow, Screen, Segmented, Sheet, Stack, Text } from '../../ui/components.tsx';
import { Bell, Cup, HomeIcon, Plus, Thermo } from '../../ui/icons.tsx';
import { useStore } from '../../lib/store.tsx';
import { fmtTemp, type Units } from '../../lib/format.ts';
import { defaultGriddle, defaultOven, hasHopper, smokerTypeInfo } from '../../lib/gear.ts';
import { rateRows, ratesSummary } from '../../lib/historyView.ts';
import { availableUpdate, RELEASES_PAGE } from '../../lib/update.ts';
import { rules } from '../../lib/rules.ts';
import { allGranted, type AlarmStatus } from '../../platform/alarms.ts';
import { AlertChecks, TestAlertButton, useAlarmStatus } from '../shared/AlertChecks.tsx';
import { AddCooker, type CookerKind } from '../shared/AddCooker.tsx';
import { SmokerPicker } from '../setup/SmokerPicker.tsx';
import { GriddleSheet, OvenSheet } from './CookerSheets.tsx';

const SUPPORT_URL = 'https://buymeacoffee.com/PitPlanner';
const KINDS: CookerKind[] = ['smoker', 'griddle', 'oven'];

type Open = 'add' | 'picker' | 'alerts' | 'units' | 'griddle' | 'oven' | null;

/** Gear tab (mockup 16): cookers, cook rates, app settings, version. */
export function GearScreen({ onDebug, onHistory }: { onDebug: () => void; onHistory: () => void }) {
  const { state, setGear, setUnits } = useStore();
  const { gear, units } = state;
  const [open, setOpen] = useState<Open>(null);
  const [status, refresh] = useAlarmStatus();
  const [taps, setTaps] = useState(0);
  const close = () => setOpen(null);
  const missing = KINDS.filter(k => !gear[k]);

  const add = (k: CookerKind) => {
    if (k === 'smoker') return setOpen('picker');
    setOpen(k);
  };
  const update = availableUpdate(state.update, __APP_VERSION__);
  const rateLine = ratesSummary(rateRows(rules, state.history, gear.smoker?.id ?? 'none', state.rates, state.totalHours, state.rateLocks), units);

  return (
    <Screen title="Gear">
      <Stack gap={8}>
        <Text v="section" tone="secondary" as="h2">Cookers</Text>
        <GroupCard>
          {gear.smoker && (
            <ListRow leading={<Avatar kind="smoker" size={40} />} title={gear.smoker.name} wrap
              subtitle={smokerSubtitle(gear, units)} onClick={() => setOpen('picker')} />
          )}
          {gear.griddle && (
            <ListRow leading={<Avatar kind="griddle" size={40} />} title="Griddle" wrap
              subtitle={gear.griddle.name !== 'Griddle' ? gear.griddle.name : `${gear.griddle.sizeIn} in, ${gear.griddle.burners} burners`}
              onClick={() => setOpen('griddle')} />
          )}
          {gear.oven && (
            <ListRow leading={<Avatar kind="oven" size={40} />} title="Oven" wrap
              subtitle={gear.oven.holdIn === 'cooler' ? 'Holding in a cooler' : `Holding at ${fmtTemp(gear.oven.lowestTempF, units, true)}`} onClick={() => setOpen('oven')} />
          )}
          {missing.length > 0 && (
            <ListRow leading={<span class="avatar avatar-40"><Plus color="var(--accent)" /></span>} title="Add a cooker" tone="accent"
              trailing={null} onClick={() => setOpen('add')} />
          )}
        </GroupCard>
      </Stack>

      <Stack gap={8}>
        <Text v="section" tone="secondary" as="h2">Your numbers</Text>
        <GroupCard>
          <ListRow leading={<IconAvatar tone="ok"><span class="avatar-text">hr</span></IconAvatar>} title="Cook rates" wrap
            subtitle={rateLine}
            onClick={onHistory} />
        </GroupCard>
      </Stack>

      <Stack gap={8}>
        <Text v="section" tone="secondary" as="h2">App</Text>
        <GroupCard>
          {update && (
            <ListRow leading={<IconAvatar tone="ok"><span class="avatar-text">new</span></IconAvatar>} title="Update available" wrap
              subtitle={`Version ${update}. Download it in your browser, then open it to install.`} href={state.update!.url ?? RELEASES_PAGE} />
          )}
          <ListRow leading={<IconAvatar tone={!status || allGranted(status) ? 'ok' : 'warn'}><Bell /></IconAvatar>} title="Alerts" wrap
            subtitle={alertsSubtitle(status)} onClick={() => setOpen('alerts')} />
          <ListRow leading={<IconAvatar><Thermo /></IconAvatar>} title="Units" wrap
            subtitle={`${units.temp === 'F' ? 'Fahrenheit' : 'Celsius'}, ${units.weight === 'lb' ? 'pounds' : 'kilograms'}`}
            onClick={() => setOpen('units')} />
          <ListRow leading={<IconAvatar><HomeIcon /></IconAvatar>} title="Home Assistant" subtitle="Coming later" />
          <ListRow leading={<IconAvatar tone="gold"><Cup /></IconAvatar>} title="Buy me a bag of pellets" wrap
            subtitle="If the app saved your brisket" href={SUPPORT_URL} />
        </GroupCard>
      </Stack>

      {/* Tap the version 5 times for the alarm test screen. */}
      <button class="gear-version" onClick={() => { if (taps + 1 >= 5) { setTaps(0); onDebug(); } else setTaps(taps + 1); }}>
        <Text v="body" tone="tertiary">Pit Planner {__APP_VERSION__}</Text>
      </button>

      {open === 'add' && <AddCooker onClose={close} hide={KINDS.filter(k => gear[k])} onPick={add} />}
      {open === 'picker' && (
        <SmokerPicker selectedId={gear.smoker?.id} units={units} onClose={close} onPick={s => setGear({ ...gear, smoker: s })} />
      )}
      {open === 'alerts' && (
        <Sheet title="Alerts" onClose={close}>
          <Stack gap={12}>
            {status && <AlertChecks status={status} onChange={refresh} />}
            <TestAlertButton />
          </Stack>
        </Sheet>
      )}
      {open === 'griddle' && (
        <GriddleSheet initial={gear.griddle ?? defaultGriddle()} onClose={close}
          onSave={griddle => setGear({ ...gear, griddle })}
          onRemove={gear.griddle && gear.smoker ? () => setGear(without(gear, 'griddle')) : undefined} />
      )}
      {open === 'oven' && (
        <OvenSheet initial={gear.oven ?? defaultOven()} units={units} onClose={close}
          onSave={oven => setGear({ ...gear, oven })} onRemove={gear.oven ? () => setGear(without(gear, 'oven')) : undefined} />
      )}
      {open === 'units' && <UnitsSheet units={units} onChange={setUnits} onClose={close} />}
    </Screen>
  );
}

function without(gear: Cookers, k: CookerKind): Cookers {
  const { [k]: _, ...rest } = gear;
  return rest;
}

function smokerSubtitle(gear: Cookers, units: Units): string {
  const s = gear.smoker!;
  const type = smokerTypeInfo(s.type).title;
  if (!hasHopper(s.type) || s.hopperLb == null) return type;
  const hopper = units.weight === 'lb' ? `${Math.round(s.hopperLb)} lb` : `${Math.round(lbToKg(s.hopperLb) * 10) / 10} kg`;
  return `${type}, ${hopper} hopper`;
}

function alertsSubtitle(s: AlarmStatus | null): string {
  if (!s) return 'Checking';
  if (allGranted(s)) return 'All set: exact alarms on, battery saver off';
  const off = [!s.notifications && 'notifications', !s.exactAlarms && 'exact alarms', !s.batteryUnrestricted && 'battery limits'].filter(Boolean);
  return `Needs a fix: ${off.join(', ')}`;
}

function UnitsSheet({ units, onChange, onClose }: { units: Units; onChange: (u: Units) => void; onClose: () => void }) {
  return (
    <Sheet title="Units" onClose={onClose}>
      <Stack gap={16}>
        <Field label="Temperature">
          <Segmented label="Temperature unit" value={units.temp} onChange={v => onChange({ ...units, temp: v as Units['temp'] })}
            options={[{ id: 'F', label: 'Fahrenheit' }, { id: 'C', label: 'Celsius' }]} />
        </Field>
        <Field label="Weight">
          <Segmented label="Weight unit" value={units.weight} onChange={v => onChange({ ...units, weight: v as Units['weight'] })}
            options={[{ id: 'lb', label: 'Pounds' }, { id: 'kg', label: 'Kilograms' }]} />
        </Field>
      </Stack>
    </Sheet>
  );
}
