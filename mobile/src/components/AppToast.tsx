// The app's toast (prototype #toast): a bar above the tab bar that shows for 5.2 s. Line breaks are kept
// (white-space: pre-line). In the prototype it appears and disappears at once (transition: none).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { inter, useTheme } from '@/theme';

const Ctx = createContext<(msg: string) => void>(() => {});

/** Shows a toast: `const toast = useAppToast(); toast('Saved')`. */
export const useAppToast = () => useContext(Ctx);

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string) => {
    setText(msg);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setText(''), 5200);
  }, []);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <AppToast text={text} />
    </Ctx.Provider>
  );
}

function AppToast({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  if (!text) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[st.toast, { bottom: 98 + insets.bottom, backgroundColor: c.toastBg, borderColor: c.toastBorder }]}
    >
      <Text style={[st.t, { color: c.toastInk }]}>{text}</Text>
    </View>
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
  },
  t: { fontFamily: inter[600], fontSize: 16, lineHeight: 23.2 },
});
