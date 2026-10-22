// Category icon tile (prototype .ic): the hand-drawn line icon in the category colour,
// on a 17% tint of that colour with a 32% inner ring.

import { View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { CATEGORY_ICONS } from './categoryIcons.data';

function hex(c: string) {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** color-mix(in srgb, c 74%, #000): the darker stroke used on light backgrounds. */
export const darken = (c: string, k = 0.74) => 'rgb(' + hex(c).map((v) => Math.round(v * k)).join(',') + ')';
export const tint = (c: string, a: number) => 'rgba(' + hex(c).join(',') + ',' + a + ')';

export function CategoryIcon({ cat, color, size = 26, radius = 8, style }: { cat: string; color: string; size?: number; radius?: number; style?: ViewStyle }) {
  const inner = CATEGORY_ICONS[cat] || CATEGORY_ICONS._;
  const icon = size * 0.62;
  const xml = `<svg viewBox="0 0 24 24" fill="none" stroke="${darken(color)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
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
      <SvgXml xml={xml} width={icon} height={icon} />
    </View>
  );
}
