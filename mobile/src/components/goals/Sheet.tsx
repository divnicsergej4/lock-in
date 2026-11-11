// A window that slides up from the bottom (Andrija's "Put money in" design): a handle, a big title, a gold
// line under it, the ✕ on the right. Tapping outside or the ✕ closes it. It moves up with the keyboard.

import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAndroidKeyboardHeight } from '@/components/keyboard';
import { F, useLook } from './look';

export function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  const g = useLook();
  const insets = useSafeAreaInsets();
  const kb = useAndroidKeyboardHeight();
  const k = useSharedValue(0);
  useEffect(() => {
    k.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [k]);
  const scrim = useAnimatedStyle(() => ({ opacity: k.value }));
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - k.value) * 600 }] }));
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: g.scrim }, scrim]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.wrap} pointerEvents="box-none">
        <Animated.View style={[st.sheet, { backgroundColor: g.card, borderColor: g.goldLine, paddingBottom: 16 + insets.bottom + kb }, body]}>
          <View style={[st.handle, { backgroundColor: g.handle }]} />
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ flexGrow: 0 }}>
            <View style={st.head}>
              <View style={{ flex: 1 }}>
                <Text style={[st.title, { color: g.ink }]}>{title}</Text>
                {!!sub && (
                  <Text style={[st.sub, { color: g.goldSoft }]} numberOfLines={1}>
                    {sub}
                  </Text>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[st.x, { borderColor: g.line }]} hitSlop={8}>
                <Svg width={16} height={16} viewBox="0 0 16 16">
                  <Path d="M3 3l10 10M13 3 3 13" stroke={g.mute} strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  title: { fontFamily: F.display, fontSize: 23, lineHeight: 28, letterSpacing: -0.3 },
  sub: { fontFamily: F.text, fontSize: 14, lineHeight: 19, marginTop: 2 },
  x: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
