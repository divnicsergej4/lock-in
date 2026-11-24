// The padlocks of the plans screen and the screens after it (docs/dizajn/placanje, the SVGs of 06, 08–11).
// The one on "Locking you in…" moves: its ring spins while the store answers, fills up when everything is done,
// and the shackle drops shut with a tap of haptics. Everything that moves runs on the UI thread (Reanimated:
// a transform for the spin, animated SVG props for the ring and the shackle), so it stays smooth while JS works.

import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { PW } from './theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const R = 80; // ring radius in the 180 × 180 drawings
const RING = 2 * Math.PI * R; // 502.65

/** Body and keyhole of the 180 × 180 padlock. */
function Body({ fill, hole }: { fill: string; hole: string }) {
  return (
    <>
      <Rect x={54} y={78} width={72} height={58} rx={16} fill={fill} />
      <Circle cx={90} cy={102} r={7} fill={hole} />
      <Rect x={86.5} y={105} width={7} height={16} rx={3.5} fill={hole} />
    </>
  );
}

/** 06, the plans screen: the small closed padlock in a full ring (120 × 120 drawing, shown at 112). */
export function LockHero({ size = 112 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={54} fill="none" stroke={PW.line} strokeWidth={8} />
      <Circle cx={60} cy={60} r={54} fill="none" stroke={PW.green} strokeWidth={8} />
      <Path d="M46 56 V46 a14 14 0 0 1 28 0 V56" fill="none" stroke={PW.green} strokeWidth={7} strokeLinecap="round" />
      <Rect x={36} y={53} width={48} height={38} rx={11} fill={PW.green} />
      <Circle cx={60} cy={69} r={4.5} fill={PW.onGreen} />
      <Rect x={57.8} y={71} width={4.4} height={10} rx={2.2} fill={PW.onGreen} />
    </Svg>
  );
}

/** A small pop when a screen with a padlock appears. */
function usePop() {
  const s = useSharedValue(0.86);
  const o = useSharedValue(0);
  useEffect(() => {
    s.value = withSpring(1, { damping: 12, stiffness: 180 });
    o.value = withTiming(1, { duration: 220 });
  }, [s, o]);
  return useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
}

/** 09, "You're locked in.": shut, in a full ring with a soft fill. */
export function LockClosed({ size = 150 }: { size?: number }) {
  const pop = usePop();
  return (
    <Animated.View style={pop}>
      <Svg width={size} height={size} viewBox="0 0 180 180">
        <Circle cx={90} cy={90} r={R} fill="none" stroke={PW.green} strokeWidth={8} />
        <Circle cx={90} cy={90} r={64} fill="rgba(34,224,122,0.08)" />
        <Path d="M68 82 V66 a22 22 0 0 1 44 0 V82" fill="none" stroke={PW.green} strokeWidth={10} strokeLinecap="round" />
        <Body fill={PW.green} hole={PW.onGreen} />
      </Svg>
    </Animated.View>
  );
}

/** 10, "That didn't go through.": open and grey, in a dashed ring. */
export function LockOpen({ size = 130 }: { size?: number }) {
  const pop = usePop();
  return (
    <Animated.View style={pop}>
      <Svg width={size} height={size} viewBox="0 0 180 180">
        <Circle cx={90} cy={90} r={R} fill="none" stroke={PW.line} strokeWidth={8} strokeDasharray="6 14" strokeLinecap="round" />
        <Path d="M68 82 V54 a22 22 0 0 1 44 0 V62" fill="none" stroke={PW.mute} strokeWidth={10} strokeLinecap="round" />
        <Body fill={PW.mute} hole={PW.bg} />
      </Svg>
    </Animated.View>
  );
}

/** 11, "Welcome back.": shut, with a check mark instead of the keyhole. */
export function LockCheck({ size = 130 }: { size?: number }) {
  const pop = usePop();
  return (
    <Animated.View style={pop}>
      <Svg width={size} height={size} viewBox="0 0 180 180">
        <Circle cx={90} cy={90} r={R} fill="none" stroke={PW.green} strokeWidth={8} />
        <Path d="M68 82 V66 a22 22 0 0 1 44 0 V82" fill="none" stroke={PW.green} strokeWidth={10} strokeLinecap="round" />
        <Rect x={54} y={78} width={72} height={58} rx={16} fill={PW.green} />
        <Path d="M76 107 l9 9 l19 -20" fill="none" stroke={PW.onGreen} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * 08, "Locking you in…". While `shut` is false the ring (64 % of it, as drawn) spins and the shackle stands open.
 * When `shut` turns true: the ring slows to a stop and fills, the shackle drops in, haptics, then `onShut`.
 */
export function LockProcessing({ shut, onShut, size = 180 }: { shut: boolean; onShut: () => void; size?: number }) {
  const spin = useSharedValue(0); // degrees
  const fill = useSharedValue(320 / RING); // the drawn arc: 320 of 502.7
  const close = useSharedValue(0); // 0 open (as drawn in 08) → 1 shut
  const cb = useRef(onShut);
  cb.current = onShut;

  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [spin]);

  useEffect(() => {
    if (!shut) return;
    cancelAnimation(spin);
    // finish the turn it is on, slowing down, so it never jumps back
    spin.value = withTiming(Math.ceil(spin.value / 360) * 360, { duration: 520, easing: Easing.out(Easing.cubic) });
    fill.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    close.value = withDelay(
      420, // wait for the ring
      withSequence(withTiming(1.06, { duration: 180, easing: Easing.in(Easing.quad) }), withSpring(1, { damping: 9, stiffness: 260 })),
    );
    // the click as the shackle hits the body, then the next screen once it has settled (JS timers: they only
    // change screens, the motion itself stays on the UI thread)
    const t1 = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 600);
    const t2 = setTimeout(() => cb.current(), 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [shut, spin, fill, close]);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const arc = useAnimatedProps(() => ({ strokeDasharray: [RING * fill.value, RING] }));
  // open (08): the left leg rises to 58 and the right leg ends at 66, above the body; shut: both end in it (82)
  const shackle = useAnimatedProps(() => {
    const k = close.value;
    const lift = 8 * (1 - k);
    return { d: `M68 82 V${66 - lift} a22 22 0 0 1 44 0 V${66 + 16 * k}` };
  });

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Padlock closing while the payment is checked">
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, ring]}>
        <Svg width={size} height={size} viewBox="0 0 180 180">
          <Circle cx={90} cy={90} r={R} fill="none" stroke={PW.line} strokeWidth={8} />
          <AnimatedCircle
            cx={90}
            cy={90}
            r={R}
            fill="none"
            stroke={PW.green}
            strokeWidth={8}
            strokeLinecap="round"
            transform="rotate(-90 90 90)"
            animatedProps={arc}
          />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 180 180" style={{ position: 'absolute' }}>
        <AnimatedPath fill="none" stroke={PW.green} strokeWidth={10} strokeLinecap="round" animatedProps={shackle} />
        <Body fill={PW.green} hole={PW.onGreen} />
      </Svg>
    </View>
  );
}
