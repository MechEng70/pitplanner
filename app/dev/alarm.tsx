// Alarm check (T-013, dev builds only): what the device check reads to prove the pit-alarms module is in the
// build and a test alarm goes through the real path. Not a screen of the app (the debug screen is T-015).
//   pitplanner://dev/alarm            show the alert status and what is stored to fire
//   pitplanner://dev/alarm?test=10    schedule a test alarm in 10 seconds first
//   pitplanner://dev/alarm?test=10:x  the same, titled "Test alert x" (one parameter: adb's shell eats an "&")
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, Text } from '@/components/kit';
import { alarmService, permissionService } from '@/platform/alarms';

export default function AlarmCheck() {
  const { test } = useLocalSearchParams<{ test?: string }>();
  if (!__DEV__) return <Redirect href="/plan" />;
  // Keyed by the request, so a new link runs it again.
  return <Check key={test ?? ''} test={test} />;
}

function Check({ test }: { test?: string }) {
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
        const s = await permissionService.status();
        out.push(`notifications ${s.notifications ? 'on' : 'off'}`, `exact alarms ${s.exactAlarms ? 'on' : 'off'}`);
        const stored = await alarmService.scheduled();
        out.push(`stored alarms ${stored.alarms.length}, repeats ${stored.nags.length}`);
      } catch (e) {
        out.push(`alarm check failed: ${String(e)}`);
      }
      if (live) setLines(out);
    })();
    return () => {
      live = false;
    };
  }, [test]);
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
