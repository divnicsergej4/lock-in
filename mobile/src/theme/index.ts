import { useStore } from '@/store/StoreProvider';
import type { ThemeName } from '@/logic/types';

// Colours from the prototype's CSS (dark is the default, html[data-theme=light] the light theme),
// read from the browser's computed styles. `accent` is the prototype's --pink (it is green; the name
// stayed from an early version).
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
    hero: '#22e07a',
    inputBg: '#07120c',
    amtBg: 'rgba(127,127,127,0.06)',
    chipBg: '#0f2219',
    chipOn: '#123a26',
    hotBg: 'linear-gradient(160deg, #12361f, #0e1d15 70%)',
    hotBorder: '#246340',
    amberBg: 'linear-gradient(160deg, #241c09, #0d1812 75%)',
    amberBorder: '#4a3d14',
    tipBg: 'rgba(127,127,127,0.08)',
    challengeBg: 'rgba(34,224,122,0.08)',
    toastBg: '#16211b',
    toastInk: '#eef3ef',
    toastBorder: '#26352c',
    placeholder: '#757575',
    err: '#ff7b7b',
    /** category icons: color-mix(c 82%, white) on dark, color-mix(c 74%, black) on light */
    iconMix: 'white' as 'white' | 'black',
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
    hero: '#0b8f49',
    inputBg: '#f3f7f4',
    amtBg: 'rgba(127,127,127,0.06)',
    chipBg: '#f1f6f3',
    chipOn: '#dcf5e6',
    hotBg: 'linear-gradient(160deg, #dcf7e6, #f6fdf9 70%)',
    hotBorder: '#a9e3c0',
    amberBg: 'linear-gradient(160deg, #fff1d6, #ffffff 75%)',
    amberBorder: '#f3dfb4',
    tipBg: 'rgba(127,127,127,0.08)',
    challengeBg: 'rgba(34,224,122,0.08)',
    toastBg: '#0f1a14',
    toastInk: '#ffffff',
    toastBorder: '#0f1a14',
    placeholder: '#757575',
    err: '#ff7b7b',
    iconMix: 'black' as 'white' | 'black',
  },
} as const;

export type Palette = (typeof palettes)[ThemeName];

/** The holographic ring on Spending (prototype .hst / .vzp, dark and light). */
export const holo = {
  dark: {
    hc: 'rgba(130,255,195,0.5)', // corner marks
    hb: '#22e07a', // glow under the ring
    hr: 'rgba(130,255,195,0.55)', // ring lines
    panelBg: 'linear-gradient(162deg, #1b3e2c, #0b1d14 46%, #07120c)',
    panelBorder: 'rgba(120,255,190,0.18)',
    panelShadow: 'inset 0 1px 0 rgba(190,255,220,0.09), 0 0 30px rgba(34,224,122,0.09), 0 34px 44px -28px rgba(0,0,0,0.85)',
    grid: 'rgba(130,255,195,0.045)',
    dim: 'rgba(3,9,6,0.8)',
    scan: 'linear-gradient(180deg, rgba(34,224,122,0), rgba(34,224,122,0.06) 55%, rgba(140,255,200,0.2) 95%, rgba(215,255,232,0.95) 98.6%, rgba(34,224,122,0))',
    statBorder: 'rgba(130,255,195,0.14)',
    statBg: 'rgba(130,255,195,0.04)',
    cellBg: 'rgba(130,255,195,0.045)',
    cellBorder: 'rgba(130,255,195,0.07)',
    rowOn: 'rgba(130,255,195,0.07)',
    dot: 'rgba(130,255,195,0.18)',
    dotOnGlow: '0 0 10px rgba(34,224,122,0.65)',
  },
  light: {
    hc: 'rgba(18,184,95,0.5)',
    hb: '#12b85f',
    hr: 'rgba(18,160,85,0.5)',
    panelBg: 'linear-gradient(162deg, #ffffff, #f7fcf9 50%, #ecf7f1)',
    panelBorder: 'rgba(18,184,95,0.22)',
    panelShadow: 'inset 0 1px 0 #ffffff, 0 0 26px rgba(18,184,95,0.10), 0 30px 40px -28px rgba(13,31,21,0.38)',
    grid: 'rgba(18,140,80,0.05)',
    dim: 'rgba(238,245,240,0.8)',
    scan: 'linear-gradient(180deg, rgba(18,184,95,0), rgba(18,184,95,0.05) 55%, rgba(18,184,95,0.16) 95%, rgba(18,184,95,0.7) 98.6%, rgba(18,184,95,0))',
    statBorder: 'rgba(18,120,70,0.14)',
    statBg: 'rgba(18,120,70,0.04)',
    cellBg: 'rgba(18,120,70,0.045)',
    cellBorder: 'rgba(18,120,70,0.08)',
    rowOn: 'rgba(18,120,70,0.06)',
    dot: 'rgba(18,120,70,0.18)',
    dotOnGlow: '0 0 8px rgba(18,184,95,0.45)',
  },
} as const;

/** Section colour variants (prototype section.teal / .rose). */
export const sectionTints = {
  dark: { teal: ['linear-gradient(160deg, #0b2726, #0d1812 70%)', '#1f4a49'], rose: ['linear-gradient(160deg, #261218, #0d1812 75%)', '#4a2029'] },
  light: { teal: ['linear-gradient(160deg, #e3f7f5, #ffffff 70%)', '#c7ebe6'], rose: ['linear-gradient(160deg, #ffe8ec, #ffffff 75%)', '#f6ccd5'] },
} as const;

/** Flame tier colour for its label and progress bar (prototype TCD / TCL). */
export const tierColors = {
  dark: { or: '#ff8a00', bl: '#2fb8ff', rd: '#ff5a5a', gd: '#f2c200', pu: '#c77dff', gr: '#3ee08f', di: '#a8dcff', rb: '#ffb300', lg: '#ffd23f' },
  light: { or: '#c25e00', bl: '#0a78c2', rd: '#cf2b2b', gd: '#8f6c00', pu: '#7f3fc4', gr: '#0f8f4f', di: '#2f74b0', rb: '#a86400', lg: '#8f6c00' },
} as const;

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

/** Bricolage Grotesque by CSS weight (the intro and onboarding use it everywhere). */
export const brico = {
  400: 'BricolageGrotesque_400Regular',
  500: 'BricolageGrotesque_500Medium',
  600: 'BricolageGrotesque_600SemiBold',
  700: 'BricolageGrotesque_700Bold',
  800: 'BricolageGrotesque_800ExtraBold',
} as const;

/** Inter by CSS weight. */
export const inter = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
} as const;

export const radius = { card: 20, input: 16, button: 12 } as const;

export function useTheme(): { name: ThemeName; c: Palette } {
  const { state } = useStore();
  const name = state.theme === 'light' ? 'light' : 'dark';
  return { name, c: palettes[name] };
}
