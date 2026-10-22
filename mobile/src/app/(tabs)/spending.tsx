// Spending (prototype tab 1): the holographic ring with three charts, all transactions, category
// limits, recurring entries, subscriptions and "We noticed".

import { useState } from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hero } from '@/components/home/Hero';
import { Sections, TabEntrance } from '@/components/TabEntrance';
import { CalendarPanel } from '@/components/spending/CalendarPanel';
import { DonutPanel } from '@/components/spending/DonutPanel';
import { HoloRing } from '@/components/spending/HoloRing';
import { LinePanel } from '@/components/spending/LinePanel';
import { LimitsFold, PatternsFold, RecurringFold, SubscriptionsFold } from '@/components/spending/SpendingFolds';
import { Transactions } from '@/components/spending/Transactions';
import { useTheme } from '@/theme';

export default function Spending() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const turnMonth = (d: number) =>
    setMonth((x) => {
      const t = new Date(x.y, x.m + d, 1);
      return { y: t.getFullYear(), m: t.getMonth() };
    });
  const weeks = Math.ceil((((new Date(month.y, month.m, 1).getDay() + 6) % 7) + new Date(month.y, month.m + 1, 0).getDate()) / 7);

  // bottom padding: the tab bar sits over the content (prototype main padding-bottom 130px)
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 130 + insets.bottom }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <TabEntrance index={1}>
        <Hero />
        <Sections>
          {/* the ring runs edge to edge (section.holo: margin 0 -16px) */}
          <View style={{ marginHorizontal: -16, marginBottom: 14 }}>
            <HoloRing
              rows={weeks}
              panels={[
                (p) => <DonutPanel {...p} />,
                (p) => <LinePanel {...p} />,
                (p) => <CalendarPanel {...p} month={month} onMonth={turnMonth} />,
              ]}
            />
          </View>
          <Transactions />
          <LimitsFold />
          <RecurringFold />
          <SubscriptionsFold />
          <PatternsFold />
        </Sections>
      </TabEntrance>
    </ScrollView>
  );
}
