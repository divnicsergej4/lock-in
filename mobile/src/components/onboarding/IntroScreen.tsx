// First intro screen (prototype #s-intro): the tagline, the character scene, and the dark sheet with
// "Then lock the fuck in.", the receipt and "Get started". Sizes and colours are the browser's
// computed values from the prototype.

import { Canvas, Group, Path as SkPath } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type TextLayoutEvent } from 'react-native';

type TextLayoutLine = TextLayoutEvent['nativeEvent']['lines'][number];
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';

import { Character, characterHeight } from '@/components/intro/Character';
import { bezier } from '@/components/intro/cssAnim';
import { brico } from '@/theme';

import { Enter } from './Enter';

// The scene plays again: after the padlock pops (4.51 s) he stays locked in for 3.2 s, the drawing
// fades out (.35 s), and 0.38 s after the fade began a fresh copy fades in and starts from the top.
const FADE_OUT_AT = 4510 + 3200;
const RESTART = FADE_OUT_AT + 380;
const EASE = [0.25, 0.1, 0.25, 1];

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function IntroScreen({ onStart }: { onStart: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  // ---- scene clock (ms), on the UI thread ----
  const elapsed = useSharedValue(0);
  useFrameCallback((f) => {
    elapsed.value = f.timeSinceFirstFrame;
  });
  const clock = useDerivedValue(() => (reduce ? -1 : elapsed.value % RESTART));
  const sceneOpacity = useDerivedValue(() => {
    if (reduce) return 1;
    const e = elapsed.value;
    const t = e % RESTART;
    if (t >= FADE_OUT_AT) return 1 - bezier(EASE, Math.min(1, (t - FADE_OUT_AT) / 350));
    if (e >= RESTART && t < 350) return bezier(EASE, t / 350);
    return 1;
  });
  // the underline is drawn by a "pen" 3.8 s into each scene: .75s cubic-bezier(.6,0,.3,1)
  const pen = useDerivedValue(() => (reduce ? 1 : bezier([0.6, 0, 0.3, 1], Math.min(1, Math.max(0, (clock.value - 3800) / 750)))));

  const chrW = Math.min(290, W * 0.76);

  return (
    <View style={[st.root, { backgroundColor: '#eefcf4' }]}>
      {/* soft white oval behind the top half: width 150%, height 62%, left -25%, top -26% */}
      <View style={[st.oval, { width: W * 1.5, height: W * 1.5, left: -W * 0.25, top: -H * 0.26 + (H * 0.62 - W * 1.5) / 2, transform: [{ scaleY: (H * 0.62) / (W * 1.5) }] }]} />

      <View style={[st.itop, { paddingTop: 26 + insets.top }]}>
        <Enter kind="pop" delay={0}>
          <Text style={st.tag}>
            The only finance tracker that forces you to <Text style={st.lk}>Lock-in</Text> 🔒
          </Text>
        </Enter>
        <Enter kind="pop" delay={140} style={st.stage}>
          <View style={{ width: chrW, height: characterHeight(chrW), marginBottom: -6 }}>
            <Character width={chrW} clock={clock} opacity={sceneOpacity} />
          </View>
        </Enter>
      </View>

      <Enter kind="up" delay={80}>
        <View style={[st.ibot, { paddingBottom: 26 + insets.bottom }]}>
          <SheetTop width={W} />
          <View style={st.sheetBody} />
          <Enter kind="pop" delay={320}>
            <Headline pen={pen} />
          </Enter>
          <Enter kind="pop" delay={410} style={st.rcw}>
            <Receipt />
          </Enter>
          <Enter kind="pop" delay={500}>
            <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => [st.go, pressed && { opacity: 0.85 }]}>
              <Text style={st.goT}>Get started</Text>
            </Pressable>
          </Enter>
          <Enter kind="pop" delay={590}>
            <Text style={st.sm}>Setup takes 10 seconds</Text>
          </Enter>
          <Enter kind="apop" delay={520} style={st.appi}>
            <Text style={st.appiT}>🔒</Text>
          </Enter>
        </View>
      </Enter>
    </View>
  );
}

