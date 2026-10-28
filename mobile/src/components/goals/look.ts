// Colours and fonts of the shared goal screens (Andrija, 28 October 2026). Dark: exactly his values (the app's
// own dark theme). Light: the app's light theme, with the gold made darker where it is text, so it can be read.

import { brico, inter, useTheme } from '@/theme';

export const F = { display: brico[800], displayBold: brico[700], text: inter[400], medium: inter[500], semi: inter[600], bold: inter[700], heavy: inter[800] };

const dark = {
  bg: '#050b08',
  card: '#0d1812',
  line: '#1b3326',
  ink: '#e8fff1',
  mute: '#86ab95',
  green: '#22e07a',
  gold: '#f5c84b', // fills: buttons, the lock, pins
  goldInk: '#f5c84b', // gold text
  goldSoft: '#d9c27d', // the goal name under a sheet title, "of 2,000 €"
  goldBg: 'linear-gradient(160deg, #2a2209, #0d1812 70%)',
  goldLine: '#5a4a16',
  goldChip: 'rgba(245,200,75,0.14)',
  onGold: '#1a1000',
  track: '#16291f',
  red: '#ff7b7b',
  redChip: 'rgba(255,123,123,0.12)',
  greenChip: 'rgba(34,224,122,0.12)',
  flame: '#ff8a3d',
  flameChip: 'rgba(255,138,61,0.14)',
  scrim: 'rgba(0,0,0,0.72)',
  handle: '#24503a',
};
export type Look = typeof dark;

const light: Look = {
  bg: '#f4f8f5',
  card: '#ffffff',
  line: '#dbe7df',
  ink: '#0d1f15',
  mute: '#5d7466',
  green: '#12b85f',
  gold: '#f5c84b',
  goldInk: '#9a6f00',
  goldSoft: '#8a6a12',
  goldBg: 'linear-gradient(160deg, #fff4d1, #ffffff 70%)',
  goldLine: '#efd88f',
  goldChip: 'rgba(245,200,75,0.22)',
  onGold: '#1a1000',
  track: '#e8efe9',
  red: '#d93a3a',
  redChip: 'rgba(217,58,58,0.10)',
  greenChip: 'rgba(18,184,95,0.12)',
  flame: '#c25e00',
  flameChip: 'rgba(255,138,61,0.16)',
  scrim: 'rgba(0,0,0,0.45)',
  handle: '#c9d8cf',
};

export function useLook(): Look {
  return useTheme().name === 'dark' ? dark : light;
}
