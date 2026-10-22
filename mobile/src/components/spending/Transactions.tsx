// "All transactions" (prototype section[data-fold=tx] + the ✎ edit sheet): filter, a heading per day,
// each entry with its icon, note, 🔁 for automatic ones, the amount, ✎ to edit and ✕ to delete.

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppToast } from '@/components/AppToast';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button, Field, Fold, Ghost, Small } from '@/components/home/Section';
import { Select } from '@/components/onboarding/Select';
import { editCategories, transactions, TX_EMPTY, type TxFilter, type TxRow } from '@/logic/charts';
import { deleteExpense, deleteIncome, editAmount, editEntry } from '@/logic/entries';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

const FILTERS: [TxFilter, string][] = [
  ['all', 'All'],
  ['in', 'Income'],
  ['out', 'Expenses'],
];

/** The edit sheet: slides up (.35s cubic-bezier(.2,.8,.2,1)) over a dark backdrop. */
function EditSheet({ target, onClose }: { target: { list: 'exp' | 'ins'; i: number } | null; onClose: () => void }) {
  const { state, update } = useStore();
  const { c } = useTheme();
  const toast = useAppToast();
  const insets = useSafeAreaInsets();
  const e = target ? (target.list === 'exp' ? state.exp[target.i] : state.ins[target.i]) : null;
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [cat, setCat] = useState('');
  const [h, setH] = useState(0);
  const y = useSharedValue(1);
  useEffect(() => {
    if (!target || !e) return;
    setAmt(editAmount(e));
    setNote(e.note || '');
    setCat(target.list === 'exp' ? (e as { cat: string }).cat : (e as { type: string }).type || 'Salary');
    y.value = 1;
    y.value = withTiming(0, { duration: 350, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * h }] }));
  if (!target || !e) return null;
  const exp = target.list === 'exp';
  const options = (exp ? editCategories(state, cat) : ['Salary', 'Gift']).map((v) => ({ value: v, label: v }));
  const save = () => {
    const r = editEntry(state, target.list, target.i, { amount: amt, note, cat });
    toast(r.ok ? r.toast : r.error);
    if (!r.ok) return;
    update(() => r.state);
    onClose();
  };
  const look = { bg: c.inputBg, border: c.line, ink: c.ink, mute: c.mute, sheet: c.card, font: inter[400] };
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose} />
      <Animated.View
        onLayout={(ev) => setH(ev.nativeEvent.layout.height)}
        style={[st.sheet, { backgroundColor: c.card, borderColor: c.line, paddingBottom: 20 + insets.bottom }, slide]}
      >
        <Text style={[st.h3, { color: c.ink }]}>✎ Edit</Text>
        <Text style={[st.label, { color: c.mute }]}>Amount</Text>
        <Field value={amt} onChangeText={setAmt} keyboardType="decimal-pad" accessibilityLabel="Amount" />
        <Text style={[st.label, { color: c.mute }]}>Description</Text>
        <Field value={note} onChangeText={setNote} accessibilityLabel="Description" />
        <Text style={[st.label, { color: c.mute }]}>{exp ? 'Category' : 'Type'}</Text>
        <Select label={exp ? 'Category' : 'Type'} value={cat} options={options} onChange={setCat} look={look} style={{ height: 46 }} />
        {/* .row stretches both buttons to the taller one: Cancel (margin 8) ends up 51.2 high, Save 47.2 */}
        <View style={st.row}>
          <Ghost title="Cancel" onPress={onClose} style={{ flex: 1, marginTop: 8 }} />
          <Button title="Save" onPress={save} style={{ flex: 1 }} />
        </View>
      </Animated.View>
    </Modal>
  );
}

function Row({ r, onEdit, onDelete }: { r: Extract<TxRow, { kind: 'tx' }>; onEdit: () => void; onDelete: () => void }) {
  const { c, name } = useTheme();
  const minus = name === 'light' ? '#d93a3a' : '#ff7b7b';
  return (
    <View style={[st.li, { borderBottomColor: c.line }]}>
      <View style={st.left}>
        <CategoryIcon cat={r.icon} color={r.color} mix={c.iconMix} style={{ marginRight: 4 }} />
        <Text style={[st.t16, { color: c.ink, flexShrink: 1 }]} numberOfLines={2}>
          {r.cat}
          {!!r.note && <Text style={[st.small, { color: c.mute }]}>{' ' + r.note}</Text>}
          {r.auto ? ' 🔁' : ''}
        </Text>
      </View>
      <View style={st.right}>
        <Text style={[st.amt, { color: r.income ? c.accent : minus }]}>{r.amount}</Text>
        {/* the HTML has a space between the amount and the buttons (≈ 4.45 px at 16 px Inter) */}
        <Ghost title="✎" onPress={onEdit} style={[st.icon, { marginLeft: 6 + 4.45 }]} />
        <Ghost title="✕" onPress={onDelete} style={st.icon} />
      </View>
    </View>
  );
}

export function Transactions() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const [f, setF] = useState<TxFilter>('all');
  const [edit, setEdit] = useState<{ list: 'exp' | 'ins'; i: number } | null>(null);
  const rows = transactions(state, f);
  const del = (ref: { list: 'exp' | 'ins'; i: number }) => update((s) => (ref.list === 'exp' ? deleteExpense(s, ref.i) : deleteIncome(s, ref.i)));
  return (
    <>
      <Fold id="tx" title="All transactions" defaultOpen>
        <View style={st.flt}>
          {FILTERS.map(([k, label]) => {
            const on = f === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setF(k)}
                style={[st.fb, { borderColor: on ? 'transparent' : c.line, backgroundColor: on ? c.accent : 'transparent' }]}
              >
                <Text style={[st.fbT, { color: on ? '#03130a' : c.ink }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View>
          {rows.length ? (
            rows.map((r) =>
              r.kind === 'date' ? (
                <Text key={r.key} style={[st.dh, { color: c.mute }]}>
                  {r.text}
                </Text>
              ) : (
                <Row key={r.key} r={r} onEdit={() => setEdit(r.ref)} onDelete={() => del(r.ref)} />
              ),
            )
          ) : (
            <Small style={{ marginTop: 6.8, marginBottom: 12.8 }}>{TX_EMPTY}</Small>
          )}
        </View>
      </Fold>
      <EditSheet target={edit} onClose={() => setEdit(null)} />
    </>
  );
}

const st = StyleSheet.create({
  flt: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  fb: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  fbT: { fontFamily: inter[700], fontSize: 13.6, lineHeight: 19.72 },
  dh: { paddingTop: 14, paddingBottom: 2, fontFamily: inter[700], fontSize: 11.52, lineHeight: 16.704, letterSpacing: 0.9216 },
  li: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  left: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  t16: { fontFamily: inter[400], fontSize: 16, lineHeight: 23.2 },
  small: { fontFamily: inter[400], fontSize: 12.8 },
  amt: { fontFamily: inter[700], fontSize: 16, lineHeight: 23.2, fontVariant: ['tabular-nums'] },
  icon: { marginLeft: 6, paddingVertical: 4, paddingHorizontal: 9 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingTop: 20, paddingHorizontal: 18 },
  // h3 margin-bottom 4 collapses into the label's margin-top 10
  h3: { fontFamily: inter[700], fontSize: 17.6, lineHeight: 25.52 },
  label: { marginTop: 10, marginBottom: 4, fontFamily: inter[400], fontSize: 13.6, lineHeight: 19.72 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