/** The dark sheet's rounded top: border-radius 50% 50% 0 0 / 46px 46px 0 0 (an elliptical arch). */
function SheetTop({ width }: { width: number }) {
  const r = width / 2;
  return (
    <Svg width={width} height={46} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Path d={`M0 46 A${r} 46 0 0 1 ${width} 46 Z`} fill="#0c1611" />
    </Svg>
  );
}

/**
 * "Tired of being broke ... yourself?" and the green "Then lock the fuck in." (an inline-block in the
 * prototype: it stays on the last line when it fits there, otherwise it goes to its own line).
 */
function Headline({ pen }: { pen: SharedValue<number> }) {
  const [boxW, setBoxW] = useState(0);
  const [last, setLast] = useState<TextLayoutLine | null>(null);
  const [scrW, setScrW] = useState(0);
  const space = 23.2 * 0.24;
  const inline = !!last && boxW > 0 && scrW > 0 && last.x + last.width + space + scrW <= boxW;
  const scrPos = inline && last ? { position: 'absolute' as const, left: last.x + last.width + space, top: last.y } : { marginTop: 4 };
  return (
    <View style={st.ihBox} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <Text style={st.ih} onTextLayout={(e) => setLast(e.nativeEvent.lines[e.nativeEvent.lines.length - 1] || null)}>
        Tired of being broke and managing your finances all by yourself?
      </Text>
      <View style={[st.scr, scrPos]} onLayout={(e) => setScrW(e.nativeEvent.layout.width)}>
        <Text style={[st.ih, { color: '#5dff9d' }]}>Then lock the fuck in.</Text>
        <Underline pen={pen} width={scrW + 8} />
      </View>
    </View>
  );
}

/** The hand-drawn underline: viewBox 240×20 stretched to the text width (preserveAspectRatio none). */
function Underline({ pen, width }: { pen: SharedValue<number>; width: number }) {
  if (width <= 8) return null;
  return (
    <Canvas pointerEvents="none" style={{ position: 'absolute', left: -4 - 4, bottom: -12 - 4, width: width + 8, height: 16 + 8 }}>
      <Group transform={[{ translateX: 4 }, { translateY: 4 }, { scaleX: width / 240 }, { scaleY: 16 / 20 }]}>
        <SkPath
          path="M3 9 C40 3 80 13 120 7 S200 4 236 8 M232 12 C180 17 100 9 10 15"
          style="stroke"
          strokeWidth={3.2}
          strokeCap="round"
          strokeJoin="round"
          color="#12b85f"
          start={0}
          end={pen}
        />
      </Group>
    </Canvas>
  );
}

/** The paper receipt with dotted leaders and a scalloped bottom edge. */
function Receipt() {
  const rows: [string, string][] = [
    ['Bank login', 'NOT NEEDED'],
    ['Spreadsheets', 'NOT NEEDED'],
    ['Your data', 'ON YOUR PHONE'],
  ];
  return (
    <View>
      <View style={st.rcpt}>
        <View style={st.rh}>
          <Text style={[st.mono, { fontWeight: '800', letterSpacing: 2.53, textAlign: 'center' }]}>🧾 RECEIPT</Text>
          <Rule dash={[4, 4]} />
        </View>
        {rows.map(([k, v]) => (
          <View key={k} style={st.rl}>
            <Text style={st.mono}>{k}</Text>
            <Leader />
            <Text style={[st.mono, { fontWeight: '800' }]}>{v}</Text>
          </View>
        ))}
        <View style={st.rt}>
          <Rule dash={[4, 4]} top />
          <View style={[st.rl, { paddingTop: 0 }]}>
            <Text style={[st.mono, { fontSize: 12.8, lineHeight: 18.56 }]}>TOTAL STRESS</Text>
            <Leader />
            <Text style={[st.mono, { fontSize: 16, lineHeight: 23.2, fontWeight: '800', color: '#0b8f49' }]}>0</Text>
          </View>
        </View>
      </View>
      <Scallops />
    </View>
  );
}

