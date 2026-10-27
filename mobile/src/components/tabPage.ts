// Each tab's scroll view, known to the guided tour (it scrolls a part into view and keeps its highlight
// on it while the page scrolls). One per tab, registered when the tab mounts.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import type { View } from 'react-native';
import type Animated from 'react-native-reanimated';
import { useAnimatedReaction, useAnimatedRef, useScrollViewOffset, useSharedValue, type AnimatedRef, type SharedValue } from 'react-native-reanimated';

import { usePageTop } from '@/components/DemoBar';
import { activeTab, pageY } from '@/tour/registry';

export interface TabScroll {
  ref: AnimatedRef<Animated.ScrollView>;
  offset: SharedValue<number>;
  /** An empty view at the top of the page's content: measured together with a part, it gives the exact
   *  scroll offset of that same moment (the offset value can be an event behind) */
  anchor: AnimatedRef<View>;
  top: number; // the content's top padding (the anchor sits there)
  contentH: SharedValue<number>; // the content's height (the tour scrolls the page up to its end)
}

export const tabScrolls: Record<number, TabScroll | undefined> = {};

/** The tab page's scroll ref and offset (for an Animated.ScrollView), its top padding and the
 *  onContentSizeChange the scroll view needs. */
export function useTabPage(tab: number) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  const anchor = useAnimatedRef<View>();
  const offset = useScrollViewOffset(ref);
  const top = usePageTop();
  const contentH = useSharedValue(0);
  const onContentSizeChange = useCallback((_w: number, h: number) => void (contentH.value = h), [contentH]);
  useEffect(() => {
    tabScrolls[tab] = { ref, offset, anchor, top, contentH };
    return () => {
      if (tabScrolls[tab]?.ref === ref) tabScrolls[tab] = undefined;
    };
  }, [tab, ref, offset, anchor, top, contentH]);
  // the page in front shares its scroll offset with the tour's light (on the UI thread, every frame); a focus
  // effect, not useIsFocused, so the whole page is not drawn again each time its tab is entered or left
  useFocusEffect(
    useCallback(() => {
      activeTab.value = tab;
      pageY.value = offset.value;
    }, [tab, offset]),
  );
  useAnimatedReaction(
    () => offset.value,
    (v) => {
      if (activeTab.value === tab) pageY.value = v;
    },
  );
  return { ref, offset, anchor, top, onContentSizeChange };
}
