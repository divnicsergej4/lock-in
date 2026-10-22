// When the user switches tabs, the new tab's sections slide in one after another (prototype tab():
// animIn(sections, n > previous ? 'anim-l' : 'anim-r', 60): from 34 px to the side and transparent,
// .45s cubic-bezier(.2,.8,.2,1)). Not on the very first tab shown.

import { useIsFocused } from 'expo-router';
import { Children, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

let lastTab: number | null = null;

const Ctx = createContext<{ play: number; dir: number }>({ play: 0, dir: 1 });

/** Wrap a tab's content; `index` is the tab's position (Home 0, Spending 1, ...). */
export function TabEntrance({ index, children }: { index: number; children: ReactNode }) {
  const focused = useIsFocused();
  const [run, setRun] = useState({ play: 0, dir: 1 });
  useEffect(() => {
    if (!focused) return;
    if (lastTab !== null && lastTab !== index) setRun((r) => ({ play: r.play + 1, dir: index > lastTab! ? 1 : -1 }));
    lastTab = index;
  }, [focused, index]);
  return <Ctx.Provider value={run}>{children}</Ctx.Provider>;
}

/** One section of a tab: it slides in when the tab is switched to (i = its position, 60 ms apart). */
export function SlideIn({ i, children }: { i: number; children: ReactNode }) {
  const { play, dir } = useContext(Ctx);
  const k = useSharedValue(1);
  const d = useSharedValue(dir);
  useEffect(() => {
    if (!play) return;
    d.value = dir;
    k.value = 0;
    k.value = withDelay(i * 60, withTiming(1, { duration: 450, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [play, dir, i, k, d]);
  const anim = useAnimatedStyle(() => ({ opacity: k.value, transform: [{ translateX: 34 * d.value * (1 - k.value) }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

/** Wraps each child in SlideIn, in order. */
export function Sections({ children }: { children: ReactNode }) {
  return (
    <>
      {Children.toArray(children).map((ch, i) => (
        <SlideIn key={i} i={i}>
          {ch}
        </SlideIn>
      ))}
    </>
  );
}
