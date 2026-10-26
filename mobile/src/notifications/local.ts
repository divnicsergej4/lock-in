// Local notifications on the phone (no server): the expense reminder and the "don't waste money" nudges.
// Everything ahead is planned for DAYS_AHEAD days and planned again whenever the app opens or a setting or
// today's entries change (logging something drops the rest of today's nudges and moves one to 21:00). The permission is never asked here: only when the user turns a
// reminder on (askPermission), not when the app starts.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { nudgePlan, reminderTimes } from '@/logic/nudges';
import { REMINDER_TEXT, REMINDER_TITLE } from '@/logic/settings';
import type { AppState } from '@/logic/types';

export const CHANNEL_REMINDERS = 'reminders';
export const CHANNEL_GOALS = 'shared-goals'; // the same id the server sends with (send-goal-push)
const OURS = /^(rem|nudge)-/;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function channels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  await Notifications.setNotificationChannelAsync(CHANNEL_GOALS, { name: 'Shared goals', importance: Notifications.AndroidImportance.HIGH });
}

const allowed = (p: Notifications.NotificationPermissionsStatus) =>
  p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

export async function hasPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return allowed(await Notifications.getPermissionsAsync());
  } catch {
    return false;
  }
}

/** Asks for the permission (once; later the phone's Settings decide). Only call on the user's own tap. */
export async function askPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await channels();
    if (await hasPermission()) return true;
    return allowed(await Notifications.requestPermissionsAsync());
  } catch {
    return false;
  }
}

let queue: Promise<void> = Promise.resolve();

/** Plans our notifications again from `s` (one at a time, so two quick changes cannot double them). */
export function syncLocalNotifications(s: AppState, now = Date.now()): Promise<void> {
  queue = queue.then(() => sync(s, now)).catch(() => {});
  return queue;
}

async function sync(s: AppState, now: number) {
  if (Platform.OS === 'web') return;
  const planned = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(planned.filter((n) => OURS.test(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!(await hasPermission())) return;
  await channels();
  const plan = (identifier: string, date: number, content: Notifications.NotificationContentInput) =>
    Notifications.scheduleNotificationAsync({
      identifier,
      content: { ...content, data: { url: 'lockin://' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_REMINDERS },
    });
  for (const t of reminderTimes(s, now)) await plan(`rem-${t}`, t, { title: REMINDER_TITLE, body: REMINDER_TEXT });
  if (s.nag?.on) for (const n of nudgePlan(s, now)) await plan(`nudge-${n.at}`, n.at, { body: n.body });
}