const LINE = 1.33; // 1.5 CSS px rounded to device pixels on a 3x screen
function Rule({ dash, top }: { dash: number[]; top?: boolean }) {
  return (
    <Svg height={LINE} style={{ position: 'absolute', left: 0, right: 0, [top ? 'top' : 'bottom']: 0, width: '100%' }}>
      <Line x1={0} y1={LINE / 2} x2="100%" y2={LINE / 2} stroke="#9aa79f" strokeWidth={LINE} strokeDasharray={dash} />
    </Svg>
  );
}

/** Dotted leader between a label and its value (flex 1, border-bottom dotted, moved up 3 px). */
function Leader() {
  return (
    <View style={{ flex: 1, height: LINE, transform: [{ translateY: -3 }] }}>
      <Svg height={LINE} width="100%">
        <Line x1={0} y1={LINE / 2} x2="100%" y2={LINE / 2} stroke="#9aa79f" strokeWidth={LINE} strokeDasharray={[LINE, LINE]} />
      </Svg>
    </View>
  );
}

/** Bottom edge: radial-gradient(circle at 6px 8px, transparent 5px, #f6f3ea 5.5px) 0 0 / 12px 8px repeat-x. */
function Scallops() {
  const [w, setW] = useState(0);
  // each 12 px tile is paper with a 5.25 px circle cut out at (6, 8)
  let d = '';
  for (let x = 0; x < w; x += 12) d += `M${x} 0H${Math.min(w, x + 12)}V8H${x + 11.25}A5.25 5.25 0 0 0 ${x + 0.75} 8H${x}Z`;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: -8, height: 8 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={8}>
          <Path d={d} fill="#f6f3ea" />
        </Svg>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    backgroundImage: 'linear-gradient(180deg, #eefcf4, #d7f7e6 60%, #c6f1da)',
  },
  oval: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.5)' },
  itop: { flex: 1, paddingHorizontal: 20 },
  tag: { fontFamily: brico[700], fontSize: 16, lineHeight: 23.2, letterSpacing: 0.32, color: '#0d1f15', textAlign: 'center' },
  lk: { fontFamily: brico[800], color: '#12b85f' },
  stage: { flex: 1, minHeight: 200, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  ibot: { paddingTop: 40, paddingHorizontal: 24 },
  sheetBody: { position: 'absolute', top: 46, left: 0, right: 0, bottom: 0, backgroundColor: '#0c1611' },
  appi: {
    position: 'absolute',
    top: -36,
    left: 24,
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: '#22e07a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appiT: { fontSize: 32, lineHeight: 46.4 },
  ihBox: { marginTop: 14, marginBottom: 18 },
  ih: { fontFamily: brico[800], fontSize: 23.2, lineHeight: 27.84, letterSpacing: -0.464, color: '#fff' },
  scr: { alignSelf: 'flex-start', paddingHorizontal: 4 },
  rcw: { marginHorizontal: 8, marginBottom: 24 },
  rcpt: {
    backgroundColor: '#f6f3ea',
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    boxShadow: '0 12px 26px rgba(0,0,0,0.35)',
  },
  mono: { fontFamily: MONO, fontSize: 11.52, lineHeight: 16.704, color: '#1c2620' },
  rh: { paddingBottom: 7 + 1, marginBottom: 6 }, // + the 1 px dashed border
  rl: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 2 },
  rt: { marginTop: 6, paddingTop: 7 + 1 }, // + the 1 px dashed border
  go: { backgroundColor: '#fff', borderRadius: 999, padding: 18, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' },
  goT: { fontFamily: brico[700], fontSize: 17.6, lineHeight: 25.52, color: '#0c1611', textAlign: 'center' },
  sm: { marginTop: 16, fontFamily: brico[500], fontSize: 13.6, lineHeight: 19.72, color: '#7d9688', textAlign: 'center' },
});
