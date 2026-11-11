// Small pieces of the shared goal screens: avatars, chips, buttons, the amount field.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { F, useLook } from './look';
import type { Tag } from '@/logic/goals';

/** A round avatar with the initial. */
export function Avatar({ letter, color, size = 34, ring }: { letter: string; color: string; size?: number; ring?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring }}>
      <Text style={{ fontFamily: F.heavy, fontSize: size * 0.42, color: '#04140a' }}>{letter}</Text>
    </View>
  );
}

/** Avatars overlapping a little (S M A). */
export function Avatars({ people, size = 30 }: { people: { initial: string; color: string }[]; size?: number }) {
  const g = useLook();
  return (
    <View style={{ flexDirection: 'row' }}>
      {people.slice(0, 5).map((p, i) => (
        <View key={i} style={{ marginLeft: i ? -size * 0.22 : 0 }}>
          <Avatar letter={p.initial} color={p.color} size={size} ring={g.card} />
        </View>
      ))}
    </View>
  );
}

export function Chip({ tag }: { tag: Tag }) {
  const g = useLook();
  const look = {
    green: [g.greenChip, 'transparent', g.green],
    red: [g.redChip, 'transparent', g.red],
    flame: [g.flameChip, 'transparent', g.flame],
    gold: [g.goldChip, 'transparent', g.goldInk],
    outline: ['transparent', g.goldLine, g.goldSoft],
  }[tag.look];
  return (
    <View style={[st.chip, { backgroundColor: look[0], borderColor: look[1] }]}>
      {tag.look === 'flame' && <Flame color={g.flame} />}
      <Text style={[st.chipT, { color: look[2] }]}>{tag.t}</Text>
    </View>
  );
}

export function Flame({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 12 15">
      <Path d="M6 0c.4 2.6 3.6 4.6 3.6 8.4A3.6 3.6 0 0 1 6 12a3.6 3.6 0 0 1-3.6-3.6c0-1.6.8-2.6 1.6-3.3 0 1.1.5 1.9 1.3 2.2C4.8 5 5.5 2.6 6 0Z" fill={color} />
    </Svg>
  );
}

/** Big gold button ("Put money in", "Add a friend"). */
export function GoldButton({ title, onPress, style, plus, dim }: { title: string; onPress: () => void; style?: ViewStyle; plus?: boolean; dim?: boolean }) {
  const g = useLook();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [st.gold, { backgroundColor: g.gold }, (pressed || dim) && { opacity: dim ? 0.5 : 0.85 }, style]}
    >
      {plus && <Plus color={g.onGold} />}
      <Text style={[st.goldT, { color: g.onGold }]}>{title}</Text>
    </Pressable>
  );
}

/** Outlined button with gold text ("Make a goal", "Friends · 3") or plain text. */
export function OutlineButton({ title, onPress, style, plain, textStyle }: { title: string; onPress: () => void; style?: ViewStyle; plain?: boolean; textStyle?: TextStyle }) {
  const g = useLook();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [st.gold, { borderWidth: 1, borderColor: plain ? g.line : g.goldLine, backgroundColor: plain ? 'transparent' : g.card }, pressed && { opacity: 0.75 }, style]}
    >
      <Text style={[st.goldT, { color: plain ? g.ink : g.goldInk }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function Plus({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" style={{ marginRight: 8 }}>
      <Path d="M8 2v12M2 8h12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function Chevron({ color, dir = 'right', size = 14 }: { color: string; dir?: 'right' | 'left' | 'down'; size?: number }) {
  const d = { right: 'M5 2l5 5-5 5', left: 'M9 2 4 7l5 5', down: 'M2 5l5 5 5-5' }[dir];
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A card of the goal screen (#0d1812 with a line). */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const g = useLook();
  return <View style={[st.card, { backgroundColor: g.card, borderColor: g.line }, style]}>{children}</View>;
}

/** A labelled text field of the sheets. */
export function SheetField(props: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; numeric?: boolean; autoFocus?: boolean; email?: boolean }) {
  const g = useLook();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[st.label, { color: g.mute }]}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={g.mute + '99'}
        keyboardType={props.numeric ? 'decimal-pad' : props.email ? 'email-address' : 'default'}
        autoCapitalize={props.email ? 'none' : 'sentences'}
        autoCorrect={false}
        autoComplete={props.email ? 'email' : 'off'}
        autoFocus={props.autoFocus}
        accessibilityLabel={props.label}
        style={[st.input, { color: g.ink, borderColor: g.line, backgroundColor: g.bg }]}
      />
    </View>
  );
}

export const st = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  chipT: { fontFamily: F.bold, fontSize: 11, lineHeight: 15 },
  gold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 14, paddingHorizontal: 14 },
  goldT: { fontFamily: F.bold, fontSize: 14.5, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15 },
  label: { fontFamily: F.semi, fontSize: 12.5, marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontFamily: F.text, fontSize: 16 },
});
