// Pieces shared by the three ring panels: the header with its blinking tag, a measured content column
// (so the ring can make the panels equally tall), and small arrival animations.

import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { bezier } from '@/components/intro/cssAnim';
import { inter, useTheme } from '@/theme';

import { useHoloClock } from './holoClock';

/** Panel title and its tag ("● OCT 2026", the dot blinking: @keyframes hbl 2.6s). */
export function PanelHead({ title, tag }: { title: string; tag?: string }) {
  const { c } = useTheme();
  // 1 → .25 → 1 over 2.6 s, each half ease-in-out; on the ring's clock, so it rests while scrolling
  const t = useHoloClock();
  const blink = useAnimatedStyle(() => {
    const ph = (t.value % 2600) / 2600;
    const k = bezier([0.42, 0, 0.58, 1], ph < 0.5 ? ph / 0.5 : (ph - 0.5) / 0.5);
    return { opacity: ph < 0.5 ? 1 - 0.75 * k : 0.25 + 0.75 * k };
  });
  return (
    <View style={st.hh}>
      <Text style={[st.h2, { color: c.ink }]} numberOfLines={1}>
        {title}
      </Text>
      {!!tag && (
        <View style={st.tag}>
          {/* the glow is drawn once and kept as a bitmap (iOS); only its opacity changes */}
          <Animated.View shouldRasterizeIOS style={[st.tagDot, { backgroundColor: c.accent, boxShadow: `0 0 6px ${c.accent}` }, blink]} />
          <Text style={[st.tagT, { color: c.accent }]}>{tag.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The panel's content. `gap` marks where the panel's spare height goes (flex: 1); the column reports
 * its natural height = its height minus that spare room.
 */
export function useNaturalHeight(onNatural: (h: number) => void, grow: number) {
  const m = useRef({ total: 0, spare: 0, grow });
  m.current.grow = grow;
  const report = () => {
    if (m.current.total) onNatural(m.current.total - m.current.spare - m.current.grow);
  };
  return {
    onColumn: (h: number) => {
      m.current.total = h;
      report();
    },
    onSpare: (h: number) => {
      m.current.spare = h;
      report();
    },
  };
}

export function Column({ children, onLayout, style }: { children: ReactNode; onLayout: (h: number) => void; style?: ViewStyle }) {
  return (
    <View style={[{ flexGrow: 1 }, style]} onLayout={(e) => onLayout(e.nativeEvent.layout.height)}>
      {children}
    </View>
  );
}

export function Spare({ onLayout }: { onLayout: (h: number) => void }) {
  return <View style={{ flexGrow: 1 }} onLayout={(e) => onLayout(e.nativeEvent.layout.height)} />;
}

/** A Web Animations-style arrival: from opacity 0 / offset to normal, replayed when `play` changes. */
export function Arrive({
  play,
  delay = 0,
  duration,
  from,
  ease = [0.2, 0.8, 0.2, 1],
  style,
  children,
}: {
  play: number;
  delay?: number;
  duration: number;
  from: { opacity?: number; x?: number; y?: number; scale?: number };
  ease?: number[];
  style?: ViewStyle;
  children: ReactNode;
}) {
  const k = useSharedValue(1);
  const curve = useRef(ease);
  useEffect(() => {
    if (!play) return;
    const e = curve.current;
    k.value = 0;
    k.value = withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(e[0], e[1], e[2], e[3]) }));
  }, [play, delay, duration, k]);
  const anim = useAnimatedStyle(() => {
    const v = k.value;
    const lerp = (a: number | undefined, b: number) => (a == null ? b : a + (b - a) * v);
    return {
      opacity: from.opacity == null ? 1 : Math.min(1, Math.max(0, lerp(from.opacity, 1))),
      transform: [{ translateX: lerp(from.x, 0) }, { translateY: lerp(from.y, 0) }, { scale: lerp(from.scale, 1) }],
    };
  });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

const st = StyleSheet.create({
  hh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  h2: { flexShrink: 1, fontFamily: inter[700], fontSize: 16.32, lineHeight: 23.664 },
  tag: { flexDirection: 'row', alignItems: 'center', opacity: 0.85 },
  tagDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 6 },
  tagT: { fontFamily: inter[700], fontSize: 9.6, lineHeight: 13.92, letterSpacing: 1.344, fontVariant: ['tabular-nums'] },
});
