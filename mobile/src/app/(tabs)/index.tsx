// Home (prototype tab 0): Lock In header, Available, the streak with the weekly challenge, New entry,
// and "Can I afford this?".

import { useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppToast } from '@/components/AppToast';
import { AffordFold } from '@/components/home/AffordFold';
import { BalanceCard } from '@/components/home/BalanceCard';
import { NewEntry } from '@/components/home/NewEntry';
import { StreakCard } from '@/components/home/StreakCard';
import { processRecurring } from '@/logic/recurring';
import { tierUp } from '@/logic/streak';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

export default function Home() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [levelUp, setLevelUp] = useState(0);

  // recurring entries whose day has come are logged when the app opens and when it comes back
  useEffect(() => {
    const run = () => update((s) => processRecurring(s, Date.now()));
    run();
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && run());
    return () => sub.remove();
  }, [update]);

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
      <View style={st.hero}>
        <Text style={[st.h1, { color: c.hero }]}>Lock In 🗿</Text>
        <Text style={[st.sub, { color: c.mute }]}>The money tracker that calls you out when you spend like cash grows on trees.</Text>
      </View>
      <BalanceCard />
      <StreakCard levelUp={levelUp} />
      <NewEntry />
      <AffordFold />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 20, paddingHorizontal: 4, paddingBottom: 12, marginBottom: 6 },
  h1: { fontFamily: inter[800], fontSize: 32, lineHeight: 46.4, letterSpacing: -0.96 },
  sub: { marginTop: 4, fontFamily: inter[400], fontSize: 14.72, lineHeight: 21.344 },
});
