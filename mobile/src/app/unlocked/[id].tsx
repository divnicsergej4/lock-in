// "Unlocked." (Andrija's design): the lock opens in its full ring, the goal, how long it took, who put in what,
// and either a new target or leaving it as it is. Shown once per goal on this phone, when it reaches 100%.

import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chevron, GoldButton, OutlineButton } from '@/components/goals/bits';
import { GoalForm } from '@/components/goals/GoalForm';
import { F, useLook } from '@/components/goals/look';
import { LockRing, segments } from '@/components/goals/LockRing';
import { useGoals } from '@/goals/GoalsProvider';
import { duration, goalView, money, people } from '@/logic/goals';

export default function Unlocked() {
  const g = useLook();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { snap } = useGoals();
  const [edit, setEdit] = useState(false);
  const now = Date.now();
  const v = snap ? goalView(snap, id, now) : null;

  useEffect(() => {
    const t = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, []);

  if (!v) return <View style={{ flex: 1, backgroundColor: g.bg }} />;
  const size = Math.min(320, width - 60);
  const total = Math.max(v.saved, 1);
  const toSavings = () => (router.canDismiss() ? router.dismissAll() : router.replace('/savings'));

  return (
    <View style={{ flex: 1, backgroundColor: g.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
        <Pressable accessibilityRole="button" onPress={toSavings} style={st.back} hitSlop={10}>
          <Chevron color={g.mute} dir="left" size={16} />
          <Text style={[st.backT, { color: g.mute }]}>Savings</Text>
        </Pressable>
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <LockRing size={size} segs={segments(v.members, v.goal.target)} passed={v.passed} next={null} unlocked animateOpen confetti />
          <Text style={[st.big, { color: g.goldInk }]}>Unlocked.</Text>
          <Text style={[st.name, { color: g.ink }]}>{v.goal.name}</Text>
          <Text style={[st.meta, { color: g.goldSoft }]}>
            {money(v.goal.target, v.goal.currency)} · {people(v.members.length)} · {duration(Date.parse(v.goal.created_at), v.unlockedAt ?? now)}
          </Text>
          <Text style={[st.book, { color: g.ink }]}>Now book it before anyone spends it.</Text>
        </View>
        <View style={[st.split, { backgroundImage: g.goldBg, borderColor: g.goldLine }]}>
          <View style={st.bar}>
            {v.members.filter((m) => m.total > 0).map((m) => (
              <View key={m.id} style={{ flex: m.total / total, height: 10, borderRadius: 5, backgroundColor: m.color }} />
            ))}
          </View>
          <View style={st.legend}>
            {v.members.map((m) => (
              <View key={m.id} style={st.who}>
                <View style={st.whoTop}>
                  <View style={[st.dot, { backgroundColor: m.color }]} />
                  <Text style={[st.whoN, { color: g.mute }]} numberOfLines={1}>{m.isMe ? 'You' : m.name}</Text>
                </View>
                <Text style={[st.whoA, { color: g.ink }]}>{money(m.total, v.goal.currency)}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flex: 1, minHeight: 30 }} />
        <GoldButton title="Set a new target" onPress={() => setEdit(true)} style={{ minHeight: 52 }} />
        <OutlineButton title="Keep it as it is" onPress={() => router.back()} plain style={{ marginTop: 12, minHeight: 48 }} />
      </ScrollView>
      {edit && <GoalForm goal={v.goal} currency={v.goal.currency} onClose={() => { setEdit(false); router.back(); }} />}
    </View>
  );
}

const st = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8 },
  backT: { fontFamily: F.medium, fontSize: 15 },
  big: { fontFamily: F.display, fontSize: 48, lineHeight: 56, letterSpacing: -1.5, marginTop: 16 },
  name: { fontFamily: F.display, fontSize: 21, lineHeight: 26, textAlign: 'center', marginTop: 4 },
  meta: { fontFamily: F.medium, fontSize: 14, marginTop: 6 },
  book: { fontFamily: F.text, fontSize: 14.5, marginTop: 8, textAlign: 'center' },
  split: { borderWidth: 1, borderRadius: 20, padding: 15, marginTop: 20 },
  bar: { flexDirection: 'row', gap: 4 },
  legend: { flexDirection: 'row', marginTop: 14 },
  who: { flex: 1 },
  whoTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  whoN: { fontFamily: F.text, fontSize: 13, flexShrink: 1 },
  whoA: { fontFamily: F.heavy, fontSize: 16, marginTop: 4 },
});
