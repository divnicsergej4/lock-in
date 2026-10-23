// The Savings page's scroll view, so the drawer can bring a folder into view like the prototype's
// scrollIntoView / scrollBy (smooth, on the UI thread).

import { createContext, useContext } from 'react';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';

export interface PageScroll {
  ref: AnimatedRef<Animated.ScrollView>;
  offset: SharedValue<number>;
  /** visible part of the page ends this far from the bottom of the screen (the tab bar) */
  bottomInset: number;
}

export const PageScrollContext = createContext<PageScroll | null>(null);
export const usePageScroll = () => useContext(PageScrollContext);
