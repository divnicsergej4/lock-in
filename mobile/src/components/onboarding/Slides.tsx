// The three skippable intro slides (prototype #land): Spending, Roasts, Streak.
// Each slide's pieces land when it comes into view (.pin), the balance ticks down, the roast level
// switches by itself every 2.8 s, and the week fills in. Values are the browser's computed styles.

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/CategoryIcon';
import { Flame } from '@/components/intro/Flame';
import { brico } from '@/theme';

import { Enter } from './Enter';

const INK = '#0d1f15';
const GREEN = '#12b85f';
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const OUT = Easing.bezier(0.2, 0.8, 0.2, 1);

/** .pin: fades and rises in when its slide is active; --d staggers it by 0.18 s. */
function Pin({ on, d, chip, style, children }: { on: boolean; d: number; chip?: boolean; style?: ViewStyle | ViewStyle[]; children: ReactNode }) {
  const o = useSharedValue(0);
  const k = useSharedValue(0);
  useEffect(() => {
    const delay = d * 180 + 100;
    o.value = withDelay(delay, withTiming(on ? 1 : 0, { duration: 550, easing: EASE }));
    k.value = withDelay(delay, withTiming(on ? 1 : 0, { duration: 700, easing: OUT }));
  }, [on, d, o, k]);
  const anim = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: chip
      ? [{ translateY: 10 * (1 - k.value) }, { rotate: '3deg' }]
      : [{ translateY: 14 * (1 - k.value) }, { scale: 0.98 + 0.02 * k.value }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** The gentle float of the active slide's main card (@keyframes hfl 6s ease-in-out 1.2s infinite). */
function useFloat(on: boolean) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (on) {
      const half = { duration: 3000, easing: Easing.bezier(0.42, 0, 0.58, 1) };
      y.value = withDelay(1200, withRepeat(withSequence(withTiming(-5, half), withTiming(0, half)), -1));
    } else {
      cancelAnimation(y);
      y.value = 0;
    }
  }, [on, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

/** Soft coloured glow behind each slide's picture (.sl .vis::before). */
function Glow({ color }: { color: string }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: '-9%', top: '-6%', width: '118%', height: '112%', backgroundImage: `radial-gradient(closest-side, ${color}, transparent)` }}
    />
  );
}

// ---------------- slide 1: Spending ----------------
const BAL = [967, 961, 897, 812];

function SpendingSlide({ on }: { on: boolean }) {
  const [n, setN] = useState(BAL[3]);
  const [barW, setBarW] = useState(0);
  const pct = useSharedValue(0.6);
  const float = useFloat(on);
  useEffect(() => {
    if (!on) return;
    const bar = { duration: 500, easing: Easing.bezier(0.3, 0.7, 0.3, 1) };
    setN(BAL[0]);
    pct.value = withTiming(0.77, bar);
    const ts = [1, 2, 3].map((k) =>
      setTimeout(() => {
        setN(BAL[k]);
        pct.value = withTiming(Math.round((BAL[k] / BAL[0]) * 77) / 100, bar);
      }, 380 + k * 180),
    );
    return () => ts.forEach(clearTimeout);
  }, [on, pct]);
  const fill = useAnimatedStyle(() => ({ width: barW * pct.value }));
  const rows: [string, string, string, string, string][] = [
    ['Coffee', '#9b4dff', 'Coffee', 'coffee with a friend', '−$6'],
    ['Groceries', '#ffab3d', 'Groceries', 'weekly shop', '−$64'],
    ['Nights out', '#5aa9f0', 'Night out', 'Friday with the crew', '−$85'],
  ];
  return (
    <View style={s.vis}>
      <Glow color="rgba(34,224,122,0.30)" />
      <Animated.View style={[s.hcard, s.h1c, float]}>
        <View style={s.h1t}>
          <Text style={s.h1tT}>Left this month</Text>
          <Text style={s.h1n}>${n}</Text>
          <View style={s.h1b} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            <Animated.View style={[s.h1bFill, fill]} />
          </View>
        </View>
        {rows.map(([cat, col, name, sub, amt], i) => (
          <Pin key={cat} on={on} d={i} style={[s.hrow, i > 0 ? s.hrowLine : {}]}>
            <CategoryIcon cat={cat} color={col} style={{ marginRight: 4 }} />
            <View style={s.hrn}>
              <Text style={s.hrnB}>{name}</Text>
              <Text style={s.hrnS}>{sub}</Text>
            </View>
            <Text style={s.hra}>{amt}</Text>
          </Pin>
        ))}
      </Animated.View>
      <Pin on={on} d={3} chip style={s.hchip}>
        <Text style={s.hchipT}>3 sec per expense</Text>
      </Pin>
    </View>
  );
}

