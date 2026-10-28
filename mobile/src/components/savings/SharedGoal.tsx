// "Shared goal" on Savings (Andrija's design, 28 October 2026). Signed out: what saving together is, with the
// S M A avatars and "Sign in to get started". Signed in without goals: friend requests, "Lock in together." and
// the three steps. With goals: one card per goal (small ring and lock, chips, the latest thing that happened),
// "New goal" and "Friends · N". The demo shows the same with its sample goal.

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useAppToast } from '@/components/AppToast';
import { Avatar, Avatars, Chevron, Chip, GoldButton, OutlineButton } from '@/components/goals/bits';
import { GoalForm } from '@/components/goals/GoalForm';
import { F, useLook } from '@/components/goals/look';
import { DashedLock, LockRing, segments } from '@/components/goals/LockRing';
import { respondInvite } from '@/goals/api';
import { useGoals } from '@/goals/GoalsProvider';
import {
  amount, dayLabel, goalsHeader, goalTags, goalView, initial, introText, lastActivity, MEMBER_COLORS, money, nameOf,
  type FriendRequest, type GoalView, type Snapshot,
} from '@/logic/goals';
import { useStore } from '@/store/StoreProvider';
import { useTourTarget } from '@/tour/registry';

const SAMPLE = [
  { initial: 'S', color: MEMBER_COLORS[0] },
  { initial: 'M', color: MEMBER_COLORS[1] },
  { initial: 'A', color: MEMBER_COLORS[2] },
];

function GoldSection({ children }: { children: React.ReactNode }) {
  const g = useLook();
  const ref = useTourTarget('team');
  return (
    <View ref={ref} style={[st.gold, { backgroundImage: g.goldBg, borderColor: g.goldLine }]}>
      {children}
    </View>
  );
}

/** "Marko wants to save with you" with Accept / Decline. */
function RequestCard({ r, s }: { r: FriendRequest; s: Snapshot }) {
  const g = useLook();
  const { run } = useGoals();
  const [busy, setBusy] = useState(false);
  const name = nameOf(s, r.from_user);
  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    await run((db) => respondInvite(db, r.id, accept));
    setBusy(false);
  };
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={[st.req, { backgroundColor: g.card, borderColor: g.line }]}>
        <Avatar letter={initial(name)} color={MEMBER_COLORS[1]} size={37} />
        <View style={{ flex: 1 }}>
          <Text style={[st.reqT, { color: g.ink }]} numberOfLines={2}>
            {name} wants to save with you
          </Text>
          <Text style={[st.reqS, { color: g.mute }]}>Friend request · {dayLabel(Date.parse(r.created_at), Date.now())}</Text>
        </View>
      </View>
      <View style={st.row}>
        <GoldButton title="Accept" onPress={() => answer(true)} style={{ flex: 1, minHeight: 42, borderRadius: 14 }} dim={busy} />
        <OutlineButton title="Decline" onPress={() => answer(false)} plain style={{ flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: g.card }} />
      </View>
    </View>
  );
}

function Requests({ s }: { s: Snapshot }) {
  const g = useLook();
  if (!s.requestsIn.length) return null;
  const more = s.requestsIn.length - 1;
  return (
    <>
      <RequestCard r={s.requestsIn[0]} s={s} />
      {more > 0 && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/friends')} style={{ marginTop: -4, marginBottom: 14, paddingHorizontal: 4 }}>
          <Text style={[st.more, { color: g.goldInk }]}>{more === 1 ? '1 more friend request' : `${more} more friend requests`}</Text>
        </Pressable>
      )}
    </>
  );
}

const STEPS: [string, string][] = [
  ['Add a friend', 'Send an invite to their email.'],
  ['Make a goal', 'A name, an amount, a date if you want one.'],
  ['Put money in', "Everyone logs their own. Nobody's the boss."],
];

/** "Lock in together." with the three steps. Signed out: the S M A avatars and "Sign in to get started". */
function Intro({ signedOut, currency, onMake }: { signedOut?: boolean; currency: string; onMake?: () => void }) {
  const g = useLook();
  const toast = useAppToast();
  const { available } = useAuth();
  return (
    <GoldSection>
      <Text style={[st.kicker, { color: g.goldInk }]}>SHARED GOAL</Text>
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <DashedLock size={128} />
        {signedOut && (
          <View style={{ marginTop: 14 }}>
            <Avatars people={SAMPLE} size={26} />
          </View>
        )}
        <Text style={[st.big, { color: g.ink }]}>Lock in together.</Text>
        <Text style={[st.intro, { color: g.ink }]}>{introText(currency)}</Text>
      </View>
      <View style={{ marginTop: 18, gap: 16 }}>
        {STEPS.map(([t, d], i) => (
          <View key={t} style={st.step}>
            <View style={[st.num, { borderColor: g.gold }]}>
              <Text style={[st.numT, { color: g.goldInk }]}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.stepT, { color: g.ink }]}>{t}</Text>
              <Text style={[st.stepD, { color: g.mute }]}>{d}</Text>
            </View>
          </View>
        ))}
      </View>
      {signedOut ? (
        <GoldButton
          title="Sign in to get started"
          onPress={() => (available ? router.push('/sign-in') : toast('Accounts are coming soon. For now this is a preview.'))}
          style={{ marginTop: 18 }}
        />
      ) : (
        <>
          <GoldButton title="Add a friend" onPress={() => router.push('/friends')} style={{ marginTop: 18 }} />
          <OutlineButton title="Make a goal" onPress={onMake ?? (() => {})} style={{ marginTop: 12, backgroundColor: 'transparent' }} />
        </>
      )}
    </GoldSection>
  );
}

