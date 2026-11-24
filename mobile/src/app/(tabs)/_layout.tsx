import { Redirect, Tabs } from 'expo-router';
import { useCallback, useEffect, type ComponentProps } from 'react';
import { AppState as RNAppState, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import Animated, { runOnUI, scrollTo } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { DemoBar } from '@/components/DemoBar';
import { useKeepFieldInView } from '@/components/keyboard';
import { TabFreeze } from '@/components/TabFreeze';
import { TabIcon, type TabIconName } from '@/components/TabIcon';
import { tabScrolls } from '@/components/tabPage';
import { processRecurring } from '@/logic/recurring';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';
import { activeTab, useTourTarget } from '@/tour/registry';
import { TourOverlay } from '@/tour/TourOverlay';

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
  const bar = useTourTarget('nav'); // the tour keeps parts above it
  return (
    <Animated.View ref={bar} style={[st.nav, { backgroundColor: c.navBg, borderTopColor: c.line, paddingBottom: 6 + insets.bottom }]}>
      {state.routes.map((r, i) => {
        const tab = TABS.find((t) => t.name === r.name)!;
        const on = state.index === i;
        const color = on ? c.accent : c.mute;
        return (
          <NavButton
            key={r.key}
            i={i}
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
          </NavButton>
        );
      })}
    </Animated.View>
  );
}

/** A tab button the tour can point at ('nav1' Spending, 'nav2' Savings, 'nav3' More). */
function NavButton({ i, ...props }: PressableProps & { i: number }) {
  const ref = useTourTarget('nav' + i);
  return (
    <Animated.View ref={ref} style={{ flex: 1 }}>
      <Pressable {...props} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const { c } = useTheme();
  const { state, update, epoch, demo } = useStore();
  const { locked } = useAuth();
  const insets = useSafeAreaInsets();
  // Android: the page in front scrolls the field being typed in (and its button) above the keyboard
  const scrollFront = useCallback((dy: number) => {
    const sc = tabScrolls[activeTab.value];
    if (!sc) return;
    const { ref, offset } = sc;
    runOnUI(() => {
      'worklet';
      scrollTo(ref, 0, Math.max(0, offset.value + dy), true);
    })();
  }, []);
  useKeepFieldInView(scrollFront, insets.top);
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
  // no trial or plan (7 days free, then everyone pays): only the plans screen, and the demo from it
  if (locked && !demo) return <Redirect href="/paywall" />;
  // epoch: after the demo or the tour every page starts fresh (fields empty, Home, at the top)
  return (
    <>
      {/* TabFreeze: a tab that is not in front does not re-render (see TabFreeze.tsx) */}
      <Tabs
        key={epoch}
        screenLayout={({ children, navigation }) => <TabFreeze navigation={navigation}>{children}</TabFreeze>}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
        tabBar={(p) => <NavBar {...p} />}
      >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
      </Tabs>
      <DemoBar />
      <TourOverlay />
    </>
  );
}

const st = StyleSheet.create({
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingTop: 6, paddingHorizontal: 6, borderTopWidth: 1 },
  btn: { alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 12 },
  label: { fontFamily: inter[600], fontSize: 11.52, lineHeight: 16.704 },
});
