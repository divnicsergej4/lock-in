// The app's toast (prototype #toast): a bar just above the tab bar that shows for 5.2 s, or until the next
// touch. Line breaks are kept
// (white-space: pre-line). In the prototype it appears and disappears at once (transition: none).
// During the guided tour it moves to the top, or to the bottom when the light or the bubble is there
// (prototype body.tuton #toast).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { inter, useTheme } from '@/theme';
import { tourBubble, tourHole, tourOnSV } from '@/tour/registry';

const Ctx = createContext<(msg: string) => void>(() => {});

/** Shows a toast: `const toast = useAppToast(); toast('Saved')`. */
export const useAppToast = () => useContext(Ctx);

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const on = useRef(false);
  const show = useCallback((msg: string) => {
    setText(msg);
    on.current = !!msg;
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      on.current = false;
      setText('');
    }, 5200);
  }, []);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);
  // the toast never stays over a button the user is reaching for: the next touch anywhere puts it away (the
  // touch itself still goes through to what is under it)
  const touch = useCallback(() => {
    if (!on.current) return;
    on.current = false;
    if (t.current) clearTimeout(t.current);
    setText('');
  }, []);
  return (
    <Ctx.Provider value={show}>
      <View style={{ flex: 1 }} onTouchStart={touch}>
        {children}
      </View>
      <AppToast text={text} />
    </Ctx.Provider>
  );
}

function AppToast({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  const { height: vh } = useWindowDimensions();
  const { c } = useTheme();
  const th = useSharedValue(52);
  const place = useAnimatedStyle(() => {
    // prototype: bottom: calc(78px + env(safe-area-inset-bottom)), just above the tab bar
    if (!tourOnSV.value) return { top: undefined, bottom: 78 + insets.bottom };
    const yT = insets.top + 54;
    const yB = vh - th.value - 16;
    const H = tourHole.value;
    const B = tourBubble.value;
    const ov = (z: number) => (H.on && z < H.b + 6 && z + th.value > H.t - 6) || (B.on && z < B.y + B.h + 6 && z + th.value > B.y - 6);
    return { top: !ov(yT) ? yT : !ov(yB) ? yB : yT, bottom: undefined };
  });
  if (!text) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      onLayout={(e) => (th.value = e.nativeEvent.layout.height)}
      style={[st.toast, { backgroundColor: c.toastBg, borderColor: c.toastBorder }, place]}
    >
      <Text style={[st.t, { color: c.toastInk }]}>{text}</Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxWidth: 536,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    zIndex: 60,
  },
  t: { fontFamily: inter[600], fontSize: 16, lineHeight: 23.2 },
});
