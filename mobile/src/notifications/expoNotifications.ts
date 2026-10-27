// expo-notifications, or null where it cannot load. In Expo Go on Android (SDK 58) just importing it throws
// "Cannot find native module 'ExpoTopicSubscriptionModule'" (Expo Go has no push modules there), which took the
// whole app down at start. There the app runs without phone notifications (the reminder card on Home still
// works); Expo Go on iPhone and real builds have the module.

import type * as ExpoNotifications from 'expo-notifications';

function load(): typeof ExpoNotifications | null {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

export const Notifications = load();
