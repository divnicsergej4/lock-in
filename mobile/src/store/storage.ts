import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialState, type AppState } from '@/logic/types';

// Everything personal stays on the phone, under one key (like the prototype's localStorage 'lockin').
const KEY = 'lockin';

/** Fills in fields missing from older saves, so new fields never come back undefined. */
export function hydrate(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return { ...initialState };
  return { ...initialState, ...(raw as Partial<AppState>), v: 1 };
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return hydrate(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...initialState };
  }
}

export async function saveState(s: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or unavailable: keep running with the in-memory state.
  }
}
