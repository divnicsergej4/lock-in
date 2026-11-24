// The ring's clock for its endless animations (the blinking tag, the empty donut turning). It runs only
// while the ring is on screen, its tab is open and the page is not being scrolled, so a ring that is just
// sitting there changes nothing from frame to frame and costs the scroll nothing.

import { createContext, useContext } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export const HoloClock = createContext<SharedValue<number> | null>(null);

/** Milliseconds the ring has been live (stands still while scrolling or off screen). */
export function useHoloClock(): SharedValue<number> {
  const own = useSharedValue(0);
  return useContext(HoloClock) ?? own;
}
