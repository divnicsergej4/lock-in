// "Start in 10 seconds" (prototype #hero0 + #setup): money, currency (+ second currency), monthly
// income, savings goal and age (optional, just for info).

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { KeyboardSpace, useScrollFieldInView } from '@/components/keyboard';
import { CURRENCIES, currencyLabel, type SetupInput } from '@/logic/setup';
import { brico } from '@/theme';

import { Enter } from './Enter';
import { Select } from './Select';

const CUR_OPTIONS = CURRENCIES.map(([c]) => ({ value: c, label: currencyLabel(c) }));

function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor="#757575" autoComplete="off" autoCorrect={false} {...props} style={[st.input, props.style]} />;
}

export function SetupScreen({ onStart }: { onStart: (input: SetupInput) => void }) {
  const insets = useSafeAreaInsets();
  const [v, setV] = useState<SetupInput>({ amount: '', cur: 'EUR', cur2: '', amount2: '', income: '', save: '', age: '' });
  const [more, setMore] = useState(false);
  const set = (k: keyof SetupInput) => (t: string) => setV((x) => ({ ...x, [k]: t }));
  const kb = useScrollFieldInView(insets.top);
  return (
    <ScrollView ref={kb.ref} onScroll={kb.onScroll} style={{ flex: 1, backgroundColor: '#f4f8f5' }} contentContainerStyle={{ paddingBottom: 14 + insets.bottom }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Enter kind="pop" delay={0} style={[st.hero, { paddingTop: 20 + insets.top }]}>
        <Text style={st.h1}>Lock In 🗿</Text>
        <Text style={st.sub}>The money tracker that calls you out when you spend like cash grows on trees.</Text>
      </Enter>
      <Enter kind="pop" delay={90} style={st.card}>
        <Text style={st.h2}>Start in 10 seconds</Text>
        <View style={st.row}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>How much money do you have</Text>
            <Field value={v.amount} onChangeText={set('amount')} placeholder="1500" keyboardType="decimal-pad" accessibilityLabel="How much money do you have" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Currency</Text>
            <Select label="Currency" value={v.cur} options={CUR_OPTIONS} onChange={set('cur')} />
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore((m) => !m)} style={st.summary}>
          <Svg width={10} height={10} viewBox="0 0 10 10" style={{ transform: [{ rotate: more ? '90deg' : '0deg' }] }}>
            <Path d="M1.5 0.5 9 5 1.5 9.5Z" fill="#5d7466" />
          </Svg>
          <Text style={st.summaryT}>I also keep a second currency</Text>
        </Pressable>
        {more && (
          <View style={[st.row, { marginTop: 8 }]}>
            <Select
              label="Second currency"
              value={v.cur2 || ''}
              options={[{ value: '', label: 'No second currency' }, ...CUR_OPTIONS]}
              onChange={set('cur2')}
              style={{ flex: 1, flexBasis: 0, minWidth: 0, height: 47.2 }}
            />
            <Field value={v.amount2} onChangeText={set('amount2')} placeholder="Balance" keyboardType="decimal-pad" style={{ flex: 1, flexBasis: 0, minWidth: 0 }} accessibilityLabel="How much you have in the second currency" />
          </View>
        )}

        <Text style={st.label}>Total monthly income (optional)</Text>
        <Field value={v.income} onChangeText={set('income')} placeholder="900" keyboardType="decimal-pad" />
        <Text style={st.label}>How much do you want to save monthly</Text>
        <Field value={v.save} onChangeText={set('save')} placeholder="200" keyboardType="decimal-pad" />
        <Text style={st.label}>How old are you? (optional, just for info)</Text>
        <Field value={v.age} onChangeText={set('age')} placeholder="21" keyboardType="number-pad" maxLength={3} />

        <Pressable accessibilityRole="button" onPress={() => onStart(v)} style={({ pressed }) => [st.go, pressed && { opacity: 0.85 }]}>
          <Text style={st.goT}>Start</Text>
        </Pressable>
        <Text style={st.trk}>🔒 Amounts, descriptions and categories stay on your phone only, except shared goals, which sync with the people you share them with.</Text>
      </Enter>
      <KeyboardSpace />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 12, marginBottom: 6 },
  h1: { fontFamily: brico[800], fontSize: 32, lineHeight: 46.4, letterSpacing: -0.96, color: '#0b8f49' },
  sub: { marginTop: 4, fontFamily: brico[400], fontSize: 14.72, lineHeight: 21.344, color: '#5d7466' },
  card: { marginHorizontal: 16, padding: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe7df', borderRadius: 20 },
  h2: { marginBottom: 10, fontFamily: brico[700], fontSize: 17.6, lineHeight: 25.52, color: '#0d1f15' },
  row: { flexDirection: 'row', gap: 8 },
  label: { marginTop: 10, marginBottom: 4, fontFamily: brico[400], fontSize: 13.6, lineHeight: 19.72, color: '#5d7466' },
  input: {
    height: 47.2,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontFamily: brico[400],
    fontSize: 16,
    color: '#0d1f15',
    backgroundColor: '#f3f7f4',
    borderWidth: 1,
    borderColor: '#dbe7df',
    borderRadius: 12,
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }, // details 6 + summary 10, collapsed
  summaryT: { fontFamily: brico[400], fontSize: 14.08, lineHeight: 20.416, color: '#5d7466' },
  go: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#12b85f' },
  goT: { fontFamily: brico[700], fontSize: 16, lineHeight: 23.2, color: '#03130a', textAlign: 'center' },
  trk: { marginTop: 10, fontFamily: brico[400], fontSize: 12.8, lineHeight: 17.92, color: '#5d7466' },
});