function GoalCard({ v }: { v: GoalView }) {
  const g = useLook();
  const now = Date.now();
  const last = lastActivity(v, now);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/goal/[id]', params: { id: v.goal.id } })}
      style={({ pressed }) => [st.card, { borderColor: g.goldLine, backgroundColor: 'rgba(5,11,8,0.35)' }, pressed && { opacity: 0.85 }]}
    >
      <View style={st.cardTop}>
        <LockRing size={58} small segs={segments(v.members, v.goal.target)} unlocked={v.unlocked} />
        <View style={{ flex: 1 }}>
          <Text style={[st.cardName, { color: g.ink }]} numberOfLines={2}>
            {v.goal.name}
          </Text>
          <Text style={[st.cardSum, { color: g.goldSoft }]}>
            {amount(v.saved)} / {money(v.goal.target, v.goal.currency)} · {v.pct}%
          </Text>
        </View>
        <Chevron color={g.mute} />
      </View>
      <View style={st.tags}>
        <Avatars people={v.members} size={22} />
        {goalTags(v, now).map((t) => (
          <Chip key={t.t} tag={t} />
        ))}
      </View>
      <View style={[st.last, { borderTopColor: g.line }]}>
        {last ? (
          <Text style={[st.lastT, { color: g.mute }]} numberOfLines={1}>
            {last.parts.map((p, i) => (
              <Text key={i} style={p.role === 'name' ? { color: g.ink, fontFamily: F.bold } : undefined}>
                {p.t}
              </Text>
            ))}
            {' · ' + last.when}
          </Text>
        ) : (
          <Text style={[st.lastT, { color: g.mute }]}>No money in yet</Text>
        )}
      </View>
    </Pressable>
  );
}

export function SharedGoal() {
  const g = useLook();
  const { state } = useStore();
  const { on, snap, status, refresh, run } = useGoals();
  const [making, setMaking] = useState(false);
  const make = () => run(async () => ({ ok: true as const, data: undefined }), { named: true, quiet: true }).then((r) => r && setMaking(true));

  if (!on) return <Intro signedOut currency={state.cur} />;
  if (!snap) {
    return (
      <GoldSection>
        <Text style={[st.kicker, { color: g.goldInk }]}>SHARED GOAL</Text>
        {status === 'error' ? (
          <View style={{ paddingVertical: 18, gap: 12 }}>
            <Text style={[st.stepD, { color: g.mute }]}>Couldn't load your goals. Check your connection.</Text>
            <OutlineButton title="Try again" onPress={refresh} />
          </View>
        ) : (
          <ActivityIndicator color={g.gold} style={{ marginVertical: 40 }} />
        )}
      </GoldSection>
    );
  }
  const now = Date.now();
  const views = snap.goals.map((x) => goalView(snap, x.id, now)).filter((x): x is GoalView => !!x);
  return (
    <>
      <Requests s={snap} />
      {views.length === 0 ? (
        <Intro currency={state.cur} onMake={make} />
      ) : (
        <GoldSection>
          <View style={st.head}>
            <Text style={[st.h, { color: g.ink }]}>Shared goals</Text>
            <Text style={[st.count, { color: g.mute }]}>{goalsHeader(views.length, snap.friends.length)}</Text>
          </View>
          <View style={{ gap: 14 }}>
            {views.map((v) => (
              <GoalCard key={v.goal.id} v={v} />
            ))}
          </View>
          <View style={[st.row, { marginTop: 16, marginBottom: 0 }]}>
            <GoldButton title="New goal" plus onPress={make} style={{ flex: 1 }} />
            <OutlineButton title={`Friends · ${snap.friends.length}`} onPress={() => router.push('/friends')} style={{ flex: 1, backgroundColor: 'transparent' }} />
          </View>
        </GoldSection>
      )}
      {making && <GoalForm currency={state.cur} onClose={() => setMaking(false)} onMade={(id) => router.push({ pathname: '/goal/[id]', params: { id } })} />}
    </>
  );
}

// sizes measured on Andrija's screenshots (drawn at 2x)
const st = StyleSheet.create({
  gold: { borderWidth: 1, borderRadius: 24, padding: 16, marginBottom: 14 },
  kicker: { fontFamily: F.heavy, fontSize: 11.5, letterSpacing: 1.4 },
  big: { fontFamily: F.display, fontSize: 25, lineHeight: 30, letterSpacing: -0.5, marginTop: 16, textAlign: 'center' },
  intro: { fontFamily: F.text, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 8, opacity: 0.86 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  num: { width: 27, height: 27, borderRadius: 14, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  numT: { fontFamily: F.heavy, fontSize: 12 },
  stepT: { fontFamily: F.bold, fontSize: 14.5, lineHeight: 19 },
  stepD: { fontFamily: F.text, fontSize: 12.5, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  req: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 13 },
  reqT: { fontFamily: F.bold, fontSize: 14.5, lineHeight: 19 },
  reqS: { fontFamily: F.text, fontSize: 12, lineHeight: 16, marginTop: 2 },
  more: { fontFamily: F.semi, fontSize: 12.5 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 11 },
  h: { fontFamily: F.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  count: { fontFamily: F.text, fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  cardName: { fontFamily: F.display, fontSize: 15.5, lineHeight: 20 },
  cardSum: { fontFamily: F.medium, fontSize: 12.5, marginTop: 3 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  last: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  lastT: { fontFamily: F.text, fontSize: 12.5 },
});
