// "Put money in" (Andrija's design): the amount, +10 / +20 / +50, "Rest of my share", what the goal looks like
// after it, the next pin, whether it counts for this week's squad streak. Also "Your entry": change or delete
// one of my own payments (from Activity).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Flame, GoldButton, OutlineButton } from './bits';
import { F, useLook } from './look';
import { Sheet } from './Sheet';
import { deleteEntry, editEntry, putIn } from '@/goals/api';
import { useGoals } from '@/goals/GoalsProvider';
import { fmt, parseAmount } from '@/logic/format';
import { GOLD, money, putPreview, type GoalView } from '@/logic/goals';

const PREFIX = /^[^\d-]+(?=\d)/;

function AmountBox({ value, onChange, currency, autoFocus }: { value: string; onChange: (v: string) => void; currency: string; autoFocus?: boolean }) {
  const g = useLook();
  const sample = money(1, currency); // "1 €" or "$1": where the symbol goes
  const pre = sample.match(PREFIX)?.[0];
  const post = pre ? '' : sample.replace(/^[\d.,]+\s*/, '');
  return (
    <View style={[st.box, { borderColor: g.gold, backgroundColor: g.goldChip }]}>
      {!!pre && <Text style={[st.sym, { color: g.goldSoft }]}>{pre}</Text>}
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^\d.,]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={g.mute}
        autoFocus={autoFocus}
        accessibilityLabel="Amount"
        // as wide as what is typed, so the amount and its symbol sit together in the middle ("50 €")
        style={[st.amt, { color: g.ink, width: 12 + 24 * Math.max(1, value.length) }]}
      />
      {!!post && <Text style={[st.sym, { color: g.goldSoft }]}>{post}</Text>}
    </View>
  );
}

function Quick({ t, onPress, gold }: { t: string; onPress: () => void; gold?: boolean }) {
  const g = useLook();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [st.quick, { borderColor: gold ? g.goldLine : g.line, backgroundColor: gold ? g.goldChip : 'transparent' }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[st.quickT, { color: gold ? g.goldInk : g.ink }]}>{t}</Text>
    </Pressable>
  );
}

export function PutMoneyIn({ v, onClose }: { v: GoalView; onClose: () => void }) {
  const g = useLook();
  const { run, offerAlerts } = useGoals();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const a = parseAmount(raw) || 0;
  const p = putPreview(v, a);
  const add = (n: number) => setRaw(String(Math.round((a + n) * 100) / 100));
  const meIdx = v.members.findIndex((m) => m.isMe);

  const save = async () => {
    if (busy || !(a > 0)) return;
    setBusy(true);
    const r = await run((db, me) => putIn(db, me, v.goal.id, Math.round(a * 100) / 100));
    setBusy(false);
    if (r?.ok) {
      onClose();
      offerAlerts();
    }
  };

  return (
    <Sheet title="Put money in" sub={v.goal.name} onClose={onClose}>
      <Text style={[st.label, { color: g.mute }]}>Amount</Text>
      <AmountBox value={raw} onChange={setRaw} currency={v.goal.currency} autoFocus />
      <View style={st.quicks}>
        <Quick t="+10" onPress={() => add(10)} />
        <Quick t="+20" onPress={() => add(20)} />
        <Quick t="+50" onPress={() => add(50)} />
      </View>
      {p.rest > 0 && (
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <Quick t={`Rest of my share · ${fmt(p.rest)}`} onPress={() => setRaw(String(p.rest))} gold />
        </View>
      )}

      <View style={[st.after, { borderColor: g.line }]}>
        <View style={st.afterTop}>
          <Text style={[st.afterL, { color: g.mute }]}>After this</Text>
          <Text style={[st.afterV, { color: g.ink }]}>{p.line}</Text>
        </View>
        <View style={[st.bar, { backgroundColor: g.track }]}>
          {v.members.map((m, i) => {
            const part = m.total + (i === meIdx ? a : 0);
            const w = Math.max(0, Math.min(1, part / v.goal.target));
            return w > 0 ? <View key={m.id} style={{ width: `${w * 100}%`, backgroundColor: m.color }} /> : null;
          })}
        </View>
        {!!p.note && (
          <View style={st.line}>
            <View style={[st.dot, { backgroundColor: GOLD }]} />
            <Text style={[st.lineT, { color: g.ink }]}>{p.note}</Text>
          </View>
        )}
        {p.streak && (
          <View style={st.line}>
            <View style={{ width: 14, alignItems: 'center' }}>
              <Flame color={g.flame} size={11} />
            </View>
            <Text style={[st.lineT, { color: g.ink }]}>Counts for this week's squad streak</Text>
          </View>
        )}
      </View>

      <GoldButton title={`Put in ${money(a, v.goal.currency)}`} onPress={save} dim={busy || !(a > 0)} style={{ marginTop: 16, minHeight: 50 }} />
      <Text style={[st.foot, { color: g.mute }]}>Only you can change or delete your own entries.</Text>
    </Sheet>
  );
}

/** "Your entry": one of my payments, from Activity. */
export function EntrySheet({ v, id, onClose }: { v: GoalView; id: string; onClose: () => void }) {
  const g = useLook();
  const { run, snap } = useGoals();
  const entry = snap?.contributions.find((c) => c.id === id);
  const [raw, setRaw] = useState(entry ? String(entry.amount) : '');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!entry) return null;
  const a = parseAmount(raw) || 0;
  const save = async () => {
    if (busy || !(a > 0)) return;
    setBusy(true);
    const r = await run((db) => editEntry(db, id, Math.round(a * 100) / 100));
    setBusy(false);
    if (r?.ok) onClose();
  };
  const del = async () => {
    if (!sure) return setSure(true);
    if (busy) return;
    setBusy(true);
    const r = await run((db) => deleteEntry(db, id), { always: true });
    setBusy(false);
    if (r?.ok) onClose();
  };
  return (
    <Sheet title="Your entry" sub={v.goal.name} onClose={onClose}>
      <Text style={[st.label, { color: g.mute }]}>Amount</Text>
      <AmountBox value={raw} onChange={setRaw} currency={v.goal.currency} />
      <GoldButton title="Save" onPress={save} dim={busy || !(a > 0)} style={{ marginTop: 18 }} />
      <OutlineButton title={sure ? 'Sure? Tap again' : 'Delete'} onPress={del} plain style={{ marginTop: 10 }} textStyle={{ color: g.red }} />
    </Sheet>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: F.semi, fontSize: 13, textAlign: 'center', marginBottom: 7 },
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 16, minHeight: 74, paddingHorizontal: 16 },
  amt: { fontFamily: F.display, fontSize: 38, textAlign: 'center', paddingVertical: 4, outlineWidth: 0 },
  sym: { fontFamily: F.display, fontSize: 29, marginHorizontal: 5 },
  quicks: { flexDirection: 'row', gap: 8, marginTop: 16 },
  quick: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  quickT: { fontFamily: F.bold, fontSize: 14 },
  after: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 16, gap: 9 },
  afterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  afterL: { fontFamily: F.text, fontSize: 13 },
  afterV: { fontFamily: F.bold, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  bar: { height: 9, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 3 },
  lineT: { fontFamily: F.text, fontSize: 13, flexShrink: 1 },
  foot: { fontFamily: F.text, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
