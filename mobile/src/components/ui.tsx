import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius, useTheme } from '@/theme';

/** Scrollable tab page with the theme background and safe-area padding. */
export function Screen({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 12 }]}
    >
      {children}
    </ScrollView>
  );
}

/** A card, like the prototype's <section>. */
export function Card({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>{children}</View>;
}

type Variant = 'title' | 'h2' | 'body' | 'small' | 'big';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const { c } = useTheme();
  const v = variants[variant];
  return <Text {...rest} style={[v, { color: variant === 'small' ? c.mute : c.ink }, style]} />;
}

const variants = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 17 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  big: { fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1 },
});

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingBottom: 130, gap: 14 }, // the tab bar sits over the content
  card: { borderWidth: 1, borderRadius: radius.card, padding: 18, gap: 6 },
});
