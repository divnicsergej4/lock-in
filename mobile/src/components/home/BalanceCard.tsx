// "Available" card (prototype section.bal-card): balance minus envelopes, the second currency, and
// how much of the account sits in envelopes.

import { StyleSheet, Text, View } from 'react-native';

import { fmt } from '@/logic/format';
import { accountLine, convert, freeBalance, secondBalance } from '@/logic/money';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

import { Section, Small } from './Section';

export function BalanceCard() {
  const { state } = useStore();
  const { c } = useTheme();
  const env = accountLine(state);
  const b2 = state.cur2 ? secondBalance(state) : 0;
  return (
    <Section tourId="bal-card">
      <Small>Available</Small>
      <Text style={[st.bal, { color: c.ink }]}>
        {fmt(freeBalance(state))} <Text style={[st.cur, { color: c.mute }]}>{state.cur}</Text>
      </Text>
      {!!state.cur2 && (
        <Text style={[st.b2l, { color: c.ink }]}>
          {'+ ' + fmt(b2) + ' ' + state.cur2 + ' '}
          <Text style={[st.small, { color: c.mute }]}>{'≈ ' + fmt(convert(state, b2)) + ' ' + state.cur}</Text>
        </Text>
      )}
      {/* #envl always has margin-top 4px; when #bal2 is empty its margin collapses into this one */}
      <View style={{ marginTop: 4 }}>{!!env && <Small>{env}</Small>}</View>
    </Section>
  );
}

const st = StyleSheet.create({
  bal: { fontFamily: inter[800], fontSize: 48, lineHeight: 48, letterSpacing: -1.44, fontVariant: ['tabular-nums'] },
  cur: { fontFamily: inter[600], fontSize: 16, lineHeight: 16 },
  b2l: { marginTop: 4, fontFamily: inter[700], fontSize: 20, lineHeight: 29, fontVariant: ['tabular-nums'] },
  small: { fontFamily: inter[400], fontSize: 12.8 },
});
