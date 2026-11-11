// 06, the plans screen (docs/dizajn/placanje/06-placanje): padlock, "7 DAYS FREE", what you get, how the free
// week works, the three plans, the button and the line under it (both always about the picked plan), the demo,
// Restore purchase / Terms / Privacy and the renewal terms. Prices and the trial come from the store.
// The button and its line stay at the bottom of the screen while the page scrolls (like CSS position: sticky),
// moved on the UI thread from the scroll position.

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { PlansResult } from '@/auth/purchases';
import { bestValue, ctaNote, ctaText, finePrint, header, offeredTrial, planCard, timeline, type PlanOption } from '@/logic/paywall';
import { brico, inter } from '@/theme';

import { LockHero } from './Padlock';
import { BigButton, LineIcon, Links, TextButton } from './parts';
import { PW } from './theme';

const FEATURES: { text: string; icon: string; gold?: boolean; round?: boolean }[] = [
  { text: 'Roasts every time you spend like cash grows on trees', icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h6"/>' },
  { text: 'A streak that keeps you honest every day', icon: '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z"/>' },
  {
    text: 'Shared goals you fill up with your friends',
    icon: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
    gold: true,
  },
  { text: 'Charts, calendar and what you keep doing wrong', icon: '<path d="M5 20V11M12 20V5M19 20v-6"/>' },
  { text: 'No bank login. Your spending stays on your phone', icon: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>' },
];

export function PlansView({
  plans,
  picked,
  onPick,
  onBuy,
  busy,
  onDemo,
  onRestore,
  onTerms,
  onPrivacy,
  onRetry,
  onClose,
}: {
  plans: PlansResult | null; // null: still loading
  picked: PlanOption | null;
  onPick: (p: PlanOption) => void;
  onBuy: () => void;
  busy: boolean;
  onDemo: (() => void) | null; // null in the demo
  onRestore: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
  onRetry: () => void;
  onClose: (() => void) | null; // null while locked: there is nowhere to go back to
}) {
  const insets = useSafeAreaInsets();
  const list = plans?.ok ? plans.plans : [];
  const trial = offeredTrial(list);
  const head = header(trial);
  const now = Date.now();

  // sticky button: its place in the page (y), the screen's height and its own height
  const scrollY = useSharedValue(0);
  const ctaY = useSharedValue(1e6); // the placeholder is the first thing in that block, so its y in the page
  const flowY = ctaY;
  const viewH = useSharedValue(0);
  const blockH = useSharedValue(0);
  const [blockHeight, setBlockHeight] = useState(98);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const bottomGap = insets.bottom + 12;
  const sticky = useAnimatedStyle(() => {
    const top = viewH.value - bottomGap - blockH.value; // where it rests while its place is further down
    return { transform: [{ translateY: Math.min(top, flowY.value - scrollY.value) }] };
  });
  const fade = useAnimatedStyle(() => {
    const top = viewH.value - bottomGap - blockH.value;
    return { opacity: Math.max(0, Math.min(1, (flowY.value - scrollY.value - top) / 24)) };
  });

  const ready = !!(plans?.ok && picked);

  return (
    <View style={{ flex: 1, backgroundColor: PW.bg }} onLayout={(e) => (viewH.value = e.nativeEvent.layout.height)}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 28, paddingHorizontal: 18, paddingBottom: insets.bottom + 28, gap: 22 }}
      >
        {/* ✕ (only when there is somewhere to go back to): scrolls away with the page, like the prototype's .pwx */}
        {onClose && (
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} style={[s.x, { top: insets.top + 14 }]}>
            <Text style={s.xT}>✕</Text>
          </Pressable>
        )}
        <View style={s.head}>
          <LockHero />
          {plans?.ok && plans.test && <Text style={s.test}>TEST PRICES · NO STORE YET</Text>}
          {plans && (
            <Animated.View entering={FadeIn.duration(250)} style={s.head}>
              {head.badge && <Text style={s.badge}>{head.badge}</Text>}
              <Text style={s.h1}>{head.title}</Text>
              <Text style={s.lead}>{head.sub}</Text>
            </Animated.View>
          )}
        </View>

        {!plans && <ActivityIndicator color={PW.green} style={{ marginTop: 24 }} />}

        {plans && (
          <View style={s.features}>
            {FEATURES.map((f) => (
              <View key={f.text} style={s.feat}>
                <View style={[s.featIc, f.gold && { backgroundColor: 'rgba(245,200,75,0.12)' }]}>
                  <LineIcon xml={f.icon} size={19} color={f.gold ? PW.gold : PW.green} width={1.9} />
                </View>
                <Text style={s.featT}>{f.text}</Text>
              </View>
            ))}
          </View>
        )}

        {plans?.ok && trial != null && <Timeline now={now} days={trial} />}

        {plans && (
          <View style={{ gap: 10 }}>
            <Text style={s.legend} accessibilityRole="header">
              Pick your plan
            </Text>
            {plans.ok ? (
              <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
                {list.map((p) => (
                  <PlanCard key={p.id} p={p} plans={list} on={picked?.id === p.id} onPress={() => onPick(p)} />
                ))}
              </View>
            ) : (
              <View style={s.err}>
                <Text style={s.errT}>{plans.error}</Text>
                <TextButton title="Try again" onPress={onRetry} underline />
              </View>
            )}
          </View>
        )}

        {plans && (
          <View style={{ gap: 10, marginTop: 2 }} onLayout={(e: LayoutChangeEvent) => (ctaY.value = e.nativeEvent.layout.y)}>
            {/* the button's place in the page; the button itself is drawn over it (sticky) */}
            {ready && <View style={{ height: blockHeight }} />}
            {onDemo && <TextButton title="Look around the demo first" onPress={onDemo} underline />}
          </View>
        )}

        {plans && (
          <>
            <Links
              items={[
                { title: 'Restore purchase', onPress: onRestore },
                { title: 'Terms', onPress: onTerms },
                { title: 'Privacy', onPress: onPrivacy },
              ]}
            />
            <Text style={s.fine}>{finePrint(trial)}</Text>
          </>
        )}
      </Animated.ScrollView>

      {ready && picked && (
        <Animated.View pointerEvents="box-none" style={[s.sticky, sticky]}>
          <Animated.View pointerEvents="none" style={[s.fadeTop, fade]}>
            <Svg width="100%" height={28}>
              <Defs>
                <LinearGradient id="pwfade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={PW.bg} stopOpacity={0} />
                  <Stop offset="1" stopColor={PW.bg} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height={28} fill="url(#pwfade)" />
            </Svg>
          </Animated.View>
          <View
            style={s.block}
            onLayout={(e) => {
              blockH.value = e.nativeEvent.layout.height;
              setBlockHeight(e.nativeEvent.layout.height);
            }}
          >
            <BigButton title={ctaText(picked)} onPress={onBuy} busy={busy} />
            <Text style={s.note}>{ctaNote(picked)}</Text>
          </View>
          {/* while it rests at the bottom, the page scrolls under it, not below it */}
          <Animated.View pointerEvents="none" style={[s.under, { height: bottomGap + 40 }, fade]} />
        </Animated.View>
      )}

    </View>
  );
}

