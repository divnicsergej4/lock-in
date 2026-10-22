// "Can I afford this?" (prototype section[data-fold=buy]): a foldable amber card. Name + price → the
// verdict from docs/FORE.md and what the purchase does to free money, fixed costs and goals.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AFFORD_NO_PRICE, canIAfford } from '@/logic/afford';
import { parseAmount } from '@/logic/format';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

import { Button, Field, Fold, Small } from './Section';

export function AffordFold() {
  const { state } = useStore();
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [out, setOut] = useState<{ verdict: string; lines: string[] } | null>(null);
  const [noPrice, setNoPrice] = useState(false);

  const check = () => {
    const p = parseAmount(price);
    if (!(p > 0)) {
      setOut(null);
      setNoPrice(true);
      return;
    }
    setNoPrice(false);
    setOut(canIAfford(state, p, name, Date.now()));
  };

  return (
    <Fold id="buy" title="Can I afford this?" kind="amber">
      <View style={st.row}>
        <Field value={name} onChangeText={setName} placeholder="Guitar" accessibilityLabel="What are you buying" style={st.half} />
        <Field value={price} onChangeText={setPrice} placeholder="Price" keyboardType="decimal-pad" accessibilityLabel="Price" style={st.half} />
      </View>
      <Button title="Check" onPress={check} />
      <View style={{ marginTop: 10 }}>
        {noPrice && <Small style={{ marginTop: 2.8, marginBottom: 12.8 }}>{AFFORD_NO_PRICE}</Small>}
        {out && (
          <View style={[st.tip, { backgroundColor: c.tipBg, borderColor: c.line }]}>
            <Text style={[st.tipT, { color: c.ink }]}>
              <Text style={{ fontFamily: inter[700] }}>{out.verdict}</Text>
              {out.lines.map((l) => '\n' + l).join('')}
            </Text>
          </View>
        )}
      </View>
    </Fold>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1, flexBasis: 0, minWidth: 0 },
  tip: { padding: 12, borderWidth: 1, borderRadius: 14 },
  tipT: { fontFamily: inter[400], fontSize: 14.72, lineHeight: 21.344 },
});
