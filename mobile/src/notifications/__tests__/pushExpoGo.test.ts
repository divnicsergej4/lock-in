// In Expo Go the push part of expo-notifications is never loaded: turning on shared goal alerts says they come
// with the full build, and signing out (disableGoalAlerts) still works.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'storeClient', expoConfig: { extra: { eas: { projectId: 'p' } } } },
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../expoLocal', () => ({ setNotificationHandler: jest.fn() }));
jest.mock('expo-notifications/build/getExpoPushTokenAsync', () => {
  throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
});

import { disableGoalAlerts, enableGoalAlerts } from '../push';

test('no push in Expo Go, nothing crashes', async () => {
  const client = { rpc: jest.fn(async () => ({ error: null })) };
  expect(await enableGoalAlerts(client as never)).toEqual({ ok: false, error: 'Shared goal alerts come with the full app build.' });
  expect(client.rpc).not.toHaveBeenCalled();
  await expect(disableGoalAlerts(client as never)).resolves.toBeUndefined();
});
