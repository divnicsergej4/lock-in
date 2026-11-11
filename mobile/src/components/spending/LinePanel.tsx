// Ring panel 2: money in minus money out over the last 30 days. Tap a day, or hold ~0.2 s and drag to go
// day by day (a quick swipe turns the ring instead). On arrival the line draws itself and the totals
// count up (prototype lnRender + lnDraw).

import { Canvas, Circle, DashPathEffect, Group, Line, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { LINE_HINT, LINE_LABEL_SPACE, lineChart, lineTip } from '@/logic/charts';
import { fmt } from '@/logic/format';
import { useStore } from '@/store/StoreProvider';
import { holo, inter, useTheme } from '@/theme';
import { tourBus, useTourTarget } from '@/tour/registry';

import type { PanelProps } from './HoloRing';
import { Arrive, Column, PanelHead, Spare, useNaturalHeight } from './PanelParts';

/** A total that counts up from 0 in 0.9 s (ease-out cubic) when the panel arrives. */
function CountUp({ value, play, style }: { value: number; play: number; style: object }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!play || !value) {
      setShown(value);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const f = (ts: number) => {
      if (!t0) t0 = ts;
      const k = Math.min(1, (ts - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(k < 1 ? Math.round(value * e) : value);
      if (k < 1) raf = requestAnimationFrame(f);
    };
    setShown(0);
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [play, value]);
  return <Text style={style}>{fmt(shown)}</Text>;
}

export function LinePanel({ activation, grow, onNatural }: PanelProps) {
  const { state } = useStore();
  const { c, name } = useTheme();
  const k = holo[name];
  const [W, setW] = useState(0);
  const H = 176 + grow;
  const L = useMemo(() => (W ? lineChart(state, Date.now(), W, H) : null), [state, W, H]);
  const nat = useNaturalHeight(onNatural, grow);

  // the selected day: the dot moves on the UI thread, the text follows in JS
  const [day, setDay] = useState(29);
  // the tour lights up the chart ('ln') and the line under it ('ln-tip'), and waits for another day
  const chartRef = useTourTarget('ln');
  const tipRef = useTourTarget('ln-tip');
  useEffect(() => {
    tourBus.lnDay = day;
  }, [day]);
  const sel = useSharedValue(29);
  useEffect(() => {
    sel.value = 29;
    setDay(29);
  }, [state, sel]);
  const pts = L ? L.points : [];
  const xs = useMemo(() => pts.map((q) => q[0]), [pts]);
  const ys = useMemo(() => pts.map((q) => q[1]), [pts]);
  const pick = (x: number) => {
    'worklet';
    if (!W) return;
    const kk = Math.max(0, Math.min(29, Math.round(((x - 8) / (W - 16)) * 29)));
    if (kk !== sel.value) {
      sel.value = kk;
      runOnJS(setDay)(kk);
    }
  };
  const scrub = Gesture.Pan()
    .activateAfterLongPress(170)
    .onBegin((e) => pick(e.x))
    .onUpdate((e) => pick(e.x));

  // paths
  const { line, area, top, bottom } = useMemo(() => {
    const lb = Skia.PathBuilder.Make();
    const ab = Skia.PathBuilder.Make();
    if (L) {
      L.points.forEach((q, i) => (i ? lb.lineTo(q[0], q[1]) : lb.moveTo(q[0], q[1])));
      ab.moveTo(L.x(0), L.zeroY);
      L.points.forEach((q) => ab.lineTo(q[0], q[1]));
      ab.lineTo(L.x(29), L.zeroY);
      ab.close();
    }
    const ln = lb.detach();
    const ar = ab.detach();
    const b = ar.getBounds();
    return { line: ln, area: ar, top: b.y, bottom: b.y + b.height };
  }, [L]);

  // arrival: the line draws (950 ms), the area fades in, then the marker pops
  const draw = useSharedValue(1);
  const areaO = useSharedValue(1);
  const vO = useSharedValue(1);
  const dotS = useSharedValue(1);
  useEffect(() => {
    if (!activation) return;
    draw.value = 0;
    draw.value = withTiming(1, { duration: 950, easing: Easing.bezier(0.45, 0.05, 0.25, 1) });
    areaO.value = 0;
    areaO.value = withDelay(300, withTiming(1, { duration: 650 }));
    vO.value = 0;
    vO.value = withDelay(850, withTiming(1, { duration: 300 }));
    dotS.value = 0;
    dotS.value = withDelay(860, withSequence(withTiming(1.7, { duration: 264 }), withTiming(1, { duration: 176 })));
  }, [activation, draw, areaO, vO, dotS]);

  const cx = useDerivedValue(() => xs[sel.value] ?? 0);
  const cy = useDerivedValue(() => ys[sel.value] ?? 0);
  const vp1 = useDerivedValue(() => vec(cx.value, 0));
  const vp2 = useDerivedValue(() => vec(cx.value, H));
  const dotT = useDerivedValue(() => [{ scale: dotS.value }]);
  const dotO = useDerivedValue(() => ({ x: cx.value, y: cy.value }));

  const tip = L ? lineTip(L.days[day]) : null;
  const minus = name === 'light' ? '#d93a3a' : '#ff7b7b';
  const stats = L
    ? [
        { label: 'Received', v: L.received, color: c.accent },
        { label: 'Spent', v: L.spent, color: minus },
        { label: L.saved >= 0 ? 'Saved' : 'In the red', v: Math.abs(L.saved), color: L.saved >= 0 ? c.accent : minus },
      ]
    : [];

  return (
    <Column onLayout={nat.onColumn}>
      <PanelHead title="Saved vs spent" tag="30 days" />
      <Text style={[st.hint, { color: c.mute }]}>{LINE_HINT}</Text>
      <View ref={chartRef} style={{ height: H + LINE_LABEL_SPACE }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {L && (
          <GestureDetector gesture={scrub}>
            <View style={StyleSheet.absoluteFill}>
              <Canvas style={{ width: W, height: H + LINE_LABEL_SPACE }} pointerEvents="none">
                <Line p1={vec(0, L.zeroY)} p2={vec(W, L.zeroY)} color="#2b5a40" strokeWidth={1}>
                  <DashPathEffect intervals={[4, 4]} />
                </Line>
                <Group opacity={areaO}>
                  <Path path={area}>
                    <LinearGradient start={vec(0, top)} end={vec(0, bottom)} colors={['rgba(34,224,122,0.26)', 'rgba(34,224,122,0)']} />
                  </Path>
                </Group>
                <Path path={line} style="stroke" strokeWidth={7} strokeJoin="round" strokeCap="round" color={c.accent} opacity={0.16} end={draw} />
                <Path path={line} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" color={c.accent} end={draw} />
                <Group opacity={vO}>
                  <Line p1={vp1} p2={vp2} color={c.mute} strokeWidth={1} />
                </Group>
                <Group transform={dotT} origin={dotO}>
                  <Circle cx={cx} cy={cy} r={5} color={c.accent} />
                  <Circle cx={cx} cy={cy} r={5} color={c.card} style="stroke" strokeWidth={2} />
                </Group>
              </Canvas>
              {L.labels.map((l) => (
                <Text
                  key={l.anchor}
                  style={[
                    st.axis,
                    { color: c.mute, top: H + LINE_LABEL_SPACE - 3 - 10.5 },
                    l.anchor === 'start' ? { left: l.x } : l.anchor === 'end' ? { right: W - l.x } : { left: l.x - 40, width: 80, textAlign: 'center' },
                  ]}
                >
                  {l.text}
                </Text>
              ))}
            </View>
          </GestureDetector>
        )}
      </View>
      {tip && (
        <Text ref={tipRef} style={[st.tip, { color: c.ink }]}>
          <Text style={{ fontFamily: inter[700] }}>{tip.date}</Text>
          {' received ' + tip.received + ', spent '}
          <Text style={{ color: '#ff8a8a' }}>{tip.spent}</Text>
          {', ' + tip.label + ' '}
          <Text style={{ color: tip.saved ? '#5dff9d' : '#ff8a8a' }}>{tip.net}</Text>
        </Text>
      )}
      <Spare onLayout={nat.onSpare} />
      <View style={st.hstat}>
        {stats.map((s, i) => (
          <Arrive key={s.label} play={activation} delay={180 + i * 90} duration={420} from={{ opacity: 0, y: 8 }} style={{ flex: 1, minWidth: 0 }}>
            <View style={[st.tile, { borderColor: k.statBorder, backgroundColor: k.statBg }]}>
              <Text style={[st.tileL, { color: c.mute }]} numberOfLines={1}>
                {s.label.toUpperCase()}
              </Text>
              <CountUp value={s.v} play={activation} style={[st.tileB, { color: s.color }]} />
            </View>
          </Arrive>
        ))}
      </View>
    </Column>
  );
}

const st = StyleSheet.create({
  hint: { marginTop: -2, marginBottom: 8, fontFamily: inter[400], fontSize: 12.8, lineHeight: 18.56 },
  axis: { position: 'absolute', fontFamily: inter[400], fontSize: 10, lineHeight: 12 },
  tip: { marginTop: 6, minHeight: 22, fontFamily: inter[400], fontSize: 13.44, lineHeight: 19.488 },
  hstat: { flexDirection: 'row', gap: 8, paddingTop: 12 },
  tile: { borderWidth: 1, borderRadius: 12, paddingTop: 8, paddingHorizontal: 9, paddingBottom: 7 },
  tileL: { fontFamily: inter[400], fontSize: 9.6, lineHeight: 13.92, letterSpacing: 0.96 },
  tileB: { marginTop: 2, fontFamily: inter[700], fontSize: 16, lineHeight: 23.2, fontVariant: ['tabular-nums'] },
});
