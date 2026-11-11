// The ring on a phone that cannot draw it (Andrija, 4 Nov 2026, after an old Samsung stopped responding: "as plain as
// possible, windows that change, but only if the phone lags; on normal phones the nice holo"). The three panels sit
// side by side in a plain paging scroll: no 3D, no floating, no blinking, no scan line, no pictures kept in memory,
// nothing that runs every frame. HoloRing switches to it (see goLite there).

import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { holo, useTheme } from '@/theme';
import { tourBus, useTourTarget } from '@/tour/registry';

import { holoLayout, HN } from './holo';
import type { PanelProps } from './HoloRing';

const noop = () => {};

// plain colours instead of the ring's gradients (the middle of each gradient)
const BG = { dark: '#0f241a', light: '#f8fcfa' } as const;

export function HoloLite({ panels }: { panels: ((p: PanelProps) => ReactNode)[] }) {
  const { width: W } = useWindowDimensions();
  const { name, c } = useTheme();
  const k = holo[name];
  const pw = holoLayout(W).pw; // the same width as the ring's panels
  const [cur, setCur] = useState(0);
  // all three windows as tall as the tallest
  const [tall, setTall] = useState(0);
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const stage = useTourTarget('vzc'); // the ring's stage, lit up by the tour
  useEffect(() => {
    tourBus.holoAct = 0; // the tour waits for the line (1) and the calendar (2)
  }, []);
  const show = (i: number) => {
    setCur(i);
    tourBus.holoAct = i;
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(HN - 1, Math.round(e.nativeEvent.contentOffset.x / W)));
    if (i !== cur) show(i);
  };
  return (
    <View>
      <View ref={stage}>
        <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd}>
          {panels.map((render, i) => (
            <View key={i} style={[st.page, { width: W }]}>
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  setTall((t) => (h > t + 0.5 ? h : t));
                }}
                style={[st.card, { width: pw, minHeight: tall || undefined, backgroundColor: BG[name], borderColor: k.panelBorder }]}
              >
                {render({ activation: 0, grow: 0, onNatural: noop })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={st.dots}>
        {Array.from({ length: HN }, (_, j) => (
          <Pressable
            key={j}
            accessibilityRole="button"
            accessibilityState={{ selected: j === cur }}
            hitSlop={8}
            onPress={() => {
              ref.current?.scrollTo({ x: j * W, animated: true });
              show(j);
            }}
          >
            <View style={[st.dot, { width: j === cur ? 22 : 8, backgroundColor: j === cur ? c.accent : k.dot }]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  page: { alignItems: 'center', paddingTop: 12, paddingBottom: 14 },
  // the ring's panel without its looks (HoloPanel .vzp: padding 17 / 17 / 15, radius 22, 1 px border)
  card: { borderRadius: 22, borderWidth: 1, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 2, paddingBottom: 4 },
  dot: { height: 8, borderRadius: 4 },
});
