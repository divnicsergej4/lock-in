// TEMPORARY (3 Nov 2026): finding what makes the holo ring stutter on Android when it turns from one panel to the
// next. Only in a build with EXPO_PUBLIC_HOLO_LAB=1 (eas.json, preview) and only on Android, three switches under
// the ring turn off one suspect each; Andrija tries them and the one that makes it smooth is the cause. Remove this
// file, its uses in HoloRing.tsx and the eas.json variable once the cause is fixed (docs/PROJEKAT.md, Android).

import { Platform } from 'react-native';

export const HOLO_LAB = Platform.OS === 'android' && process.env.EXPO_PUBLIC_HOLO_LAB === '1';

export interface LabFlags {
  /** each panel drawn into an offscreen picture every frame (needsOffscreenAlphaCompositing) */
  offscreen: boolean;
  /** the front panel's zIndex changed from the UI thread in the middle of a turn */
  zIndexUI: boolean;
  /** JavaScript work when a panel arrives: front panel state, the scan line and the flash */
  switchJS: boolean;
}

export const LAB_DEFAULT: LabFlags = { offscreen: true, zIndexUI: true, switchJS: true };

export const LAB_ITEMS: { key: keyof LabFlags; label: string }[] = [
  { key: 'offscreen', label: '1 Slika panela' },
  { key: 'zIndexUI', label: '2 Redosled' },
  { key: 'switchJS', label: '3 JS pri prelasku' },
];
