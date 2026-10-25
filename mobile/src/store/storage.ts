import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialState, type AppState } from '@/logic/types';

// Everything personal stays on the phone, under one key (like the prototype's localStorage 'lockin').
const KEY = 'lockin';

/** Fills in fields missing from older saves, so new fields never come back undefined. */
export function hydrate(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return { ...initialState };
  return { ...initialState, ...(raw as Partial<AppState>), v: 1 };
}

// The user's data from before the guided tour (prototype 'lockin_tut'): if the app closed mid-tour,
// the practice entries are dropped and this comes back.
const TOUR_KEY = 'lockin_tut';

export async function loadState(): Promise<AppState> {
  try {
    const tour = await AsyncStorage.getItem(TOUR_KEY);
    if (tour) {
      const s = { ...hydrate(JSON.parse(tour)), tutSeen: 1 };
      await AsyncStorage.setItem(KEY, JSON.stringify(s));
      await AsyncStorage.removeItem(TOUR_KEY);
      return s;
    }
    const raw = await AsyncStorage.getItem(KEY);
    return hydrate(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...initialState };
  }
}

export async function saveTourSnapshot(s: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(TOUR_KEY, JSON.stringify(s));
  } catch {
    // without the snapshot the tour still ends with the data put back from memory
  }
}

export async function clearTourSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOUR_KEY);
  } catch {
    // nothing to do
  }
}

export async function saveState(s: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or unavailable: keep running with the in-memory state.
  }
}
