// The part of expo-notifications the local reminders need, imported piece by piece: the package's index also
// loads the push modules, and Expo Go on Android has none of them ("Cannot find native module
// 'ExpoTopicSubscriptionModule'"). The push token is loaded only when shared goal alerts are turned on, and
// never in Expo Go (push.ts).

export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { addNotificationResponseReceivedListener } from 'expo-notifications/build/NotificationsEmitter';
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';
