// Lane chart (legacy/src/ui/components.tsx "Lane chart"; sizes and colors from ui.css): one lane per food,
// its phases placed by time, a now line, a highlighted band where foods share the smoker, and hour ticks.
// Times are epoch ms; the caller words the ticks. Heights follow the system font size, so two lines of label
// fit beside a track at any scale.
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Num } from '@/components/kit/num';
import { BAND_FILL } from '@/components/kit/surfaces';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

export interface LaneSegment {
  start: number;
  end: number;
  label?: string;
  tone: 'smoke' | 'smoke2' | 'hot' | 'griddle' | 'oven' | 'hold';
}
export interface Lane {
  id: string;
  title: string;
  subtitle: string;
  segments: LaneSegment[];
}

/** ui.css: 46 dp a lane, 28 dp its track, 24 dp the tick row, the labels 34% of the width. */
const LANE_H = 46;
const TRACK_H = 28;
const TICK_H = 24;
/** A segment narrower than this share of the chart has no room for its label. */
const LABEL_MIN = 0.1;

const SEG: Record<LaneSegment['tone'], string> = {
  smoke: 'bg-ember',
  smoke2: 'bg-lane-smoke2',
  hot: 'bg-lane-hot',
  griddle: 'min-w-[6px] rounded-[6px] bg-griddle',
  oven: 'bg-outline-2',
  hold: 'rounded-[6px] border-[1.5px] border-dashed border-ink-3',
};

export function Lanes({
  lanes,
  from,
  to,
  now,
  band,
  ticks,
}: {
  lanes: Lane[];
  from: number;
  to: number;
  now: number;
  band?: { start: number; end: number; laneIds: string[] } | null;
  ticks: { at: number; label: string }[];
}) {
  const { fontScale } = useWindowDimensions();
  const scale = Math.max(1, fontScale);
  const laneH = Math.round(LANE_H * scale);
  const share = (t: number) => Math.max(0, Math.min(1, (t - from) / (to - from)));
  // Two decimals: 0.01% of a phone's width is far under a pixel, and the strings stay readable.
  const pct = (x: number) => `${Math.round(x * 10000) / 100}%` as const;
  const span = (a: number, b: number) => ({ left: pct(share(a)), width: pct(Math.max(0, share(b) - share(a))) });
  const rows = band ? lanes.map((l, i) => (band.laneIds.includes(l.id) ? i : -1)).filter(i => i >= 0) : [];
  const first = rows[0] ?? 0;
  const last = rows[rows.length - 1] ?? 0;
  return (
    <View>
      {lanes.map(l => (
        <View key={l.id} className="flex-row items-center" style={{ height: laneH }}>
          <View className="w-[34%] shrink-0 pr-2">
            <Text variant="bodyM" weight="500" clamp>
              {l.title}
            </Text>
            <Text variant="label" tone="secondary" clamp>
              {l.subtitle}
            </Text>
          </View>
          <View
            className="flex-1 overflow-hidden rounded-[8px] bg-surface-2"
            style={{ height: Math.round(TRACK_H * scale) }}
          >
            {l.segments
              .filter(s => s.end > from && s.start < to)
              .map((s, i) => (
                <View
                  key={i}
                  testID={`seg-${l.id}-${i}`}
                  className={cn('absolute bottom-0 top-0 justify-center overflow-hidden', SEG[s.tone])}
                  style={[span(s.start, s.end), i > 0 && s.tone !== 'hold' ? styles.next : null]}
                >
                  {s.label && share(s.end) - share(s.start) >= LABEL_MIN ? (
                    // One line, cut at the segment's edge with no ellipsis, as in mockup 12.
                    <Text
                      variant="caption"
                      tone={s.tone === 'hold' ? 'secondary' : 'onAccent'}
                      numberOfLines={1}
                      ellipsizeMode="clip"
                      className="px-1.5"
                    >
                      {s.label}
                    </Text>
                  ) : null}
                </View>
              ))}
          </View>
        </View>
      ))}
      <View
        className="absolute right-0 top-0"
        style={[styles.overlay, { height: laneH * lanes.length }]}
        pointerEvents="none"
        aria-hidden
        importantForAccessibility="no-hide-descendants"
      >
        {band && rows.length > 1 ? (
          <View
            testID="lane-band"
            className="absolute rounded-[10px] border-2 border-ember-on-container"
            style={[
              styles.band,
              span(band.start, band.end),
              { top: first * laneH - 4, height: (last - first + 1) * laneH + 8 },
            ]}
          />
        ) : null}
        {now >= from && now <= to ? (
          <View testID="lane-now" className="absolute w-0.5 bg-ink" style={[styles.now, { left: pct(share(now)) }]} />
        ) : null}
      </View>
      <View className="mt-1 flex-row" style={{ height: Math.round(TICK_H * scale) }}>
        <View className="w-[34%] shrink-0" />
        <View className="flex-1">
          {ticks.map((t, i) => (
            // The first tick starts at the chart's left edge and the last (serve) ends at its right edge;
            // the ones between are centered on their time.
            <Num
              key={t.at}
              variant="caption"
              tone="secondary"
              className="absolute top-0.5"
              style={
                i === 0
                  ? { left: pct(share(t.at)) }
                  : t.at >= to
                    ? styles.end
                    : [{ left: pct(share(t.at)) }, styles.centered]
              }
            >
              {t.label}
            </Num>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { left: '34%' },
  band: { backgroundColor: BAND_FILL },
  now: { top: -6, bottom: -6, marginLeft: -1 },
  next: { borderLeftWidth: 1, borderLeftColor: withAlpha(colors.bgDeep, 0.35) },
  end: { right: 0 },
  centered: { transform: [{ translateX: '-50%' }] },
});
