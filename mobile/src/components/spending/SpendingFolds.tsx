// Spending tab sections below "All transactions": category limits, recurring entries, subscriptions and
// "We noticed" (prototype section[data-fold=lim|rec|subs|pat]).

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppToast } from '@/components/AppToast';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button, Field, Fold, Ghost, Small } from '@/components/home/Section';
import { Select } from '@/components/onboarding/Select';
import { allCategories, categoryColor } from '@/logic/categories';
import { fmt, ordinal } from '@/logic/format';
import { PATTERNS_EMPTY, patterns } from '@/logic/insights';
import { LIMITS_EMPTY, LIMITS_HINT, limitRows, setLimit } from '@/logic/limits';
import { addRecurring, deleteRecurring, DONT_USE_IT, dropSubscription, RECURRING_EMPTY, RECURRING_IN_CATEGORIES, RECURRING_OUT_CATEGORIES, recurringList, subscriptions } from '@/logic/recurring';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

function useLook() {
  const { c } = useTheme();
  return { bg: c.inputBg, border: c.line, ink: c.ink, mute: c.mute, sheet: c.card, font: inter[400] };
}
const half = { flex: 1, flexBasis: 0, minWidth: 0 } as const;

export function LimitsFold() {
  const { state, update } = useStore();
  const { c, name } = useTheme();
  const toast = useAppToast();
  const look = useLook();
  const cats = allCategories(state);
  const [cat, setCat] = useState(cats[0]);
  const [amt, setAmt] = useState('');
  const rows = limitRows(state, Date.now());
  const minus = name === 'light' ? '#d93a3a' : '#ff7b7b';
  const go = () => {
    const r = setLimit(state, cat, amt);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    setAmt('');
    toast(r.toast);
  };
  return (
    <Fold id="lim" title="Category limits" tourId="lim">
      <View style={st.row}>
        <Select label="Category" value={cat} onChange={setCat} options={cats.map((v) => ({ value: v, label: v }))} look={look} style={{ ...half, height: 47.2 }} />
        <Field value={amt} onChangeText={setAmt} placeholder="Monthly limit" keyboardType="decimal-pad" accessibilityLabel="Limit" style={half} />
      </View>
      <Button title="Set limit" onPress={go} />
      {/* CSS collapses the vertical margins here: 10 above the list absorbs the first bar's 8,
          bars sit 8 apart, and the hint's 12.8 absorbs the last bar's 8 */}
      <View style={{ marginTop: 10 }}>
        {rows.length ? (
          <>
            {rows.map((r, i) => (
              <View key={r.cat} style={{ marginTop: i ? 8 : 0 }}>
                <View style={st.barT}>
                  <View style={st.barL}>
                    <CategoryIcon cat={r.cat} color={categoryColor(state, r.cat)} mix={c.iconMix} style={{ marginRight: 4 }} />
                    <Text style={[st.t14, { color: c.ink }]}>{r.cat}</Text>
                  </View>
                  <Text style={[st.t14, { fontFamily: inter[700], color: r.over ? minus : c.ink }]}>{fmt(r.spent) + ' / ' + fmt(r.limit)}</Text>
                </View>
                <View style={[st.track, { backgroundColor: c.line }]}>
                  <View style={{ height: '100%', width: Math.min(r.pct, 100) + '%', backgroundColor: r.over ? '#ff6b6b' : r.near ? '#f0b35a' : c.accent }} />
                </View>
              </View>
            ))}
            <Small style={{ marginVertical: 12.8 }}>{LIMITS_HINT}</Small>
          </>
        ) : (
          <Small style={{ marginTop: 2.8, marginBottom: 12.8 }}>{LIMITS_EMPTY}</Small>
        )}
      </View>
    </Fold>
  );
}

