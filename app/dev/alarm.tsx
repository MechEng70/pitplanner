// Alarm check (T-013, T-016; dev builds only): what the device checks read to prove the pit-alarms module is
// in the build, that a test alarm goes through the real path, and (for the alarm tests on a phone, where
// there is no Start cook screen yet) to run a short cook whose steps ring minutes apart. Not a screen of the
// app (the debug screen is T-015).
//   pitplanner://dev/alarm            show the alert status and what is stored to fire
//   pitplanner://dev/alarm?test=10    schedule a test alarm in 10 seconds first
//   pitplanner://dev/alarm?test=10:x  the same, titled "Test alert x" (one parameter: adb's shell eats an "&")
//   pitplanner://dev/alarm?cook=3     start a test cook through the store: 2 lb of wings, the smoker fired at
//                                     the minute mark at least 3 minutes out, wings on 3 minutes later
//   pitplanner://dev/alarm?cook=end   end the cook (clears every alarm)
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildPlan } from '../../engine/plan';
import type { PlanInput } from '../../engine/types';
import { Stack, Text } from '@/components/kit';
import { newCook } from '@/lib/cook';
import { saturday } from '@/lib/fixtures/saturday';
import { rules } from '@/lib/rules';
import { useStore } from '@/lib/store';
import { alarmService } from '@/platform/alarms';
import { permissionService } from '@/platform/permissions';

const MIN = 60_000;
const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8);

/** The test cook's input: steps minutes apart (a 3 minute preheat), starting `minutes` from now. */
function testCook(minutes: number, now: number): PlanInput {
  return {
    ...saturday,
    mode: 'startAt',
    at: Math.ceil((now + minutes * MIN) / MIN) * MIN,
    cookers: { smoker: { ...saturday.cookers.smoker!, preheatMin: 3 } },
    rateOverrides: {},
    items: [
      { id: 'w', foodId: 'wings', methodId: 'smokeCrisp', quantity: 2, options: { drybrine: 'yes' }, restMin: 5 },
    ],
  };
}

export default function AlarmCheck() {
  const { test, cook } = useLocalSearchParams<{ test?: string; cook?: string }>();
  if (!__DEV__) return <Redirect href="/plan" />;
  // Keyed by the request, so a new link runs it again.
  return <Check key={`${test}-${cook}`} test={test} cook={cook} />;
}

function Check({ test, cook }: { test?: string; cook?: string }) {
  const { setCook } = useStore();
  const [lines, setLines] = useState<string[]>(['alarm check running']);
  useEffect(() => {
    let live = true;
    void (async () => {
      const out: string[] = [];
      try {
        const [secs, tag] = (test ?? '').split(':');
        const seconds = Number(secs);
        if (seconds > 0) {
          const t = await alarmService.testAlarm(seconds, tag ? `Test alert ${tag}` : undefined);
          out.push(`test alarm set, exact ${t.exact ? 'yes' : 'no'}`);
        }
        if (cook === 'end') {
          setCook(null);
          out.push('cook ended');
        } else if (Number(cook) > 0) {
          const now = Date.now();
          const input = testCook(Number(cook), now);
          setCook(newCook(input, buildPlan(rules, input), now));
          out.push(`cook started, smoker fires at ${clock(input.at)}`);
        }
        // The store syncs the phone's alarms after a cook change: give it a moment before reading them.
        if (cook) await new Promise(resolve => setTimeout(resolve, 1500));
        const s = await permissionService.status();
        out.push(`notifications ${s.notifications ? 'on' : 'off'}`, `exact alarms ${s.exactAlarms ? 'on' : 'off'}`);
        const stored = await alarmService.scheduled();
        out.push(`stored alarms ${stored.alarms.length}, repeats ${stored.nags.length}`);
        for (const a of stored.alarms) out.push(`${clock(a.at)} ${a.id}`);
        for (const n of stored.nags) out.push(`${clock(n.nextAt)} repeat ${n.count} of ${n.alarmId}`);
      } catch (e) {
        out.push(`alarm check failed: ${String(e)}`);
      }
      if (live) setLines(out);
    })();
    return () => {
      live = false;
    };
  }, [test, cook, setCook]);
  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <Stack gap={8}>
        {lines.map(line => (
          <Text key={line}>{line}</Text>
        ))}
      </Stack>
    </SafeAreaView>
  );
}
