import { Tabs } from 'expo-router';

import { TabIcon, type TabIconName } from '@/components/TabIcon';
import { fonts, useTheme } from '@/theme';

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'spending', title: 'Spending', icon: 'spending' },
  { name: 'savings', title: 'Savings', icon: 'savings' },
  { name: 'more', title: 'More', icon: 'more' },
];

export default function TabLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.mute,
        tabBarStyle: { backgroundColor: c.navBg, borderTopColor: c.line, borderTopWidth: 1 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11.5 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarIcon: ({ color }) => <TabIcon name={t.icon} color={color} /> }}
        />
      ))}
    </Tabs>
  );
}