export function RecurringFold() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const toast = useAppToast();
  const look = useLook();
  const [kind, setKind] = useState<'o' | 'i'>('o');
  const catOptions = kind === 'o' ? RECURRING_OUT_CATEGORIES : RECURRING_IN_CATEGORIES;
  const [cat, setCat] = useState(catOptions[0]);
  const [amt, setAmt] = useState('');
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const list = recurringList(state);
  const go = () => {
    const r = addRecurring(state, { kind, amount: amt, day, note, cat }, Date.now());
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    setAmt('');
    setDay('');
    setNote('');
    toast(r.toast);
  };
  return (
    <Fold id="rec" title="Recurring entries" kind="teal" tourId="rec">
      <Small style={{ marginTop: -4, marginBottom: 8 }}>Rent, bills, salary... logged automatically every month.</Small>
      <View>
        <View style={st.row}>
          <Select
            label="Type of entry"
            value={kind}
            onChange={(v) => {
              setKind(v as 'o' | 'i');
              setCat((v === 'o' ? RECURRING_OUT_CATEGORIES : RECURRING_IN_CATEGORIES)[0]);
            }}
            options={[
              { value: 'o', label: 'Expense' },
              { value: 'i', label: 'Income' },
            ]}
            look={look}
            style={{ ...half, height: 47.2 }}
          />
          <Field value={amt} onChangeText={setAmt} placeholder="Amount" keyboardType="decimal-pad" accessibilityLabel="Amount" style={half} />
        </View>
        <View style={[st.row, { marginTop: 8 }]}>
          <Select label="Category" value={cat} onChange={setCat} options={catOptions.map((v) => ({ value: v, label: v }))} look={look} style={{ ...half, height: 47.2 }} />
          <Field value={day} onChangeText={setDay} placeholder="Day of month (1-31)" keyboardType="number-pad" accessibilityLabel="Day of month" style={half} />
        </View>
        <Field value={note} onChangeText={setNote} placeholder="Description (required), e.g. rent" accessibilityLabel="Description" style={{ marginTop: 8 }} />
      </View>
      <Button title="Add recurring entry" onPress={go} />
      <View style={{ marginTop: 10 }}>
        {list.length ? (
          list.map((r) => {
            const n = state.rec[r.i].day;
            return (
              <View key={r.i} style={[st.rli, { borderBottomColor: c.line }]}>
                <View style={[st.rdb, { borderColor: c.line }]}>
                  <Text style={[st.t16, { fontFamily: inter[700], color: c.ink }]}>{n}</Text>
                  <Text style={[st.suffix, { color: c.mute }]}>{r.day.slice(String(n).length)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[st.t16, { fontFamily: inter[600], color: c.ink }]} numberOfLines={1}>
                    {r.note}
                  </Text>
                  <Small>{r.cat}</Small>
                </View>
                <Text style={[st.t16, { fontFamily: inter[700], color: r.income ? c.accent : c.ink }]}>{r.amount}</Text>
                <Ghost title="✕" onPress={() => update((s) => deleteRecurring(s, r.i))} style={{ marginLeft: 8, paddingVertical: 4, paddingHorizontal: 9 }} />
              </View>
            );
          })
        ) : (
          <Small style={{ marginTop: 2.8, marginBottom: 12.8 }}>{RECURRING_EMPTY}</Small>
        )}
      </View>
    </Fold>
  );
}

export function SubscriptionsFold() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const toast = useAppToast();
  const sub = subscriptions(state);
  return (
    <Fold id="subs" title="Subscriptions" kind="rose" tourId="subs">
      {sub.list.length ? (
        <View>
          <View>
            {sub.list.map((q) => (
              <View key={q.source.kind + q.source.i} style={[st.sli, { borderBottomColor: c.line }]}>
                <Text style={[st.t16, { color: c.ink, flexShrink: 1 }]}>
                  <Text style={{ fontFamily: inter[700] }}>{q.name}</Text>
                  <Text style={[st.small, { color: c.mute }]}>{' ' + q.line}</Text>
                </Text>
                <Ghost
                  title={DONT_USE_IT}
                  onPress={() => {
                    const r = dropSubscription(state, q);
                    update(() => r.state);
                    if (r.toast) toast(r.toast);
                  }}
                  style={{ flexShrink: 1 }}
                />
              </View>
            ))}
          </View>
          <Text style={[st.t16, { color: c.ink, marginVertical: 16 }]}>{sub.summary}</Text>
        </View>
      ) : (
        // p.small right under the title: its 12.8 px margin absorbs the title's 12
        <Small style={{ marginTop: 0.8, marginBottom: 12.8 }}>{sub.summary}</Small>
      )}
    </Fold>
  );
}

export function PatternsFold() {
  const { state } = useStore();
  const { c } = useTheme();
  const list = patterns(state, Date.now());
  return (
    <Fold id="pat" title="We noticed" tourId="pat">
      {list.length ? (
        <View>
          {list.map((t) => (
            <View key={t} style={[st.tip, { backgroundColor: c.tipBg, borderColor: c.line }]}>
              <Text style={[st.tipT, { color: c.ink }]}>{t}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Small style={{ marginTop: 0.8, marginBottom: 12.8 }}>{PATTERNS_EMPTY}</Small>
      )}
    </Fold>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  barT: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barL: { flexDirection: 'row', alignItems: 'center' },
  t14: { fontFamily: inter[400], fontSize: 14.4, lineHeight: 20.88 },
  track: { height: 10, borderRadius: 6, marginTop: 3, overflow: 'hidden' },
  t16: { fontFamily: inter[400], fontSize: 16, lineHeight: 23.2 },
  small: { fontFamily: inter[400], fontSize: 12.8 },
  suffix: { marginLeft: 1, marginTop: 9, alignSelf: 'flex-start', fontFamily: inter[400], fontSize: 9.6, lineHeight: 13.92 },
  rli: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  rdb: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(127,127,127,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  sli: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  tip: { marginBottom: 8, padding: 12, borderWidth: 1, borderRadius: 14 },
  tipT: { fontFamily: inter[400], fontSize: 14.72, lineHeight: 21.344 },
});
