// Pieces the plans screen and the screens after it share (sizes and colours from docs/dizajn/placanje/*.html).

import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { brico, inter } from '@/theme';

import { PW } from './theme';

/** The green button (58 high, radius 18, 18 / 800). */
export function BigButton({ title, onPress, busy, style }: { title: string; onPress: () => void; busy?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [st.big, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }, style]}
    >
      {busy ? <ActivityIndicator color={PW.onGreen} /> : <Text style={st.bigT}>{title}</Text>}
    </Pressable>
  );
}

/** The dark outlined button of 10 ("Look around the demo"). */
export function CardButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.cardBtn, pressed && { opacity: 0.8 }]}>
      <Text style={st.cardBtnT}>{title}</Text>
    </Pressable>
  );
}

/** A plain text button (44 high, 15 / 600), underlined where the design underlines it. */
export function TextButton({ title, onPress, underline }: { title: string; onPress: () => void; underline?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.textBtn, pressed && { opacity: 0.7 }]}>
      <Text style={[st.textBtnT, underline && st.under]}>{title}</Text>
    </Pressable>
  );
}

/** The small grey links in a row (Restore purchase · Terms · Privacy). */
export function Links({ items, style }: { items: { title: string; onPress: () => void }[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[st.links, style]}>
      {items.map((l) => (
        <Pressable key={l.title} accessibilityRole="link" onPress={l.onPress} hitSlop={10}>
          <Text style={st.link}>{l.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function H1({ children, size, lh, ls = 0 }: { children: ReactNode; size: number; lh: number; ls?: number }) {
  return <Text style={[st.h1, { fontSize: size, lineHeight: size * lh, letterSpacing: size * ls }]}>{children}</Text>;
}

export function Sub({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return <Text style={[st.sub, { fontSize: size, lineHeight: size * 1.45 }]}>{children}</Text>;
}

/** The dark card with label / value rows (09, 11): 50 high, a line between them. */
export function RowsCard({ rows, children }: { rows: { label: string; value: string }[]; children?: ReactNode }) {
  return (
    <View style={[st.card, { paddingVertical: 6, paddingHorizontal: 16 }]}>
      {rows.map((r, i) => (
        <View key={r.label} style={[st.kv, (i < rows.length - 1 || !!children) && st.kvLine]}>
          <Text style={st.kvL}>{r.label}</Text>
          <Text style={st.kvV}>{r.value}</Text>
        </View>
      ))}
      {children}
    </View>
  );
}

const ICON = {
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/>',
  card: '<rect x="3" y="6" width="18" height="12.5" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  wifi: '<path d="M4.5 10a11 11 0 0 1 15 0"/><path d="M7.5 13.2a6.5 6.5 0 0 1 9 0"/><path d="M12 17h.01"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
};

/** Card with an icon box, a bold line and text (10's reason, 11's "New phone?"). */
export function NoteCard({ icon, tone, title, text }: { icon: keyof typeof ICON; tone: 'lime' | 'green'; title: string; text: string }) {
  const color = tone === 'lime' ? PW.lime : PW.green;
  return (
    <View style={[st.card, st.note]}>
      <View style={[st.iconBox, { backgroundColor: tone === 'lime' ? 'rgba(184,255,92,0.10)' : 'rgba(34,224,122,0.10)' }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <IconPaths xml={ICON[icon]} color={color} width={icon === 'phone' ? 1.9 : 2} />
        </Svg>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={st.noteB}>{title}</Text>
        <Text style={st.noteT}>{text}</Text>
      </View>
    </View>
  );
}

/** A line icon from the design's SVG markup (24 × 24 view box). */
export function LineIcon({ xml, size, color, width }: { xml: string; size: number; color: string; width: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <IconPaths xml={xml} color={color} width={width} />
    </Svg>
  );
}

/** The few line icons here, from their SVG markup (circles, rects and paths only). */
function IconPaths({ xml, color, width }: { xml: string; color: string; width: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const parts = xml.match(/<(circle|rect|path)[^>]*\/>/g) || [];
  return (
    <>
      {parts.map((tag, i) => {
        const a = (n: string) => tag.match(new RegExp(`${n}="([^"]*)"`))?.[1];
        const num = (n: string) => Number(a(n) ?? 0);
        if (tag.startsWith('<circle')) return <Circle key={i} cx={num('cx')} cy={num('cy')} r={num('r')} {...p} />;
        if (tag.startsWith('<rect')) return <Rect key={i} x={num('x')} y={num('y')} width={num('width')} height={num('height')} rx={num('rx')} {...p} />;
        return <Path key={i} d={a('d')} {...p} />;
      })}
    </>
  );
}

/** The switch of 09 (52 × 32, green with a dark knob when on). */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    k.value = withTiming(on ? 1 : 0, { duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [on, k]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * k.value }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      hitSlop={8}
      style={[st.sw, { backgroundColor: on ? PW.green : PW.stepOff }]}
    >
      <Animated.View style={[st.knob, { backgroundColor: on ? PW.onGreen : PW.ink }, knob]} />
    </Pressable>
  );
}

export const st = StyleSheet.create({
  big: { height: 58, borderRadius: 18, backgroundColor: PW.green, alignItems: 'center', justifyContent: 'center' },
  bigT: { fontFamily: inter[800], fontSize: 18, lineHeight: 22, color: PW.onGreen },
  cardBtn: { height: 52, borderRadius: 18, borderWidth: 1, borderColor: PW.line, backgroundColor: PW.card, alignItems: 'center', justifyContent: 'center' },
  cardBtnT: { fontFamily: inter[600], fontSize: 16, lineHeight: 20, color: PW.ink },
  textBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  textBtnT: { fontFamily: inter[600], fontSize: 15, lineHeight: 19, color: PW.ink },
  under: { textDecorationLine: 'underline' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  link: { fontFamily: inter[400], fontSize: 13, lineHeight: 18, color: PW.mute, textDecorationLine: 'underline' },
  h1: { fontFamily: brico[800], color: PW.ink, textAlign: 'center' },
  sub: { fontFamily: inter[400], color: PW.sub, textAlign: 'center' },
  card: { borderRadius: 20, borderWidth: 1, borderColor: PW.line, backgroundColor: PW.card },
  kv: { height: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvLine: { borderBottomWidth: 1, borderBottomColor: PW.line },
  kvL: { fontFamily: inter[400], fontSize: 15, lineHeight: 20, color: PW.sub },
  kvV: { fontFamily: inter[700], fontSize: 15, lineHeight: 20, color: PW.ink },
  note: { padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  noteB: { fontFamily: inter[700], fontSize: 15, lineHeight: 20, color: PW.ink },
  noteT: { fontFamily: inter[400], fontSize: 14, lineHeight: 20.3, color: PW.sub },
  sw: { width: 52, height: 32, borderRadius: 16, justifyContent: 'center' },
  knob: { position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 13 },
});
