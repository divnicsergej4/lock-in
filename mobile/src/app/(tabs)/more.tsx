import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Screen, T } from '@/components/ui';
import type { ThemeName } from '@/logic/types';
import { useStore } from '@/store/StoreProvider';
import { fonts, radius, useTheme } from '@/theme';

// Skeleton: monthly report, backup and the rest of Settings come in step 4.
// The theme switch is here already so the light theme can be checked on the phone.
export default function More() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const options: { v: ThemeName; label: string }[] = [
    { v: 'dark', label: 'Dark' },
    { v: 'light', label: 'Light' },
  ];

  return (
    <Screen>
      <T variant="title">More</T>
      <Card>
        <T variant="h2">Theme</T>
        <View style={styles.row}>
          {options.map((o) => {
            const on = state.theme === o.v;
            return (
              <Pressable
                key={o.v}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => update((s) => ({ ...s, theme: o.v }))}
                style={[styles.btn, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : 'transparent' }]}
              >
                <T style={{ fontFamily: fonts.semibold, color: on ? c.onAccent : c.ink }}>{o.label}</T>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1.5, borderRadius: radius.button },
});
