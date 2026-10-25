// Shared goal alerts (push from the server, migration 0005 / function send-goal-push). Turning them on registers
// this phone's Expo push token for the signed-in user; turning them off, signing out and deleting the account
// remove it. Needs a real phone and a real build (Expo Go on Android has no push since SDK 53, and the token
// needs the EAS project id). Call enableGoalAlerts only on the user's own tap (it may ask for the permission),
// e.g. the Settings switch or, once the shared goal screen exists, when joining a goal.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { askPermission } from './local';

const KEY = 'lockin-push-token'; // which token this phone registered, to remove it again
export type PushResult = { ok: true } | { ok: false; error: string };

export function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function enableGoalAlerts(client: SupabaseClient): Promise<PushResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return { ok: false, error: 'Shared goal alerts need a real phone.' };
  const pid = projectId();
  if (!pid) return { ok: false, error: 'Shared goal alerts come with the full app build.' };
  if (!(await askPermission())) return { ok: false, error: 'Allow notifications for Lock In in your phone’s Settings first.' };
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
  } catch {
    return { ok: false, error: 'Couldn’t turn on alerts on this phone. Try again later.' };
  }
  const { error } = await client.rpc('register_push_token', { token, platform: Platform.OS });
  if (error) return { ok: false, error: error.hint === 'rate_limited' ? error.message : 'Couldn’t reach the server. Check your connection.' };
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // the server has it; turning off later still works through getExpoPushTokenAsync
  }
  return { ok: true };
}

/** Best effort: without a connection the token stays on the server until the next sign-in or the app is removed. */
export async function disableGoalAlerts(client: SupabaseClient | null): Promise<void> {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(KEY);
    await AsyncStorage.removeItem(KEY);
  } catch {
    // nothing saved
  }
  if (token && client) await client.rpc('unregister_push_token', { token }).then(() => {}, () => {});
}
