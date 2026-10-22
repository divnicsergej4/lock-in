jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialState } from '@/logic/types';

import { hydrate, loadState, saveState } from '../storage';

describe('local storage', () => {
  beforeEach(() => AsyncStorage.clear());

  test('first launch gives the empty state', async () => {
    expect(await loadState()).toEqual(initialState);
  });

  test('saved data comes back after a restart', async () => {
    const s = { ...initialState, start: 750, cur: 'USD', exp: [{ amt: 4, cat: 'Coffee', t: 1, note: 'latte' }] };
    await saveState(s);
    expect(await loadState()).toEqual(s);
  });

  test('fields missing from older saves get defaults', () => {
    expect(hydrate({ start: 10 })).toEqual({ ...initialState, start: 10 });
  });

  test('broken data falls back to the empty state instead of crashing', async () => {
    await AsyncStorage.setItem('lockin', '{not json');
    expect(await loadState()).toEqual(initialState);
  });
});
