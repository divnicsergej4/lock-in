// Keeps the local notifications in step with the app (root layout): planned again when the reminder or nudge
// settings or "done for today" change, and every time the app comes back to the screen (so
// the 10 days ahead keep moving). Not in the demo (its data is not the user's). A tap on a shared goal alert
// opens Savings.

import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';

import { dayKey } from '@/logic/dates';
import { todayCount } from '@/logic/money';
import { useStore } from '@/store/StoreProvider';

import { Notifications } from './expoNotifications';
import { syncLocalNotifications } from './local';

export function useNotifications() {
  const { state, ready, demo } = useStore();
  const latest = useRef(state);
  latest.current = state;

  const now = Date.now();
  const k = dayKey(now);
  const doneToday = todayCount(state, now) > 0 || !!(state.chk || {})[k] || state.remDis === k;
  const key = JSON.stringify([state.rem, state.nag, state.streakNag, k, doneToday]);

  useEffect(() => {
    if (!ready || demo) return;
    const t = setTimeout(() => syncLocalNotifications(latest.current), 400);
    return () => clearTimeout(t);
  }, [key, ready, demo]);

  useEffect(() => {
    if (!ready || demo) return;
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && syncLocalNotifications(latest.current));
    return () => sub.remove();
  }, [ready, demo]);

  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if (r.notification.request.content.data?.url === 'lockin://savings') router.navigate('/savings');
    });
    return () => sub.remove();
  }, []);
}
