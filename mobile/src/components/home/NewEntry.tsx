// "New entry" (prototype #sheet): expense / income switch, amount, required description, category chips
// with icons, "More options" (own category, monthly subscription, paid from an envelope), and the
// button. After an expense the roast from docs/FORE.md shows as a toast.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppToast } from '@/components/AppToast';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Enter } from '@/components/onboarding/Enter';
import { Select } from '@/components/onboarding/Select';
import { allCategories, categoryColor } from '@/logic/categories';
import { addExpense, addIncome } from '@/logic/entries';
import { fmt } from '@/logic/format';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

import { Button, Field, Ghost, H2, Section, Small, SummaryMarker } from './Section';

const INCOME_CHIPS: [string, string][] = [
  ['Salary', '#22e07a'],
  ['Gift', '#ff7eb6'],
];

export function NewEntry() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const toast = useAppToast();
  const [mode, setMode] = useState<'o' | 'i'>('o');
  const [second, setSecond] = useState(false); // amount typed in the second currency
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [cat, setCat] = useState('');
  const [itype, setItype] = useState('');
  const [more, setMore] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [sub, setSub] = useState(false);
  const [envId, setEnvId] = useState('');
  const [err, setErr] = useState('');
  const [chipsKey, setChipsKey] = useState(0); // replays the chips' pop-in after a mode switch

  const income = mode === 'i';
  const switchMode = (m: 'o' | 'i') => {
    setMode(m);
    setErr('');
    setChipsKey((k) => k + 1);
  };

  /** Picking a category fills an empty amount with the last amount spent on it (prototype lastAmt). */
  const pick = (k: string) => {
    setCat(k);
    if (amt) return;
    for (let j = state.exp.length - 1; j >= 0; j--)
      if (state.exp[j].cat === k) {
        setAmt(String(state.exp[j].amt));
        return;
      }
  };

  const addCategory = () => {
    const v = newCat.trim();
    if (!v) return;
    if (!allCategories(state).includes(v)) update((s) => ({ ...s, cats: [...s.cats, v] }));
    setCat(v);
    setNewCat('');
  };

  const submit = () => {
    const now = Date.now();
    if (income) {
      const r = addIncome(state, { amount: amt, type: itype, note, inSecond: second }, now);
      if (!r.ok) return toast(r.error);
      update(() => r.state);
      toast(r.toast);
      setAmt('');
      setNote('');
      setItype('');
      switchMode('o');
      return;
    }
    setErr('');
    const r = addExpense(state, { amount: amt, cat, note, sub, envId, inSecond: second }, now);
    if (!r.ok) return setErr(r.error);
    update(() => r.state);
    toast(r.toast);
    setAmt('');
    setNote('');
    setCat('');
    setSub(false);
    setEnvId('');
  };

  const look = { bg: c.inputBg, border: c.line, ink: c.ink, mute: c.mute, sheet: c.card, font: inter[400] };

  return (
    <Section>
      <H2>New entry</H2>
      <View style={[st.mode]}>
        {(['o', 'i'] as const).map((m) => {
          const on = mode === m;
          return (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => switchMode(m)}
              style={[st.mb, on && { backgroundColor: c.card, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }]}
            >
              <Text style={[st.mbT, { color: on ? (m === 'i' ? c.accent : c.ink) : c.mute }]}>{m === 'o' ? '− Expense' : '+ Income'}</Text>
            </Pressable>
          );
        })}
      </View>

      {!!state.cur2 && (
        <View style={st.cs}>
          {[false, true].map((sec) => {
            const on = second === sec;
            return (
              <Pressable
                key={String(sec)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSecond(sec)}
                style={[st.cb, { borderColor: on ? 'transparent' : c.line, backgroundColor: on ? c.accent : 'transparent' }]}
              >
                <Text style={[st.cbT, { color: on ? '#03130a' : c.ink }]}>{sec ? state.cur2 : state.cur}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={[st.amtl, { color: c.mute }]}>Amount</Text>
      <TextInput
        value={amt}
        onChangeText={setAmt}
        placeholder="0"
        placeholderTextColor={c.placeholder}
        keyboardType="decimal-pad"
        accessibilityLabel="Amount"
        style={[st.amt, { color: c.ink, backgroundColor: c.amtBg, borderColor: c.line }]}
      />
      <Field
        value={note}
        onChangeText={setNote}
        placeholder={income ? 'Description (required), e.g. salary' : 'Description (required), e.g. lunch with a friend'}
        accessibilityLabel="Description"
        style={st.note}
      />

      <View style={st.chips}>
        {(income ? INCOME_CHIPS : allCategories(state).map((k) => [k, categoryColor(state, k)] as [string, string])).map(([k, col], i) => {
          const on = income ? itype === k : cat === k;
          return (
            <Enter key={chipsKey + ':' + k} kind="pop" delay={i * (income ? 40 : 20)}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => (income ? setItype(k) : pick(k))}
                style={[st.chip, { backgroundColor: on ? c.chipOn : c.chipBg, borderColor: on ? c.accent : c.line }]}
              >
                <CategoryIcon cat={k} color={col} mix={c.iconMix} style={{ marginRight: 4 }} />
                <Text style={[st.chipT, { color: c.ink }]}>{k}</Text>
              </Pressable>
            </Enter>
          );
        })}
      </View>

      {!income && (
        <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore((m) => !m)} style={st.summary}>
            <SummaryMarker open={more} color={c.mute} />
            <Text style={[st.summaryT, { color: c.mute }]}>More options</Text>
          </Pressable>
          {more && (
            <>
              <View style={st.row}>
                <Field value={newCat} onChangeText={setNewCat} placeholder="New category" accessibilityLabel="New category" style={{ flex: 1, flexBasis: 0, minWidth: 0 }} />
                <Ghost title="Add" onPress={addCategory} />
              </View>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: sub }} onPress={() => setSub((v) => !v)} style={st.check}>
                <View style={[st.box, { borderColor: sub ? c.accent : c.mute, backgroundColor: sub ? c.accent : c.inputBg }]}>
                  {sub && <Text style={st.tick}>✓</Text>}
                </View>
                <Text style={[st.checkT, { color: c.ink }]}>Monthly subscription</Text>
              </Pressable>
              {state.env.length > 0 && (
                <>
                  <Text style={[st.label, { color: c.mute }]}>Paid from envelope</Text>
                  <Select
                    label="Paid from envelope"
                    value={envId}
                    onChange={setEnvId}
                    look={look}
                    style={{ height: 47.2 }}
                    options={[{ value: '', label: 'No, from free money' }, ...state.env.map((e) => ({ value: e.id, label: e.n + ' (' + fmt(e.b) + ')' }))]}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      <Button title={income ? 'Log income' : 'Log expense'} onPress={submit} />
      {!!err && <Small style={{ color: c.err }}>{err}</Small>}
    </Section>
  );
}

const st = StyleSheet.create({
  mode: { flexDirection: 'row', gap: 6, padding: 4, marginBottom: 10, borderRadius: 14, backgroundColor: 'rgba(127,127,127,0.12)' },
  mb: { flex: 1, padding: 10, borderRadius: 10 },
  mbT: { fontFamily: inter[700], fontSize: 16, lineHeight: 23.2, textAlign: 'center' },
  cs: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 6 },
  cb: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  cbT: { fontFamily: inter[700], fontSize: 12.8, lineHeight: 18.56 },
  // margin-top 4 collapses into the switch's 10 px margin above it
  amtl: { marginTop: 0, marginBottom: 6, fontFamily: inter[400], fontSize: 13.6, lineHeight: 19.72, textAlign: 'center' },
  amt: { height: 82.3, padding: 10, marginBottom: 4, borderWidth: 1, borderRadius: 16, fontFamily: inter[800], fontSize: 41.6, textAlign: 'center' },
  note: { marginTop: 4, marginBottom: 10, borderRadius: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2, paddingBottom: 8 },
  chip: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 6, paddingRight: 11, borderWidth: 1, borderRadius: 16 },
  chipT: { fontFamily: inter[600], fontSize: 13.6, lineHeight: 19.72 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  summaryT: { fontFamily: inter[400], fontSize: 14.08, lineHeight: 20.416 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 4 },
  box: { width: 13, height: 13, marginLeft: 4, marginVertical: 3, borderWidth: 1, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#03130a', fontSize: 9, lineHeight: 11, fontWeight: '900' },
  checkT: { fontFamily: inter[400], fontSize: 13.6, lineHeight: 19.72 },
  label: { marginTop: 10, marginBottom: 4, fontFamily: inter[400], fontSize: 13.6, lineHeight: 19.72 },
});