// ---------------- slide 2: Roasts ----------------
const LEVELS = ['Gentle', 'Normal', 'No mercy'];
const MSGS = [
  'logged, just watch your goal 🙂',
  'going out is expensive, and tomorrow your head hurts too 🥀🥀',
  'going out is expensive, and tomorrow your head hurts too 🥀🥀 Your goal is watching and it’s disappointed.',
];

function LevelLabel({ text, color }: { text: string; color: string }) {
  const c = useSharedValue(color);
  useEffect(() => {
    c.value = withTiming(color, { duration: 300, easing: EASE });
  }, [color, c]);
  const anim = useAnimatedStyle(() => ({ color: c.value }));
  return <Animated.Text style={[s.rlvT, anim]}>{text}</Animated.Text>;
}

function RoastsSlide({ on }: { on: boolean }) {
  const [lv, setLv] = useState(1);
  const [msg, setMsg] = useState(MSGS[1]);
  const [segW, setSegW] = useState(0);
  const x = useSharedValue(1);
  const fade = useSharedValue(1);
  const float = useFloat(on);
  useEffect(() => {
    if (!on) return;
    let level = 1;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const set = (v: number) => {
      level = v;
      setLv(v);
      x.value = withTiming(v, { duration: 450, easing: Easing.bezier(0.3, 0.7, 0.2, 1) });
      fade.value = withTiming(0, { duration: 250, easing: EASE });
      timers.push(
        setTimeout(() => {
          setMsg(MSGS[v]);
          fade.value = withTiming(1, { duration: 250, easing: EASE });
        }, 250),
      );
    };
    set(1);
    const iv = setInterval(() => set((level + 1) % 3), 2800);
    return () => {
      clearInterval(iv);
      timers.forEach(clearTimeout);
    };
  }, [on, x, fade]);
  const knob = useAnimatedStyle(() => ({ width: segW, transform: [{ translateX: x.value * segW }] }));
  const msgAnim = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: 4 * (1 - fade.value) }] }));
  return (
    <View style={s.vis}>
      <Glow color="rgba(155,77,255,0.22)" />
      <Pin on={on} d={0} style={[s.hcard, s.rex]}>
        <CategoryIcon cat="Nights out" color="#5aa9f0" style={{ marginRight: 4 }} />
        <View style={s.hrn}>
          <Text style={s.hrnB}>Night out</Text>
          <Text style={s.hrnS}>just logged</Text>
        </View>
        <Text style={s.hra}>−$85</Text>
      </Pin>
      <Pin on={on} d={1} style={s.rtoWrap}>
        <Animated.View style={[s.rto, float]}>
          <View style={s.ni}>
            <Text style={{ fontSize: 19.2, lineHeight: 27.84 }}>🗿</Text>
          </View>
          <Animated.Text style={[s.rmsg, msgAnim]}>{msg}</Animated.Text>
        </Animated.View>
      </Pin>
      <Pin on={on} d={2} style={s.rlv}>
        <View style={StyleSheet.absoluteFill} onLayout={(e) => setSegW((e.nativeEvent.layout.width - 8) / 3)} pointerEvents="none" />
        <Animated.View style={[s.rlk, knob]} />
        {LEVELS.map((t, j) => (
          <LevelLabel key={t} text={t} color={j === lv ? (lv === 2 ? '#d93a3a' : INK) : '#6d7d73'} />
        ))}
      </Pin>
    </View>
  );
}

// ---------------- slide 3: Streak ----------------
function Day({ on, i, label, today }: { on: boolean; i: number; label: string; today?: boolean }) {
  const k = useSharedValue(today ? 1 : 0);
  const bg = useSharedValue('rgba(127,127,127,0.12)');
  useEffect(() => {
    if (today) return;
    const delay = on ? 450 + i * 100 : 0;
    k.value = withDelay(delay, withTiming(on ? 1 : 0, { duration: 400, easing: Easing.bezier(0.3, 1.6, 0.5, 1) }));
    bg.value = withDelay(delay, withTiming(on ? '#22e07a' : 'rgba(127,127,127,0.12)', { duration: 300, easing: EASE }));
  }, [on, i, today, k, bg]);
  const anim = useAnimatedStyle(() => (today ? {} : { backgroundColor: bg.value, transform: [{ scale: 0.6 + 0.4 * k.value }] }));
  return (
    <Animated.View style={[s.day, today ? s.dayToday : null, anim]}>
      <Text style={[s.dayT, { color: today ? INK : '#04140a' }]}>{label}</Text>
    </Animated.View>
  );
}

