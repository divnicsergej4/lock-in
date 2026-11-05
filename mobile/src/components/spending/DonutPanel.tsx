// Ring panel 1: this month's top 5 categories as a donut, the selected one in the middle, and the list.
// When the panel comes to the front every arc starts as a dot at the top, makes one turn and grows into
// its place (prototype dnSpin).

import { Canvas, Circle, DashPathEffect, Group, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { CategoryIcon } from '@/components/CategoryIcon';
import { bezier } from '@/components/intro/cssAnim';
import { donut, DONUT_C, DONUT_EMPTY, DONUT_R, type DonutArc } from '@/logic/charts';
import { fmt } from '@/logic/format';
import { useStore } from '@/store/StoreProvider';
import { holo, inter, useTheme } from '@/theme';

import type { PanelProps } from './HoloRing';
import { useHoloClock } from './holoClock';
import { Arrive, Column, PanelHead, useNaturalHeight } from './PanelParts';

const SIZE = 176; // the donut box; the drawing is 240 × 240 scaled into it
const S = SIZE / 240;
const SPIN = [0.22, 0.8, 0.24, 1];

const circle = Skia.PathBuilder.Make().addCircle(120, 120, DONUT_R).detach();

/** One arc, drawn as a trimmed circle turned to where its dash starts (same as SVG stroke-dasharray). */
function Arc({ a, i, clock }: { a: DonutArc; i: number; clock: SharedValue<number> }) {
  const q = useDerivedValue(() => bezier(SPIN, Math.min(1, Math.max(0, (clock.value - i * 85) / 1150))));
  // dash 0 → L, offset C → o (one full turn on the way)
  const end = useDerivedValue(() => Math.max(0.0005, (a.dash * q.value) / DONUT_C));
  const transform = useDerivedValue(() => {
    const off = DONUT_C + (a.offset - DONUT_C) * q.value;
    return [{ rotate: -Math.PI / 2 + (-off / DONUT_C) * 2 * Math.PI }];
  });
  return (
    <Group transform={transform} origin={{ x: 120, y: 120 }}>
      <Path path={circle} style="stroke" strokeWidth={a.width} strokeCap={a.round ? 'round' : 'butt'} color={a.color} start={0} end={end} />
    </Group>
  );
}

/** Empty month: a dashed circle turning slowly (24 s a turn). */
function EmptyDonut({ color }: { color: string }) {
  // on the ring's clock: it rests while the page scrolls or the ring is off screen
  const t = useHoloClock();
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: ((t.value % 24000) / 24000) * 360 + 'deg' }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, spin]}>
      <Canvas style={{ width: SIZE, height: SIZE }}>
        <Group transform={[{ scale: S }]}>
          <Path path={circle} style="stroke" strokeWidth={12} color={color}>
            <DashPathEffect intervals={[3, 11]} />
          </Path>
          <Circle cx={120} cy={120} r={70} style="stroke" strokeWidth={1} color={color} opacity={0.45} />
        </Group>
      </Canvas>
    </Animated.View>
  );
}

