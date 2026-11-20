// Čuvanje napretka na telefonu (AsyncStorage; na webu se koristi localStorage pregledača).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'zombie-rush-3d-save-v2';

export const DEFAULT_SAVE = {
  version: 2,
  coins: 0,
  level: 1, // nivo koji sledeći igra
  maxLevel: 1,
  stars: {}, // { [nivo]: 1..3 }
  upgrades: { damage: 0, rate: 0, ammo: 0, health: 0 },
  weapons: { pistol: true },
  equipped: 'pistol',
  daily: { last: null, streak: 0 },
  settings: { sound: true, music: true },
  stats: { kills: 0, games: 0, wins: 0 },
  tutorialDone: false,
};

function merge(data) {
  const d = data && typeof data === 'object' ? data : {};
  return {
    ...DEFAULT_SAVE,
    ...d,
    upgrades: { ...DEFAULT_SAVE.upgrades, ...(d.upgrades || {}) },
    weapons: { ...DEFAULT_SAVE.weapons, ...(d.weapons || {}) },
    daily: { ...DEFAULT_SAVE.daily, ...(d.daily || {}) },
    settings: { ...DEFAULT_SAVE.settings, ...(d.settings || {}) },
    stats: { ...DEFAULT_SAVE.stats, ...(d.stats || {}) },
    stars: { ...(d.stars || {}) },
  };
}

export async function loadSave() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return merge(raw ? JSON.parse(raw) : null);
  } catch {
    return merge(null);
  }
}

let timer = null;
let pending = null;
export function writeSave(data) {
  pending = data;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const d = pending;
    pending = null;
    AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
  }, 250);
}
