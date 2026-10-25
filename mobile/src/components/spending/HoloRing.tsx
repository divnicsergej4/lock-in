// The holographic ring (prototype section.holo): three panels on a ring in 3D. The finger turns it, a
// spring settles it on the nearest panel. Everything that moves is driven on the UI thread (gesture →
// shared values → animated styles, the spring stepped every frame), so it runs at the screen's own
// refresh rate (120 Hz on ProMotion) and never waits for JavaScript.

import { useIsFocused } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  measure,
  runOnJS,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { bezier } from '@/components/intro/cssAnim';
import { holo, useTheme } from '@/theme';
import { tourBus, useTourTarget } from '@/tour/registry';

import { HoloClock } from './holoClock';
import { HoloPanel } from './HoloPanel';
import { HN, holoLayout, hm, hPose, HPB, HPT, poseMatrix, poseTransform, SPRING_DT, SPRING_MAX_S, settled, springStep, swipeTarget, type HoloLayout } from './holo';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
// iOS orders the panels by real depth (see poseMatrix); Android and the web follow zIndex
const IOS = Platform.OS === 'ios';

/** What a panel's content is given. */
export interface PanelProps {
  /** changes each time the panel becomes the front one: replay the arrival animations */
  activation: number;
  /** extra height the line chart / calendar may use so all panels are equally tall */
  grow: number;
  /** report the content's natural height (at grow = 0) */
  onNatural: (h: number) => void;
}

/** One panel on the ring: its pose comes from the ring position, its float from the shared clock. */
function RingPanel({
  i,
  L,
  p,
  sp,
  floatT,
  depth,
  h,
  activation,
  onPressSide,
  children,
}: {
  i: number;
  L: HoloLayout;
  p: SharedValue<number>;
  sp: SharedValue<number>;
  floatT: SharedValue<number>;
  depth: number;
  h: number | undefined;
  activation: number;
  onPressSide: (() => void) | null;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const q = hPose(i, p.value, sp.value, L);
    if (!IOS) return { opacity: q.opacity, transform: poseTransform(q) };
    return { opacity: q.opacity, transform: [{ matrix: poseMatrix(q, i === hm(Math.round(p.value))) }] };
  });
  const dim = useDerivedValue(() => hPose(i, p.value, sp.value, L).dim);
  // .vzf: @keyframes hfl 7s ease-in-out infinite (0 → −5 px → 0), panels offset by −2.4 s and −4.7 s
  const float = useAnimatedStyle(() => {
    const ph = (((floatT.value + [0, 2400, 4700][i]) % 7000) + 7000) % 7000 / 7000;
    const k = bezier([0.42, 0, 0.58, 1], ph < 0.5 ? ph / 0.5 : (1 - ph) / 0.5);
    return { transform: [{ translateY: -5 * k }] };
  });
  return (
    <Animated.View style={[st.vzs, { width: L.pw, marginLeft: -L.pw / 2, zIndex: depth, transformOrigin: '50% 43%' }, style]}>
      <Animated.View style={float}>
        <HoloPanel w={L.pw} h={h} dim={dim} activation={activation}>
          {children}
        </HoloPanel>
      </Animated.View>
      {/* a side panel: a tap turns the ring to it */}
      {onPressSide && <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onPressSide} />}
    </Animated.View>
  );
}

/**
 * `scrolling`: true while the page is being dragged or is gliding (set on the UI thread by the page's
 * scroll handler). The ring's endless animations stand still then, and while the ring is off screen.
 */