export function DonutPanel({ activation, onNatural }: PanelProps) {
  const { state } = useStore();
  const { c, name } = useTheme();
  const k = holo[name];
  const [sel, setSel] = useState<string | undefined>(undefined);
  const d = useMemo(() => donut(state, Date.now(), sel), [state, sel]);

  // the spin replays each time the panel comes to the front
  const clock = useSharedValue(10000);
  useEffect(() => {
    if (!activation) return;
    clock.value = 0;
    clock.value = withTiming(1150 + 4 * 85, { duration: 1150 + 4 * 85, easing: Easing.linear });
  }, [activation, clock]);

  // natural height: the donut block sits in the middle of the room it is given (flex 1 1 auto)
  const spares = useRef([0, 0]);
  const nat = useNaturalHeight(onNatural, 0);
  const onSpare = (j: number) => (h: number) => {
    spares.current[j] = h;
    nat.onSpare(spares.current[0] + spares.current[1]);
  };

  /** A tap on the donut picks the arc under the finger. */
  const pickAt = (x: number, y: number) => {
    const dx = x / S - 120;
    const dy = y / S - 120;
    const r = Math.hypot(dx, dy);
    if (r < DONUT_R - 20 || r > DONUT_R + 20) return;
    const along = (((Math.atan2(dy, dx) + Math.PI / 2) / (2 * Math.PI)) * DONUT_C + DONUT_C) % DONUT_C;
    const hit = d.arcs.find((a) => {
      const s0 = (((-a.offset - a.width / 2) % DONUT_C) + DONUT_C) % DONUT_C;
      const len = a.dash + a.width;
      return (along - s0 + DONUT_C) % DONUT_C <= len;
    });
    if (hit) setSel(hit.cat);
  };

  return (
    <Column onLayout={nat.onColumn}>
      <PanelHead title="This month's breakdown" tag={d.month} />
      <View style={{ flexGrow: 1 }} onLayout={(e) => onSpare(0)(e.nativeEvent.layout.height)} />
      <View style={st.dnw}>
        {d.empty ? (
          <EmptyDonut color={k.hr} />
        ) : (
          <Pressable onPress={(e) => pickAt(e.nativeEvent.locationX, e.nativeEvent.locationY)} style={StyleSheet.absoluteFill}>
            <Canvas style={{ width: SIZE, height: SIZE }} pointerEvents="none">
              <Group transform={[{ scale: S }]}>
                {d.arcs.map((a, i) => (
                  <Arc key={a.cat + ':' + a.width} a={a} i={i} clock={clock} />
                ))}
              </Group>
            </Canvas>
          </Pressable>
        )}
        <Arrive play={d.empty ? 0 : activation} delay={420} duration={520} from={{ opacity: 0, scale: 0.8 }} style={st.dnc}>
          {d.empty ? (
            <Text style={[st.l, { color: c.mute, maxWidth: 120, lineHeight: 12.48 * 1.35 }]}>{DONUT_EMPTY}</Text>
          ) : (
            <>
              <CategoryIcon cat={d.selected} color={d.arcs.find((a) => a.cat === d.selected)!.color} size={40} radius={20} mix={c.iconMix} />
              <Text style={[st.b, { color: c.ink }]}>{fmt(d.selectedAmount) + ' ' + state.cur}</Text>
              <Text style={[st.l, { color: c.mute }]}>{d.selected}</Text>
            </>
          )}
        </Arrive>
      </View>
      {!d.empty && (
        <Arrive play={activation} delay={200} duration={400} from={{ opacity: 0 }} ease={[0.25, 0.1, 0.25, 1]}>
          <Text style={[st.cap, { color: c.mute }]}>{d.caption}</Text>
        </Arrive>
      )}
      <View style={{ flexGrow: 1 }} onLayout={(e) => onSpare(1)(e.nativeEvent.layout.height)} />
      <View>
        {d.rows.map((r, i) => (
          <Arrive key={r.cat} play={activation} delay={260 + i * 60} duration={380} from={{ opacity: 0, x: -12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: r.on }}
              onPress={() => setSel(r.cat)}
              style={[st.dl, i < d.rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.line }, r.on && { backgroundColor: k.rowOn, borderRadius: 12 }]}
            >
              <CategoryIcon cat={r.cat} color={r.color} size={28} radius={14} mix={c.iconMix} style={{ marginRight: 4 }} />
              <Text style={[st.dlT, { color: c.ink }]} numberOfLines={1}>
                {r.cat + ' '}
                <Text style={[st.small, { color: c.mute }]}>{r.pct + '%'}</Text>
              </Text>
              <Text style={[st.dlB, { color: c.ink }]}>{fmt(r.amount) + ' ' + state.cur}</Text>
            </Pressable>
          </Arrive>
        ))}
      </View>
    </Column>
  );
}

const st = StyleSheet.create({
  dnw: { width: SIZE, height: SIZE, marginTop: 2, marginBottom: 8, alignSelf: 'center' },
  dnc: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 },
  b: { fontFamily: inter[700], fontSize: 19.52, lineHeight: 28.304, letterSpacing: -0.3904 },
  l: { fontFamily: inter[400], fontSize: 12.48, lineHeight: 18.096, textAlign: 'center' },
  cap: { marginBottom: 4, fontFamily: inter[400], fontSize: 10.24, lineHeight: 14.848, letterSpacing: 1.2288, textTransform: 'uppercase', textAlign: 'center' },
  dl: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4 },
  dlT: { flexShrink: 1, fontFamily: inter[400], fontSize: 14.72, lineHeight: 21.344 },
  small: { fontFamily: inter[400], fontSize: 12.8 },
  dlB: { marginLeft: 'auto', fontFamily: inter[700], fontSize: 14.72, lineHeight: 21.344 },
});
