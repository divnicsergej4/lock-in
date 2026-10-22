// Prototype #toast (light theme): a dark bar near the bottom that shows for 5.2 s. In the prototype it
// appears and disappears at once (transition: none), so it does here too.

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brico } from '@/theme';

export function useToast() {
  const [text, setText] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string) => {
    setText(msg);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setText(''), 5200);
  }, []);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);
  return { text, show };
}

export function Toast({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[st.toast, { bottom: 98 + insets.bottom }]} accessibilityLiveRegion="polite">
      {/* textContent collapses line breaks into spaces */}
      <Text style={st.t}>{text.replace(/\s*\n\s*/g, ' ')}</Text>
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
    backgroundColor: '#0f1a14',
    borderWidth: 1,
    borderColor: '#0f1a14',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
  },
  t: { fontFamily: brico[600], fontSize: 16, lineHeight: 23.2, color: '#fff' },
});
