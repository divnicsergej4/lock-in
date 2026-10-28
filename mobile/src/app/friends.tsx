// Friends: invite by email (the server sends the email), requests to answer, invites I sent (cancel), and my
// friends. Other people's emails are never shown: friends by their name only.

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, Chevron, GoldButton, SheetField } from '@/components/goals/bits';
import { F, useLook } from '@/components/goals/look';
import { cancelInvite, respondInvite, sendInvite } from '@/goals/api';
import { useGoals } from '@/goals/GoalsProvider';
import { dayLabel, initial, MEMBER_COLORS, nameOf } from '@/logic/goals';

export default function Friends() {
  const g = useLook();
  const insets = useSafeAreaInsets();
  const { snap, run } = useGoals();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const now = Date.now();

  const send = async () => {
    if (busy) return;
    setBusy('send');
    const r = await run((db) => sendInvite(db, email.trim()), { named: true });
    setBusy('');
    if (r?.ok) setEmail('');
  };
  const answer = async (id: string, accept: boolean) => {
    if (busy) return;
    setBusy(id);
    await run((db) => respondInvite(db, id, accept));
    setBusy('');
  };
  const cancel = async (id: string) => {
    if (busy) return;
    setBusy(id);
    await run((db) => cancelInvite(db, id), { always: true });
    setBusy('');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: g.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={st.back} hitSlop={10}>
        <Chevron color={g.mute} dir="left" size={16} />
        <Text style={[st.backT, { color: g.mute }]}>Savings</Text>
      </Pressable>
      <Text style={[st.title, { color: g.ink }]}>Friends</Text>

      <View style={[st.gold, { backgroundImage: g.goldBg, borderColor: g.goldLine }]}>
        <Text style={[st.h, { color: g.ink }]}>Add a friend</Text>
        <Text style={[st.body, { color: g.mute, marginBottom: 14 }]}>They get an email from Lock In. When they accept, you can save together.</Text>
        <SheetField label="Their email" value={email} onChangeText={setEmail} email />
        <GoldButton title="Send invite" onPress={send} dim={busy === 'send' || !email.trim()} />
      </View>

      {!!snap?.requestsIn.length && (
        <>
          <Text style={[st.section, { color: g.mute }]}>Requests</Text>
          <Card style={{ paddingVertical: 6 }}>
            {snap.requestsIn.map((r) => {
              const nm = nameOf(snap, r.from_user);
              return (
                <View key={r.id} style={st.row}>
                  <Avatar letter={initial(nm)} color={MEMBER_COLORS[1]} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.name, { color: g.ink }]} numberOfLines={1}>{nm}</Text>
                    <Text style={[st.sub, { color: g.mute }]}>Friend request · {dayLabel(Date.parse(r.created_at), now)}</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => answer(r.id, true)} style={[st.btn, { backgroundColor: g.gold, opacity: busy === r.id ? 0.5 : 1 }]}>
                    <Text style={[st.btnT, { color: g.onGold }]}>Accept</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => answer(r.id, false)} style={[st.btn, { borderWidth: 1, borderColor: g.line }]}>
                    <Text style={[st.btnT, { color: g.ink }]}>Decline</Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </>
      )}

      {!!snap?.requestsOut.length && (
        <>
          <Text style={[st.section, { color: g.mute }]}>Sent</Text>
          <Card style={{ paddingVertical: 6 }}>
            {snap.requestsOut.map((r) => (
              <View key={r.id} style={st.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.name, { color: g.ink }]} numberOfLines={1}>{r.to_email}</Text>
                  <Text style={[st.sub, { color: g.mute }]}>Waiting · {dayLabel(Date.parse(r.created_at), now)}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => cancel(r.id)} style={[st.btn, { borderWidth: 1, borderColor: g.line, opacity: busy === r.id ? 0.5 : 1 }]}>
                  <Text style={[st.btnT, { color: g.ink }]}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}

      <Text style={[st.section, { color: g.mute }]}>Your friends</Text>
      <Card style={{ paddingVertical: 6 }}>
        {!snap?.friends.length ? (
          <Text style={[st.body, { color: g.mute, paddingVertical: 10 }]}>No friends yet. Invite someone by email above.</Text>
        ) : (
          snap.friends.map((id, i) => {
            const nm = nameOf(snap, id);
            return (
              <View key={id} style={st.row}>
                <Avatar letter={initial(nm)} color={MEMBER_COLORS[(i + 1) % MEMBER_COLORS.length]} size={38} />
                <Text style={[st.name, { color: g.ink, flex: 1 }]} numberOfLines={1}>{nm}</Text>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8 },
  backT: { fontFamily: F.medium, fontSize: 15 },
  title: { fontFamily: F.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, marginTop: 14, marginBottom: 16 },
  gold: { borderWidth: 1, borderRadius: 26, padding: 18 },
  h: { fontFamily: F.display, fontSize: 19, lineHeight: 24, marginBottom: 4 },
  body: { fontFamily: F.text, fontSize: 13.5, lineHeight: 19 },
  section: { fontFamily: F.bold, fontSize: 13.5, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  name: { fontFamily: F.bold, fontSize: 14.5 },
  sub: { fontFamily: F.text, fontSize: 12, marginTop: 1 },
  btn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  btnT: { fontFamily: F.bold, fontSize: 13 },
});
