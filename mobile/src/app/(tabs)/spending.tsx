// Spending (prototype tab 1): the holographic ring with three charts, all transactions, category
// limits, recurring entries, subscriptions and "We noticed".

import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hero } from '@/components/home/Hero';
import { Sections, TabEntrance } from '@/components/TabEntrance';
import { useTabPage } from '@/components/tabPage';
import { CalendarPanel } from '@/components/spending/CalendarPanel';
import { DonutPanel } from '@/components/spending/DonutPanel';
import { HoloRing, type PanelProps } from '@/components/spending/HoloRing';
import { LinePanel } from '@/components/spending/LinePanel';
import { LimitsFold, PatternsFold, RecurringFold, SubscriptionsFold } from '@/components/spending/SpendingFolds';
import { Transactions } from '@/components/spending/Transactions';
import { useTheme } from '@/theme';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function Spending() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { ref, anchor, top, onContentSizeChange } = useTabPage(1);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const turnMonth = useCallback(
    (d: number) =>
      setMonth((x) => {
        const t = new Date(x.y, x.m + d, 1);
        return { y: t.getFullYear(), m: t.getMonth() };
      }),
    [],
  );
  const weeks = Math.ceil((((new Date(month.y, month.m, 1).getDay() + 6) % 7) + new Date(month.y, month.m + 1, 0).getDate()) / 7);
  const panels = useMemo(
    () => [
      (p: PanelProps) => <DonutPanel {...p} />,
      (p: PanelProps) => <LinePanel {...p} />,
      (p: PanelProps) => <CalendarPanel {...p} month={month} onMonth={turnMonth} />,
    ],
    [month, turnMonth],
  );

  // whether the page is moving, known on the UI thread only (no JavaScript runs while scrolling):
  // the ring rests its endless animations meanwhile
  const scrolling = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      scrolling.value = true;
    },
    onEndDrag: () => {
      scrolling.value = false;
    },
    onMomentumBegin: () => {
      scrolling.value = true;
    },
    onMomentumEnd: () => {
      scrolling.value = false;
    },
  });

  // bottom padding: the tab bar sits over the content (prototype main padding-bottom 130px)
  return (
    <AnimatedScrollView
      ref={ref}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScroll}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: top, paddingHorizontal: 16, paddingBottom: 130 + insets.bottom }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {/* the top of the content, for the guided tour's measurements */}
      <View ref={anchor} collapsable={false} />
      <TabEntrance index={1}>
        <Hero />
        <Sections>
          {/* the ring runs edge to edge (section.holo: margin 0 -16px) */}
          <View style={{ marginHorizontal: -16, marginBottom: 14 }}>
            <HoloRing rows={weeks} panels={panels} scrolling={scrolling} />
          </View>
          <Transactions />
          <LimitsFold />
          <RecurringFold />
          <SubscriptionsFold />
          <PatternsFold />
        </Sections>
      </TabEntrance>
    </AnimatedScrollView>
  );
}
