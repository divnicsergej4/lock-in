// "Make a goal" and "Edit goal": a name, an amount, a due date if you want one, and (when making it) which friends
// are in. Every member can edit; the currency stays the one the goal was made in.

import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, GoldButton, SheetField } from './bits';
import { F, useLook } from './look';
import { Sheet } from './Sheet';
import { useAppToast } from '@/components/AppToast';
import { createGoal, editGoal } from '@/goals/api';
import { useGoals } from '@/goals/GoalsProvider';
import { parseAmount } from '@/logic/format';
import { dayString, initial, MEMBER_COLORS, nameOf, parseDay, shortDate, type Goal } from '@/logic/goals';

export function GoalForm({
  goal,
  currency,
  target,
  onClose,
  onMade,
}: {
  goal?: Goal; // editing this one
  currency: string;
  target?: number; // "Set a new target": start with this amount
  onClose: () => void;
  onMade?: (id: string) => void;
}) {
  const g = useLook();
  const toast = useAppToast();
  const { snap, run, offerAlerts } = useGoals();
  const [name, setName] = useState(goal?.name ?? '');
  const [amt, setAmt] = useState(target != null ? String(target) : goal ? String(goal.target) : '');
  const [date, setDate] = useState<string | null>(goal?.deadline ?? null);
  const [picking, setPicking] = useState(false);
  const [who, setWho] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const cur = goal?.currency ?? currency;

  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const pick = () => {
    const value = date ? new Date(parseDay(date)) : tomorrow();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value, mode: 'date', minimumDate: tomorrow(), onChange: (e, d) => e.type === 'set' && d && setDate(dayString(d.getTime())) });
    } else setPicking((p) => !p);
  };

  const save = async () => {
    if (busy) return;
    const n = name.trim();
    const t = parseAmount(amt);
    if (!n) return toast('Give it a name.');
    if (!(t > 0)) return toast('Enter an amount.');
    if (date && !goal && parseDay(date) <= Date.now()) return toast('Pick a date after today.');
    if (date && goal && date !== goal.deadline && parseDay(date) <= Date.now()) return toast('Pick a date after today.');
    setBusy(true);
    const data = { name: n, target: Math.round(t * 100) / 100, deadline: date };
    const r = goal
      ? await run((db) => editGoal(db, goal.id, data))
      : await run((db) => createGoal(db, { ...data, currency: cur }, who), { named: true });
    setBusy(false);
    if (r?.ok) {
      onClose();
      if (!goal && typeof r.data === 'string') {
        onMade?.(r.data);
        offerAlerts();
      }
    }
  };

  const friends = snap?.friends ?? [];
  return (
    <Sheet title={goal ? 'Edit goal' : 'Make a goal'} onClose={onClose}>
      <SheetField label="Name" value={name} onChangeText={setName} placeholder="E.g. Summer trip" autoFocus={!goal} />
      <SheetField label="Amount" value={amt} onChangeText={setAmt} placeholder="0" numeric />
      <Text style={[st.note, { color: g.mute }]}>In {cur}. A goal keeps one currency.</Text>

      <Text style={[st.label, { color: g.mute }]}>Due date</Text>
      <View style={st.dateRow}>
        <Pressable accessibilityRole="button" onPress={pick} style={[st.date, { borderColor: g.line, backgroundColor: g.bg }]}>
          <Text style={[st.dateT, { color: date ? g.ink : g.mute }]}>{date ? shortDate(parseDay(date), now) : 'Optional'}</Text>
          <Text style={[st.dateA, { color: g.goldInk }]}>Pick a date</Text>
        </Pressable>
        {date && (
          <Pressable accessibilityRole="button" onPress={() => { setDate(null); setPicking(false); }} hitSlop={8}>
            <Text style={[st.dateA, { color: g.mute }]}>Remove date</Text>
          </Pressable>
        )}
      </View>
      {picking && Platform.OS === 'ios' && (
        <DateTimePicker
          value={date ? new Date(parseDay(date)) : tomorrow()}
          mode="date"
          display="inline"
          minimumDate={tomorrow()}
          themeVariant={g.bg === '#050b08' ? 'dark' : 'light'}
          accentColor={g.gold}
          onChange={(_e, d) => d && setDate(dayString(d.getTime()))}
        />
      )}

      {!goal && (
        <>
          <Text style={[st.label, { color: g.mute, marginTop: 16 }]}>Who's in</Text>
          {friends.length === 0 ? (
            <Text style={[st.note, { color: g.mute }]}>Just you for now. You can add friends later.</Text>
          ) : (
            <View style={{ gap: 8, marginBottom: 6 }}>
              {friends.map((id, i) => {
                const on = who.includes(id);
                const nm = nameOf(snap!, id);
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => setWho((w) => (on ? w.filter((x) => x !== id) : [...w, id]))}
                    style={[st.friend, { borderColor: on ? g.gold : g.line }]}
                  >
                    <Avatar letter={initial(nm)} color={MEMBER_COLORS[(i + 1) % MEMBER_COLORS.length]} size={30} />
                    <Text style={[st.friendT, { color: g.ink }]} numberOfLines={1}>{nm}</Text>
                    <View style={[st.box, { borderColor: on ? g.gold : g.line, backgroundColor: on ? g.gold : 'transparent' }]}>
                      {on && <Text style={[st.tick, { color: g.onGold }]}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      <GoldButton title={goal ? 'Save' : 'Make the goal'} onPress={save} dim={busy} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

const st = StyleSheet.create({
  note: { fontFamily: F.text, fontSize: 13.5, marginTop: -4, marginBottom: 14 },
  label: { fontFamily: F.semi, fontSize: 13.5, marginBottom: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  date: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  dateT: { fontFamily: F.text, fontSize: 16.5 },
  dateA: { fontFamily: F.semi, fontSize: 14.5 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  friendT: { flex: 1, fontFamily: F.semi, fontSize: 16 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  tick: { fontFamily: F.heavy, fontSize: 14 },
});
