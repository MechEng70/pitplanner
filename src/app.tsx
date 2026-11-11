import { useEffect, useRef, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Plan } from '../engine/types.ts';
import { ListIcon, Sliders, Timer } from './ui/icons.tsx';
import { popBack } from './ui/back.ts';
import { BottomNav } from './ui/components.tsx';
import { StoreProvider, useStore, planInput } from './lib/store.tsx';
import { PlanScreen } from './screens/plan/PlanScreen.tsx';
import { StartCheckSheet } from './screens/plan/StartCheckSheet.tsx';
import { DebugScreen } from './screens/debug/DebugScreen.tsx';
import { CookScreen } from './screens/cook/CookScreen.tsx';
import { Setup } from './screens/setup/Setup.tsx';
import { GearScreen } from './screens/gear/GearScreen.tsx';
import { PitAlarms, allGranted, alarmsAreNative } from './platform/alarms.ts';
import { applyActions, newCook, syncAlarms } from './lib/cook.ts';

type Tab = 'plan' | 'cook' | 'gear';

export function App() {
  return <StoreProvider now={Date.now()}><Shell /></StoreProvider>;
}

function Shell() {
  const { state, setCook } = useStore();
  const [tab, setTab] = useState<Tab>(state.cook ? 'cook' : 'plan');
  const cookRef = useRef(state.cook);
  cookRef.current = state.cook;

  // Done / +15 tapped on a notification: apply on start, on resume, and while open.
  useEffect(() => {
    if (!alarmsAreNative) return;
    const drain = async () => {
      const { actions } = await PitAlarms.drainActions();
      const c = cookRef.current;
      if (!c || !actions.length) return;
      const next = applyActions(c, actions);
      cookRef.current = next;
      setCook(next);
      await syncAlarms(next, Date.now());
      setTab('cook');
    };
    drain();
    const hs = [CapApp.addListener('resume', drain), PitAlarms.addListener('alarmAction', drain)];
    return () => { hs.forEach(h => h.then(x => x.remove())); };
  }, []);

  // Android back: close the top sheet or menu, else go to Plan, else leave the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      if (popBack()) return;
      setTab(t => { if (t !== 'plan') return 'plan'; CapApp.minimizeApp(); return t; });
    });
    return () => { h.then(x => x.remove()); };
  }, []);

  const [checkPlan, setCheckPlan] = useState<Plan | null>(null);
  const [debug, setDebug] = useState(false);
  // Gear detail screens (mockups 18-20), opened over the Gear tab.
  const [gearView, setGearView] = useState<'history' | 'griddle' | 'oven' | null>(null);

  const beginCook = async (plan: Plan) => {
    const cook = newCook(planInput(state), plan, Date.now());
    setCook(cook);
    await syncAlarms(cook, Date.now());
    setTab('cook');
  };
  // Failure mode 9: a missing alert permission blocks Start cook until fixed or acknowledged.
  const startCook = async (plan: Plan) => {
    if (allGranted(await PitAlarms.status())) return beginCook(plan);
    setCheckPlan(plan);
  };

  if (state.firstRun) return <div class="app"><Setup /></div>;
  return (
    <div class="app">
      <main class="app-body" data-gear-view={gearView ?? undefined}>
        {tab === 'plan' && <PlanScreen onStartCook={startCook} />}
        {tab === 'cook' && <CookScreen onGoPlan={() => setTab('plan')} />}
        {tab === 'gear' && <GearScreen onDebug={() => setDebug(true)} onHistory={() => setGearView('history')} onCooker={setGearView} />}
      </main>
      {checkPlan && <StartCheckSheet onClose={() => setCheckPlan(null)} onStart={() => beginCook(checkPlan)} />}
      {debug && <DebugScreen onClose={() => setDebug(false)} />}
      <BottomNav value={tab} onChange={t => setTab(t as Tab)} items={[
        { id: 'plan', label: 'Plan', icon: <ListIcon /> },
        { id: 'cook', label: 'Cook', icon: <Timer /> },
        { id: 'gear', label: 'Gear', icon: <Sliders /> },
      ]} />
    </div>
  );
}