export const HoloRing = memo(function HoloRing({
  panels,
  rows,
  scrolling,
}: {
  panels: ((p: PanelProps) => ReactNode)[];
  rows: number;
  scrolling: SharedValue<boolean>;
}) {
  const { width: W, height: screenH } = useWindowDimensions();
  const L = holoLayout(W);
  const { name } = useTheme();
  const k = holo[name];
  const reduce = useReducedMotion();
  const focused = useIsFocused();

  // ---- ring state (UI thread) ----
  const p = useSharedValue(0); // position: 0, 1, 2 = panels in front (any real number in between)
  const v = useSharedValue(0); // speed while settling
  const t = useSharedValue(0); // where it is going
  const sp = useSharedValue(1); // unfolding when the tab opens (0 → 1)
  const springOn = useSharedValue(false);
  const springT = useSharedValue(0);
  const landed = useSharedValue(true);
  const moving = useSharedValue(false);
  const floatT = useSharedValue(0);
  const p0 = useSharedValue(0);
  const ringOffset = useSharedValue(0);
  const stepCarry = useSharedValue(0);

  // ---- is anything worth animating? on screen, tab open, page not scrolling ----
  const liveT = useSharedValue(0); // the clock of the endless animations (see holoClock)
  const visible = useSharedValue(true);
  const focusedSV = useSharedValue(true);
  const box = useAnimatedRef<Animated.View>();
  // when a scroll ends, check (on the UI thread) whether the ring is still on screen
  useAnimatedReaction(
    () => scrolling.value,
    (s, prev) => {
      if (s || !prev) return;
      const m = measure(box);
      visible.value = !!m && m.pageY + m.height > 0 && m.pageY < screenH;
    },
  );

  // ---- JS state: which panel is in front (stacking, taps) and the arrival animations ----
  const [cur, setCur] = useState(0);
  const [act, setAct] = useState<number[]>([0, 0, 0]);
  const stage = useTourTarget('vzc'); // the ring's stage, lit up by the tour
  const activeRef = useRef(-1);
  const activate = useCallback((i: number) => {
    activeRef.current = i;
    tourBus.holoAct = i; // the tour waits for the line (1) and the calendar (2)
    setAct((a) => a.map((n, j) => (j === i ? n + 1 : n)));
  }, []);

  useAnimatedReaction(
    () => hm(Math.round(p.value)),
    (c, prev) => {
      if (c !== prev) runOnJS(setCur)(c);
    },
  );

  /** Turn the ring to panel position `to` (prototype hGo). */
  const go = useCallback(
    (to: number, v0?: number) => {
      'worklet';
      t.value = to;
      if (typeof v0 === 'number') v.value = v0;
      if (reduce) {
        p.value = hm(to);
        t.value = p.value;
        v.value = 0;
        runOnJS(activate)(hm(to));
        return;
      }
      springOn.value = true;
      springT.value = 0;
      landed.value = false;
      moving.value = true;
      // the dashed ring under the panels turns with them (stroke-dashoffset −t·46, .9s cubic-bezier(.2,.8,.2,1))
      ringOffset.value = withTiming(-to * 46, { duration: 900, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    },
    [reduce, activate, t, v, p, springOn, springT, landed, moving, ringOffset],
  );

  // the spring, stepped in exact 1/120 s steps however long each frame was
  useFrameCallback((f) => {
    const dt = (f.timeSincePreviousFrame ?? 16.7) / 1000;
    // the clocks only move while the ring is live; a ring at rest then changes nothing per frame
    const live = !scrolling.value && visible.value && focusedSV.value;
    if (live) liveT.value += dt * 1000;
    if (!springOn.value) {
      if (live && !moving.value) floatT.value += dt * 1000;
      return;
    }
    stepCarry.value += dt;
    let pp = p.value;
    let vv = v.value;
    const to = t.value;
    while (stepCarry.value >= SPRING_DT) {
      stepCarry.value -= SPRING_DT;
      [pp, vv] = springStep(pp, vv, to);
      springT.value += SPRING_DT;
      // the panel's content lights up only once it has (almost) landed
      if (!landed.value && Math.abs(pp - to) < 0.03) {
        landed.value = true;
        if (hm(to) !== activeRef.current) runOnJS(activate)(hm(to));
      }
      if (settled(pp, vv, to) || springT.value >= SPRING_MAX_S) {
        pp = hm(to);
        t.value = pp;
        vv = 0;
        springOn.value = false;
        moving.value = false;
        stepCarry.value = 0;
        if (!landed.value) {
          landed.value = true;
          runOnJS(activate)(hm(to));
        }
        break;
      }
    }
    p.value = pp;
    v.value = vv;
  });

  // the ring unfolds from the front panel each time the tab opens, then the front panel lights up
  useEffect(() => {
    focusedSV.value = focused;
    if (!focused) return;
    const c = hm(Math.round(p.value));
    activate(c);
    if (reduce) {
      sp.value = 1;
      return;
    }
    sp.value = 0;
    sp.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
  }, [focused, reduce, activate, p, sp, focusedSV]);

  // ---- the finger ----
  const pan = Gesture.Pan()
    .activeOffsetX([-7, 7])
    .failOffsetY([-9, 9])
    .onStart(() => {
      springOn.value = false;
      moving.value = true;
      sp.value = 1;
      p0.value = p.value;
    })
    .onUpdate((e) => {
      p.value = p0.value - e.translationX / L.step;
    })
    .onEnd((e) => {
      const r = swipeTarget(p.value, p0.value, e.velocityX, L.step);
      go(r.t, r.v);
    });

  const tapTo = (i: number) => {
    const kk = Math.round(t.value);
    const dir = hm(i - kk) === 1 ? 1 : -1;
    go(kk + dir);
  };
  const dotTo = (j: number) => {
    const kk = Math.round(t.value);
    const df = hm(j - kk + 1) - 1;
    if (df) go(kk + df);
    else if (activeRef.current !== j) activate(j);
  };

  // ---- equal panel heights (prototype hFit): the chart and the calendar may grow a little ----
  const [nat, setNat] = useState<number[]>([0, 0, 0]);
  const T = Math.max(...nat);
  const grow = nat.map((n, i) => {
    const ex = T - n;
    if (!n || ex <= 6) return 0;
    if (i === 1) return Math.min(44, Math.round(ex));
    if (i === 2) return Math.min(52, 44 + ex / rows) - 44;
    return 0;
  });
  const ph = nat.every((n) => n > 0) ? T + 16 + 14 + 2 : undefined;
  const onNatural = (i: number) => (h: number) => setNat((a) => (Math.abs(a[i] - h) < 0.5 ? a : a.map((x, j) => (j === i ? h : x))));

  // ---- the glowing base: two ellipses and the dashed ring ----
  const bw = Math.min(W * 0.88, 430);
  const sx = bw / 300;
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ringOffset.value }));

  return (
    <HoloClock.Provider value={liveT}>
    <Animated.View ref={box}>
      <GestureDetector gesture={pan}>
        <View ref={stage} style={{ height: (ph ?? 472) + HPT + HPB, overflow: 'hidden' }}>
          <View pointerEvents="none" style={[st.base, { width: bw, marginLeft: -bw / 2 }]}>
            <Svg width={bw} height={46}>
              <Defs>
                <RadialGradient id="hbg" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={k.hb} stopOpacity={0.34} />
                  <Stop offset="0.55" stopColor={k.hb} stopOpacity={0.1} />
                  <Stop offset="1" stopColor={k.hb} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx={bw / 2} cy={23} rx={150 * sx} ry={23} fill="url(#hbg)" />
              <Ellipse cx={bw / 2} cy={23} rx={132 * sx} ry={12.5} fill="none" stroke={k.hr} strokeOpacity={0.5} strokeWidth={1} />
              <AnimatedEllipse cx={bw / 2} cy={23} rx={108 * sx} ry={9.5} fill="none" stroke={k.hr} strokeWidth={1.6} strokeDasharray={[2, 7]} animatedProps={ringProps} />
            </Svg>
          </View>
          {panels.map((render, i) => {
            const front = i === cur;
            return (
              <RingPanel
                key={i}
                i={i}
                L={L}
                p={p}
                sp={sp}
                floatT={floatT}
                depth={front ? 60 : 20}
                h={ph}
                activation={act[i]}
                onPressSide={front ? null : () => tapTo(i)}
              >
                {render({ activation: act[i], grow: grow[i], onNatural: onNatural(i) })}
              </RingPanel>
            );
          })}
        </View>
      </GestureDetector>
      <View style={st.dots}>
        {Array.from({ length: HN }, (_, j) => (
          <Dot key={j} on={j === cur} color={k.dot} glow={k.dotOnGlow} onPress={() => dotTo(j)} />
        ))}
      </View>
    </Animated.View>
    </HoloClock.Provider>
  );
});

function Dot({ on, color, glow, onPress }: { on: boolean; color: string; glow: string; onPress: () => void }) {
  const { c } = useTheme();
  const w = useSharedValue(on ? 22 : 8);
  useEffect(() => {
    w.value = withTiming(on ? 22 : 8, { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [on, w]);
  const anim = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} hitSlop={8}>
      {/* the glow is kept as a bitmap instead of a shadow redrawn every frame */}
      <Animated.View shouldRasterizeIOS renderToHardwareTextureAndroid style={[st.dot, { backgroundColor: on ? c.accent : color, boxShadow: on ? glow : undefined }, anim]} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  vzs: { position: 'absolute', top: HPT, left: '50%' },
  base: { position: 'absolute', left: '50%', bottom: 8, height: 46 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 2, paddingBottom: 4 },
  dot: { height: 8, borderRadius: 4 },
});
