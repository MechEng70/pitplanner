// T-004 spike (dev builds only): NativeWind + Reusables + tokens + Roboto on RN 0.88 / New Architecture.
// Mirrors the top of mockup 05 (docs/mockups/05-plan.png) with real engine times from the Saturday fixture,
// plus chips and a stepper. Open with: adb shell am start -d pitplanner://dev/spike <dev package>.
// Icons come with the kit (T-005). Not a screen of the app: the kit replaces these one-off classes.
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildPlan, onHeatSpan } from '../../engine/plan.ts';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { saturday } from '@/lib/fixtures/saturday';
import { fmtDuration, fmtTime } from '@/lib/format';
import { rules } from '@/lib/rules';

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function SpikeRoute() {
  if (!__DEV__) return <Redirect href="/plan" />;
  return <Spike />;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      aria-checked={on}
      className={
        on
          ? 'min-h-[28px] justify-center rounded-inset bg-ember-container px-2.5'
          : 'min-h-[28px] justify-center rounded-inset border border-outline px-2.5'
      }
    >
      <Text variant="caption" weight={on ? '500' : '400'} tone={on ? 'onAccentContainer' : 'soft'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'ok' }) {
  return (
    <View className="min-w-[96px] flex-1 gap-1 rounded-control bg-surface p-3">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="tile" tone={tone}>
        {value}
      </Text>
    </View>
  );
}

function Spike() {
  const plan = buildPlan(rules, saturday);
  const brisket = plan.items[0];
  const span = onHeatSpan(brisket);
  const [mode, setMode] = useState<'readyBy' | 'startAt'>('readyBy');
  const [temp, setTemp] = useState(225);
  const [rate, setRate] = useState(0.75);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerClassName="gap-4 px-4 pb-6">
        <View className="min-h-[56px] justify-center">
          <Text variant="title" role="heading">
            Plan
          </Text>
        </View>

        <View className="gap-1 rounded-card bg-surface px-4 py-4">
          <View className="flex-row gap-2">
            <Chip label="Ready by" on={mode === 'readyBy'} onPress={() => setMode('readyBy')} />
            <Chip label="Start at" on={mode === 'startAt'} onPress={() => setMode('startAt')} />
          </View>
          <Text variant="when">
            <Text variant="when">{dayFmt.format(plan.serveAt)}</Text> at{' '}
            <Text variant="when">{fmtTime(plan.serveAt)}</Text>
          </Text>
        </View>

        <View className="min-h-[60px] flex-row items-center gap-2.5 rounded-control border border-outline px-4 py-2">
          <View className="flex-1">
            <Text variant="label" tone="secondary">
              Smoker temp
            </Text>
            <Text variant="value">{temp}F</Text>
          </View>
          <Text variant="bodyM" tone="secondary">
            Fire {plan.fireAt == null ? '-' : fmtTime(plan.fireAt)}
          </Text>
        </View>

        <View className="flex-row gap-2">
          {[225, 250, 275].map(t => (
            <Chip key={t} label={`${t}F`} on={temp === t} onPress={() => setTemp(t)} />
          ))}
        </View>

        <View className="flex-row items-baseline justify-between">
          <Text variant="section">On the menu</Text>
          <Text variant="body" tone="secondary">
            1 item
          </Text>
        </View>

        <View className="flex-row items-center gap-3.5 rounded-card bg-surface px-4 py-3.5">
          <View className="h-11 w-11 rounded-full bg-ember-soft" />
          <View className="flex-1">
            <Text variant="tile">{brisket.name}</Text>
            <Text variant="bodyM" tone="secondary">
              12 lb, smoker, paper wrap
            </Text>
          </View>
          <View className="items-end">
            <Text variant="tile">{fmtTime(span.start)}</Text>
            <Text variant="body" tone="secondary">
              {fmtDuration(span.minutes)} on heat
            </Text>
          </View>
        </View>

        <View className="gap-2 rounded-card bg-surface px-4 py-3.5">
          <Text variant="label" tone="secondary">
            Hours per pound
          </Text>
          <View className="flex-row items-center justify-between gap-2 rounded-control bg-background p-1.5">
            <Button
              kind="outline"
              className="h-12 w-12 px-0"
              aria-label="Less"
              onPress={() => setRate(r => Math.max(0.3, r - 0.05))}
            >
              <Text variant="select">-</Text>
            </Button>
            <Text variant="value">{rate.toFixed(2)} hr/lb</Text>
            <Button
              kind="outline"
              className="h-12 w-12 px-0"
              aria-label="More"
              onPress={() => setRate(r => Math.min(2.5, r + 0.05))}
            >
              <Text variant="select">+</Text>
            </Button>
          </View>
        </View>

        <Button kind="outline" block>
          <Text tone="accent">+ Add food</Text>
        </Button>

        <View className="flex-row flex-wrap gap-2">
          <Tile label="Fire smoker" value={plan.fireAt == null ? '-' : fmtTime(plan.fireAt)} />
          <Tile label="Pellets" value={`~${Math.round(plan.pelletsLb)} lb`} />
          <Tile label="Conflicts" value="None" tone="ok" />
        </View>

        <Button block>
          <Text>Start cook</Text>
        </Button>
        <View className="flex-row gap-2">
          <Button kind="tonal">
            <Text>Tonal</Text>
          </Button>
          <Button kind="text">
            <Text>Text button</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
