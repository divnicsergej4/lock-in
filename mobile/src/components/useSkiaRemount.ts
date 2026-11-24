// A key for a Skia <Canvas> that changes each time its screen comes back to the front.
// A tab that is not in front is hidden (display: none, TabFreeze); Fabric then recreates the Canvas's native view,
// and Skia 2.14 leaves that new view blank until something makes it re-render (react-native-skia issue 4442).
// Seen in the first TestFlight build: the flame and the holo charts were empty after another tab.
// A new key makes a new Canvas that draws at once; the animations live in shared values outside it, so nothing replays.

import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

export function useSkiaRemount(): number {
  const focused = useIsFocused();
  const [gen, setGen] = useState(0);
  const was = useRef(focused);
  useEffect(() => {
    if (focused && !was.current) setGen((g) => g + 1);
    was.current = focused;
  }, [focused]);
  return gen;
}
