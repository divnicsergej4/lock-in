// TEMPORARY (4 Nov 2026): finding why the app gets slow while the holo ring is on screen (Android). Only on Android
// and only in an update on the "preview" channel: an FPS meter and switches under the ring that turn off one suspect
// each. Andrija reads the meter with each switch, and only the cause gets fixed. Remove this file and its uses in
// HoloRing.tsx and HoloPanel.tsx afterwards (docs/PROJEKAT.md, Android).

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

function channel(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates').channel ?? null;
  } catch {
    return null;
  }
}

export const HOLO_LAB = Platform.OS === 'android' && channel() === 'preview';

export interface LabFlags {
  /** the panels bobbing up and down (7 s loop, every frame) */
  float: boolean;
  /** the blinking tag dots and the turning empty donut (every frame) */
  blink: boolean;
  /** the glow and drop shadow outside each panel */
  shadow: boolean;
  /** each panel's gradient, grid and inner shadow (kept as a bitmap) */
  chrome: boolean;
  /** the charts and the calendar inside the panels */
  content: boolean;
  /** the two side panels */
  sides: boolean;
}

export const LAB_ITEMS: { key: keyof LabFlags; label: string }[] = [
  { key: 'float', label: '1 Lebdenje' },
  { key: 'blink', label: '2 Treptanje' },
  { key: 'shadow', label: '3 Senke' },
  { key: 'chrome', label: '4 Pozadina panela' },
  { key: 'content', label: '5 Grafikoni' },
  { key: 'sides', label: '6 Bocni paneli' },
];

let flags: LabFlags = { float: true, blink: true, shadow: true, chrome: true, content: true, sides: true };
const subs = new Set<() => void>();

/** The same flags for worklets (UI thread). */
export const labSV: { value: LabFlags } = typeof makeMutable === 'function' ? makeMutable(flags) : { value: flags }; // tests mock Reanimated

export function toggleLab(key: keyof LabFlags) {
  flags = { ...flags, [key]: !flags[key] };
  labSV.value = flags;
  subs.forEach((f) => f());
}

export function useHoloLab(): LabFlags {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => flags,
  );
}
