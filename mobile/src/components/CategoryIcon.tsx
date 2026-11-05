// Category icon tile (prototype .ic) and the bare inline icon (.ei): the hand-drawn line icon in the
// category colour, on a 17% tint of that colour with a 32% inner ring. On dark backgrounds the line is
// the colour mixed 82% with white, on light backgrounds 74% with black (prototype color-mix).

import { View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { CATEGORY_ICONS } from './categoryIcons.data';

function hex(c: string) {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** color-mix(in srgb, c 74%, #000): the darker stroke used on light backgrounds. */
export const darken = (c: string, k = 0.74) => 'rgb(' + hex(c).map((v) => Math.round(v * k)).join(',') + ')';
/** color-mix(in srgb, c 82%, #fff): the lighter stroke used on dark backgrounds. */
export const lighten = (c: string, k = 0.82) => 'rgb(' + hex(c).map((v) => Math.round(v * k + 255 * (1 - k))).join(',') + ')';
export const tint = (c: string, a: number) => 'rgba(' + hex(c).join(',') + ',' + a + ')';

export type IconMix = 'white' | 'black';
const strokeFor = (color: string, mix: IconMix) => (mix === 'white' ? lighten(color) : darken(color));

const xmlFor = (cat: string, stroke: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${CATEGORY_ICONS[cat] || CATEGORY_ICONS._}</svg>`;

export function CategoryIcon({ cat, color, size = 26, radius = 8, mix = 'black', style }: { cat: string; color: string; size?: number; radius?: number; mix?: IconMix; style?: ViewStyle }) {
  const icon = size * 0.62;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: tint(color, 0.17),
          boxShadow: `inset 0 0 0 1px ${tint(color, 0.32)}`,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <SvgXml xml={xmlFor(cat, strokeFor(color, mix))} width={icon} height={icon} />
    </View>
  );
}

/** The bare icon used inside text (prototype .ei: 1.15em, no tile). */
export function InlineIcon({ cat, color, size, mix }: { cat: string; color: string; size: number; mix: IconMix }) {
  return <SvgXml xml={xmlFor(cat, strokeFor(color, mix))} width={size} height={size} />;
}
