// The "Lock In 🗿" header above every tab (prototype #hero0).

import { StyleSheet, Text, View } from 'react-native';

import { inter, useTheme } from '@/theme';

export function Hero() {
  const { c } = useTheme();
  return (
    <View style={st.hero}>
      <Text style={[st.h1, { color: c.hero }]}>Lock In 🗿</Text>
      <Text style={[st.sub, { color: c.mute }]}>The money tracker that calls you out when you spend like cash grows on trees.</Text>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 20, paddingHorizontal: 4, paddingBottom: 12, marginBottom: 6 },
  h1: { fontFamily: inter[800], fontSize: 32, lineHeight: 46.4, letterSpacing: -0.96 },
  sub: { marginTop: 4, fontFamily: inter[400], fontSize: 14.72, lineHeight: 21.344 },
});
