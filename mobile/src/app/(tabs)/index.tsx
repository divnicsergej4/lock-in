// Home (prototype tab 0): Lock In header, Available, the streak with the weekly challenge, New entry,
// and "Can I afford this?".

import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppToast } from '@/components/AppToast';
import { Sections, TabEntrance } from '@/components/TabEntrance';
import { AffordFold } from '@/components/home/AffordFold';
import { BalanceCard } from '@/components/home/BalanceCard';
import { Hero } from '@/components/home/Hero';
import { NewEntry } from '@/components/home/NewEntry';
import { StreakCard } from '@/components/home/StreakCard';
import { tierUp } from '@/logic/streak';
import { useStore } from '@/store/StoreProvider';
import { useTheme } from '@/theme';

export default function Home() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [levelUp, setLevelUp] = useState(0);

  // a new flame tier: remember it, and 0.7 s later celebrate it (toast + the flame bounces)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const up = tierUp(state, Date.now());
    if (up.tierSeen === state.tierSeen) return;
    update((s) => ({ ...s, tierSeen: up.tierSeen }));
    if (up.toast) {
      const msg = up.toast;
      timer.current = setTimeout(() => {
        toast(msg);
        setLevelUp((n) => n + 1);
      }, 700);
    }
  }, [state, update, toast]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // bottom padding: the tab bar sits over the content (prototype main padding-bottom 130px)
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 130 + insets.bottom }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <TabEntrance index={0}>
        <Hero />
        <Sections>
          <BalanceCard />
          <StreakCard levelUp={levelUp} />
          <NewEntry />
          <AffordFold />
        </Sections>
      </TabEntrance>
    </ScrollView>
  );
}
