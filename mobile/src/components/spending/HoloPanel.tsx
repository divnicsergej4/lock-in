// One floating panel of the holographic ring (prototype .vzs > .vzf > .vzp): glassy gradient card with a
// fading grid, corner marks, the scan line and flash when it becomes the front panel, and the dimming
// when it turns away. Its content measures itself so the ring can make all three panels equally tall.

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, G, Line, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';

import { holo, useTheme } from '@/theme';

/** Fading 24 px grid (.vzp::before: lines every 24 px, faded out towards the bottom). */
function Grid({ w, h, color }: { w: number; h: number; color: string }) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = 23; x < w; x += 24) xs.push(x + 0.5);
  for (let y = 23; y < h; y += 24) ys.push(y + 0.5);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={1} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0.3} />
          <Stop offset="0.85" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
        <Mask id="gm">
          <Rect x={0} y={0} width={w} height={h} fill="url(#gf)" />
        </Mask>
      </Defs>
      <G mask="url(#gm)">
        {xs.map((x) => (
          <Line key={'x' + x} x1={x} y1={0} x2={x} y2={h} stroke={color} strokeWidth={1} />
        ))}
        {ys.map((y) => (
          <Line key={'y' + y} x1={0} y1={y} x2={w} y2={y} stroke={color} strokeWidth={1} />
        ))}
      </G>
    </Svg>
  );
}

/** The eight corner marks (.vzp::after: 13 × 1.5 px, 9 px in from the edges). */
function Corners({ color }: { color: string }) {
  const a = 13;
  const t = 1.5;
  const marks: object[] = [];
  for (const v of ['top', 'bottom'] as const)
    for (const hz of ['left', 'right'] as const) {
      marks.push({ [v]: 9, [hz]: 9, width: a, height: t });
      marks.push({ [v]: 9, [hz]: 9, width: t, height: a });
    }
  return (
    <>
      {marks.map((m, i) => (
        <View key={i} pointerEvents="none" style={[{ position: 'absolute', backgroundColor: color }, m]} />
      ))}
    </>
  );
}

export function HoloPanel({
  w,
  h,
  dim,
  activation,
  children,
}: {
  w: number;
  h: number | undefined;
  dim: SharedValue<number>;
  activation: number; // changes each time this panel becomes the front one
  children: ReactNode;
}) {
  const { name } = useTheme();
  const k = holo[name];
  const inner = h ? h - 2 : 0;

  // scan line: translateY(−90 → −60 → H+10), opacity 0 → 1, 700 ms cubic-bezier(.42,0,.22,1);
  // content flash: opacity .35 → 1 → .72 → 1 over 420 ms
  const scanY = useSharedValue(-90);
  const scanO = useSharedValue(0);
  const flash = useSharedValue(1);
  useEffect(() => {
    if (!activation || !h) return;
    const ease = Easing.bezier(0.42, 0, 0.22, 1);
    scanY.value = -90;
    scanO.value = 0;
    scanY.value = withSequence(withTiming(-60, { duration: 56, easing: ease }), withTiming(h + 10, { duration: 644, easing: ease }));
    scanO.value = withSequence(withTiming(1, { duration: 56 }), withTiming(1, { duration: 644 }), withTiming(0, { duration: 0 }));
    flash.value = 0.35;
    flash.value = withSequence(withTiming(1, { duration: 118 }), withTiming(0.72, { duration: 59 }), withTiming(1, { duration: 243 }));
  }, [activation, h, scanY, scanO, flash]);

  // the opacity sits on the clipping box, so when the scan is not running the whole box is skipped
  const scanBox = useAnimatedStyle(() => ({ opacity: scanO.value }));
  const scanStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scanY.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <View style={[st.vzp, { width: w, height: h }]}>
      {/* the panel's still look (gradient, border, grid, corner marks and its three shadows) is drawn once
          and kept as a bitmap; otherwise iOS redraws the masked shadows on every frame of a scroll */}
      <View
        pointerEvents="none"
        shouldRasterizeIOS
        renderToHardwareTextureAndroid
        style={[st.chrome, { backgroundImage: k.panelBg, borderColor: k.panelBorder, boxShadow: k.panelShadow }]}
      >
        {!!h && (
          <View style={[StyleSheet.absoluteFill, { borderRadius: 21, overflow: 'hidden' }]}>
            <Grid w={w - 2} h={inner} color={k.grid} />
          </View>
        )}
        <Corners color={k.hc} />
      </View>
      <Animated.View style={[st.vzi, flashStyle]}>{children}</Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 21, overflow: 'hidden' }, scanBox]}>
        <Animated.View style={[st.scan, { backgroundImage: k.scan }, scanStyle]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 21, backgroundColor: k.dim }, dimStyle]} />
    </View>
  );
}

const st = StyleSheet.create({
  // the 1 px border is drawn by `chrome`, so it is part of the padding here (16 + 1, 14 + 1)
  vzp: { borderRadius: 22, paddingTop: 17, paddingHorizontal: 17, paddingBottom: 15 },
  chrome: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderWidth: 1 },
  vzi: { flexGrow: 1 },
  scan: { position: 'absolute', left: 0, right: 0, top: 0, height: 70 },
});
