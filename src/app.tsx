import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Plan } from '../engine/types.ts';
import { ListIcon, Sliders, Timer } from './ui/icons.tsx';
import { popBack } from './ui/back.ts';
import { BottomNav, Chips, Field, Screen, Segmented, Text } from './ui/components.tsx';
import { StoreProvider, useStore, planInput } from './lib/store.tsx';
import { save } from './lib/storage.ts';
import { defaultGriddle, defaultOven } from './lib/gear.ts';
import { PlanScreen } from './screens/plan/PlanScreen.tsx';

type Tab = 'plan' | 'cook' | 'gear';

export function App() {
  return <StoreProvider now={Date.now()}><Shell /></StoreProvider>;
}

function Shell() {
  const [tab, setTab] = useState<Tab>('plan');
  const { state } = useStore();

  // Android back: close the top sheet or menu, else go to Plan, else leave the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      if (popBack()) return;
      setTab(t => { if (t !== 'plan') return 'plan'; CapApp.minimizeApp(); return t; });
    });
    return () => { h.then(x => x.remove()); };
  }, []);

  const startCook = async (plan: Plan) => {
    // TODO(alarms): schedule from plan.events via the setAlarmClock plugin (SPEC section 6)
    // and block Start cook when alert permissions are missing (failure mode 9).
    await save('activeCook', { input: planInput(state), plan, startedAt: Date.now() });
    setTab('cook');
  };

  return (
    <div class="app">
      <main class="app-body">
        {tab === 'plan' && <PlanScreen onStartCook={startCook} />}
        {tab === 'cook' && <CookPlaceholder />}
        {tab === 'gear' && <GearPlaceholder />}
      </main>
      <BottomNav value={tab} onChange={t => setTab(t as Tab)} items={[
        { id: 'plan', label: 'Plan', icon: <ListIcon /> },
        { id: 'cook', label: 'Cook', icon: <Timer /> },
        { id: 'gear', label: 'Gear', icon: <Sliders /> },
      ]} />
    </div>
  );
}

function CookPlaceholder() {
  return (
    <Screen title="Cook">
      <Text v="bodyM" tone="secondary">The live cook screen is not built yet. No alarms are scheduled.</Text>
    </Screen>
  );
}

/** Stand-in until the Gear and Setup screens exist: enough to exercise the Plan screen. */
function GearPlaceholder() {
  const { state, setGear, setUnits } = useStore();
  const { gear, units } = state;
  const onOff = [{ id: 'on', label: 'Have one' }, { id: 'off', label: 'None' }];
  return (
    <Screen title="Gear">
      <Field label="Smoker"><Text v="bodyL">{gear.smoker?.name ?? 'None set up'}</Text></Field>
      <Field label="Griddle">
        <Chips label="Griddle" value={gear.griddle ? 'on' : 'off'} options={onOff}
          onChange={v => setGear({ ...gear, griddle: v === 'on' ? gear.griddle ?? defaultGriddle() : undefined })} />
      </Field>
      <Field label="Oven">
        <Chips label="Oven" value={gear.oven ? 'on' : 'off'} options={onOff}
          onChange={v => setGear({ ...gear, oven: v === 'on' ? gear.oven ?? defaultOven() : undefined })} />
      </Field>
      <Field label="Temperature">
        <Segmented label="Temperature unit" value={units.temp} onChange={v => setUnits({ ...units, temp: v as 'F' | 'C' })}
          options={[{ id: 'F', label: 'Fahrenheit' }, { id: 'C', label: 'Celsius' }]} />
      </Field>
      <Field label="Weight">
        <Segmented label="Weight unit" value={units.weight} onChange={v => setUnits({ ...units, weight: v as 'lb' | 'kg' })}
          options={[{ id: 'lb', label: 'Pounds' }, { id: 'kg', label: 'Kilograms' }]} />
      </Field>
      <Text v="label" tone="secondary">Version {__APP_VERSION__}</Text>
    </Screen>
  );
}
