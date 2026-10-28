// "Settings" (prototype section[data-fold=set]): grouped rows with an icon, a title and a hint, like a
// phone's settings: Money (salary, second currency), You & look (age, theme, roast level), Reminder,
// Help, Account (sign in / out, delete account), Subscription, Privacy, Legal & support (web pages on the domain)
// and the Danger zone.

import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { accessText } from '@/auth/access';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/auth/supabase';
import { webUrl } from '@/config/domain';
import { nudgeAlerts, setNudgeAlerts } from '@/goals/api';
import { useGoals } from '@/goals/GoalsProvider';
import { askPermission } from '@/notifications/local';
import { disableGoalAlerts, enableGoalAlerts } from '@/notifications/push';
import { useAppToast } from '@/components/AppToast';
import { DEMO_FADE, useDemoGuard } from '@/components/demoGuard';
import { Button, Field, Fold, Ghost } from '@/components/home/Section';
import { Select } from '@/components/onboarding/Select';
import { DEMO_ON, demoData } from '@/logic/demo';
import { resetAll, setAge, setIncome, setReminder, setReminderTime, setSecondCurrency } from '@/logic/settings';
import { CURRENCIES } from '@/logic/setup';
import type { RoastLevel, ThemeName } from '@/logic/types';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';
import { isTourRunning } from '@/tour/registry';
import { tour } from '@/tour/TourOverlay';

import { TimeField } from './TimeField';

// row icons (prototype .sic svg: 24 × 24, stroke 1.7, round)
/** Privacy Policy, Terms of Use, Support: Lock In's pages (folder web/), opened in the phone's browser. */
const openWeb = (path: string) => {
  const url = webUrl(path);
  if (url) Linking.openURL(url).catch(() => {});
};

const ICONS = {
  salary: '<rect x="3.5" y="6.5" width="17" height="12" rx="2.5"/><path d="M3.5 10.5h17"/><path d="M15 15h2.5"/>',
  cur2: '<path d="M5 8.5h13l-3-3"/><path d="M19 15.5H6l3 3"/>',
  age: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  theme: '<path d="M19.5 14.3A7.8 7.8 0 1 1 9.7 4.5a6.2 6.2 0 0 0 9.8 9.8Z"/>',
  roast: '<path d="M12 3.5c.9 3 4.9 5.1 4.9 9.7a4.9 4.9 0 0 1-9.8 0c0-2.3 1-3.9 2.2-5.1.3 1.7 1 2.7 2.2 3.2-.5-2.7-.4-5.3.5-7.8Z"/>',
  bell: '<path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14Z"/><path d="M10 20.5a2.3 2.3 0 0 0 4 0"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  flame: '<path d="M12 3.5c.9 3 4.9 5.1 4.9 9.7a4.9 4.9 0 0 1-9.8 0c0-2.3 1-3.9 2.2-5.1.3 1.7 1 2.7 2.2 3.2-.5-2.7-.4-5.3.5-7.8Z"/><path d="M12 20.5v-3"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4"/><path d="M9.5 12.5h5M9.5 16h5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.3c-.5-.8-1.4-1.3-2.5-1.3-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4.1 0 1.1-1.1 2-2.5 2-1.2 0-2.2-.5-2.7-1.4M12 6.5V8m0 8v1.5"/>',
  team: '<circle cx="9" cy="9" r="3"/><path d="M3.5 18.5c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7"/><circle cx="16.5" cy="8" r="2.5"/><path d="M16.5 12.8c2.2 0 3.7 1.4 4.1 3.7"/>',
  tour: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.3M12 16.8h.01"/>',
  demo: '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/><path d="m10.5 8.2 4 2.3-4 2.3z"/>',
  star: '<path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2l-4.8 2.6 1-5.4-4-3.7 5.4-.7Z"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l.9 12.5h9.2L17.5 7"/><path d="M10.2 10.5v5.5M13.8 10.5v5.5"/>',
  user: '<circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c.9-3.4 3.4-5.3 6.5-5.3s5.6 1.9 6.5 5.3"/><circle cx="12" cy="12" r="9"/>',
  out: '<path d="M14 4.5H6.5v15H14"/><path d="M10.5 12h9"/><path d="m16.5 9 3 3-3 3"/>',
};
type IconName = keyof typeof ICONS;

