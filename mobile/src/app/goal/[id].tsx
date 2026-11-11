// One shared goal (Andrija's design): the big gold lock in its ring, the amount and pins, "Put money in", pace and
// squad streak, who put in what (with Nudge), the activity, and Edit / Leave. Everyone in it is equal. When the
// group passes a pin the pin pops with a haptic; at 100% the lock opens and "Unlocked." follows.

import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAppToast } from '@/components/AppToast';
import { Avatar, Avatars, Card, Chevron, Flame, GoldButton } from '@/components/goals/bits';
import { GoalForm } from '@/components/goals/GoalForm';
import { F, useLook } from '@/components/goals/look';
import { LockRing, segments } from '@/components/goals/LockRing';
import { EntrySheet, PutMoneyIn } from '@/components/goals/PutMoneyIn';
import { Sheet } from '@/components/goals/Sheet';
import { addToGoal, ENDED, leaveGoal, nudge } from '@/goals/api';
import { useGoals } from '@/goals/GoalsProvider';
import {
  GOLD, goalView, initial, leaveText, MEMBER_COLORS, money, nameOf, paceCard, peopleLine, pinChips, streakCard, timeAgo,
  type GoalView,
} from '@/logic/goals';
import { useStore } from '@/store/StoreProvider';

/** Pops the pins the group just passed (not the ones already passed when the screen opened), with a haptic. */
function usePinPulse(v: GoalView | null) {
  const [pulse, setPulse] = useState<Record<number, number>>({});
  const seen = useRef<{ id: string; passed: number[] } | null>(null);
  useEffect(() => {
    if (!v) return;
    const before = seen.current?.id === v.goal.id ? seen.current.passed : null;
    seen.current = { id: v.goal.id, passed: v.passed };
    if (!before) return;
    const fresh = v.passed.filter((p) => !before.includes(p));
    if (!fresh.length) return;
    setPulse((p) => {
      const n = { ...p };
      for (const x of fresh) n[x] = (n[x] ?? 0) + 1;
      return n;
    });
    if (fresh.includes(100)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [v]);
  return pulse;
}

function AddFriendIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Circle cx={9} cy={7} r={3.6} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M2.5 19c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6M17.5 6v6M14.5 9h6" stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Dots({ color }: { color: string }) {
  return (
    <Svg width={20} height={6} viewBox="0 0 20 6">
      {[3, 10, 17].map((x) => (
        <Circle key={x} cx={x} cy={3} r={2} fill={color} />
      ))}
    </Svg>
  );
}

/** The person+ button: add one of my friends who is not in this goal yet. */
function AddToGoal({ v, onClose }: { v: GoalView; onClose: () => void }) {
  const g = useLook();
  const { snap, run } = useGoals();
  const [busy, setBusy] = useState('');
  const toast = useAppToast();
  const inGoal = new Set(v.members.map((m) => m.id));
  const left = (snap?.friends ?? []).filter((f) => !inGoal.has(f));
  return (
    <Sheet title="Add to this goal" sub={v.goal.name} onClose={onClose}>
      {left.length === 0 ? (
        <Text style={[st.body, { color: g.mute, marginBottom: 8 }]}>Everyone you know is already here.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {left.map((id, i) => {
            const nm = nameOf(snap!, id);
            return (
              <View key={id} style={[st.friend, { borderColor: g.line }]}>
                <Avatar letter={initial(nm)} color={MEMBER_COLORS[(v.members.length + i) % MEMBER_COLORS.length]} size={34} />
                <Text style={[st.friendT, { color: g.ink }]} numberOfLines={1}>{nm}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    if (busy) return;
                    setBusy(id);
                    const r = await run((db) => addToGoal(db, v.goal.id, id));
                    setBusy('');
                    if (r?.ok) toast(`Added ${nm}`);
                  }}
                  style={[st.small, { backgroundColor: g.gold, opacity: busy === id ? 0.5 : 1 }]}
                >
                  <Text style={[st.smallT, { color: g.onGold }]}>Add</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push('/friends'); }} style={{ paddingVertical: 16 }}>
        <Text style={[st.link, { color: g.goldInk }]}>Invite a friend by email</Text>
      </Pressable>
    </Sheet>
  );
}

export default function GoalScreen() {
  const g = useLook();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { snap, status, canAct, run } = useGoals();
  const { state, update, demo } = useStore();
  const toast = useAppToast();
  const now = Date.now();
  const v = snap ? goalView(snap, id, now) : null;
  const pulse = usePinPulse(v);
  const [sheet, setSheet] = useState<null | 'put' | 'edit' | 'add' | { entry: string }>(null);
  const [menu, setMenu] = useState(false);
  const [all, setAll] = useState(false);
  const [sureLeave, setSureLeave] = useState(false);
  const leaveT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (leaveT.current && clearTimeout(leaveT.current)), []);

  // the goal is gone (I left, or the last member did): back to Savings
  useEffect(() => {
    if (snap && status === 'ready' && !v) router.back();
  }, [snap, status, v]);

  // "Unlocked." once per goal on this phone, as soon as it is reached
  const unlocked = !!v?.unlocked;
  useEffect(() => {
    if (!unlocked || demo || state.unlockSeen?.[id]) return;
    update((s) => ({ ...s, unlockSeen: { ...(s.unlockSeen ?? {}), [id]: 1 } }));
    const t = setTimeout(() => router.push({ pathname: '/unlocked/[id]', params: { id } }), 1100); // after the lock has opened here
    return () => clearTimeout(t);
  }, [unlocked, demo, id, state.unlockSeen, update]);

  if (!v) return <View style={{ flex: 1, backgroundColor: g.bg }} />;

  const ring = Math.min(310, width - 80); // the ring itself is 40 px smaller: room for its glow
  const pc = paceCard(v, now);
  const sc = streakCard(v);
  const fair = Math.round(v.fair);
  const acts = all ? v.activity : v.activity.slice(0, 4);
  const blocked = () => toast(ENDED);
  const act = (fn: () => void) => (canAct || demo ? fn : blocked);

  const leave = async () => {
    if (!sureLeave) {
      setSureLeave(true);
      leaveT.current = setTimeout(() => setSureLeave(false), 4000);
      return;
    }
    if (leaveT.current) clearTimeout(leaveT.current);
    setSureLeave(false);
    const r = await run((db) => leaveGoal(db, v.goal.id), { always: true });
    if (r?.ok) router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: g.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={st.top}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={st.back} hitSlop={10}>
            <Chevron color={g.mute} dir="left" size={16} />
            <Text style={[st.backT, { color: g.mute }]}>Savings</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Add a friend to this goal" onPress={act(() => setSheet('add'))} style={[st.icon, { borderColor: g.line, backgroundColor: g.card }]}>
              <AddFriendIcon color={g.ink} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => setMenu(true)} style={[st.icon, { borderColor: g.line, backgroundColor: g.card }]}>
              <Dots color={g.ink} />
            </Pressable>
          </View>
        </View>

        <Text style={[st.kicker, { color: g.goldInk }]}>SHARED GOAL</Text>
        <Text style={[st.name, { color: g.ink }]}>{v.goal.name}</Text>
        <View style={st.people}>
          <Avatars people={v.members} size={26} />
          <Text style={[st.peopleT, { color: g.mute }]}>{peopleLine(v, now)}</Text>
        </View>

        {!canAct && !demo && (
          <View style={[st.ended, { borderColor: g.goldLine, backgroundColor: g.goldChip }]}>
            <Text style={[st.body, { color: g.ink }]}>{ENDED}</Text>
          </View>
        )}

        <View style={[st.goldCard, { backgroundImage: g.goldBg, borderColor: g.goldLine }]}>
          <View style={{ alignItems: 'center' }}>
            <LockRing size={ring} segs={segments(v.members, v.goal.target)} passed={v.passed} next={v.next} unlocked={v.unlocked} pulse={pulse} />
          </View>
          <Text style={[st.amount, { color: g.ink }]}>{money(v.saved, v.goal.currency)}</Text>
          <Text style={[st.of, { color: g.goldSoft }]}>
            {`of ${money(v.goal.target, v.goal.currency)} · `}
            <Text style={{ color: g.goldInk, fontFamily: F.heavy }}>{v.pct}%</Text>
            {v.left > 0 ? ` · ${money(v.left, v.goal.currency)} to go` : ''}
          </Text>
          <View style={st.chips}>
            {pinChips(v).map((c) => (
              <View key={c.t} style={[st.pin, c.passed ? { backgroundColor: g.goldChip } : { borderColor: g.goldLine, borderWidth: 1 }]}>
                <Text style={[st.pinT, { color: c.passed ? g.goldInk : g.ink }]}>{c.t}</Text>
              </View>
            ))}
          </View>
          <GoldButton title="Put money in" plus onPress={act(() => setSheet('put'))} style={{ marginTop: 16 }} dim={!canAct && !demo} />
        </View>

        <View style={st.two}>
          <Card style={st.half}>
            <View style={st.labelRow}>
              <View style={[st.dot, { backgroundColor: pc.good ? g.green : g.red }]} />
              <Text style={[st.label, { color: pc.good ? g.green : g.red }]}>{pc.label}</Text>
            </View>
            <Text style={[st.body, { color: g.ink }]}>{pc.text}</Text>
          </Card>
          <Card style={st.half}>
            <View style={st.labelRow}>
              <Flame color={g.flame} size={11} />
              <Text style={[st.label, { color: g.flame, flex: 1 }]}>{sc.title}</Text>
            </View>
            <Text style={[st.body, { color: g.ink }]}>{sc.text}</Text>
          </Card>
        </View>

        <Card style={{ marginTop: 14 }}>
          <View style={st.cardHead}>
            <Text style={[st.h, { color: g.ink }]}>Who put in what</Text>
            <Text style={[st.fair, { color: g.mute }]}>Fair share {money(fair, v.goal.currency)} each</Text>
          </View>
          {v.members.map((m) => (
            <View key={m.id} style={st.member}>
              <View style={st.memberRow}>
                <Avatar letter={m.initial} color={m.color} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={[st.mName, { color: g.ink }]} numberOfLines={1}>
                    {m.name}
                    {m.isMe && <Text style={[st.you, { color: g.mute }]}>  YOU</Text>}
                  </Text>
                  <Text style={[st.mWeek, { color: m.thisWeek ? g.mute : g.goldInk }]}>{m.thisWeek ? 'Put in this week' : 'Nothing this week'}</Text>
                </View>
                <Text style={[st.mAmt, { color: g.ink }]}>{money(m.total, v.goal.currency)}</Text>
                {!m.isMe && !m.thisWeek && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={act(async () => {
                      if (m.nudgedToday) return;
                      await run((db) => nudge(db, v.goal.id, m.id));
                    })}
                    style={[st.nudge, { borderColor: g.goldLine, backgroundColor: g.goldChip, opacity: m.nudgedToday ? 0.5 : 1 }]}
                  >
                    <Svg width={14} height={14} viewBox="0 0 14 14">
                      <Path d="M7 1.5a3.6 3.6 0 0 0-3.6 3.6v2.6L2.2 10h9.6l-1.2-2.3V5.1A3.6 3.6 0 0 0 7 1.5ZM5.6 11.6a1.5 1.5 0 0 0 2.8 0" stroke={g.goldInk} strokeWidth={1.3} fill="none" strokeLinejoin="round" />
                    </Svg>
                    <Text style={[st.nudgeT, { color: g.goldInk }]}>{m.nudgedToday ? 'Nudged' : 'Nudge'}</Text>
                  </Pressable>
                )}
              </View>
              <View style={[st.track, { backgroundColor: g.track }]}>
                <View style={{ width: `${Math.min(1, m.total / Math.max(1, v.fair)) * 100}%`, height: '100%', backgroundColor: m.color }} />
              </View>
            </View>
          ))}
        </Card>

        <Card style={{ marginTop: 14 }}>
          <Text style={[st.h, { color: g.ink, marginBottom: 10 }]}>Activity</Text>
          {acts.length === 0 && <Text style={[st.body, { color: g.mute }]}>Nothing yet. Put money in to start.</Text>}
          {acts.map((a) => {
            const row = (
              <View style={st.act}>
                <View style={[st.actDot, { backgroundColor: a.kind === 'pin' || a.kind === 'unlocked' ? GOLD : a.color }]} />
                <Text style={[st.actT, { color: g.ink }]} numberOfLines={2}>
                  {a.parts.map((p, i) => (
                    <Text key={i} style={p.role === 'gold' ? { color: g.goldInk, fontFamily: F.heavy } : p.role === 'text' ? { fontFamily: F.text } : undefined}>
                      {p.t}
                    </Text>
                  ))}
                </Text>
                <Text style={[st.actW, { color: g.mute }]}>{timeAgo(a.at, now)}</Text>
              </View>
            );
            return a.contributionId ? (
              <Pressable key={a.key} accessibilityRole="button" accessibilityHint="Change or delete this entry" onPress={act(() => setSheet({ entry: a.contributionId! }))}>
                {row}
              </Pressable>
            ) : (
              <View key={a.key}>{row}</View>
            );
          })}
          {v.activity.length > 4 && (
            <Pressable accessibilityRole="button" onPress={() => setAll((x) => !x)} style={[st.all, { borderColor: g.line }]}>
              <Text style={[st.allT, { color: g.mute }]}>{all ? 'Show less' : 'See all activity'}</Text>
            </Pressable>
          )}
        </Card>

        <Pressable accessibilityRole="button" onPress={act(() => setSheet('edit'))} style={{ marginTop: 22, paddingHorizontal: 4 }}>
          <Text style={[st.bottomL, { color: g.ink }]}>Edit goal</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={demo ? act(() => {}) : leave} style={{ marginTop: 22, paddingHorizontal: 4 }}>
          <Text style={[st.bottomL, { color: g.red }]}>{sureLeave ? 'Tap again to leave' : 'Leave goal'}</Text>
        </Pressable>
        <Text style={[st.leaveT, { color: g.mute }]}>{leaveText(v)}</Text>
      </ScrollView>

      {menu && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setMenu(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setMenu(false)}>
            <View style={[st.menu, { top: insets.top + 62, backgroundColor: g.card, borderColor: g.line }]}>
              {[
                ['Edit goal', act(() => setSheet('edit'))],
                ['Friends', () => router.push('/friends')],
                ['Leave goal', demo ? act(() => {}) : leave],
              ].map(([t, fn]) => (
                <Pressable
                  key={t as string}
                  accessibilityRole="button"
                  onPress={() => {
                    setMenu(false);
                    (fn as () => void)();
                  }}
                  style={st.menuI}
                >
                  <Text style={[st.menuT, { color: t === 'Leave goal' ? g.red : g.ink }]}>{t as string}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}

      {sheet === 'put' && <PutMoneyIn v={v} onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <GoalForm goal={v.goal} currency={v.goal.currency} onClose={() => setSheet(null)} />}
      {sheet === 'add' && <AddToGoal v={v} onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && <EntrySheet v={v} id={sheet.entry} onClose={() => setSheet(null)} />}
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backT: { fontFamily: F.medium, fontSize: 15 },
  icon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: F.heavy, fontSize: 11.5, letterSpacing: 1.3 },
  name: { fontFamily: F.display, fontSize: 27, lineHeight: 32, letterSpacing: -0.5, marginTop: 3 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6, marginBottom: 14 },
  peopleT: { fontFamily: F.text, fontSize: 13.5 },
  ended: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  goldCard: { borderWidth: 1, borderRadius: 24, padding: 16 },
  amount: { fontFamily: F.display, fontSize: 38, lineHeight: 44, textAlign: 'center', marginTop: 6, letterSpacing: -0.8 },
  of: { fontFamily: F.medium, fontSize: 13.5, textAlign: 'center', marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 12 },
  pin: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pinT: { fontFamily: F.bold, fontSize: 11.5 },
  two: { flexDirection: 'row', gap: 11, marginTop: 14 },
  half: { flex: 1, flexBasis: 0, padding: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: F.bold, fontSize: 12.5 },
  body: { fontFamily: F.text, fontSize: 13, lineHeight: 18.5 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  h: { fontFamily: F.display, fontSize: 18, lineHeight: 23 },
  fair: { fontFamily: F.text, fontSize: 11.5, flexShrink: 1, textAlign: 'right' },
  member: { paddingVertical: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mName: { fontFamily: F.bold, fontSize: 14.5 },
  you: { fontFamily: F.semi, fontSize: 11, letterSpacing: 0.5 },
  mWeek: { fontFamily: F.text, fontSize: 12, marginTop: 1 },
  mAmt: { fontFamily: F.heavy, fontSize: 15 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  nudgeT: { fontFamily: F.bold, fontSize: 13 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 9 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  actDot: { width: 8, height: 8, borderRadius: 4 },
  actT: { flex: 1, fontFamily: F.bold, fontSize: 13.5 },
  actW: { fontFamily: F.text, fontSize: 12 },
  all: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  allT: { fontFamily: F.semi, fontSize: 14 },
  bottomL: { fontFamily: F.bold, fontSize: 15.5 },
  leaveT: { fontFamily: F.text, fontSize: 12, lineHeight: 17, marginTop: 10, paddingHorizontal: 4 },
  menu: { position: 'absolute', right: 16, minWidth: 190, borderWidth: 1, borderRadius: 16, paddingVertical: 6 },
  menuI: { paddingHorizontal: 16, paddingVertical: 12 },
  menuT: { fontFamily: F.semi, fontSize: 16 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10 },
  friendT: { flex: 1, fontFamily: F.semi, fontSize: 16 },
  small: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  smallT: { fontFamily: F.bold, fontSize: 15 },
  link: { fontFamily: F.semi, fontSize: 16, textAlign: 'center' },
});
