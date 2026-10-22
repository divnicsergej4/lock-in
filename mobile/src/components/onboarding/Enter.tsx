// Entrance animations of the prototype's intro screens (.anim-in, .anim-up, .anim-pop).
// Like the CSS keyframes they copy, each goes from its start value to the element's normal look.

import { useEffect, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export type EnterKind = 'pop' | 'up' | 'apop';

const SPEC = {
  // @keyframes pop{from{opacity:0;transform:translateY(16px) scale(.97)}}  .5s cubic-bezier(.2,.8,.2,1)
  pop: { dur: 500, ease: Easing.bezier(0.2, 0.8, 0.2, 1) },
  // @keyframes pup{from{transform:translateY(100%)}}  .65s cubic-bezier(.2,.8,.2,1)
  up: { dur: 650, ease: Easing.bezier(0.2, 0.8, 0.2, 1) },
  // @keyframes apop{from{opacity:0;transform:scale(.3) rotate(-20deg)}}  .55s cubic-bezier(.3,1.6,.5,1)
  apop: { dur: 550, ease: Easing.bezier(0.3, 1.6, 0.5, 1) },
};

export function Enter({ kind = 'pop', delay = 0, style, children }: { kind?: EnterKind; delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const p = useSharedValue(0);
  const [h, setH] = useState(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: SPEC[kind].dur, easing: SPEC[kind].ease }));
  }, [delay, kind, p]);
  const anim = useAnimatedStyle(() => {
    const v = p.value;
    if (kind === 'up') return { transform: [{ translateY: h * (1 - v) }] };
    const op = Math.min(1, Math.max(0, v));
    if (kind === 'apop') return { opacity: op, transform: [{ scale: 0.3 + 0.7 * v }, { rotate: -20 * (1 - v) + 'deg' }] };
    return { opacity: op, transform: [{ translateY: 16 * (1 - v) }, { scale: 0.97 + 0.03 * v }] };
  });
  return (
    <Animated.View style={[style, anim]} onLayout={kind === 'up' ? (e) => setH(e.nativeEvent.layout.height) : undefined}>
      {children}
    </Animated.View>
  );
}
