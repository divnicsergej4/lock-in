// "Envelopes & goals" (prototype section[data-fold=env], teal): free money, the drawer of envelopes,
// splitting free money into them, and a new envelope with an optional goal and deadline.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppToast } from '@/components/AppToast';
import { Button, Field, Fold, Ghost, Small, SummaryMarker } from '@/components/home/Section';
import { Select } from '@/components/onboarding/Select';
import { createEnvelope, distribute, leftUnassigned } from '@/logic/envelopes';
import { fmt } from '@/logic/format';
import { freeBalance } from '@/logic/money';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

import { Drawer } from './Drawer';

const third = { flex: 1, flexBasis: 0, minWidth: 0 } as const;

export function EnvelopesFold({ play }: { play: number }) {
  const { state, update } = useStore();
  const { c, name } = useTheme();
  const toast = useAppToast();
  const E = state.env || [];
  const free = freeBalance(state);
  const minus = name === 'light' ? '#d93a3a' : '#ff7b7b';

  // "Split money into envelopes"
  const [split, setSplit] = useState<string[] | null>(null);
  const toggleSplit = () => setSplit((v) => (v ? null : E.map(() => '')));
  const left = split ? leftUnassigned(state, split) : 0;
  const saveSplit = () => {
    if (!split) return;
    const r = distribute(state, split);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    setSplit(null);
    toast(r.toast);
  };

  // "+ New envelope"
  const [more, setMore] = useState(false);
  const [pullOut, setPullOut] = useState({ i: -1, k: 0 });
  const [nm, setNm] = useState('');
  const [goal, setGoal] = useState('');
  const [k, setK] = useState('');
  const [unit, setUnit] = useState<'d' | 'm' | 'y'>('m');
  const look = { bg: c.inputBg, border: c.line, ink: c.ink, mute: c.mute, sheet: c.card, font: inter[400] };
  const create = () => {
    const r = createEnvelope(state, { name: nm, target: goal, deadlineIn: k, unit }, Date.now());
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    setNm('');
    setGoal('');
    setK('');
    setMore(false);
    setPullOut((p) => ({ i: r.state.env.length - 1, k: p.k + 1 }));
    toast(r.toast);
  };

  return (
    <Fold id="env" title="Envelopes & goals" kind="teal" defaultOpen>
      <Small style={{ marginTop: 0.8 }}>Split your money into envelopes, like at home: rent, clothes, a trip… An envelope can also have a goal and a deadline.</Small>
      <View style={[st.envf]}>
        <Text style={[st.envfL, { color: c.mute }]}>Free to assign</Text>
        <Text style={[st.envfV, { color: free < 0 ? minus : c.ink }]}>{fmt(free) + ' ' + state.cur}</Text>
      </View>
      <Drawer play={play} pullOut={pullOut} />
      {E.length > 0 && <Ghost title="Split money into envelopes" onPress={toggleSplit} style={{ marginTop: 12 }} />}
      {split && (
        <View style={{ marginTop: 10 }}>
          {E.map((e, i) => (
            <View key={e.id} style={st.srow2}>
              <Text style={[st.srow2T, { color: c.ink }]} numberOfLines={1}>
                {e.n}
              </Text>
              <Field
                value={split[i]}
                onChangeText={(v) => setSplit((a) => (a ? a.map((x, j) => (j === i ? v : x)) : a))}
                placeholder="0"
                keyboardType="decimal-pad"
                accessibilityLabel={e.n}
                style={{ width: '44%' }}
              />
            </View>
          ))}
          <Small style={{ marginTop: 12.8, marginBottom: 0 }}>
            {'Left unassigned: '}
            <Text style={{ fontFamily: inter[700], color: left < 0 ? minus : c.mute }}>{fmt(left) + ' ' + state.cur}</Text>
          </Small>
          <Button title="Save" onPress={saveSplit} style={{ marginTop: 12.8 + 12 - 12.8 }} />
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore((m) => !m)} style={st.summary}>
        <SummaryMarker open={more} color={c.mute} />
        <Text style={[st.summaryT, { color: c.mute }]}>+ New envelope</Text>
      </Pressable>
      {more && (
        <View>
          <Field value={nm} onChangeText={setNm} placeholder="Name, e.g. Summer trip" accessibilityLabel="Envelope name" style={{ marginTop: 10 }} />
          <View style={[st.row, { marginTop: 8 }]}>
            <Field value={goal} onChangeText={setGoal} placeholder="Goal (optional)" keyboardType="decimal-pad" accessibilityLabel="Goal" style={third} />
            <Field value={k} onChangeText={setK} placeholder="Deadline" keyboardType="number-pad" accessibilityLabel="Deadline" style={third} />
            <Select
              label="Deadline unit"
              value={unit}
              onChange={(v) => setUnit(v as 'd' | 'm' | 'y')}
              options={[
                { value: 'd', label: 'days' },
                { value: 'm', label: 'months' },
                { value: 'y', label: 'years' },
              ]}
              look={look}
              style={{ ...third, height: 47.2 }}
            />
          </View>
          <Button title="Create envelope" onPress={create} />
        </View>
      )}
    </Fold>
  );
}

const st = StyleSheet.create({
  envf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12.8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(127,127,127,0.08)' },
  envfL: { fontFamily: inter[400], fontSize: 14.4, lineHeight: 20.88 },
  envfV: { fontFamily: inter[700], fontSize: 18.4, lineHeight: 26.68, fontVariant: ['tabular-nums'] },
  srow2: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  srow2T: { flex: 1, fontFamily: inter[600], fontSize: 16, lineHeight: 23.2 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6.9, marginTop: 10 },
  summaryT: { fontFamily: inter[400], fontSize: 14.08, lineHeight: 20.4 },
  row: { flexDirection: 'row', gap: 8 },
});
