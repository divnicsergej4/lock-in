// "Monthly plan" (prototype section[data-fold=plan], teal): planned spending per category with what
// was spent on it, a monthly savings goal, and how much is left to spend.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppToast } from '@/components/AppToast';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button, Field, Fold, Ghost, Small } from '@/components/home/Section';
import { Select } from '@/components/onboarding/Select';
import { allCategories, categoryColor } from '@/logic/categories';
import { fmt } from '@/logic/format';
import { planRows, planText, removePlanItem, setPlanItem, setPlanSave } from '@/logic/plan';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

const half = { flex: 1, flexBasis: 0, minWidth: 0 } as const;

export function PlanFold() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const toast = useAppToast();
  const cats = allCategories(state);
  const [cat, setCat] = useState(cats[0]);
  const [amt, setAmt] = useState('');
  const [save, setSave] = useState('');
  const now = Date.now();
  const rows = planRows(state, now);
  const out = planText(state, now);
  const look = { bg: c.inputBg, border: c.line, ink: c.ink, mute: c.mute, sheet: c.card, font: inter[400] };

  // the field shows the saved goal until the user types (prototype: filled in when empty)
  const saved = state.plan && state.plan.save;
  useEffect(() => {
    if (saved) setSave((v) => v || String(saved));
  }, [saved]);

  const add = () => {
    const r = setPlanItem(state, cat, amt);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    setAmt('');
  };
  const saveGoal = () => {
    const r = setPlanSave(state, save);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    toast(r.toast);
  };

  return (
    <Fold id="plan" title="Monthly plan" kind="teal" defaultOpen>
      <Small style={{ marginTop: -4, marginBottom: 8 }}>
        Enter planned expenses (rent, bills, food...) and how much you want to save, and see how much you can spend.
      </Small>
      <View style={st.row}>
        <Select label="Category" value={cat} onChange={setCat} options={cats.map((v) => ({ value: v, label: v }))} look={look} style={{ ...half, height: 47.2 }} />
        <Field value={amt} onChangeText={setAmt} placeholder="Amount" keyboardType="decimal-pad" accessibilityLabel="Planned amount" style={half} />
      </View>
      <Ghost title="+ Add planned expense" onPress={add} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      {/* #p-list (margin-top 8) and its .bar rows (margin 8 0): all these margins collapse to 8 */}
      <View style={{ marginTop: 8 }}>
        {rows.map((r, i) => (
          <View key={r.cat} style={{ marginTop: i ? 8 : 0 }}>
            <View style={st.barT}>
              {/* in the prototype the name sits 1.1 px higher than the amount (inline icon vs inline button) */}
              <View style={[st.barL, { top: -1.1 }]}>
                <CategoryIcon cat={r.cat} color={categoryColor(state, r.cat)} mix={c.iconMix} style={{ marginRight: 4 }} />
                <Text style={[st.t14, { color: c.ink }]}>{r.cat}</Text>
              </View>
              <View style={st.barL}>
                <Text style={[st.t14, { color: c.ink, fontFamily: inter[700] }]}>{fmt(r.spent) + ' / ' + fmt(r.planned)}</Text>
                <Ghost
                  title="✕"
                  onPress={() => update((s) => removePlanItem(s, r.cat))}
                  style={{ marginLeft: 6 + 4, paddingVertical: 2, paddingHorizontal: 8 }}
                  textStyle={{ fontSize: 14.4, lineHeight: 20.88 }}
                />
              </View>
            </View>
            <View style={[st.track, { backgroundColor: c.line }]}>
              <View style={{ height: '100%', width: Math.min(r.pct, 100) + '%', backgroundColor: r.over ? '#ff6b6b' : c.accent }} />
            </View>
          </View>
        ))}
      </View>
      <Text style={[st.label, { color: c.mute, marginTop: rows.length ? 10 : 10 }]}>How much do you want to save monthly</Text>
      <View style={[st.row, { alignItems: 'stretch' }]}>
        <Field value={save} onChangeText={setSave} placeholder="200" keyboardType="decimal-pad" accessibilityLabel="How much do you want to save monthly" style={half} />
        <Button title="Save" onPress={saveGoal} style={{ marginTop: 0 }} />
      </View>
      <View style={{ marginTop: 12 }}>
        {out.status === 'no-income' || out.status === 'empty' ? (
          <Small style={{ marginTop: 12.8, marginBottom: 12.8 }}>{out.lines[0]}</Small>
        ) : (
          <PlanTip status={out.status} lines={out.lines} />
        )}
      </View>
    </Fold>
  );
}

/** The calculation (.tip): the free amount in bold, the last line green, or red when the plan fails. */
function PlanTip({ status, lines }: { status: string; lines: string[] }) {
  const { c, name } = useTheme();
  const [l1, l2, l3] = lines;
  const eq = l1.lastIndexOf(' = ');
  const free = l1.slice(eq + 3, l1.indexOf(' free this month.'));
  const ok = status === 'ok';
  const cut = ok ? l3.indexOf(' (about') : -1;
  return (
    <View style={[st.tip, { backgroundColor: name === 'light' ? '#f3f6f4' : c.tipBg, borderColor: c.line }]}>
      <Text style={[st.tipT, { color: c.ink }]}>
        {l1.slice(0, eq + 3)}
        <Text style={{ fontFamily: inter[700] }}>{free}</Text>
        {' free this month.\n' + l2 + '\n'}
        {ok ? (
          <>
            <Text style={{ fontFamily: inter[700], color: c.accent }}>{l3.slice(0, cut)}</Text>
            {l3.slice(cut)}
          </>
        ) : (
          <Text style={{ fontFamily: inter[700], color: '#ff8a8a' }}>{l3}</Text>
        )}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  barT: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barL: { flexDirection: 'row', alignItems: 'center' },
  t14: { fontFamily: inter[400], fontSize: 14.4, lineHeight: 20.88 },
  track: { height: 10, borderRadius: 6, marginTop: 3, overflow: 'hidden' },
  label: { marginBottom: 4, fontFamily: inter[400], fontSize: 13.6, lineHeight: 19.72 },
  tip: { padding: 12, borderWidth: 1, borderRadius: 14 },
  tipT: { fontFamily: inter[400], fontSize: 14.72, lineHeight: 21.344 },
});
