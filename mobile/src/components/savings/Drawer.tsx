// The envelope drawer (prototype .drw: envRender, the folder click, flyBack, drwSet and the handle drag).
// Each envelope is a coloured folder standing in the drawer. Tap one and it is pulled out as a big card
// (.fopen.pull); "Put it back" (or tapping its folder) flies it home: the card turns into the small
// folder, arcs up over its slot and drops in with a little bounce, nudging the folders in front of it.
// The handle opens and closes the drawer, by a tap or by dragging. Every motion runs on the UI thread
// from one clock per animation; the still parts (drawer inside, folders, front) are kept as bitmaps.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type LayoutRectangle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  measure,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useAppToast } from '@/components/AppToast';
import { bezier } from '@/components/intro/cssAnim';
import { useDemoGuard } from '@/components/demoGuard';
import { Small } from '@/components/home/Section';
import { deleteEnvelope, DRAWER_CLOSED_HINT, DRAWER_OPEN_HINT, drawerLabel, envelopeCard, envelopeColor, putIn, takeOut } from '@/logic/envelopes';
import { fmt } from '@/logic/format';
import type { Envelope } from '@/logic/types';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';
import { tourBus, useTourInput, useTourRef } from '@/tour/registry';

import { EASE, EASE_IN, EASE_IN_OUT, EASE_OUT, kf, mixWhite, phase, rgba, type Frame } from './kf';
import { usePageScroll } from './scroll';

const FOLDER = 44; // each folder's slot in the stack
const PAD_TOP = 16; // .fstack padding-top
const LF = 48; // how high the returning folder flies above its slot
const TX = ['4%', '34%', '64%']; // tab positions, in turn
const MORPH: number[] = [0.4, 0, 0.2, 1];
const PULL: number[] = [0.2, 0.9, 0.25, 1];
const DRAWER: number[] = [0.2, 0.9, 0.3, 1];
// flyBack timeline (ms from its start)
const T_MORPH = 70;
const T_FLIGHT = 70;
const T_LAND = 570; // flight over: the folder is back in its slot
const T_DROP = T_LAND + 40;
const T_BUMP = T_DROP + 300 * 0.62;
const T_END = T_DROP + 300 + 90;

interface Rect {
  l: number;
  t: number;
  w: number;
  h: number;
}
/** Where the flight starts and ends (all in the drawer area's coordinates), set when it starts. */
interface Geo {
  sl: number; // the slot (where the ghost folder ends), in the drawer area
  st: number;
  i: number;
  sw: number;
  X0: number;
  Y0: number;
  tab0: Rect;
  tab1: Rect;
  body0: Rect;
  body1: Rect;
  amt0: [number, number];
  amt1: [number, number];
  cardH: number;
}

/** CSS box-shadow numbers: x, y, blur, r, g, b, alpha. */
type Shadow = [number, number, number, number, number, number, number];
const shadowCss = (s: number[]) => `${s[0]}px ${s[1]}px ${s[2]}px rgba(${s[3]},${s[4]},${s[5]},${s[6]})`;

function useLook(ec: string) {
  const { name } = useTheme();
  const light = name === 'light';
  const tab = light ? rgba(mixWhite(ec, 0.58), 0.82) : ec;
  const solid = light ? rgba(mixWhite(ec, 0.58)) : ec;
  return {
    light,
    tab,
    body: tab,
    solid,
    bodyOverlay: light ? undefined : 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.08))',
    cardTab: tab,
    cardBody: light ? rgba(mixWhite(ec, 0.62), 0.9) : ec,
    cardOverlay: light ? undefined : 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 40%)',
    shCard: (light ? [0, 10, 24, 13, 31, 21, 0.14] : [0, 14, 30, 0, 0, 0, 0.35]) as Shadow,
    shFly: (light ? [0, 12, 22, 13, 31, 21, 0.18] : [0, 14, 26, 0, 0, 0, 0.45]) as Shadow,
    shSlot: (light ? [0, -2, 6, 13, 31, 21, 0.1] : [0, -3, 8, 0, 0, 0, 0.25]) as Shadow,
  };
}

