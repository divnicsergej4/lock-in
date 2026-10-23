// Savings (prototype tab 2): the shared goal, envelopes in a drawer and the monthly plan.

import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef, useScrollViewOffset } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hero } from '@/components/home/Hero';
import { EnvelopesFold } from '@/components/savings/EnvelopesFold';
import { PlanFold } from '@/components/savings/PlanFold';
import { PageScrollContext } from '@/components/savings/scroll';
import { SharedGoal } from '@/components/savings/SharedGoal';
import { Sections, TabEntrance } from '@/components/TabEntrance';
import { useTheme } from '@/theme';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function Savings() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollViewOffset(ref);
  // the tab bar (about 68 px plus the home indicator) covers the bottom of the page
  const scroll = useMemo(() => ({ ref, offset, bottomInset: 68 + insets.bottom }), [ref, offset, insets.bottom]);

  // each time the tab opens, the drawer's folders rise in again (prototype tab(): drwAnim)
  const focused = useIsFocused();
  const [play, setPlay] = useState(0);
  useEffect(() => {
    if (focused) setPlay((p) => p + 1);
  }, [focused]);

  return (
    <PageScrollContext.Provider value={scroll}>
      <AnimatedScrollView
        ref={ref}
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 130 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <TabEntrance index={2}>
          <Hero />
          <Sections>
            <SharedGoal />
            <EnvelopesFold play={play} />
            <PlanFold />
          </Sections>
        </TabEntrance>
      </AnimatedScrollView>
    </PageScrollContext.Provider>
  );
}
