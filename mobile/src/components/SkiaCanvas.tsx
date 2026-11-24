// The app's only Skia <Canvas>: every drawing imports Canvas from here, never from '@shopify/react-native-skia'
// (a test checks). It is made anew each time its screen comes back to the front (useSkiaRemount): Skia 2.14 left a
// canvas blank after its screen had been hidden (the flame on Home, the holo charts, the goal padlock on Savings in
// the first TestFlight build).

import { Canvas as SkCanvas } from '@shopify/react-native-skia';
import type { ComponentProps } from 'react';

import { useSkiaRemount } from './useSkiaRemount';

export function Canvas(props: ComponentProps<typeof SkCanvas>) {
  const gen = useSkiaRemount();
  return <SkCanvas key={gen} {...props} />;
}