/** One folder in the drawer. */
function Folder({
  e,
  i,
  outSV,
  intro,
  fly,
  geo,
  onPress,
  onTab,
  onAmt,
}: {
  e: Envelope;
  i: number;
  outSV: SharedValue<number>; // which folder is out of the drawer (-1: none), kept on the UI thread
  intro: SharedValue<number>;
  fly: SharedValue<number>;
  geo: SharedValue<Geo | null>;
  onPress: () => void;
  onTab: (l: LayoutRectangle) => void;
  onAmt: (l: LayoutRectangle) => void;
}) {
  const ec = envelopeColor(i);
  const L = useLook(ec);
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => {
    // arrival when the tab opens: from 34 px lower and transparent, 80 ms apart
    const k = bezier(DRAWER, phase(intro.value, i * 80 + 120, 500));
    let y = press.value + 34 * (1 - k);
    let o = k;
    const g = geo.value;
    if (g && fly.value >= 0) {
      const t = fly.value;
      if (g.i === i) {
        // hidden while it flies, then drops in from above with a small bounce
        o = t < T_LAND ? 0 : o;
        y += kf(DROP, phase(t, T_DROP, 300))[0];
      } else if (i > g.i) y += bump(t);
    } else if (outSV.value === i) o = 0;
    return { opacity: o, transform: [{ translateY: y }] };
  });
  return (
    <Animated.View style={[st.fld, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={e.n}
        onPress={onPress}
        onPressIn={() => (press.value = withTiming(-4, { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }))}
        onPressOut={() => (press.value = withTiming(0, { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }))}
        style={StyleSheet.absoluteFill}
      >
        {/* drawn once and kept as a bitmap: the shadows would otherwise be redrawn every frame */}
        <View shouldRasterizeIOS renderToHardwareTextureAndroid style={StyleSheet.absoluteFill}>
          <View style={[st.fbody, { backgroundColor: L.body, backgroundImage: L.bodyOverlay, boxShadow: shadowCss(L.shSlot) }]}>
            <Text style={st.famt} onLayout={(ev) => onAmt(ev.nativeEvent.layout)}>
              {fmt(e.b)}
            </Text>
          </View>
          <View onLayout={(ev) => onTab(ev.nativeEvent.layout)} style={[st.ftab, { left: TX[i % 3] as `${number}%`, backgroundColor: L.tab }]}>
            <Text style={st.ftabT} numberOfLines={1}>
              {e.n}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const DROP: Frame[] = [
  { o: 0, v: [-LF], e: [0.55, 0, 1, 0.45] },
  { o: 0.62, v: [0], e: EASE_OUT },
  { o: 0.8, v: [-5], e: EASE_IN },
  { o: 1, v: [0] },
];
/** The folders in front and the drawer front give way 3 px when the folder lands (220 ms, ease-out). */
function bump(t: number) {
  'worklet';
  const k = bezier(EASE_OUT, phase(t, T_BUMP, 220));
  return k <= 0 || k >= 1 ? 0 : k < 0.5 ? 6 * k : 6 * (1 - k);
}

/** The ghost folder that flies from the open card back into the drawer. */
function Ghost({ e, i, geo, fly }: { e: Envelope; i: number; geo: SharedValue<Geo | null>; fly: SharedValue<number> }) {
  const ec = envelopeColor(i);
  const L = useLook(ec);
  const box = useAnimatedStyle(() => {
    const g = geo.value;
    if (!g) return {};
    const t = fly.value;
    const [x, y, r] = kf(
      [
        { o: 0, v: [g.X0, g.Y0, 0], e: EASE_OUT },
        { o: 0.2, v: [g.X0, g.Y0 - 14, -1.5], e: [0.45, 0, 0.3, 1] },
        { o: 0.8, v: [g.X0 * 0.2, -LF - 26, -3], e: EASE_IN_OUT },
        { o: 1, v: [0, -LF, 0] },
      ],
      phase(t, T_FLIGHT, 500),
    );
    // gone once it has landed: from then on the real folder drops into its slot (prototype g.remove())
    return { opacity: t < T_LAND ? phase(t, 0, 70) : 0, transform: [{ translateX: x }, { translateY: y }, { rotate: r.toFixed(3) + 'deg' }] };
  });
  const m = (t: number) => {
    'worklet';
    return bezier(MORPH, phase(t, T_MORPH, 220));
  };
  const lerp = (a: number, b: number, k: number) => {
    'worklet';
    return a + (b - a) * k;
  };
  const tab = useAnimatedStyle(() => {
    const g = geo.value;
    if (!g) return {};
    const k = m(fly.value);
    return {
      left: lerp(g.tab0.l, g.tab1.l, k),
      top: lerp(g.tab0.t, g.tab1.t, k),
      width: lerp(g.tab0.w, g.tab1.w, k),
      height: lerp(g.tab0.h, g.tab1.h, k),
      paddingTop: lerp(5, 3, k),
      paddingHorizontal: lerp(16, 10, k),
      borderTopLeftRadius: lerp(12, 9, k),
      borderTopRightRadius: lerp(12, 9, k),
    };
  });
  const tabT = useAnimatedStyle(() => {
    const k = m(fly.value);
    return { fontSize: lerp(16, 12, k), lineHeight: lerp(23.2, 17.4, k) };
  });
  const body = useAnimatedStyle(() => {
    const g = geo.value;
    if (!g) return {};
    const k = m(fly.value);
    return {
      left: lerp(g.body0.l, g.body1.l, k),
      top: lerp(g.body0.t, g.body1.t, k),
      width: lerp(g.body0.w, g.body1.w, k),
      height: lerp(g.body0.h, g.body1.h, k),
    };
  });
  // the body's corners and its shadow: the card's shadow turns into the flight shadow while it morphs,
  // then (from 440 ms, 150 ms) into the folder's own. On the phone a shadow can't be animated as text
  // (Reanimated parses it, and numbers like 1e-15 break it), so three ready shadows cross-fade instead.
  const corners = useAnimatedStyle(() => {
    const k = m(fly.value);
    return {
      borderTopLeftRadius: lerp(6, 4, k),
      borderTopRightRadius: lerp(16, 10, k),
      borderBottomRightRadius: lerp(16, 6, k),
      borderBottomLeftRadius: lerp(16, 6, k),
    };
  });
  const shCard = useAnimatedStyle(() => ({ opacity: 1 - m(fly.value) }));
  const shFly = useAnimatedStyle(() => ({ opacity: Math.min(m(fly.value), 1 - phase(fly.value, 440, 150)) }));
  const shSlot = useAnimatedStyle(() => ({ opacity: phase(fly.value, 440, 150) }));
  const amt = useAnimatedStyle(() => {
    const g = geo.value;
    if (!g) return {};
    const k = m(fly.value);
    return {
      left: lerp(g.amt0[0], g.amt1[0], k),
      top: lerp(g.amt0[1], g.amt1[1], k),
      fontSize: lerp(32, 12.48, k),
      lineHeight: lerp(46.4, 18.1, k),
      letterSpacing: lerp(-0.64, 0, k),
      color: interpolateColor(k, [0, 1], ['rgba(17,17,17,1)', 'rgba(0,0,0,0.6)']),
    };
  });
  const g = geo.value;
  if (!g) return null;
  return (
    <Animated.View pointerEvents="none" style={[st.fly, { left: g.sl, top: g.st, width: g.sw, transformOrigin: `${g.sw / 2}px 43px` }, box]}>
      <Animated.View style={[st.flyBody, body]}>
        {([
          [L.shCard, shCard],
          [L.shFly, shFly],
          [L.shSlot, shSlot],
        ] as const).map(([sh, op], j) => (
          <Animated.View key={j} style={[StyleSheet.absoluteFill, { backgroundColor: L.solid, boxShadow: shadowCss(sh) }, corners, op]} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: L.solid, backgroundImage: L.bodyOverlay }, corners]} />
        <Animated.Text style={[st.flyAmt, amt]} numberOfLines={1}>
          {fmt(e.b)}
        </Animated.Text>
      </Animated.View>
      <Animated.View style={[st.flyTab, { backgroundColor: L.light ? L.solid : L.tab }, tab]}>
        <Animated.Text style={[st.ftabT, tabT]} numberOfLines={1}>
          {e.n}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

/** The folder taken out: amount, goal, Add / Take out / ✕, and "Put it back". */
function Card({
  e,
  i,
  pull,
  fly,
  geo,
  onPutBack,
  onDeleted,
  clip,
  onLayout,
  onTab,
  onBody,
  onAmt,
  cardRef,
}: {
  e: Envelope;
  i: number;
  pull: SharedValue<number>;
  fly: SharedValue<number>;
  geo: SharedValue<Geo | null>;
  onPutBack: () => void;
  onDeleted: () => void;
  clip: boolean;
  onLayout: (l: LayoutRectangle) => void;
  onTab: (l: LayoutRectangle) => void;
  onBody: (l: LayoutRectangle) => void;
  onAmt: (l: LayoutRectangle) => void;
  cardRef: ReturnType<typeof useAnimatedRef<View>>;
}) {
  const { state, update } = useStore();
  const toast = useAppToast();
  const ec = envelopeColor(i);
  const L = useLook(ec);
  const card = envelopeCard(state, e, Date.now());
  const [mode, setMode] = useState<'in' | 'out' | null>(null);
  const [v, setV] = useState('');
  const addIn = useTourInput('env-add', v);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const id = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(id);
  }, [sure]);

  const ok = () => {
    const r = mode === 'in' ? putIn(state, i, v) : takeOut(state, i, v);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    setMode(null);
    setV('');
    toast(r.toast);
  };
  const del = () => {
    if (!sure) return setSure(true);
    const r = deleteEnvelope(state, i);
    if (r.ok) {
      onDeleted();
      update(() => r.state);
      toast(r.toast);
    }
  };

  // pulled out of the drawer (.fopen.pull, 550 ms), and while flying home: fades and its space closes
  const anim = useAnimatedStyle(() => {
    const [y, s, r, o] = kf(
      [
        { o: 0, v: [-70, 0.9, -4, 0], e: PULL },
        { o: 0.55, v: [6, 1.01, 0.8, 1], e: PULL },
        { o: 1, v: [0, 1, 0, 1] },
      ],
      pull.value,
    );
    const g = geo.value;
    if (g && fly.value >= 0 && g.i === i) {
      const t = fly.value;
      const k = 1 - bezier(MORPH, phase(t, 180, 420));
      return { opacity: 1 - phase(t, 70, 30), height: g.cardH * k, marginTop: 18 * k, paddingTop: 26 * k, transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }] };
    }
    return { opacity: o, transform: [{ translateY: y }, { scale: s }, { rotate: r.toFixed(3) + 'deg' }] };
  });

  return (
    // while it flies home its space closes and the contents are clipped (a plain style, not animated)
    <Animated.View ref={cardRef} onLayout={(ev) => onLayout(ev.nativeEvent.layout)} style={[st.fopen, clip && { overflow: 'hidden' }, anim]}>
      <View onLayout={(ev) => onTab(ev.nativeEvent.layout)} style={[st.fotab, { backgroundColor: L.cardTab }]}>
        <Text style={st.fotabT} numberOfLines={1}>
          {e.n}
        </Text>
      </View>
      <View onLayout={(ev) => onBody(ev.nativeEvent.layout)} style={st.fobody}>
        {/* the card's look (colour, shine, big shadow) is a bitmap under its contents */}
        <View shouldRasterizeIOS renderToHardwareTextureAndroid style={[StyleSheet.absoluteFill, st.fobodyBg, { backgroundColor: L.cardBody, backgroundImage: L.cardOverlay, boxShadow: shadowCss(L.shCard) }]} />
        <Text style={st.foamt} onLayout={(ev) => onAmt(ev.nativeEvent.layout)}>
          {card.amount + ' '}
          <Text style={st.foamtS}>{state.cur}</Text>
        </Text>
        {e.t > 0 && (
          <View style={st.fobar}>
            <View style={{ width: card.progress + '%', height: '100%', borderRadius: 4, backgroundColor: '#111' }} />
          </View>
        )}
        <Text style={st.fotx}>{card.text}</Text>
        <View style={st.envb}>
          <CardButton title="+ Add" onPress={() => (setMode('in'), setV(''))} />
          <CardButton title="− Take out" onPress={() => (setMode('out'), setV(''))} />
          <CardButton title={sure ? 'Sure?' : '✕'} onPress={del} label="Delete" />
        </View>
        {mode && (
          <View style={st.envx}>
            <TextInput
              ref={addIn}
              autoFocus
              value={v}
              onChangeText={setV}
              keyboardType="decimal-pad"
              placeholder={mode === 'out' ? 'How much to take out' : 'How much to add'}
              placeholderTextColor="rgba(17,17,17,0.45)"
              style={st.envxIn}
            />
            <Pressable accessibilityRole="button" onPress={ok} style={st.envxOk}>
              <Text style={st.envxOkT}>OK</Text>
            </Pressable>
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={onPutBack} style={st.foback}>
          <Text style={st.fobackT}>Put it back</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function CardButton({ title, onPress, label }: { title: string; onPress: () => void; label?: string }) {
  const { guard } = useDemoGuard(); // Add, Take out and Delete change data: look only in the demo
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} onPress={guard(onPress)} style={({ pressed }) => [st.envbB, pressed && { transform: [{ scale: 0.97 }] }]}>
      <Text style={st.envbT}>{title}</Text>
    </Pressable>
  );
}

/** The drawer with its folders, the open card and the flying folder. `play` replays the arrival;
 * a new `pullOut.k` takes folder `pullOut.i` out. */
export function Drawer({ play, pullOut }: { play: number; pullOut?: { i: number; k: number } }) {
  const { state, update } = useStore();
  const { c, name } = useTheme();
  const reduce = useReducedMotion();
  const page = usePageScroll();
  const { height: winH } = useWindowDimensions();
  const E = state.env || [];
  const n = E.length;
  const shut = state.drw === 'c';
  const H = PAD_TOP + n * FOLDER;

  const [open, setOpen] = useState(-1);
  const [flying, setFlying] = useState(-1);
  const openRef = useRef(-1);
  openRef.current = open;
  const busy = useRef<(() => void)[] | null>(null);
  // which folder is out: React state (the card), a ref (read right away, before React re-renders) and a
  // UI-thread copy (the folders hide their own slot with it in the same frame), always set together
  const openSV = useSharedValue(-1);
  const setOpenAll = useCallback(
    (k: number) => {
      openRef.current = k;
      openSV.value = k;
      setOpen(k);
    },
    [openSV],
  );

  // ---- UI-thread values ----
  const boxH = useSharedValue(shut ? 0 : H);
  const Hs = useSharedValue(H);
  const rad = useSharedValue(shut ? 14 : 10);
  const intro = useSharedValue(1e6);
  const pull = useSharedValue(1);
  const fly = useSharedValue(-1);
  const geo = useSharedValue<Geo | null>(null);
  const cardOpen = useSharedValue(false);
  const shutSV = useSharedValue(shut);
  const busySV = useSharedValue(false);
  const drawerRef = useAnimatedRef<View>();
  const cardRef = useAnimatedRef<View>();
  // the guided tour lights up the drawer, the card taken out and the handle
  const frontRef = useAnimatedRef<Animated.View>();
  useTourRef('drw', drawerRef);
  useTourRef('fopen', cardRef);
  useTourRef('dfront', frontRef);

  useEffect(() => {
    Hs.value = H;
    if (!shutSV.value) boxH.value = H;
  }, [H, Hs, boxH, shutSV]);
  useEffect(() => {
    cardOpen.value = open >= 0;
  }, [open, cardOpen]);

  // ---- layout, for the flight ----
  const lay = useRef({
    drw: { x: 0, y: 0, width: 0, height: 0 } as LayoutRectangle,
    dboxY: 0,
    tab: [] as LayoutRectangle[],
    amt: [] as LayoutRectangle[],
    card: null as LayoutRectangle | null,
    cTab: null as LayoutRectangle | null,
    cBody: null as LayoutRectangle | null,
    cAmt: null as LayoutRectangle | null,
  }).current;

  // ---- arrival each time the tab opens: the card goes back, folders rise in ----
  useEffect(() => {
    if (!play) return;
    setOpenAll(-1);
    if (reduce) return;
    const total = Math.max(450, (n - 1) * 80 + 120 + 500);
    intro.value = 0;
    intro.value = withTiming(total, { duration: total, easing: Easing.linear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const scrollNearest = useCallback(() => {
    if (!page) return;
    const { ref, offset, bottomInset } = page;
    runOnUI(() => {
      'worklet';
      const m = measure(cardRef);
      if (!m) return;
      const bottom = m.pageY + m.height;
      const limit = winH - bottomInset;
      if (m.pageY < 0) scrollTo(ref, 0, offset.value + m.pageY, true);
      else if (bottom > limit) scrollTo(ref, 0, offset.value + Math.min(bottom - limit, m.pageY), true);
    })();
  }, [page, cardRef, winH]);

  const finish = useCallback(() => {
    const cbs = busy.current || [];
    busy.current = null;
    busySV.value = false;
    setFlying(-1);
    setOpenAll(-1);
    // what waits for the landing (closing the drawer) runs once the drawer clips its folders again
    afterFly.current = cbs;
  }, [busySV, setOpenAll]);
  const afterFly = useRef<(() => void)[]>([]);
  // the flight's values are cleared only once the card and the ghost are gone from the screen, so no frame
  // shows them back in their resting state
  useEffect(() => {
    if (flying >= 0) return;
    fly.value = -1;
    geo.value = null;
    const cbs = afterFly.current;
    afterFly.current = [];
    // one frame later, so the clipping is on the screen before the drawer starts closing
    if (cbs.length) requestAnimationFrame(() => cbs.forEach((f) => f()));
  }, [flying, fly, geo]);

  /** Put the open folder back (prototype flyBack); `cb` runs when it has landed. */
  const flyBack = useCallback(
    (cb?: () => void) => {
      if (busy.current) {
        if (cb) busy.current.push(cb);
        return;
      }
      const i = openRef.current;
      const { drw, dboxY, card, cTab, cBody, cAmt } = lay;
      const t1 = lay.tab[i];
      const a1 = lay.amt[i];
      if (i < 0 || reduce || !card || !cTab || !cBody || !cAmt || !t1 || !a1) {
        setOpenAll(-1);
        cb?.();
        return;
      }
      busy.current = cb ? [cb] : [];
      busySV.value = true;
      const s = { l: drw.x + 12, t: drw.y + dboxY + PAD_TOP + i * FOLDER, w: drw.width - 24 };
      const b0 = { l: card.x + cBody.x, t: card.y + cBody.y, w: cBody.width, h: cBody.height };
      const g: Geo = {
        i,
        sl: s.l,
        st: s.t,
        sw: s.w,
        X0: b0.l - s.l,
        Y0: card.y - s.t,
        tab0: { l: card.x + cTab.x - b0.l, t: cTab.y, w: cTab.width, h: cTab.height },
        tab1: { l: t1.x, t: t1.y, w: t1.width, h: t1.height },
        body0: { l: 0, t: b0.t - card.y, w: b0.w, h: b0.h },
        body1: { l: 0, t: 22, w: s.w, h: 64 },
        amt0: [cAmt.x, cAmt.y],
        amt1: [a1.x, a1.y],
        cardH: card.height,
      };
      geo.value = g;
      setFlying(i);
      fly.value = 0;
      fly.value = withTiming(T_END, { duration: T_END, easing: Easing.linear }, (done) => {
        if (done) runOnJS(finish)();
      });
      // the slot is above the screen: scroll up so the landing is seen
      if (page) {
        const { ref, offset } = page;
        const slotY = dboxY + PAD_TOP + i * FOLDER;
        runOnUI(() => {
          'worklet';
          const m = measure(drawerRef);
          if (!m) return;
          const vt = m.pageY + slotY - LF - 40;
          if (vt < 0) scrollTo(ref, 0, offset.value + vt, true);
        })();
      }
    },
    [lay, reduce, busySV, geo, fly, finish, page, drawerRef],
  );

  /** Open or close the drawer (prototype drwSet). */
  const drwSet = useCallback(
    (close: boolean) => {
      if (close && openRef.current >= 0 && !reduce) {
        flyBack(() => drwSet(true));
        return;
      }
      if (close) setOpenAll(-1);
      shutSV.value = close;
      update((s) => ({ ...s, drw: close ? 'c' : 'o' }));
      const ease = Easing.bezier(DRAWER[0], DRAWER[1], DRAWER[2], DRAWER[3]);
      boxH.value = reduce ? (close ? 0 : Hs.value) : withTiming(close ? 0 : Hs.value, { duration: 360, easing: ease });
      rad.value = withTiming(close ? 14 : 10, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
    },
    [reduce, flyBack, shutSV, update, boxH, Hs, rad],
  );

  const pullCard = (k: number) => {
    setOpenAll(k);
    if (!reduce) {
      pull.value = 0;
      pull.value = withTiming(1, { duration: 550, easing: Easing.linear });
    }
    setTimeout(scrollNearest, 80);
  };
  const tapFolder = (k: number) => {
    if (busy.current) return;
    if (k === open) return flyBack();
    pullCard(k);
  };

  // a new envelope comes out of the drawer right away (prototype en-go: envOpen = the new one)
  useEffect(() => {
    if (pullOut && pullOut.k) pullCard(pullOut.i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullOut && pullOut.k]);

  // ---- the handle: tap toggles, drag follows the finger (prototype pointer handlers) ----
  const d0 = useSharedValue({ h0: 0, env: false, moved: false, h: 0, off: false });
  const handle = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      if (busySV.value) {
        d0.value = { h0: 0, env: false, moved: false, h: 0, off: true };
        return;
      }
      cancelAnimation(boxH);
      d0.value = { h0: boxH.value, env: !shutSV.value && cardOpen.value, moved: false, h: boxH.value, off: false };
    })
    .onUpdate((e) => {
      const d = d0.value;
      if (d.off) return;
      const dy = e.translationY;
      if (!d.moved && Math.abs(dy) < 6) return;
      const h = d.env ? Hs.value + Math.max(-40, Math.min(0, dy * 0.35)) : Math.max(0, Math.min(Hs.value, d.h0 + dy));
      d0.value = { ...d, moved: true, h };
      boxH.value = h;
    })
    .onFinalize(() => {
      const d = d0.value;
      if (d.off) return;
      d0.value = { ...d, off: true };
      const HH = Hs.value;
      if (d.env) {
        boxH.value = withTiming(HH, { duration: 220, easing: Easing.bezier(DRAWER[0], DRAWER[1], DRAWER[2], DRAWER[3]) });
        if (!d.moved || d.h < HH - 8) runOnJS(drwSet)(true);
        return;
      }
      if (!d.moved) runOnJS(drwSet)(!shutSV.value);
      else runOnJS(drwSet)(shutSV.value ? d.h < HH * 0.25 : d.h < HH * 0.75);
    });

  const boxStyle = useAnimatedStyle(() => ({ height: boxH.value }));
  const frontStyle = useAnimatedStyle(() => {
    const k = bezier(DRAWER, phase(intro.value, 0, 450));
    const g = geo.value;
    const b = g && fly.value >= 0 ? bump(fly.value) : 0;
    return { borderTopLeftRadius: rad.value, borderTopRightRadius: rad.value, transform: [{ translateY: -14 * (1 - k) + b }] };
  });

  if (!n) return <Small style={{ marginTop: 12.8, marginBottom: 12.8 }}>The drawer is empty. Create your first envelope below.</Small>;

  const light = name === 'light';
  const showCard = open >= 0 && !shut && E[open];
  tourBus.fopen = !!showCard;
  return (
    <View>
      <View ref={drawerRef} onLayout={(ev) => (lay.drw = ev.nativeEvent.layout)} style={[st.drw, flying >= 0 && { overflow: 'visible' }]}>
        <Small style={{ marginBottom: 8 }}>{shut ? DRAWER_CLOSED_HINT : DRAWER_OPEN_HINT}</Small>
        <Animated.View onLayout={(ev) => (lay.dboxY = ev.nativeEvent.layout.y)} style={[st.dbox, flying >= 0 && { overflow: 'visible' }, boxStyle]}>
          <View style={st.fstack}>
            <View
              shouldRasterizeIOS
              renderToHardwareTextureAndroid
              style={[
                st.fstackBg,
                light
                  ? { backgroundImage: 'linear-gradient(180deg, #c9d8ce, #dbe6df)', boxShadow: 'inset 0 8px 16px rgba(13,31,21,0.18), inset 0 0 0 1px #c3d4c8' }
                  : { backgroundImage: 'linear-gradient(180deg, #07100b, #0e1a14)', boxShadow: 'inset 0 8px 16px rgba(0,0,0,0.55), inset 0 0 0 1px #1d2e25' },
              ]}
            />
            {E.map((e, i) => (
              <Folder
                key={e.id}
                e={e}
                i={i}
                outSV={openSV}
                intro={intro}
                fly={fly}
                geo={geo}
                onPress={() => tapFolder(i)}
                onTab={(l) => (lay.tab[i] = l)}
                onAmt={(l) => (lay.amt[i] = l)}
              />
            ))}
          </View>
        </Animated.View>
        <GestureDetector gesture={handle}>
          <Animated.View
            ref={frontRef}
            accessibilityRole="button"
            accessibilityLabel="Open or close the drawer"
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
            style={[
              st.dfront,
              light
                ? { backgroundImage: 'linear-gradient(180deg, #e7efe9, #d3e0d7)', borderColor: '#c3d4c8', boxShadow: '0 -6px 14px rgba(13,31,21,0.12)' }
                : { backgroundImage: 'linear-gradient(180deg, #22352b, #15221b)', borderColor: '#2c4436', boxShadow: '0 -6px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)' },
              frontStyle,
            ]}
          >
            <View style={[st.hdl, light ? { backgroundColor: '#a9bfb0' } : { backgroundColor: '#3b5747', boxShadow: 'inset 0 2px 2px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.08)' }]} />
            {shut && <Text style={[st.dlab, { color: c.mute }]}>{drawerLabel(state)}</Text>}
          </Animated.View>
        </GestureDetector>
      </View>
      {showCard && (
        <Card
          key={E[open].id}
          e={E[open]}
          i={open}
          pull={pull}
          fly={fly}
          geo={geo}
          cardRef={cardRef}
          onPutBack={() => flyBack()}
          onDeleted={() => setOpenAll(-1)}
          clip={flying === open}
          onLayout={(l) => {
            if (fly.value < 0) lay.card = l;
          }}
          onTab={(l) => (lay.cTab = l)}
          onBody={(l) => {
            if (fly.value < 0) lay.cBody = l;
          }}
          onAmt={(l) => (lay.cAmt = l)}
        />
      )}
      {flying >= 0 && E[flying] && <Ghost e={E[flying]} i={flying} geo={geo} fly={fly} />}
    </View>
  );
}

const st = StyleSheet.create({
  drw: { marginTop: 12, overflow: 'hidden', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  dbox: { overflow: 'hidden', zIndex: 0 },
  fstack: { paddingTop: PAD_TOP, paddingHorizontal: 12 },
  fstackBg: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  fld: { height: FOLDER },
  ftab: { position: 'absolute', top: 0, maxWidth: '32%', height: 24, paddingTop: 3, paddingHorizontal: 10, borderTopLeftRadius: 9, borderTopRightRadius: 9, boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.25)' },
  ftabT: { fontFamily: inter[800], fontSize: 12, lineHeight: 17.4, color: '#111' },
  fbody: { position: 'absolute', top: 22, left: 0, right: 0, height: 64, borderTopLeftRadius: 4, borderTopRightRadius: 10, borderBottomRightRadius: 6, borderBottomLeftRadius: 6 },
  famt: { position: 'absolute', right: 12, top: 6, fontFamily: inter[800], fontSize: 12.48, lineHeight: 18.1, color: 'rgba(0,0,0,0.6)', fontVariant: ['tabular-nums'] },
  dfront: { zIndex: 50, minHeight: 46, paddingTop: 10, paddingBottom: 8, gap: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  hdl: { width: 70, height: 9, borderRadius: 5 },
  dlab: { fontFamily: inter[600], fontSize: 11.52, lineHeight: 16.7 },
  fopen: { marginTop: 18, paddingTop: 26 },
  fotab: { position: 'absolute', top: 0, left: 14, maxWidth: '70%', height: 30, paddingTop: 5, paddingHorizontal: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  fotabT: { fontFamily: inter[800], fontSize: 16, lineHeight: 23.2, color: '#111' },
  fobody: { padding: 16 },
  fobodyBg: { borderTopLeftRadius: 6, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 16 },
  foamt: { fontFamily: inter[800], fontSize: 32, lineHeight: 46.4, letterSpacing: -0.64, color: '#111', fontVariant: ['tabular-nums'] },
  // the space before it is in the big font, like in the prototype; its line height is its own (1.45)
  foamtS: { fontFamily: inter[700], fontSize: 14.4, lineHeight: 20.88, letterSpacing: -0.64, color: 'rgba(17,17,17,0.7)' },
  fobar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.18)', marginTop: 8, marginBottom: 6, overflow: 'hidden' },
  fotx: { fontFamily: inter[400], fontSize: 14.08, lineHeight: 20.4, color: 'rgba(0,0,0,0.75)' },
  envb: { flexDirection: 'row', gap: 6, marginTop: 6 },
  envbB: { flex: 1, flexBasis: 0, minWidth: 0, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.14)' },
  envbT: { fontFamily: inter[700], fontSize: 13.6, lineHeight: 19.72, color: '#111', textAlign: 'center' },
  envx: { flexDirection: 'row', gap: 8, marginTop: 8 },
  envxIn: { flex: 1, minWidth: 0, height: 47.2, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.75)', color: '#111', fontFamily: inter[400], fontSize: 16 },
  envxOk: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center' },
  envxOkT: { fontFamily: inter[700], fontSize: 16, lineHeight: 23.2, color: '#fff' },
  foback: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.35)' },
  fobackT: { fontFamily: inter[700], fontSize: 16, lineHeight: 23.2, color: '#111', textAlign: 'center' },
  fly: { position: 'absolute', height: 44, zIndex: 5 },
  flyTab: { position: 'absolute', overflow: 'hidden' },
  flyBody: { position: 'absolute' },
  flyAmt: { position: 'absolute', fontFamily: inter[800], fontVariant: ['tabular-nums'] },
});