function StreakSlide({ on }: { on: boolean }) {
  return (
    <View style={s.vis}>
      <Glow color="rgba(255,176,40,0.30)" />
      <Pin on={on} d={0} style={[s.hcard, s.fdemo]}>
        <Flame tier="gd" />
        <View>
          <Text style={s.fn}>14</Text>
          <Text style={s.fdays}>days in a row</Text>
          <Text style={s.ft}>Golden flame</Text>
        </View>
      </Pin>
      <Pin on={on} d={1} style={s.wk7}>
        {['M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Day key={i} on={on} i={i} label={d} />
        ))}
        <Day on={on} i={6} label="S" today />
      </Pin>
    </View>
  );
}

// ---------------- the carousel ----------------
const SLIDES = [
  { eb: 'Spending', sh: 'Stop wondering where your money went.', sp: 'Log an expense in seconds and see what’s left until the end of the month.', Vis: SpendingSlide },
  { eb: 'Roasts', sh: 'Overspend? You’ll hear about it.', sp: 'Every expense gets a reply. Honest, sometimes harsh. You pick how harsh.', Vis: RoastsSlide },
  { eb: 'Streak', sh: 'Keep the flame alive.', sp: 'Log your spending every day and the flame grows. Skip a single day and it goes out.', Vis: StreakSlide },
];

function Dot({ on }: { on: boolean }) {
  const w = useSharedValue(on ? 22 : 8);
  const c = useSharedValue(on ? GREEN : '#dbe7df');
  useEffect(() => {
    w.value = withTiming(on ? 22 : 8, { duration: 250, easing: EASE });
    c.value = withTiming(on ? GREEN : '#dbe7df', { duration: 250, easing: EASE });
  }, [on, w, c]);
  const anim = useAnimatedStyle(() => ({ width: w.value, backgroundColor: c.value }));
  return <Animated.View style={[s.dot, anim]} />;
}

