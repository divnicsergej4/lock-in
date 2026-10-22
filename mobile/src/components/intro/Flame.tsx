// The streak flame of the prototype (flameSVG + .flm CSS): three flickering layers whose outlines
// morph (SVG <animate>), stretch and squash from the bottom, sparks rising, and a glow around it.
// Drawn with Skia; everything moves on the UI thread.

import {
  Canvas,
  Circle,
  ColorMatrix,
  Shadow,
  Group,
  LinearGradient,
  Paint,
  Path,
  RoundedRect,
  Skia,
  SweepGradient,
  usePathInterpolation,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { bezier } from './cssAnim';

const BOX = 'inset 0 0 0 1px rgba(255,255,255,0.07), 0 8px 20px rgba(0,0,0,0.25)';

/** Flame colours per tier (prototype .t-or ... .t-lg): a = base, b = middle, c = core. */
export const FLAME_COLORS = {
  or: { a: '#ff3300', b: '#ff8a00', c: '#ffd27a', box: BOX },
  bl: { a: '#0047ff', b: '#2fb8ff', c: '#e8fbff', box: BOX },
  rd: { a: '#a30018', b: '#ff2e2e', c: '#ffd29a', box: BOX },
  gd: { a: '#f2b600', b: '#fff07a', c: '#ffffff', box: 'inset 0 0 0 2px rgba(255,215,64,0.55), 0 0 18px rgba(255,210,60,0.35)' },
  pu: { a: '#5b16d6', b: '#c06bff', c: '#f6e9ff', box: BOX },
  gr: { a: '#008f45', b: '#38ff8f', c: '#eaffef', box: BOX },
  di: { a: '#5fb6ff', b: '#d9f3ff', c: '#ffffff', box: BOX },
  rb: { a: '#ff2e2e', b: '#ffb300', c: '#fff6c2', box: BOX },
  lg: { a: '#ffb800', b: '#fff1a8', c: '#ffffff', box: BOX },
} as const;

/** CSS hue-rotate(deg) as a Skia colour matrix. */
function hueMatrix(deg: number) {
  'worklet';
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

const FO = [
  'M32 3C37 15 51 23 52 41C53 59 44 76 32 76C20 76 11 61 12 45C13 34 18 28 22 20C24 28 27 31 30 32C30 22 28 13 32 3Z',
  'M37 5C39 17 52 25 53 42C54 60 44 76 32 76C20 76 11 61 11 46C12 35 17 28 21 21C24 29 28 31 31 31C32 21 32 13 37 5Z',
  'M32 3C37 15 51 23 52 41C53 59 44 76 32 76C20 76 11 61 12 45C13 34 18 28 22 20C24 28 27 31 30 32C30 22 28 13 32 3Z',
  'M27 4C33 15 49 23 51 40C53 58 44 76 32 76C20 76 11 62 12 45C13 33 19 27 24 18C25 27 28 30 30 31C29 21 25 12 27 4Z',
  'M32 3C37 15 51 23 52 41C53 59 44 76 32 76C20 76 11 61 12 45C13 34 18 28 22 20C24 28 27 31 30 32C30 22 28 13 32 3Z',
];
const FM = [
  'M32 24C36 33 45 39 45 52C45 65 39 74 32 74C25 74 19 66 19 55C19 47 24 42 27 36C29 42 31 44 33 44C33 38 31 31 32 24Z',
  'M35 25C38 34 46 40 46 53C46 66 39 74 32 74C25 74 19 66 19 56C19 48 23 43 26 37C29 43 32 45 34 44C35 38 34 31 35 25Z',
  'M32 24C36 33 45 39 45 52C45 65 39 74 32 74C25 74 19 66 19 55C19 47 24 42 27 36C29 42 31 44 33 44C33 38 31 31 32 24Z',
  'M29 25C34 33 44 39 44 52C44 65 39 74 32 74C25 74 19 66 19 55C19 46 25 41 28 35C29 41 31 43 32 43C31 37 28 31 29 25Z',
  'M32 24C36 33 45 39 45 52C45 65 39 74 32 74C25 74 19 66 19 55C19 47 24 42 27 36C29 42 31 44 33 44C33 38 31 31 32 24Z',
];
const FI = [
  'M32 44C35 50 39 54 39 61C39 68 36 73 32 73C28 73 25 68 25 62C25 57 28 54 29 50C31 54 32 55 33 55C33 51 32 48 32 44Z',
  'M34 45C36 51 40 55 40 62C40 69 36 73 32 73C28 73 25 68 25 62C25 57 28 54 30 51C31 54 33 56 34 55C35 51 34 48 34 45Z',
  'M32 44C35 50 39 54 39 61C39 68 36 73 32 73C28 73 25 68 25 62C25 57 28 54 29 50C31 54 32 55 33 55C33 51 32 48 32 44Z',
  'M30 45C34 50 38 54 38 61C38 68 36 73 32 73C28 73 24 68 24 62C24 57 27 53 29 49C30 53 31 54 32 54C31 50 30 48 30 45Z',
  'M32 44C35 50 39 54 39 61C39 68 36 73 32 73C28 73 25 68 25 62C25 57 28 54 29 50C31 54 32 55 33 55C33 51 32 48 32 44Z',
];
const KEYS = [0, 0.25, 0.5, 0.75, 1];
const EIO = [0.42, 0, 0.58, 1]; // ease-in-out

/** CSS "alternate" progress of an infinite animation. */
function alt(t: number, dur: number) {
  'worklet';
  const i = Math.floor(t / dur);
  const p = (t - i * dur) / dur;
  return i % 2 ? 1 - p : p;
}
function lerp(a: number, b: number, k: number) {
  'worklet';
  return a + (b - a) * k;
}

/** One flame layer: outline morph + stretch from the bottom centre of its own box (transform-box: fill-box). */
function Layer({ paths, morphMs, clock, scale, colors }: { paths: string[]; morphMs: number; clock: SharedValue<number>; scale: (t: number) => number[]; colors: string[] | string }) {
  const outputs = useMemo(() => paths.map((d) => Skia.Path.MakeFromSVGString(d) as SkPath), [paths]);
  const morph = useDerivedValue(() => (clock.value % morphMs) / morphMs);
  const path = usePathInterpolation(morph, KEYS, outputs);
  const box = useDerivedValue(() => path.value.computeTightBounds());
  const matrix = useDerivedValue(() => {
    const [sx, sy] = scale(clock.value);
    const b = box.value;
    const ox = b.x + b.width / 2;
    const oy = b.y + b.height;
    return Skia.Matrix([sx, 0, ox - sx * ox, 0, sy, oy - sy * oy, 0, 0, 1]);
  });
  const start = useDerivedValue(() => vec(0, box.value.y + box.value.height));
  const end = useDerivedValue(() => vec(0, box.value.y));
  return (
    <Group matrix={matrix}>
      {typeof colors === 'string' ? (
        <Path path={path} color={colors} />
      ) : (
        <Path path={path}>
          <LinearGradient start={start} end={end} colors={colors} />
        </Path>
      )}
    </Group>
  );
}

/** A spark: @keyframes emb 2.3s linear, starting `offset` ms into its cycle. */
function Ember({ cx, cy, r, offset, clock, color }: { cx: number; cy: number; r: number; offset: number; clock: SharedValue<number>; color: string }) {
  const p = useDerivedValue(() => ((clock.value + offset) % 2300) / 2300);
  const opacity = useDerivedValue(() => (p.value < 0.15 ? p.value / 0.15 : 1 - (p.value - 0.15) / 0.85));
  const transform = useDerivedValue(() => [{ translateX: 5 * p.value }, { translateY: -44 * p.value }]);
  return <Circle cx={cx} cy={cy} r={r} color={color} opacity={opacity} transform={transform} />;
}

export type FlameTier = keyof typeof FLAME_COLORS;

/** The flame in its rounded dark box (prototype .flw, 70 × 82). Change `levelUp` to play the level-up bounce. */
export function Flame({ tier = 'or', style, levelUp = 0 }: { tier?: FlameTier; style?: ViewStyle; levelUp?: number }) {
  const col = FLAME_COLORS[tier];
  const reduce = useReducedMotion();
  const clock = useSharedValue(0);
  useFrameCallback((f) => {
    if (!reduce) clock.value = f.timeSinceFirstFrame;
  });
  // svg 54×68 showing a 64×80 viewBox: scale 0.84375, centred vertically
  const s = 54 / 64;
  const fk1 = (t: number) => {
    'worklet';
    // 0% scale(1,1) 50% scale(.96,1.05) 100% scale(1.03,.97), ease-in-out per interval
    const p = alt(t, 1150);
    if (p < 0.5) {
      const k = bezier(EIO, p / 0.5);
      return [lerp(1, 0.96, k), lerp(1, 1.05, k)];
    }
    const k = bezier(EIO, (p - 0.5) / 0.5);
    return [lerp(0.96, 1.03, k), lerp(1.05, 0.97, k)];
  };
  const fk2 = (t: number) => {
    'worklet';
    const k = bezier(EIO, alt(t, 850));
    return [lerp(1.02, 0.93, k), lerp(0.98, 1.08, k)];
  };
  const fk3 = (t: number) => {
    'worklet';
    const k = bezier(EIO, alt(t, 600));
    return [lerp(1, 0.9, k), lerp(0.94, 1.1, k)];
  };
  // filter on the flame: drop-shadow(0 0 7px b) drop-shadow(0 0 2px a) (Legendary: 9px #ffd23f, 3px #fff);
  // the Rainbow flame has one shadow and turns through every hue every 3 s. Blur radius → sigma = radius / 2.
  const hue = useDerivedValue(() => hueMatrix(((clock.value % 3000) / 3000) * 360));
  const shadows =
    tier === 'lg' ? (
      <Shadow dx={0} dy={0} blur={1.5} color="#ffffff">
        <Shadow dx={0} dy={0} blur={4.5} color="#ffd23f" />
      </Shadow>
    ) : tier === 'rb' ? (
      <Shadow dx={0} dy={0} blur={3.5} color={col.b} />
    ) : (
      <Shadow dx={0} dy={0} blur={1} color={col.a}>
        <Shadow dx={0} dy={0} blur={3.5} color={col.b} />
      </Shadow>
    );
  const flame = (
    <Group
      transform={[{ translateX: 20 }, { translateY: 20 + (68 - 80 * s) / 2 }, { scale: s }]}
      layer={<Paint>{shadows}</Paint>}
    >
      <Layer paths={FO} morphMs={1900} clock={clock} scale={fk1} colors={[col.a, col.b]} />
      <Layer paths={FM} morphMs={1400} clock={clock} scale={fk2} colors={[col.b, col.c]} />
      <Layer paths={FI} morphMs={1000} clock={clock} scale={fk3} colors={col.c} />
      {!reduce && (
        <>
          <Ember cx={25} cy={44} r={1.7} offset={0} clock={clock} color={col.b} />
          <Ember cx={38} cy={40} r={1.4} offset={800} clock={clock} color={col.b} />
          <Ember cx={31} cy={34} r={1.2} offset={1600} clock={clock} color={col.b} />
        </>
      )}
    </Group>
  );

  // .flw.lvlup: 0% scale(1) → 35% scale(1.28) rotate(-7deg) → 100% scale(1), cubic-bezier(.3,1.6,.5,1) per interval
  const pop = useSharedValue(0);
  useEffect(() => {
    if (!levelUp || reduce) return;
    const ease = Easing.bezier(0.3, 1.6, 0.5, 1);
    pop.value = 0;
    pop.value = withSequence(withTiming(0.35, { duration: 315, easing: ease }), withTiming(1, { duration: 585, easing: ease }));
  }, [levelUp, reduce, pop]);
  const popStyle = useAnimatedStyle(() => {
    const p = pop.value;
    if (p <= 0 || p >= 1) return { transform: [{ scale: 1 }, { rotate: '0deg' }] };
    const k = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
    return { transform: [{ scale: 1 + 0.28 * k }, { rotate: -7 * k + 'deg' }] };
  });

  return (
    <Animated.View style={[{ width: 70, height: 82 }, style, popStyle]}>
      {tier === 'lg' && <RainbowRing clock={clock} />}
      <View
        style={{
          width: 70,
          height: 82,
          borderRadius: 22,
          backgroundColor: tier === 'lg' ? '#120a22' : '#06110b',
          backgroundImage:
            tier === 'lg'
              ? 'radial-gradient(circle at 50% 75%, rgba(255,200,60,0.25), transparent 65%)'
              : 'radial-gradient(circle at 50% 80%, rgba(255,255,255,0.07), transparent 60%)',
          boxShadow: col.box,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Canvas style={{ width: 54 + 40, height: 68 + 40, margin: -20 }} pointerEvents="none">
          {tier === 'rb' ? (
            <Group
              layer={
                <Paint>
                  <ColorMatrix matrix={hue} />
                </Paint>
              }
            >
              {flame}
            </Group>
          ) : (
            flame
          )}
        </Canvas>
      </View>
      {tier === 'di' && (
        <>
          <Twinkle clock={clock} style={{ top: 8, right: 9 }} size={12.8} delay={0} />
          <Twinkle clock={clock} style={{ bottom: 14, left: 8 }} size={9.6} delay={900} />
        </>
      )}
      {tier === 'lg' && <Text style={fl.moai}>🗿</Text>}
    </Animated.View>
  );
}

/** Diamond flame sparkles (✦, @keyframes tw 1.8s ease-in-out infinite). */
function Twinkle({ style, size, delay, clock }: { style: ViewStyle; size: number; delay: number; clock: SharedValue<number> }) {
  const anim = useAnimatedStyle(() => {
    const p = ((clock.value + delay) % 1800) / 1800;
    const k = bezier(EIO, p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5);
    return { opacity: 0.15 + 0.85 * k, transform: [{ scale: 0.6 + 0.5 * k }] };
  });
  return <Animated.Text style={[fl.twinkle, { fontSize: size, lineHeight: size * 1.45 }, style, anim]}>✦</Animated.Text>;
}

/** Legendary flame: a rainbow ring (conic gradient, 3 px outside the box) slowly cycling its hues. */
function RainbowRing({ clock }: { clock: SharedValue<number> }) {
  const hue = useDerivedValue(() => hueMatrix(((clock.value % 3000) / 3000) * 360));
  return (
    <Canvas style={{ position: 'absolute', left: -3, top: -3, width: 76, height: 88 }} pointerEvents="none">
      <RoundedRect x={0} y={0} width={76} height={88} r={25}>
        <SweepGradient c={vec(38, 44)} colors={['#ff2e2e', '#ffb300', '#fff04d', '#38ff8f', '#2fb8ff', '#c06bff', '#ff2e2e']} start={-90} end={270} />
        <ColorMatrix matrix={hue} />
      </RoundedRect>
    </Canvas>
  );
}

const fl = StyleSheet.create({
  twinkle: { position: 'absolute', color: '#fff', textShadowColor: '#bfe9ff', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  moai: { position: 'absolute', right: -6, bottom: -6, fontSize: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 2 } },
});

