// Ring panel 3: spending per day of a month. Greener = more spent; today is outlined. Tap a day for its
// totals; ‹ › change the month. On arrival the days ripple in from the top-left (prototype cal + calWave).

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { InlineIcon } from '@/components/CategoryIcon';
import { Ghost } from '@/components/home/Section';
import { calendar, calendarDay, WEEKDAYS_SHORT, type CalendarCell } from '@/logic/charts';
import { useStore } from '@/store/StoreProvider';
import { holo, inter, useTheme } from '@/theme';

import type { PanelProps } from './HoloRing';
import { Arrive, Column, PanelHead, Spare, useNaturalHeight } from './PanelParts';

const POP = [0.2, 0.9, 0.25, 1.15];

/** Today's cell sends out one green pulse after the ripple (box-shadow 0 → 12 px, fading). */
function Pulse({ play }: { play: number }) {
  const k = useSharedValue(1);
  useEffect(() => {
    if (!play) return;
    k.value = 0;
    k.value = withDelay(760, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [play, k]);
  const anim = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - k.value),
    transform: [{ scaleX: 1 + (24 * k.value) / 38 }, { scaleY: 1 + (24 * k.value) / 46 }],
  }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 10, backgroundColor: 'rgba(34,224,122,1)' }, anim]} />;
}

function Cell({ cell, row, col, wave, rowH, onPress }: { cell: CalendarCell; row: number; col: number; wave: number; rowH: number; onPress: () => void }) {
  const { c, name } = useTheme();
  const k = holo[name];
  if (!cell.day) return <View style={{ flex: 1, height: rowH }} />;
  return (
    <Arrive play={wave} delay={60 + (row + col) * 26} duration={420} from={{ opacity: 0, y: 10, scale: 0.7 }} ease={POP} style={{ flex: 1, height: rowH }}>
      {cell.today && <Pulse play={wave} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'Day ' + cell.day}
        onPress={onPress}
        style={[
          st.d,
          { height: rowH, backgroundColor: cell.alpha ? `rgba(34,224,122,${cell.alpha.toFixed(2)})` : k.cellBg, borderColor: k.cellBorder },
        ]}
      >
        <Text style={[st.dn, { color: c.ink }]}>{cell.day}</Text>
        <Text style={[st.da, { color: c.ink }]}>{cell.label}</Text>
      </Pressable>
      {/* outline: 2px solid, outside the cell */}
      {cell.today && <View pointerEvents="none" style={[st.today, { borderColor: c.accent }]} />}
    </Arrive>
  );
}

export function CalendarPanel({ activation, grow, onNatural, month, onMonth }: PanelProps & { month: { y: number; m: number }; onMonth: (d: number) => void }) {
  const { state } = useStore();
  const { c } = useTheme();
  const cal = useMemo(() => calendar(state, month.y, month.m, Date.now()), [state, month]);
  const [picked, setPicked] = useState<number | null>(null);
  const nat = useNaturalHeight(onNatural, 0);
  const rows: CalendarCell[][] = [];
  for (let i = 0; i < cal.cells.length; i += 7) rows.push(cal.cells.slice(i, i + 7));
  while (rows.length && rows[rows.length - 1].length < 7) rows[rows.length - 1].push({ day: 0, amount: 0, label: '', alpha: 0, today: false });
  const rowH = 44 + grow;

  // the ripple plays when the panel arrives and when the month changes
  const [wave, setWave] = useState(0);
  useEffect(() => {
    if (activation) setWave((w) => w + 1);
  }, [activation]);
  const turn = (d: number) => {
    setPicked(null);
    onMonth(d);
    setWave((w) => w + 1);
  };

  const day = picked ? calendarDay(state, month.y, month.m, picked) : null;
  return (
    <Column onLayout={(h) => nat.onColumn(h - rows.length * grow)}>
      <PanelHead title="Daily spending" />
      <View style={st.calh}>
        <Ghost title="‹" onPress={() => turn(-1)} style={st.nav} />
        <Text style={[st.title, { color: c.ink }]}>{cal.title}</Text>
        <Ghost title="›" onPress={() => turn(1)} style={st.nav} />
      </View>
      <View style={st.grid}>
        <View style={st.row}>
          {WEEKDAYS_SHORT.map((d, i) => (
            <Arrive key={d} play={wave} delay={i * 22} duration={280} from={{ opacity: 0 }} ease={[0.25, 0.1, 0.25, 1]} style={{ flex: 1 }}>
              <Text style={[st.h, { color: c.mute }]}>{d}</Text>
            </Arrive>
          ))}
        </View>
        {rows.map((r, ri) => (
          <View key={ri} style={st.row}>
            {r.map((cell, ci) => (
              <Cell key={ci} cell={cell} row={ri + 1} col={ci} wave={wave} rowH={rowH} onPress={() => setPicked(cell.day)} />
            ))}
          </View>
        ))}
      </View>
      <View style={st.hcd}>
        {day && (
          <Text style={[st.small, { color: c.mute }]}>
            <Text style={{ fontFamily: inter[700] }}>{day.head}</Text>
            {day.summary}
            {day.items.map((it, i) => (
              <Text key={i}>
                {'\n'}
                <InlineIcon cat={it.cat} color={it.color} size={14.7} mix={c.iconMix} />
                {it.text}
              </Text>
            ))}
            {day.more ? '\n' + day.more : ''}
          </Text>
        )}
      </View>
      <Spare onLayout={nat.onSpare} />
    </Column>
  );
}

const st = StyleSheet.create({
  calh: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nav: { width: 38, padding: 6 },
  title: { flex: 1, marginHorizontal: 0, fontFamily: inter[700], fontSize: 16, lineHeight: 23.2 },
  grid: { gap: 4 },
  row: { flexDirection: 'row', gap: 4 },
  h: { fontFamily: inter[400], fontSize: 10.4, lineHeight: 15.08, textAlign: 'center' },
  d: { borderRadius: 10, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 2, justifyContent: 'space-between', alignItems: 'center' },
  dn: { fontFamily: inter[400], fontSize: 9.92, lineHeight: 14.384 },
  da: { fontFamily: inter[700], fontSize: 11.52, lineHeight: 16.7 },
  today: { position: 'absolute', left: -2, right: -2, top: -2, bottom: -2, borderRadius: 12, borderWidth: 2 },
  hcd: { marginTop: 8, minHeight: 18 },
  small: { fontFamily: inter[400], fontSize: 12.8, lineHeight: 18.56 },
});