function Timeline({ now, days }: { now: number; days: number }) {
  const t = timeline(now, days);
  return (
    <View style={s.tl}>
      <Text style={s.tlTitle}>{t.title.toUpperCase()}</Text>
      {t.rows.map((r, i) => {
        const last = i === t.rows.length - 1;
        return (
          <View key={r.label} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={[s.dot, i === 0 ? { backgroundColor: PW.green } : { borderWidth: 2, borderColor: i === 1 ? PW.green : PW.dotOff }]} />
              {!last && <View style={s.stem} />}
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: last ? 0 : 14 }}>
              <Text style={s.tlB}>{r.label}</Text>
              <Text style={s.tlT}>{r.text}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PlanCard({ p, plans, on, onPress }: { p: PlanOption; plans: PlanOption[]; on: boolean; onPress: () => void }) {
  const c = planCard(p, plans);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${c.name}, ${c.price}${c.unit}. ${c.sub}`}
      onPress={onPress}
      style={[s.plan, on ? s.planOn : s.planOff]}
    >
      <View style={[s.radio, on ? s.radioOn : s.radioOff]}>{on && <View style={s.radioDot} />}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.planN}>{c.name}</Text>
        <Text style={s.planS}>{c.sub}</Text>
      </View>
      <Text style={s.price}>
        {c.price}
        <Text style={s.unit}>{c.unit}</Text>
      </Text>
      {p.kind === 'yearly' && <Text style={s.best}>{bestValue(plans)}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', gap: 14 },
  test: { fontFamily: inter[800], fontSize: 10.5, letterSpacing: 1.5, color: '#1a1000', backgroundColor: PW.gold, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  badge: { fontFamily: inter[800], fontSize: 12, lineHeight: 15, letterSpacing: 1.2, color: PW.onGreen, backgroundColor: PW.lime, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, overflow: 'hidden' },
  h1: { fontFamily: brico[800], fontSize: 36, lineHeight: 36.72, letterSpacing: -0.54, color: PW.ink, textAlign: 'center' },
  lead: { fontFamily: inter[400], fontSize: 15, lineHeight: 21.75, color: PW.sub, textAlign: 'center', maxWidth: 300 },
  features: { gap: 12, paddingHorizontal: 4 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featIc: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(34,224,122,0.10)', alignItems: 'center', justifyContent: 'center' },
  featT: { flex: 1, fontFamily: inter[400], fontSize: 15, lineHeight: 20.25, color: PW.ink },
  tl: { borderRadius: 20, borderWidth: 1, borderColor: PW.line, backgroundColor: PW.card, padding: 16 },
  tlTitle: { fontFamily: inter[700], fontSize: 12, lineHeight: 15, letterSpacing: 0.96, color: PW.mute, marginBottom: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  stem: { width: 2, flex: 1, backgroundColor: PW.line, marginVertical: 4 },
  tlB: { fontFamily: inter[700], fontSize: 15, lineHeight: 20, color: PW.ink },
  tlT: { fontFamily: inter[400], fontSize: 13, lineHeight: 18, color: PW.sub },
  legend: { fontFamily: brico[700], fontSize: 20, lineHeight: 24, color: PW.ink, marginBottom: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 14, borderRadius: 18 },
  planOn: { borderWidth: 2, borderColor: PW.green, backgroundColor: 'rgba(34,224,122,0.07)' },
  planOff: { borderWidth: 1, borderColor: PW.line, backgroundColor: PW.card, margin: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioOff: { backgroundColor: '#ffffff' },
  radioOn: { borderWidth: 2, borderColor: PW.green, backgroundColor: PW.onGreen },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PW.green },
  planN: { fontFamily: inter[700], fontSize: 16, lineHeight: 20, color: PW.ink },
  planS: { fontFamily: inter[400], fontSize: 13, lineHeight: 17, color: PW.sub },
  price: { fontFamily: brico[800], fontSize: 20, lineHeight: 24, color: PW.ink },
  unit: { fontFamily: inter[500], fontSize: 13, color: PW.sub },
  best: {
    position: 'absolute',
    top: -11,
    right: 14,
    fontFamily: inter[800],
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.66,
    color: PW.onGreen,
    backgroundColor: PW.green,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  err: { borderRadius: 18, borderWidth: 1, borderColor: PW.line, backgroundColor: PW.card, padding: 16, alignItems: 'center', gap: 4 },
  errT: { fontFamily: inter[400], fontSize: 14, lineHeight: 20, color: PW.sub, textAlign: 'center' },
  sticky: { position: 'absolute', left: 18, right: 18, top: 0 },
  fadeTop: { position: 'absolute', left: -18, right: -18, top: -28, height: 28 },
  block: { gap: 10, backgroundColor: PW.bg, paddingBottom: 2 },
  under: { position: 'absolute', left: -18, right: -18, top: '100%', backgroundColor: PW.bg },
  note: { fontFamily: inter[400], fontSize: 13, lineHeight: 18, color: PW.sub, textAlign: 'center' },
  fine: { fontFamily: inter[400], fontSize: 11, lineHeight: 16.5, color: PW.mute, textAlign: 'center' },
  x: { position: 'absolute', zIndex: 2, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  xT: { color: '#fff', fontSize: 16 },
});
