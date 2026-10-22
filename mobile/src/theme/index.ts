import { useStore } from '@/store/StoreProvider';
import type { ThemeName } from '@/logic/types';

// Colours from the prototype's CSS variables (:root and html[data-theme=light]).
// `accent` is the prototype's --pink (it is green; the name stayed from an early version).
export const palettes = {
  dark: {
    bg: '#050b08',
    card: '#0d1812',
    ink: '#e8fff1',
    mute: '#86ab95',
    accent: '#22e07a',
    lime: '#b8ff5c',
    line: '#1b3326',
    minus: '#ff7b7b',
    navBg: 'rgba(7,12,9,0.92)',
    onAccent: '#03130a',
  },
  light: {
    bg: '#f4f8f5',
    card: '#ffffff',
    ink: '#0d1f15',
    mute: '#5d7466',
    accent: '#12b85f',
    lime: '#4d8f12',
    line: '#dbe7df',
    minus: '#d93a3a',
    navBg: 'rgba(255,255,255,0.94)',
    onAccent: '#03130a',
  },
} as const;

export type Palette = (typeof palettes)[ThemeName];

// Chart colours (prototype DCd / DCl).
export const chartColors = {
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
} as const;

// In the app everything is Inter; Bricolage Grotesque is used on the intro and onboarding.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  display: 'BricolageGrotesque_800ExtraBold',
  displaySemibold: 'BricolageGrotesque_600SemiBold',
  displayRegular: 'BricolageGrotesque_400Regular',
} as const;

export const radius = { card: 20, input: 16, button: 12 } as const;

export function useTheme(): { name: ThemeName; c: Palette } {
  const { state } = useStore();
  const name = state.theme === 'light' ? 'light' : 'dark';
  return { name, c: palettes[name] };
}
