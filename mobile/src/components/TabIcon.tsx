import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// Line icons from the prototype's bottom navigation (24x24, stroke 1.8, round caps).
export type TabIconName = 'home' | 'spending' | 'savings' | 'more';

export function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: ColorValue; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Path d="M4 10.5 12 4l8 6.5" {...stroke} />
          <Path d="M6 9.5V20h12V9.5" {...stroke} />
          <Path d="M10 20v-5.5h4V20" {...stroke} />
        </>
      )}
      {name === 'spending' && (
        <>
          <Path d="M4 20h16" {...stroke} />
          <Path d="M7 16.5v-5" {...stroke} />
          <Path d="M12 16.5V6.5" {...stroke} />
          <Path d="M17 16.5v-8" {...stroke} />
        </>
      )}
      {name === 'savings' && (
        <>
          <Circle cx="12" cy="12" r="8" {...stroke} />
          <Circle cx="12" cy="12" r="4" {...stroke} />
          <Circle cx="12" cy="12" r="1.3" fill={color} />
        </>
      )}
      {name === 'more' && (
        <>
          <Circle cx="5.5" cy="12" r="1.5" fill={color} />
          <Circle cx="12" cy="12" r="1.5" fill={color} />
          <Circle cx="18.5" cy="12" r="1.5" fill={color} />
        </>
      )}
    </Svg>
  );
}
