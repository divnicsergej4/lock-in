// The local notifications part of expo-notifications (expoLocal.ts), or null where it cannot load. The whole
// package is never imported at start: in Expo Go on Android (SDK 58) its push modules are missing and the import
// threw "Cannot find native module 'ExpoTopicSubscriptionModule'", which took the whole app down. Local
// reminders work in Expo Go too; push (shared goal alerts) only in a real build, loaded when turned on (push.ts).

import Constants, { ExecutionEnvironment } from 'expo-constants';

import type * as Local from './expoLocal';

function load(): typeof Local | null {
  try {
    return require('./expoLocal');
  } catch {
    return null;
  }
}

export const Notifications = load();

/** Running inside Expo Go (no push there on Android since SDK 53). */
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
