import { useEffect, useRef, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Plan } from '../engine/types.ts';
import { buildPlan } from '../engine/plan.ts';
import { rules } from './lib/rules.ts';
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
import { HistoryScreen } from './screens/gear/HistoryScreen.tsx';
import { PitAlarms, allGranted, alarmsAreNative } from './platform/alarms.ts';
import { applyActions, newCook, syncAlarms } from './lib/cook.ts';
import { onSharedPlan, takeSharedPlan } from './platform/sharedPlan.ts';
import { parsePitPlan, type SharedPlan } from './lib/sharedPlan.ts';
import { SharedPlanError, SharedPlanSheet } from './screens/plan/SharedPlanSheet.tsx';

type Tab = 'plan' | 'cook' | 'gear';

export function App() {
  return (
    <StoreProvider now={Date.now()}>
      <Shell />
    </StoreProvider>
  );
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
    return () => {
      hs.forEach(h => h.then(x => x.remove()));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listeners are added once; drain reads the latest cook from cookRef.
  }, []);

  // Android back: close the top sheet or menu, else go to Plan, else leave the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => {
      if (popBack()) return;
      setTab(t => {
        if (t !== 'plan') return 'plan';
        CapApp.minimizeApp();
        return t;
      });
    });
    return () => {
      h.then(x => x.remove());
    };
  }, []);

  // An opened .pitplan: checked on start, on resume and when Android hands one over while open.
  const [shared, setShared] = useState<SharedPlan | { error: string } | null>(null);
  useEffect(() => {
    const take = async () => {
      const t = await takeSharedPlan();
      if (!t) return;
      setShared(
        t.text != null
          ? parsePitPlan(rules, t.text, () => crypto.randomUUID())
          : { error: 'Could not read that file.' },
      );
      setTab('plan');
    };
    take();
    const off = onSharedPlan(take);
    const h = CapApp.addListener('resume', take);
    return () => {
      off();
      h.then(x => x.remove());
    };
  }, []);

  const [checkPlan, setCheckPlan] = useState<Plan | null>(null);
  const [debug, setDebug] = useState(false);
  // Cook history (mockup 20), opened over the Gear tab.
  const [gearView, setGearView] = useState<'history' | null>(null);

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

  // Cook tab with food on the plan and no cook running: same as Start cook.
  const pickTab = (t: Tab) => {
    if (t === 'cook' && !state.cook && state.draft.items.length) {
      let plan: Plan | null = null;
      try {
        plan = buildPlan(rules, planInput(state));
      } catch {
        /* unplannable: show the empty Cook tab */
      }
      if (plan) return void startCook(plan);
    }
    setTab(t);
  };

  if (state.firstRun)
    return (
      <div class="app">
        <Setup />
      </div>
    );
  return (
    <div class="app">
      <main class="app-body">
        {tab === 'plan' && <PlanScreen onStartCook={startCook} />}
        {tab === 'cook' && <CookScreen onGoPlan={() => setTab('plan')} />}
        {tab === 'gear' && !gearView && (
          <GearScreen onDebug={() => setDebug(true)} onHistory={() => setGearView('history')} />
        )}
        {tab === 'gear' && gearView === 'history' && (
          <HistoryScreen
            onBack={() => setGearView(null)}
            onCookAgain={() => {
              setGearView(null);
              setTab('plan');
            }}
          />
        )}
      </main>
      {shared &&
        ('error' in shared ? (
          <SharedPlanError message={shared.error} onClose={() => setShared(null)} />
        ) : (
          <SharedPlanSheet shared={shared} onClose={() => setShared(null)} onUse={() => setTab('plan')} />
        ))}
      {checkPlan && <StartCheckSheet onClose={() => setCheckPlan(null)} onStart={() => beginCook(checkPlan)} />}
      {debug && <DebugScreen onClose={() => setDebug(false)} />}
      <BottomNav
        value={tab}
        onChange={t => pickTab(t as Tab)}
        items={[
          { id: 'plan', label: 'Plan', icon: <ListIcon /> },
          { id: 'cook', label: 'Cook', icon: <Timer /> },
          { id: 'gear', label: 'Gear', icon: <Sliders /> },
        ]}
      />
    </div>
  );
}
