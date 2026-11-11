// The demo's bar at the top (prototype #demo-bar): "DEMO Sample data. Typing is off." and Exit demo.
// The pages move down by its height while it's there (prototype body.demo main: +46 px). Turning the
// demo on or off goes back to Home (prototype demoRedraw: tab(0)).

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppToast } from '@/components/AppToast';
import { DEMO_OFF } from '@/logic/demo';
import { useStore } from '@/store/StoreProvider';
import { inter } from '@/theme';

export const DEMO_BAR_SPACE = 46;

/** Top padding of a tab's page: the status bar, plus the demo bar while the demo is on. */
export function usePageTop() {
  const insets = useSafeAreaInsets();
  const { demo } = useStore();
  return insets.top + (demo ? DEMO_BAR_SPACE : 0);
}

export function DemoBar() {
  const { demo, endDemo } = useStore();
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  if (!demo) return null;
  return (
    <View style={[st.bar, { paddingTop: insets.top + 8 }]}>
      <Text style={st.t}>
        <Text style={st.b}>DEMO</Text>
        {'  Sample data. Typing is off.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.navigate('/');
          endDemo();
          toast(DEMO_OFF);
        }}
        style={({ pressed }) => [st.x, pressed && { opacity: 0.8 }]}
      >
        <Text style={st.xT}>Exit demo</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 35,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
    backgroundImage: 'linear-gradient(90deg, rgba(124,77,255,0.94), rgba(34,224,122,0.9))',
    boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
  },
  t: { flex: 1, minWidth: 0, fontFamily: inter[400], fontSize: 13.44, lineHeight: 16.8, color: '#fff' },
  b: { fontFamily: inter[700], letterSpacing: 1.0752 },
  x: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  xT: { fontFamily: inter[700], fontSize: 13.12, lineHeight: 19.02, color: '#fff' },
});
