import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Plan } from '../engine/types.ts';
import { ListIcon, Sliders, Timer } from './components/icons.tsx';
import { popBack } from './components/back.ts';
import { StoreProvider, useStore, planInput } from './lib/store.tsx';
import { save } from './lib/storage.ts';
import { defaultGriddle, defaultOven } from './lib/gear.ts';
import { Segmented } from './components/controls.tsx';
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
    // TODO(cook tab): schedule alarms from plan.events via the setAlarmClock plugin (SPEC section 6)
    // and block Start cook when alert permissions are missing (failure mode 9).
    await save('activeCook', { input: planInput(state), plan, startedAt: Date.now() });
    setTab('cook');
  };

  return (
    <div class="app">
      <main class="tab-body">
        {tab === 'plan' && <PlanScreen onStartCook={startCook} />}
        {tab === 'cook' && <CookPlaceholder />}
        {tab === 'gear' && <GearPlaceholder />}
      </main>
      <nav class="nav" aria-label="Main">
        <NavItem label="Plan" on={tab === 'plan'} onClick={() => setTab('plan')} icon={<ListIcon />} />
        <NavItem label="Cook" on={tab === 'cook'} onClick={() => setTab('cook')} icon={<Timer />} />
        <NavItem label="Gear" on={tab === 'gear'} onClick={() => setTab('gear')} icon={<Sliders />} />
      </nav>
    </div>
  );
}

function NavItem({ label, on, onClick, icon }: { label: string; on: boolean; onClick: () => void; icon: preact.ComponentChildren }) {
  return (
    <button class={`nav-item ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} onClick={onClick}>
      <span class="nav-pill">{icon}</span>{label}
    </button>
  );
}

function CookPlaceholder() {
  return (
    <div class="screen">
      <header class="top-bar"><h1>Cook</h1></header>
      <div class="content">
        <p class="muted pad">The live cook screen is not built yet. No alarms are scheduled.</p>
      </div>
    </div>
  );
}

/** Stand-in until the Gear and Setup screens exist: enough to exercise the Plan screen. */
function GearPlaceholder() {
  const { state, setGear, setUnits } = useStore();
  const { gear, units } = state;
  return (
    <div class="screen">
      <header class="top-bar"><h1>Gear</h1></header>
      <div class="content">
        <div class="field">
          <span class="field-label">Smoker</span>
          <span>{gear.smoker?.name ?? 'None set up'}</span>
        </div>
        <label class="switch-row">
          <span>Griddle</span>
          <input type="checkbox" checked={!!gear.griddle} onChange={e => setGear({ ...gear, griddle: e.currentTarget.checked ? defaultGriddle() : undefined })} />
        </label>
        <label class="switch-row">
          <span>Oven</span>
          <input type="checkbox" checked={!!gear.oven} onChange={e => setGear({ ...gear, oven: e.currentTarget.checked ? defaultOven() : undefined })} />
        </label>
        <div class="field">
          <span class="field-label">Temperature</span>
          <Segmented label="Temperature unit" value={units.temp} onChange={v => setUnits({ ...units, temp: v as 'F' | 'C' })}
            options={[{ id: 'F', label: 'Fahrenheit' }, { id: 'C', label: 'Celsius' }]} />
        </div>
        <div class="field">
          <span class="field-label">Weight</span>
          <Segmented label="Weight unit" value={units.weight} onChange={v => setUnits({ ...units, weight: v as 'lb' | 'kg' })}
            options={[{ id: 'lb', label: 'Pounds' }, { id: 'kg', label: 'Kilograms' }]} />
        </div>
        <p class="muted">Version {__APP_VERSION__}</p>
      </div>
    </div>
  );
}
