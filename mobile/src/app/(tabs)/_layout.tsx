import { Redirect, Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { AppState as RNAppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon, type TabIconName } from '@/components/TabIcon';
import { processRecurring } from '@/logic/recurring';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

/** Props Tabs passes to tabBar (state, emitter, navigateToTab; there is no `navigation` here). */
type NavProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'spending', title: 'Spending', icon: 'spending' },
  { name: 'savings', title: 'Savings', icon: 'savings' },
  { name: 'more', title: 'More', icon: 'more' },
];

/** Bottom navigation (prototype #nav): over the content, line on top, icon + label per tab. */
function NavBar({ state, emitter, navigateToTab }: NavProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.nav, { backgroundColor: c.navBg, borderTopColor: c.line, paddingBottom: 6 + insets.bottom }]}>
      {state.routes.map((r, i) => {
        const tab = TABS.find((t) => t.name === r.name)!;
        const on = state.index === i;
        const color = on ? c.accent : c.mute;
        return (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.title}
            onPress={() => {
              // same as the built-in tab bar; a tap on the current tab only emits tabPress
              const e = emitter.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigateToTab(r.key);
            }}
            style={st.btn}
          >
            <TabIcon name={tab.icon} color={color} />
            <Text style={[st.label, { color }]}>{tab.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { c } = useTheme();
  const { state, update } = useStore();
  // recurring entries whose day has come are logged when the app opens and when it comes back
  // (prototype: recProcess at every render)
  useEffect(() => {
    const run = () => update((s) => processRecurring(s, Date.now()));
    run();
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && run());
    return () => sub.remove();
  }, [update]);
  // a new user (no starting balance yet) sees the intro first, like in the prototype
  if (!(state.start > 0)) return <Redirect href="/welcome" />;
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }} tabBar={(p) => <NavBar {...p} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}

const st = StyleSheet.create({
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingTop: 6, paddingHorizontal: 6, borderTopWidth: 1 },
  btn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 12 },
  label: { fontFamily: inter[600], fontSize: 11.52, lineHeight: 16.704 },
});
