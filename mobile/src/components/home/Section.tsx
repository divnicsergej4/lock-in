// Building blocks shared by the app's screens, matching the prototype's <section> cards, foldable
// sections (section.fold) and inputs. Sizes and colours are the browser's computed values.

import { Children, useEffect, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DEMO_FADE, useDemoGuard } from '@/components/demoGuard';
import { Enter } from '@/components/onboarding/Enter';
import { useStore } from '@/store/StoreProvider';
import { inter, sectionTints, useTheme } from '@/theme';
import { useTourTarget } from '@/tour/registry';

export type SectionKind = 'plain' | 'hot' | 'amber' | 'teal' | 'rose' | 'pro';

/** A card. With `tourId` the guided tour can light it up under that name. */
export function Section({ kind = 'plain', style, tourId, children }: { kind?: SectionKind; style?: ViewStyle; tourId?: string; children: ReactNode }) {
  const { c, name } = useTheme();
  const ref = useTourTarget(tourId);
  const tint = kind === 'teal' || kind === 'rose' || kind === 'pro' ? sectionTints[name][kind] : null;
  const look: ViewStyle = tint
    ? { backgroundImage: tint[0], borderColor: tint[1] }
    : kind === 'hot'
      ? { backgroundImage: c.hotBg, borderColor: c.hotBorder }
      : kind === 'amber'
        ? { backgroundImage: c.amberBg, borderColor: c.amberBorder }
        : { backgroundColor: c.card, borderColor: c.line };
  return (
    <View ref={ref} style={[st.section, look, style]}>
      {children}
    </View>
  );
}

/** Section title (h2: 17.6 px, 700). */
export function H2({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const { c } = useTheme();
  return <Text style={[st.h2, { color: c.ink }, style]}>{children}</Text>;
}

/** .small: 12.8 px muted text. */
export function Small({ children, style }: { children: ReactNode; style?: TextStyle | TextStyle[] }) {
  const { c } = useTheme();
  return <Text style={[st.small, { color: c.mute }, style]}>{children}</Text>;
}

/** The chevron of a foldable section: points down when closed, up when open (.25s). */
function Chevron({ open }: { open: boolean }) {
  const { c } = useTheme();
  const k = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    k.value = withTiming(open ? 1 : 0, { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [open, k]);
  // closed: rotate(45deg) translateY(-3px); open: rotate(-135deg) translateY(-2px)
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: 45 - 180 * k.value + 'deg' }, { translateY: -3 + k.value }] }));
  return <Animated.View style={[st.chev, { borderColor: c.mute }, anim]} />;
}

/**
 * A foldable section (prototype section.fold): tap the title to open or close it; whether it is open
 * is remembered. When it opens, its contents pop in one after another (40 ms apart).
 */
export function Fold({
  id,
  title,
  kind = 'plain',
  defaultOpen = false,
  tourId,
  headTourId,
  children,
}: {
  id: string;
  title: string;
  kind?: SectionKind;
  defaultOpen?: boolean;
  tourId?: string; // the tour can light up the whole section
  headTourId?: string; // ... or just its title row
  children: ReactNode;
}) {
  const { state, update } = useStore();
  const head = useTourTarget(headTourId);
  const saved = (state.fold || {})[id];
  const open = saved == null ? defaultOpen : !!saved;
  const toggle = () => update((s) => ({ ...s, fold: { ...(s.fold || {}), [id]: !open } }));
  return (
    <Section kind={kind} tourId={tourId} style={open ? undefined : { paddingTop: 16, paddingBottom: 16 }}>
      <Pressable
        ref={head}
        accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={toggle} style={[st.foldHead, { marginBottom: open ? 12 : 0 }]}>
        <H2 style={{ marginBottom: 0, flex: 1 }}>{title}</H2>
        <Chevron open={open} />
      </Pressable>
      {open &&
        Children.toArray(children).map((ch, i) => (
          <Enter key={i} kind="pop" delay={i * 40}>
            {ch}
          </Enter>
        ))}
    </Section>
  );
}

/** Text field like the prototype's inputs (12 px corners unless given). Off and faded in the demo. */
export function Field(props: TextInputProps & { ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const { c } = useTheme();
  const { demo, no } = useDemoGuard();
  return (
    <TextInput
      placeholderTextColor={c.placeholder}
      autoComplete="off"
      autoCorrect={false}
      {...props}
      editable={demo ? false : props.editable}
      onPressIn={demo ? no : props.onPressIn}
      style={[st.field, { color: c.ink, backgroundColor: c.inputBg, borderColor: c.line }, props.style, demo && { opacity: DEMO_FADE }]}
    />
  );
}

/**
 * Main green button (prototype button: 12 px corners, 700). In the demo it only shows "look only",
 * unless `demoOk` (it changes no data).
 */
export function Button({ title, onPress, style, textStyle, demoOk }: { title: string; onPress: () => void; style?: ViewStyle; textStyle?: TextStyle; demoOk?: boolean }) {
  const { c } = useTheme();
  const { guard } = useDemoGuard();
  return (
    <Pressable accessibilityRole="button" onPress={demoOk ? onPress : guard(onPress)} style={({ pressed }) => [st.btn, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }, style]}>
      <Text style={[st.btnT, { color: c.onAccent }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

/** Outlined button (prototype button.ghost); like Button in the demo. */
export function Ghost({ title, onPress, style, textStyle, demoOk }: { title: string; onPress: () => void; style?: ViewStyle | ViewStyle[]; textStyle?: TextStyle; demoOk?: boolean }) {
  const { c } = useTheme();
  const { guard } = useDemoGuard();
  return (
    <Pressable accessibilityRole="button" onPress={demoOk ? onPress : guard(onPress)} style={({ pressed }) => [st.ghost, { borderColor: c.line }, pressed && { opacity: 0.7 }, style]}>
      <Text style={[st.ghostT, { color: c.ink }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

/** The ▸ marker of a <details> summary, turned down when open. */
export function SummaryMarker({ open, color }: { open: boolean; color: string }) {
  return <View style={{ width: 0, height: 0, borderTopWidth: 4.5, borderBottomWidth: 4.5, borderLeftWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color, transform: [{ rotate: open ? '90deg' : '0deg' }] }} />;
}

export const st = StyleSheet.create({
  section: { padding: 18, borderWidth: 1, borderRadius: 20, marginBottom: 14 },
  h2: { fontFamily: inter[700], fontSize: 17.6, lineHeight: 25.52, marginBottom: 10 },
  small: { fontFamily: inter[400], fontSize: 12.8, lineHeight: 18.56 },
  foldHead: { flexDirection: 'row', alignItems: 'center' },
  chev: { width: 9, height: 9, borderRightWidth: 2, borderBottomWidth: 2, marginLeft: 'auto' },
  field: { height: 47.2, paddingVertical: 11, paddingHorizontal: 12, fontFamily: inter[400], fontSize: 16, borderWidth: 1, borderRadius: 12 },
  btn: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  btnT: { fontFamily: inter[700], fontSize: 16, lineHeight: 23.2, textAlign: 'center' },
  ghost: { borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center' },
  ghostT: { fontFamily: inter[600], fontSize: 16, lineHeight: 23.2, textAlign: 'center' },
});
