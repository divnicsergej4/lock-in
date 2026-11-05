// The reminder before the free trial ends (a local notification, 2 days before, at 10:00): the plans screen
// promises it ("Day 5 · We remind you that the trial is ending"), so it is on unless switched off on
// "You're locked in." or in Settings > Subscription. Its date always comes from the store's own trial end.

import { Platform } from 'react-native';

import { trialReminderAt, trialReminderText, type StoreEntitlement } from '@/logic/paywall';

import { Notifications } from './expoNotifications';
import { channels, CHANNEL_REMINDERS, hasPermission } from './local';

const ID = 'trial-end';

/** Plans the reminder for `ent` again (or removes it: off, not a trial, cancelled, passed, no permission). */
export async function syncTrialReminder(ent: StoreEntitlement | null, on: boolean, now = Date.now()): Promise<void> {
  const N = Notifications;
  if (Platform.OS === 'web' || !N) return;
  try {
    await N.cancelScheduledNotificationAsync(ID);
    const at = on ? trialReminderAt(ent, now) : null;
    if (at == null || ent?.until == null || !(await hasPermission())) return;
    await channels();
    await N.scheduleNotificationAsync({
      identifier: ID,
      content: { ...trialReminderText(ent.until), data: { url: 'lockin://' } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_REMINDERS },
    });
  } catch {
    // planned again on the next start
  }
}