function Icon({ name, color }: { name: IconName; color: string }) {
  const xml = `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return (
    <View style={st.sic}>
      <SvgXml xml={xml} width={20} height={20} />
    </View>
  );
}

function Group({ label, first, children }: { label: string; first?: boolean; children: ReactNode }) {
  const { c } = useTheme();
  return (
    // .sgrp: 14 px apart (the first one's margin collapses with the title's 12)
    <View style={{ marginTop: first ? 2 : 14 }}>
      <Text style={[st.sgl, { color: c.mute }]}>{label}</Text>
      <View style={[st.sbox, { borderColor: c.line }]}>{children}</View>
    </View>
  );
}

/** One row: icon, title and hint, and what goes on the right. `top` draws the line above it. */
function Row({
  icon,
  title,
  hint,
  hintStyle,
  top,
  danger,
  right,
  onPress,
  style,
  demoOk,
}: {
  icon: IconName;
  title: string;
  hint?: ReactNode;
  hintStyle?: TextStyle;
  top?: boolean;
  danger?: boolean;
  right?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  demoOk?: boolean; // changes nothing (e.g. opens a web page): also works in the demo
}) {
  const { c, name } = useTheme();
  const { guard } = useDemoGuard(); // row actions change something: look only in the demo (unless demoOk)
  const red = name === 'light' ? '#d93a3a' : '#ff7b7b';
  const body = (
    <>
      <Icon name={icon} color={danger ? red : c.ink} />
      <View style={st.stx}>
        <Text style={[st.b, { color: danger ? red : c.ink }]}>{title}</Text>
        {hint != null && <Text style={[st.small, { color: c.mute }, hintStyle]}>{hint}</Text>}
      </View>
      {right}
    </>
  );
  const look = [st.srow, top && { borderTopWidth: 1, borderTopColor: c.line }, style];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={demoOk ? onPress : guard(onPress)} style={({ pressed }) => [look, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={look}>{body}</View>
  );
}

/** The arrow of a row that opens something. */
function Arrow() {
  const { c } = useTheme();
  return <Text style={[st.arr, { color: c.mute }]}>›</Text>;
}

/** On/off switch (prototype input.sw: 48 × 28, knob 22, .2s). */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  const { demo, guard } = useDemoGuard();
  const k = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    k.value = withTiming(on ? 1 : 0, { duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [on, k]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * k.value }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={guard(() => onChange(!on))}
      style={[st.sw, { backgroundColor: on ? c.accent : 'rgba(127,127,127,0.35)' }, demo && { opacity: DEMO_FADE }]}
    >
      <Animated.View style={[st.knob, knob]} />
    </Pressable>
  );
}

export function SettingsFold() {
  const { state, update, startDemo } = useStore();
  const { c } = useTheme();
  const toast = useAppToast();
  const look = { bg: c.inputBg, border: c.line, ink: c.ink, mute: c.mute, sheet: c.card, font: inter[400] };

  // Money
  const [inc, setInc] = useState(state.income > 0 ? String(state.income) : '');
  const saveIncome = () => {
    const r = setIncome(state, inc);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    toast(r.toast);
  };
  const [cur2, setCur2] = useState(state.cur2 || '');
  const [bal2, setBal2] = useState('');
  useEffect(() => setCur2(state.cur2 || ''), [state.cur2]);
  const saveCur2 = () => {
    const r = setSecondCurrency(state, cur2, bal2);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    setBal2('');
    toast(r.toast);
  };

  // You & look
  const [age, setAgeText] = useState(state.age ? String(state.age) : '');
  const saveAge = () => {
    const r = setAge(state, age);
    update(() => r.state);
    setAgeText(r.field);
    toast('Saved');
  };

  // Reminder
  const rem = state.rem || { on: false, time: '20:00' };

  // Subscription: the plans screen comes in a later step
  const soon = () => toast('Coming soon.');
  // Help: the guided tour, and the demo (sample data, nothing saved; not while the tour runs; it opens on Home)
  const demoOn = () => {
    if (isTourRunning()) return;
    router.navigate('/');
    startDemo(demoData(state, Date.now()));
    toast(DEMO_ON);
  };

  // Danger zone: a second tap within 4 s deletes everything
  const [sure, setSure] = useState(false);
  const sureT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (sureT.current && clearTimeout(sureT.current)), []);
  const reset = () => {
    if (!sure) {
      setSure(true);
      sureT.current = setTimeout(() => setSure(false), 4000);
      return;
    }
    if (sureT.current) clearTimeout(sureT.current);
    setSure(false);
    const r = resetAll();
    if (r.ok) {
      update(() => r.state);
      toast(r.toast);
    }
  };

  // Account: sign out, and delete the account (Apple requires it in the app); also a second tap within 4 s
  const auth = useAuth();
  const [sureDel, setSureDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const delT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (delT.current && clearTimeout(delT.current)), []);
  const signOut = async () => {
    await auth.signOut();
    toast('Signed out');
  };
  // Shared goal alerts: the permission is asked here, on the user's own tap (and later when joining a goal)
  const goalAlerts = async (on: boolean) => {
    if (!supabase) return;
    if (on) {
      const r = await enableGoalAlerts(supabase);
      if (!r.ok) return toast(r.error);
    } else await disableGoalAlerts(supabase);
    update((s) => ({ ...s, goalPush: on }));
    toast(on ? 'Shared goal alerts on' : 'Shared goal alerts off');
  };
  // Nudges from friends: kept on the server (it sends the push), on unless switched off
  const goals = useGoals();
  const myName = auth.session ? goals.snap?.names[auth.session.user.id] ?? null : null;
  const [nudgesOn, setNudgesOn] = useState(true);
  const uid = auth.session?.user.id;
  useEffect(() => {
    if (!supabase || !uid) return;
    nudgeAlerts(supabase).then((v) => v != null && setNudgesOn(v));
  }, [uid]);
  const nudgeAlertsSwitch = async (on: boolean) => {
    const r = await goals.run((db) => setNudgeAlerts(db, on), { always: true, quiet: true });
    if (r?.ok) setNudgesOn(on);
  };
  const deleteAccount = async () => {
    if (deleting) return;
    if (!sureDel) {
      setSureDel(true);
      delT.current = setTimeout(() => setSureDel(false), 4000);
      return;
    }
    if (delT.current) clearTimeout(delT.current);
    setSureDel(false);
    setDeleting(true);
    const r = await auth.deleteAccount();
    setDeleting(false);
    toast(r.ok ? 'Account deleted' : r.error);
  };

  const half = { flex: 1, flexBasis: 0, minWidth: 0 } as const;
  // .srow.inl select / input[type=time]: as wide as the browser makes them (a select fits its longest option)
  const inline = { maxWidth: '46%', paddingVertical: 8, paddingHorizontal: 10, height: 40, justifyContent: 'space-between' } as ViewStyle;

  return (
    <Fold id="set" title="Settings" tourId="set">
      <Group label="Money" first>
        <Row icon="salary" title="Monthly salary" hint="Used for your monthly plan and “Can I afford this?”" />
        <View style={st.sctl}>
          <View style={st.row}>
            <Field value={inc} onChangeText={setInc} placeholder="Total income" keyboardType="decimal-pad" accessibilityLabel="Total monthly income" style={half} />
            <Button title="Save" onPress={saveIncome} style={{ marginTop: 0 }} />
          </View>
        </View>
        <Row icon="cur2" title="Second currency" hint="If you also save in another currency, e.g. EUR and RSD" top />
        <View style={st.sctl}>
          <View style={st.row}>
            <Select
              label="Second currency"
              value={cur2}
              onChange={setCur2}
              options={[{ value: '', label: 'No second currency' }, ...CURRENCIES.map(([code]) => ({ value: code, label: code }))]}
              look={look}
              style={{ ...half, height: 47.2 }}
            />
            <Field value={bal2} onChangeText={setBal2} placeholder="Balance" keyboardType="decimal-pad" accessibilityLabel="Balance in the second currency" style={half} />
          </View>
          <Ghost title="Save second currency" onPress={saveCur2} style={{ marginTop: 8 }} />
        </View>
      </Group>

      <Group label="You & look">
        <Row
          icon="age"
          title="Age"
          hint="Optional, just for info"
          right={
            <Field
              value={age}
              onChangeText={setAgeText}
              onEndEditing={saveAge}
              placeholder="—"
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Age"
              style={st.age}
            />
          }
        />
        <Row
          icon="theme"
          title="Theme"
          top
          right={
            <Select
              label="Theme"
              value={state.theme}
              onChange={(v) => update((s) => ({ ...s, theme: v as ThemeName }))}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              look={look}
              style={{ ...inline, minWidth: 80 }}
              textStyle={{ flex: 0 }}
            />
          }
        />
        <Row
          icon="roast"
          title="Roast level"
          hint="How hard the app calls you out"
          top
          right={
            <Select
              label="Roast level"
              value={String(state.roast)}
              onChange={(v) => update((s) => ({ ...s, roast: parseInt(v, 10) as RoastLevel }))}
              options={[
                { value: '0', label: 'Mild' },
                { value: '1', label: 'Normal' },
                { value: '2', label: 'No mercy' },
              ]}
              look={look}
              style={{ ...inline, minWidth: 116 }}
              textStyle={{ flex: 0 }}
            />
          }
        />
      </Group>

      <Group label="Reminder">
        <Row
          icon="bell"
          title="Remind me to log expenses"
          hint="If you haven’t logged anything by then"
          right={
            <Switch
              on={rem.on}
              label="Remind me to log expenses"
              onChange={async (on) => {
                const r = setReminder(state, on);
                if (!r.ok) return;
                update(() => r.state);
                // The card on Home works either way; the notification needs the permission (asked only now).
                if (on && !(await askPermission())) return toast('Reminder on. Allow notifications for Lock In in your phone’s Settings to get it as a notification.');
                toast(r.toast);
              }}
            />
          }
        />
        <Row icon="clock" title="Reminder time" top right={<TimeField value={rem.time} onChange={(t) => update((s) => setReminderTime(s, t))} look={look} style={{ ...inline, height: 43.2, minWidth: 133.4 }} />} />
        <Row
          icon="coin"
          title="Don’t waste money"
          hint="At 9 am and 3 pm until you log something that day, then once at 9 pm"
          top
          right={
            <Switch
              on={!!state.nag?.on}
              label="Don’t waste money nudges"
              onChange={async (on) => {
                if (on && !(await askPermission())) return toast('Allow notifications for Lock In in your phone’s Settings first.');
                update((s) => ({ ...s, nag: { on } }));
                toast(on ? 'Nudges on' : 'Nudges off');
              }}
            />
          }
        />
        <Row
          icon="flame"
          title="Streak reminder"
          hint="At 8 pm, only if you haven’t logged anything that day"
          top
          right={
            <Switch
              on={!!state.streakNag}
              label="Streak reminder"
              onChange={async (on) => {
                if (on && !(await askPermission())) return toast('Allow notifications for Lock In in your phone’s Settings first.');
                update((s) => ({ ...s, streakNag: on }));
                toast(on ? 'Streak reminder on' : 'Streak reminder off');
              }}
            />
          }
        />
      </Group>

      <Group label="Help">
        <Row icon="tour" title="App tour" hint="Go through every feature again" right={<Arrow />} onPress={() => tour.start()} />
        <Row icon="demo" title="Demo" hint="See the app filled with sample data" right={<Arrow />} onPress={demoOn} top />
      </Group>

      {auth.available && (
        <Group label="Account">
          {auth.session ? (
            <>
              <Row icon="user" title={auth.session.user.email || 'Signed in'} hint={accessText(auth.access, Date.now())} />
              <Row icon="user" title="Your name" hint={myName || 'Not set'} right={<Arrow />} onPress={goals.askName} top />
              <Row
                icon="team"
                title="Shared goal alerts"
                hint="When someone in your goal pays in, joins or leaves"
                top
                right={<Switch on={!!state.goalPush} label="Shared goal alerts" onChange={goalAlerts} />}
              />
              <Row
                icon="team"
                title="Nudges from friends"
                hint="When someone in your goal nudges you"
                top
                right={<Switch on={nudgesOn} label="Nudges from friends" onChange={nudgeAlertsSwitch} />}
              />
              <Row icon="out" title="Sign out" hint="Only on this phone" right={<Arrow />} onPress={signOut} top />
            </>
          ) : (
            <Row icon="user" title="Sign in" hint="For shared goals and your plan. No password." right={<Arrow />} onPress={() => router.push('/sign-in')} />
          )}
        </Group>
      )}

      <Group label="Subscription">
        <Row icon="star" title="Lock-in Pro" hint="See plans (demo)" right={<Arrow />} onPress={soon} />
      </Group>

      <Group label="Privacy">
        <Row
          icon="lock"
          title="Your data is yours"
          hint="Amounts, descriptions and categories stay on your phone only, except shared goals, which sync with the people you share them with."
          hintStyle={{ lineHeight: 17.92 }} // .trk: line-height 1.4
        />
      </Group>

      <Group label="Legal & support">
        <Row icon="doc" title="Privacy Policy" right={<Arrow />} onPress={() => openWeb('privacy/')} demoOk />
        <Row icon="doc" title="Terms of Use" right={<Arrow />} onPress={() => openWeb('terms/')} demoOk top />
        <Row icon="mail" title="Support" hint="support@lockintracker.app" right={<Arrow />} onPress={() => openWeb('support/')} demoOk top />
      </Group>

      <Group label="Danger zone">
        <Row icon="trash" title={sure ? 'Tap again to delete everything' : 'Reset everything'} hint="Deletes all data from this phone" danger onPress={reset} />
        {auth.session && (
          <Row
            icon="trash"
            title={deleting ? 'Deleting…' : sureDel ? 'Tap again to delete your account' : 'Delete account'}
            hint="Deletes your account, friends and shared goals for good. Data on this phone stays. An App Store or Google Play subscription is not cancelled by this."
            danger
            onPress={deleteAccount}
            top
          />
        )}
      </Group>
    </Fold>
  );
}

const st = StyleSheet.create({
  sgl: { marginLeft: 4, marginBottom: 6, fontFamily: inter[600], fontSize: 13.6, lineHeight: 19.72 },
  sbox: { backgroundColor: 'rgba(127,127,127,0.07)', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  srow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  sic: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,127,127,0.12)' },
  stx: { flex: 1, minWidth: 0, gap: 2 },
  b: { fontFamily: inter[700], fontSize: 15.2, lineHeight: 22.04 },
  small: { fontFamily: inter[400], fontSize: 12.8, lineHeight: 17.28 },
  sctl: { paddingLeft: 60, paddingRight: 14, paddingBottom: 14 },
  row: { flexDirection: 'row', gap: 8 },
  arr: { fontFamily: inter[400], fontSize: 22.4, lineHeight: 32.48 },
  age: { width: 76, textAlign: 'center' },
  sw: { width: 48, height: 28, borderRadius: 999, justifyContent: 'center' },
  knob: { position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
});