export function Slides({ onDone }: { onDone: () => void }) {
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [carH, setCarH] = useState(0);
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const k = Math.max(0, Math.min(2, Math.round(e.nativeEvent.contentOffset.x / Math.max(1, W))));
    if (k !== i) setI(k);
  };
  return (
    <Enter kind="pop" style={{ flex: 1, backgroundColor: '#f4f8f5' }}>
      <View style={[s.ctop, { paddingTop: 14 + insets.top }]}>
        <Text style={s.wm}>Lock In 🗿</Text>
        <Pressable accessibilityRole="button" onPress={onDone} style={[s.skip, i === 2 && { opacity: 0 }]} disabled={i === 2}>
          <Text style={s.skipT}>Skip</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        onLayout={(e) => setCarH(e.nativeEvent.layout.height)}
      >
        {SLIDES.map(({ eb, sh, sp, Vis }, k) => (
          <View key={eb} style={[s.sl, { width: W, height: carH || undefined }]}>
            <Vis on={i === k} />
            <Text style={s.eb}>{eb}</Text>
            <Text style={s.sh}>{sh}</Text>
            <Text style={s.sp}>{sp}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.cdots}>
        {[0, 1, 2].map((k) => (
          <Dot key={k} on={i === k} />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => (i < 2 ? ref.current?.scrollTo({ x: (i + 1) * W, animated: true }) : onDone())}
        style={({ pressed }) => [s.nx, { marginBottom: 18 + insets.bottom }, pressed && { opacity: 0.85 }]}
      >
        <Text style={s.nxT}>{i < 2 ? 'Next' : 'Set up the app'}</Text>
      </Pressable>
    </Enter>
  );
}

const s = StyleSheet.create({
  ctop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  wm: { fontFamily: brico[800], fontSize: 19.2, lineHeight: 27.84, letterSpacing: -0.384, color: GREEN },
  skip: { paddingVertical: 8, paddingHorizontal: 2, borderRadius: 12 },
  skipT: { fontFamily: brico[600], fontSize: 16, lineHeight: 23.2, color: '#5d7466' },
  sl: { paddingTop: 8, paddingHorizontal: 24, justifyContent: 'center' },
  vis: { minHeight: 340, justifyContent: 'center', gap: 12 },
  eb: { marginTop: 30, fontFamily: brico[800], fontSize: 11.84, lineHeight: 17.168, letterSpacing: 1.6576, textTransform: 'uppercase', color: '#12a457' },
  sh: { marginTop: 8, marginBottom: 10, fontFamily: brico[800], fontSize: 29.6, lineHeight: 33.152, letterSpacing: -0.74, color: INK },
  sp: { fontFamily: brico[400], fontSize: 16.32, lineHeight: 24.48, color: '#5d7466' },
  hcard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(13,31,21,0.07)',
    borderRadius: 22,
    boxShadow: '0 22px 48px -20px rgba(13,31,21,0.38), 0 2px 6px rgba(13,31,21,0.05)',
  },
  h1c: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 6 },
  h1t: { paddingTop: 2, paddingHorizontal: 2, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(13,31,21,0.07)' },
  h1tT: { fontFamily: brico[600], fontSize: 13.6, lineHeight: 19.72, color: '#5d6f64' },
  h1n: { marginTop: 4, fontFamily: brico[800], fontSize: 36.8, lineHeight: 36.8, letterSpacing: -1.288, color: INK, fontVariant: ['tabular-nums'] },
  h1b: { height: 6, borderRadius: 3, backgroundColor: 'rgba(18,184,95,0.13)', marginTop: 12, overflow: 'hidden' },
  h1bFill: { height: '100%', borderRadius: 3, backgroundImage: 'linear-gradient(90deg, #12b85f, #3fe08e)' },
  hrow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 2 },
  hrowLine: { borderTopWidth: 1, borderTopColor: 'rgba(13,31,21,0.06)' },
  hrn: { flex: 1, minWidth: 0 },
  hrnB: { fontFamily: brico[700], fontSize: 15.68, lineHeight: 18.816, color: INK },
  hrnS: { marginTop: 2, fontFamily: brico[400], fontSize: 12.48, lineHeight: 14.976, color: '#6d7d73' },
  hra: { fontFamily: brico[800], fontSize: 16, lineHeight: 23.2, color: '#d93a3a', fontVariant: ['tabular-nums'] },
  hchip: {
    position: 'absolute',
    top: -14,
    right: -6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: INK,
    boxShadow: '0 10px 24px -8px rgba(13,31,21,0.5)',
  },
  hchipT: { fontFamily: brico[700], fontSize: 12.48, lineHeight: 18.096, color: '#eafff2' },
  rex: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, paddingHorizontal: 16 },
  rtoWrap: { marginHorizontal: 6 },
  rto: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#0f1a14',
    boxShadow: '0 22px 44px -16px rgba(13,31,21,0.6)',
    minHeight: 96,
  },
  ni: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#1a2a21', alignItems: 'center', justifyContent: 'center' },
  rmsg: { flex: 1, fontFamily: brico[600], fontSize: 15.68, lineHeight: 21.168, color: '#fff' },
  rlv: { flexDirection: 'row', marginTop: 6, marginHorizontal: 26, padding: 4, borderRadius: 16, backgroundColor: 'rgba(13,31,21,0.06)' },
  rlk: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 4px 12px -4px rgba(13,31,21,0.3)' },
  rlvT: { flex: 1, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 2, fontFamily: brico[700], fontSize: 12.8, lineHeight: 18.56 },
  fdemo: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
  fn: { fontFamily: brico[800], fontSize: 41.6, lineHeight: 41.6, letterSpacing: -1.248, color: INK },
  fdays: { fontFamily: brico[400], fontSize: 16, lineHeight: 23.2, color: INK },
  ft: { marginTop: 6, fontFamily: brico[700], fontSize: 13.12, lineHeight: 19.024, color: '#8f6c00' },
  wk7: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    padding: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(13,31,21,0.07)',
    borderRadius: 18,
    boxShadow: '0 18px 40px -22px rgba(13,31,21,0.35)',
  },
  day: { flex: 1, aspectRatio: 1, maxWidth: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#f2c200', backgroundColor: 'transparent' },
  dayT: { fontFamily: brico[800], fontSize: 12.8, lineHeight: 18.56 },
  cdots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 22 },
  dot: { height: 8, borderRadius: 4 },
  nx: { marginTop: 16, marginHorizontal: 20, padding: 16, borderRadius: 999, backgroundColor: GREEN },
  nxT: { fontFamily: brico[700], fontSize: 16.8, lineHeight: 24.36, color: '#03130a', textAlign: 'center' },
});
