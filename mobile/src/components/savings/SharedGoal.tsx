// "Shared goal" (prototype section[data-fold=team], gold): what saving together looks like, with a
// sample goal, and the button that opens sign-in. The shared goal itself does not sync yet.

import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useAppToast } from '@/components/AppToast';
import { Button, Field, Fold, Ghost, Small } from '@/components/home/Section';
import { teamSummary } from '@/logic/demo';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

const PEOPLE: [string, string][] = [
  ['S', '#22e07a'],
  ['M', '#5aa9f0'],
  ['A', '#ff7eb6'],
];

/**
 * In the demo (prototype #team-body) the goal is a real one with three people: what each put in, the
 * bar, and the fields to set a goal or pay in (switched off, like every input in the demo).
 */
function DemoTeam() {
  const { state } = useStore();
  const { c } = useTheme();
  const t = teamSummary(state);
  const half = { flex: 1, flexBasis: 0, minWidth: 0 } as const;
  const noop = () => {};
  return (
    <Fold id="team" title="Shared goal" kind="pro" defaultOpen tourId="team">
      <View style={st.row}>
        <Field placeholder="E.g. a trip" accessibilityLabel="Goal name" style={half} />
        <Field placeholder="Goal" keyboardType="decimal-pad" accessibilityLabel="Goal amount" style={half} />
      </View>
      <Ghost title="Set goal" onPress={noop} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      <View style={[st.row, { marginTop: 8 }]}>
        <Field placeholder="Who's paying in" accessibilityLabel="Who's paying in" style={half} />
        <Field placeholder="Amount" keyboardType="decimal-pad" accessibilityLabel="Payment amount" style={half} />
      </View>
      <Button title="Pay in" onPress={noop} />
      <View style={{ marginTop: 10 }}>
        {t ? (
          <>
            <Text style={[st.b, { color: c.ink }]}>{t.name}</Text>
            <View style={st.bar}>
              <View style={st.barT}>
                <Text style={[st.t14, { color: c.ink }]}>{t.line}</Text>
                <Text style={[st.t14, { color: c.ink, fontFamily: inter[700] }]}>{t.pct + '%'}</Text>
              </View>
              <View style={[st.track, { backgroundColor: c.line }]}>
                <View style={{ width: t.pct + '%', height: '100%', backgroundColor: c.accent }} />
              </View>
            </View>
            {t.people.map((p) => (
              <Small key={p}>{p}</Small>
            ))}
          </>
        ) : (
          <Small>Set the shared goal name and amount, then log payments.</Small>
        )}
      </View>
      <Small style={{ marginTop: 12.8, marginBottom: 12.8 }}>Saved only on this phone. Live sharing needs the real app.</Small>
    </Fold>
  );
}

export function SharedGoal() {
  const { c } = useTheme();
  const toast = useAppToast();
  const { demo } = useStore();
  const { available, session } = useAuth();
  if (demo) return <DemoTeam />;
  return (
    <Fold id="team" title="Shared goal" kind="pro" defaultOpen tourId="team">
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
      {session ? (
        <Small style={{ marginTop: 12 }}>You’re signed in. Shared goals with friends are coming soon.</Small>
      ) : (
        <Button
          title="Sign in to get started"
          onPress={() => (available ? router.push('/sign-in') : toast('Accounts are coming soon. For now this is a preview.'))}
          style={{ backgroundColor: '#f5c84b' }}
          textStyle={{ color: '#1a1000' }}
        />
      )}
    </Fold>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
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
