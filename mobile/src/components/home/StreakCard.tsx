// Streak card (prototype section.hot: #streak + #chal): the animated flame of the current tier, days in a
// row, progress to the next tier, "I didn't spend anything today" (from 20:00), and the weekly challenge.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useAppToast } from '@/components/AppToast';
import { InlineIcon } from '@/components/CategoryIcon';
import { Flame, type FlameTier } from '@/components/intro/Flame';
import { categoryColor } from '@/logic/categories';
import { days } from '@/logic/format';
import { weeklyChallenge } from '@/logic/insights';
import { checkIn, streakCard, streakInfo } from '@/logic/streak';
import { useStore } from '@/store/StoreProvider';
import { inter, tierColors, useTheme } from '@/theme';

import { Section, Small } from './Section';

/** Re-render every minute so the 20:00 button and "today" stay current while the app is open. */
function useMinute() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function StreakCard({ levelUp }: { levelUp: number }) {
  const { state, update } = useStore();
  const { c, name } = useTheme();
  const toast = useAppToast();
  const now = useMinute();
  const card = streakCard(state, Date.now());
  const tier = card.tier.key as FlameTier;
  const tc = tierColors[name][tier];

  // the bar grows to the next tier: transition: width .6s cubic-bezier(.2,.8,.2,1)
  const [barW, setBarW] = useState(0);
  const pct = useSharedValue(card.progress);
  useEffect(() => {
    pct.value = withTiming(card.progress, { duration: 600, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  }, [card.progress, pct]);
  const fill = useAnimatedStyle(() => ({ width: (barW * pct.value) / 100 }));

  const noSpend = () => {
    const t = Date.now();
    const next = { ...state, chk: checkIn(state, t) };
    update(() => next);
    const n = streakInfo(next, t).n;
    toast(n > 0 ? 'Logged. 🔥 ' + n + ' ' + days(n) + ' in a row.' : 'Logged.');
  };

  const ch = weeklyChallenge(state, now);
  return (
    <Section kind="hot">
      <View style={st.sk}>
        <Flame tier={tier} levelUp={levelUp} />
        <View style={{ flex: 1 }}>
          <View style={st.skn}>
            <Text style={[st.sn, { color: c.ink }]}>{card.n}</Text>
            <Text style={[st.skl, { color: c.ink }]}>{card.label}</Text>
          </View>
          <Text style={[st.tchip, { color: tc }]}>{card.tierName}</Text>
          <View style={[st.tbar, { backgroundColor: c.line }]} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            <Animated.View style={[st.tfill, { backgroundColor: tc }, fill]} />
          </View>
        </View>
      </View>
      <Small style={{ marginTop: 12 }}>{card.message}</Small>
      {card.showNoSpend && (
        <Pressable accessibilityRole="button" onPress={noSpend} style={({ pressed }) => [st.ckt, { borderColor: c.line }, pressed && { opacity: 0.7 }]}>
          <Text style={[st.cktT, { color: c.ink }]}>I didn’t spend anything today</Text>
        </Pressable>
      )}
      <View style={[st.ch, { backgroundColor: c.challengeBg }]}>
        <Small>{ch.label}</Small>
        {ch.cat ? (
          <>
            <Text style={[st.chB, { color: c.ink }]}>
              {'7 days without: '}
              {/* .ei: 1.15em icon, vertical-align -.22em; kept short so it doesn't make the line taller */}
              <View style={{ width: 18.4, height: 12 }}>
                <View style={{ position: 'absolute', left: 0, bottom: -16 * 0.22 }}>
                  <InlineIcon cat={ch.cat} color={categoryColor(state, ch.cat)} size={18.4} mix={c.iconMix} />
                </View>
              </View>
              {' ' + ch.cat}
            </Text>
            <Small>{ch.text}</Small>
          </>
        ) : (
          <Text style={[st.chEmpty, { color: c.ink }]}>{ch.text}</Text>
        )}
      </View>
    </Section>
  );
}

const st = StyleSheet.create({
  sk: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  skn: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  sn: { fontFamily: inter[800], fontSize: 48, lineHeight: 48, letterSpacing: -1.44 },
  skl: { fontFamily: inter[600], fontSize: 16, lineHeight: 23.2 },
  // an inline-block in a 23.2 px line: its line box is 1.2 px taller than the text
  tchip: { marginTop: 4, marginBottom: 1.2, alignSelf: 'flex-start', fontFamily: inter[700], fontSize: 13.12, lineHeight: 19.024 },
  tbar: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  tfill: { height: 6, borderRadius: 3 },
  ckt: { marginTop: 10, padding: 11, borderWidth: 1, borderRadius: 12 },
  cktT: { fontFamily: inter[600], fontSize: 16, lineHeight: 23.2, textAlign: 'center' },
  ch: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, gap: 2 },
  chB: { fontFamily: inter[700], fontSize: 16, lineHeight: 23.2 },
  chEmpty: { fontFamily: inter[400], fontSize: 16, lineHeight: 23.2 },
});
