// The Cook tab's flow: Live cook, then Cook finished (mockup 15) once End cook is tapped in Cook options or
// Done is tapped on the Serve step (as in legacy/src/screens/cook/CookScreen.tsx, `finishing`). Save and
// Discard both end the cook through the store's `setCook(null)`, which clears every alarm, and go to Plan.
// Leaving the app on Cook finished keeps the cook: it comes back as Live cook, and End cook leads here again.
// "Back to the cook" on Cook finished (T-063) takes back a Done on Serve and saves through `setCook`, so the
// alarms are set again, then shows Live cook.
import { useState } from 'react';
import { undoStep } from '@/lib/cook';
import { useStore } from '@/lib/store';
import { CookScreen, type CookScreenProps } from './CookScreen';
import { FinishScreen } from './FinishScreen';

export function CookFlow(props: Omit<CookScreenProps, 'onEnd'>) {
  const { state, setCook } = useStore();
  const [finishing, setFinishing] = useState(false);
  const { cook } = state;
  if (finishing && cook) {
    return (
      <FinishScreen
        cook={cook}
        now={props.now}
        onClose={() => {
          setFinishing(false);
          setCook(null);
          props.onGoPlan();
        }}
        onBack={() => {
          setFinishing(false);
          setCook(undoStep(cook, (props.now ?? Date.now)()));
        }}
      />
    );
  }
  return <CookScreen {...props} onEnd={() => setFinishing(true)} />;
}
