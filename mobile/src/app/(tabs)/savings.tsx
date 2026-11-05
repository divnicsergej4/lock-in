// Savings (prototype tab 2): the shared goal, envelopes in a drawer and the monthly plan.

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hero } from '@/components/home/Hero';
import { KeyboardSpace } from '@/components/keyboard';
import { EnvelopesFold } from '@/components/savings/EnvelopesFold';
import { PlanFold } from '@/components/savings/PlanFold';
import { PageScrollContext } from '@/components/savings/scroll';
import { SharedGoal } from '@/components/savings/SharedGoal';
import { Sections, TabEntrance } from '@/components/TabEntrance';
import { useTabPage } from '@/components/tabPage';
import { useTheme } from '@/theme';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function Savings() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { ref, offset, anchor, top, onContentSizeChange } = useTabPage(2);
  // the tab bar (about 68 px plus the home indicator) covers the bottom of the page
  const scroll = useMemo(() => ({ ref, offset, bottomInset: 68 + insets.bottom }), [ref, offset, insets.bottom]);

  // each time the tab opens, the drawer's folders rise in again (prototype tab(): drwAnim); a focus effect, so
  // leaving the tab does not draw the whole page again
  const [play, setPlay] = useState(0);
  useFocusEffect(useCallback(() => setPlay((p) => p + 1), []));

  return (
    <PageScrollContext.Provider value={scroll}>
      <AnimatedScrollView
        ref={ref}
        onContentSizeChange={onContentSizeChange}
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: 16, paddingBottom: 130 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* the top of the content, for the guided tour's measurements */}
        <View ref={anchor} collapsable={false} />
        <TabEntrance index={2}>
          <Hero />
          <Sections>
            <SharedGoal />
            <EnvelopesFold play={play} />
            <PlanFold />
          </Sections>
        </TabEntrance>
        <KeyboardSpace />
      </AnimatedScrollView>
    </PageScrollContext.Provider>
  );
}
