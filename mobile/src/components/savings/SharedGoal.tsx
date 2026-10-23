// "Shared goal" (prototype section[data-fold=team], gold): what saving together looks like, with a
// sample goal, and the button that will start sign-in. Accounts are not there yet, so it says so.

import { StyleSheet, Text, View } from 'react-native';

import { useAppToast } from '@/components/AppToast';
import { Button, Fold, Small } from '@/components/home/Section';
import { inter, useTheme } from '@/theme';

const PEOPLE: [string, string][] = [
  ['S', '#22e07a'],
  ['M', '#5aa9f0'],
  ['A', '#ff7eb6'],
];

export function SharedGoal() {
  const { c } = useTheme();
  const toast = useAppToast();
  return (
    <Fold id="team" title="Shared goal" kind="pro" defaultOpen>
      <Small style={{ marginTop: 0.8 }}>
        Save together with friends or your partner: for a trip, a gift or a place. Everyone logs what they put in, and everyone sees how much is left.
      </Small>
      {/* .tmd: the sample goal (margins collapse with the text above: 12.8) */}
      <View style={st.tmd}>
        <View style={st.tmh}>
          <Text style={[st.b, { color: c.ink }]}>Summer trip to Greece</Text>
          <View style={st.tav}>
            {PEOPLE.map(([l, bg]) => (
              <View key={l} style={[st.av, { backgroundColor: bg, borderColor: c.card }]}>
                <Text style={st.avT}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={st.bar}>
          <View style={st.barT}>
            <Text style={[st.t14, { color: c.ink }]}>1,240 / 2,000 €</Text>
            <Text style={[st.t14, { color: c.ink, fontFamily: inter[700] }]}>62%</Text>
          </View>
          <View style={[st.track, { backgroundColor: c.line }]}>
            <View style={{ width: '62%', height: '100%', backgroundColor: c.accent }} />
          </View>
        </View>
        <View style={st.tmr}>
          {['Sergej put in 520 €', 'Marko 400 €', 'Ana 320 €'].map((t) => (
            <Text key={t} style={[st.tmrT, { color: c.mute }]}>
              {t}
            </Text>
          ))}
        </View>
      </View>
      <Button
        title="Sign in to get started"
        onPress={() => toast('Accounts are coming soon. For now this is a preview.')}
        style={{ backgroundColor: '#f5c84b' }}
        textStyle={{ color: '#1a1000' }}
      />
    </Fold>
  );
}

const st = StyleSheet.create({
  tmd: { marginTop: 12.8, marginBottom: 4, padding: 14, borderRadius: 14, backgroundColor: 'rgba(127,127,127,0.08)' },
  tmh: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  b: { flexShrink: 1, fontFamily: inter[700], fontSize: 16, lineHeight: 23.2 },
  tav: { flexDirection: 'row' },
  av: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, marginLeft: -6, alignItems: 'center', justifyContent: 'center' },
  avT: { fontFamily: inter[800], fontSize: 11.52, lineHeight: 16.7, color: '#04140a' },
  bar: { marginVertical: 8 },
  barT: { flexDirection: 'row', justifyContent: 'space-between' },
  t14: { fontFamily: inter[400], fontSize: 14.4, lineHeight: 20.88 },
  track: { height: 10, borderRadius: 6, marginTop: 3, overflow: 'hidden' },
  tmr: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 14 },
  tmrT: { fontFamily: inter[400], fontSize: 12.48, lineHeight: 18.1 },
});
