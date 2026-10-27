// Expo Go on Android (SDK 58): importing expo-notifications throws because a native module is missing. The app
// must keep running, just without phone notifications.
jest.mock('expo-notifications', () => {
  throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
});

import { initialState } from '@/logic/types';

import { Notifications } from '../expoNotifications';
import { askPermission, hasPermission, syncLocalNotifications } from '../local';

test('the module is missing instead of crashing the app', () => {
  expect(Notifications).toBeNull();
});

test('reminders say no permission and plan nothing', async () => {
  expect(await hasPermission()).toBe(false);
  expect(await askPermission()).toBe(false);
  await expect(syncLocalNotifications({ ...initialState, nag: { on: true } } as typeof initialState)).resolves.toBeUndefined();
});
