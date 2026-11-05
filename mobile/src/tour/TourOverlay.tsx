// The guided tour (prototype tutStart / tutGo / tutLoop / tutEnd). The part a step explains is lit up
// through a hole in a softly blurred cover; the bubble sits above or below it with an arrow; when the
// tab changes, everything clears for a moment so the user sees where they are. Steps that ask the user
// to do something wait until it's done ("Nice." and on), and "Skip step" turns up after 15 s.
//
// The hole follows the page while it scrolls on the UI thread: the parts are measured every 40 ms, and
// in between the hole moves by exactly what the page has scrolled since. Entries made during the tour
// are practice: the real data is put aside at the start and comes back at the end (or on the next
// launch, if the app closed mid-tour).
//
// The page scrolls from anywhere on the screen, the cover too (a drag there scrolls the page in front,
// with a fling); taps on the cover still do nothing. The keyboard is put away once a step that needs
// it is done, and moves on to the next field once the user stops typing.

import { BlurView } from 'expo-blur';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  measure,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppToast } from '@/components/AppToast';
import { tabScrolls } from '@/components/tabPage';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

import { isTourRunning, pageY, setTourRunning, tourBubble, tourBus, tourHole, tourInputs, tourRefs, tourTyping } from './registry';
import { NICE, STEPS, TOUR_DONE, TOUR_SKIPPED, type TourCtx } from './steps';

const PATHS = ['/', '/spending', '/savings', '/more'];
const tabOf = (p: string) => Math.max(0, PATHS.indexOf(p === '/index' ? '/' : p));
const G = 8; // the light's margin around the part
const IDLE = 2000; // the user has stopped typing after this long without a key press
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}
interface Measured {
  ok: boolean;
  u: Rect; // all the parts together
  first: Rect;
  last: Rect;
  navTop: number;
  base: number; // the page's scroll offset when this was measured
}
const NONE: Measured = { ok: false, u: { l: 0, t: 0, r: 0, b: 0 }, first: { l: 0, t: 0, r: 0, b: 0 }, last: { l: 0, t: 0, r: 0, b: 0 }, navTop: 0, base: 0 };

/** Starts the tour (Settings > Help, or on its own for a new user). Set by the overlay when it mounts. */
export const tour: { start: () => void } = { start: () => {} };

export function TourOverlay() {
  const store = useStore();
  const { state, demo } = store;
  const { c, name } = useTheme();
  const toast = useAppToast();
  const insets = useSafeAreaInsets();
  const { width: vw, height: vh } = useWindowDimensions();
  const pathname = usePathname();
  const tab = tabOf(pathname);
  const light = name === 'light';

  const [on, setOn] = useState(false); // mounted
  const [i, setI] = useState(-1);
  const [text, setText] = useState('');
  const [ok, setOk] = useState(false);
  const [skipStep, setSkipStep] = useState(false);
  const [paused, setPaused] = useState(false);

  // latest values for the timers
  const live = useRef({ state, tab, demo });
  live.current = { state, tab, demo };
  const R = useRef({
    i: -1,
    v: {} as Record<string, unknown>,
    ph: 0,
    t0: 0,
    stab: 0,
    key: '',
    clrUntil: 0,
    seenTab: -1 as number,
    timers: [] as ReturnType<typeof setTimeout>[],
    poll: null as ReturnType<typeof setInterval> | null,
    loop: null as ReturnType<typeof setInterval> | null,
    paused: false,
    m: NONE,
    kb: null as ReturnType<typeof setInterval> | null,
    kbSince: 0,
    kbDone: false,
  }).current;

  // ---- UI-thread values ----
  const fade = useSharedValue(0); // the whole tour (.4s in, .42s out)
  // bubble and ring hidden while the next part settles (.25s / .3s); the cover cleared for a moment after
  // a tab change (.45s)
  const bubO = useSharedValue(0);
  const ringO = useSharedValue(0);
  const paneO = useSharedValue(1);
  const [shown, setShown] = useState(false);
  const hide = (h: boolean) => {
    bubO.value = withTiming(h ? 0 : 1, { duration: 250, easing: EASE });
    ringO.value = withTiming(h ? 0 : 1, { duration: 300, easing: EASE });
    setShown(!h);
  };
  const clear = (c0: boolean) => {
    paneO.value = withTiming(c0 ? 0 : 1, { duration: 450, easing: EASE });
  };
  const meas = useSharedValue<Measured>(NONE);
  const fixed = useSharedValue(false); // the tab bar doesn't scroll
  const has = useSharedValue(false);
  const pos = useSharedValue<'up' | ''>('');
  const bw = useSharedValue(340);
  const bh = useSharedValue(0);
  const prog = useSharedValue(0);
  const txt = useSharedValue(1);
  const kb = useKeyboardHeight();

  // ---- the light ----
  const hole = useDerivedValue(() => {
    const m = meas.value;
    if (!has.value || !m.ok) return { l: vw / 2, t: vh * 0.45, r: vw / 2, b: vh * 0.45, on: false };
    const dy = fixed.value ? 0 : pageY.value - m.base;
    const cl = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));
    const T = { l: cl(m.u.l - G, 4, vw - 4), t: cl(m.u.t - dy - G, 2, vh - 2), r: cl(m.u.r + G, 4, vw - 4), b: cl(m.u.b - dy + G, 2, vh - 2), on: true };
    if (T.b < T.t) T.b = T.t;
    if (T.r < T.l) T.r = T.l;
    tourHole.value = T;
    return T;
  });
  const paneTop = useAnimatedStyle(() => ({ left: 0, top: 0, width: vw, height: hole.value.t }));
  const paneBottom = useAnimatedStyle(() => ({ left: 0, top: hole.value.b, width: vw, height: Math.max(0, vh - hole.value.b) }));
  const paneLeft = useAnimatedStyle(() => ({ left: 0, top: hole.value.t, width: hole.value.l, height: hole.value.b - hole.value.t }));
  const paneRight = useAnimatedStyle(() => ({ left: hole.value.r, top: hole.value.t, width: Math.max(0, vw - hole.value.r), height: hole.value.b - hole.value.t }));
  const panes = useAnimatedStyle(() => ({ opacity: paneO.value }));
  const ring = useAnimatedStyle(() => {
    const h = hole.value;
    return { left: h.l, top: h.t, width: h.r - h.l, height: h.b - h.t, opacity: h.on && h.b - h.t > 6 ? ringO.value : 0 };
  });

  // ---- the bubble: below or above the part, wherever there is room (the keyboard counts as no room) ----
  const place = useDerivedValue(() => {
    const T = hole.value;
    const top0 = insets.top + 58;
    const vb = vh - kb.value;
    const w = bw.value;
    const h = bh.value;
    const cl = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));
    let x: number;
    let y: number;
    let cls: 'up' | 'dn' | 'mid';
    if (!T.on) {
      x = (vw - w) / 2;
      y = Math.max(top0, (vb - h) / 2);
      cls = 'mid';
    } else {
      const below = vb - 12 - (T.b + 14);
      const above = T.t - 14 - top0;
      x = cl((T.l + T.r) / 2 - w / 2, 12, vw - w - 12);
      if (pos.value === 'up' && above >= h) {
        y = T.t - 14 - h;
        cls = 'dn';
      } else if (below >= h) {
        y = T.b + 14;
        cls = 'up';
      } else if (above >= h) {
        y = T.t - 14 - h;
        cls = 'dn';
      } else {
        const m = meas.value;
        const dy = fixed.value ? 0 : pageY.value - m.base;
        const lastMid = (m.last.t + m.last.b) / 2 - dy;
        y = lastMid > vb / 2 ? top0 : vb - h - 12;
        cls = 'mid';
      }
    }
    const ax = T.on ? cl((T.l + T.r) / 2 - x, 18, w - 18) : w / 2;
    tourBubble.value = { y, h, on: true };
    return { x, y, cls, ax };
  });
  const bubble = useAnimatedStyle(() => ({
    opacity: bubO.value,
    transform: [{ translateX: Math.round(place.value.x) }, { translateY: Math.round(place.value.y) }],
  }));
  const arrow = useAnimatedStyle(() => {
    const p = place.value;
    return p.cls === 'dn'
      ? { opacity: 1, left: p.ax - 6, top: undefined, bottom: -7, transform: [{ rotate: '225deg' }] }
      : { opacity: p.cls === 'mid' ? 0 : 1, left: p.ax - 6, top: -7, bottom: undefined, transform: [{ rotate: '45deg' }] };
  });
  const root = useAnimatedStyle(() => ({ opacity: fade.value }));
  const bar = useAnimatedStyle(() => ({ width: Math.max(0, bw.value - 32) * prog.value }));
  const words = useAnimatedStyle(() => ({ opacity: txt.value, transform: [{ translateY: 5 * (1 - txt.value) }] }));

  // ---- helpers ----
  const later = (f: () => void, ms: number) => R.timers.push(setTimeout(f, ms));
  const clearTimers = () => {
    R.timers.forEach(clearTimeout);
    R.timers = [];
    if (R.poll) clearInterval(R.poll);
    R.poll = null;
  };
  const ctx = (): TourCtx => ({ s: live.current.state, tab: live.current.tab, v: R.v, bus: tourBus, has: (id) => tourRefs([id]).length > 0 });
  const swapText = (t: string, good = false) => {
    txt.value = withTiming(0, { duration: 230, easing: EASE });
    later(() => {
      setText(t);
      setOk(good);
      txt.value = withTiming(1, { duration: 250, easing: EASE });
    }, 230);
  };
  // the keyboard, once the user has stopped typing for 2 s (a step can be done after two letters while
  // they are still writing): it moves on to the step's next empty field (switching between letters and
  // numbers), or goes away when the step in front doesn't type. Only while it is up.
  const stopKb = () => {
    if (R.kb) clearInterval(R.kb);
    R.kb = null;
  };
  const kbTick = () => {
    const st = STEPS[R.i];
    if (!st || R.paused) return;
    let focused = '';
    tourInputs.forEach((e, id) => {
      if (e.ref.current?.isFocused()) focused = id;
    });
    if (tourTyping.at !== R.kbSince) {
      R.kbSince = tourTyping.at;
      R.kbDone = false;
    }
    if (R.kbDone || Date.now() - tourTyping.at < IDLE) return;
    R.kbDone = true;
    if (!focused) return;
    const next = st.fields?.find((id) => {
      const e = tourInputs.get(id);
      return !!e && !e.value.trim();
    });
    if (next) {
      if (next !== focused) tourInputs.get(next)?.ref.current?.focus();
    } else if (!st.kb) Keyboard.dismiss();
  };
  const scrollBy = (dy: number) => {
    const sc = tabScrolls[live.current.tab];
    if (!sc || !dy) return;
    const { ref, offset } = sc;
    runOnUI(() => {
      'worklet';
      scrollTo(ref, 0, Math.max(0, offset.value + dy), false);
    })();
  };

  /** Measures the step's parts on the UI thread; `done` gets the result on the JS side. */
  const measureStep = useCallback(
    (ids: string[], done: (m: Measured) => void) => {
      const refs = tourRefs(ids);
      const nav = tourRefs(['nav'])[0];
      const page = tabScrolls[live.current.tab];
      const anchor = page ? page.anchor : null;
      const topPad = page ? page.top : 0;
      runOnUI(() => {
        'worklet';
        // the page's scroll offset at this very moment, from the same measurement as the parts (the page
        // starts at the top of the screen, its content's first view sits at its top padding)
        let am: { pageY: number } | null = null;
        try {
          am = anchor ? measure(anchor) : null;
        } catch {
          am = null;
        }
        const base = am ? topPad - am.pageY : pageY.value;
        let u: Rect | null = null;
        let first: Rect | null = null;
        let last: Rect | null = null;
        for (let k = 0; k < refs.length; k++) {
          const g = measure(refs[k]);
          if (!g || (!g.width && !g.height)) continue;
          const q = { l: g.pageX, t: g.pageY, r: g.pageX + g.width, b: g.pageY + g.height };
          if (!first) first = q;
          last = q;
          u = u ? { l: Math.min(u.l, q.l), t: Math.min(u.t, q.t), r: Math.max(u.r, q.r), b: Math.max(u.b, q.b) } : q;
        }
        const n = nav ? measure(nav) : null;
        const m: Measured = u && first && last ? { ok: true, u, first, last, navTop: n ? n.pageY : vh, base } : { ...NONE, navTop: n ? n.pageY : vh };
        meas.value = m;
        runOnJS(done)(m);
      })();
    },
    [meas, vh],
  );

  // ---- the steps ----
  const end = useRef<(done: boolean) => void>(() => {});
  const go = useCallback(
    (n: number) => {
      clearTimers();
      const x = ctx();
      let k = n;
      // skip steps that don't apply (no envelope out, nothing to light up on the tab in front)
      while (k < STEPS.length) {
        const s = STEPS[k];
        const missing = s.t && s.tab != null && x.tab === s.tab && !tourRefs(s.t).length && !s.act;
        if ((s.skip && s.skip(x)) || missing) k++;
        else break;
      }
      if (k >= STEPS.length) return end.current(true);
      const st = STEPS[k];
      R.i = k;
      setI(k);
      R.v = {};
      R.kbDone = false;
      if (st.tab != null && x.tab !== st.tab) router.navigate(PATHS[st.tab] as '/');
      st.pre?.(ctx());
      st.init?.(ctx());
      R.ph = 0;
      R.t0 = Date.now();
      R.stab = 0;
      R.key = '';
      hide(true);
      has.value = !!st.t;
      fixed.value = !!st.t && st.t[0].startsWith('nav');
      pos.value = st.pos || '';
      if (!st.t) meas.value = NONE;
      prog.value = withTiming((k + 1) / STEPS.length, { duration: 500, easing: EASE });
      setSkipStep(false);
      // a part off screen is scrolled into view once, while the bubble is faded out
      if (st.t && !fixed.value)
        later(() => {
          if (R.i !== k) return;
          measureStep(st.t!, (m) => {
            if (R.i !== k || !m.ok) return;
            const r = m.u;
            if (!(r.t < 80 || r.b > vh - 150)) return;
            if (st.sheet) scrollBy((m.first.t + m.first.b) / 2 - vh / 2);
            else {
              const nt = m.navTop;
              const fb = st.t!.length > 1 ? m.last.b : 0;
              scrollBy(r.b - r.t > nt - 74 && fb >= r.b - 2 ? r.b - (nt - 12) : r.b - r.t > vh * 0.55 ? r.t - 74 : (r.t + r.b) / 2 - vh * 0.45);
            }
          });
        }, 240);
      swapText(st.c);
      if (st.act) {
        R.poll = setInterval(() => {
          if (R.i !== k || R.paused) return;
          let done = false;
          try {
            done = !!st.act!(ctx());
          } catch {
            done = false;
          }
          // a step the user types in is done once they have stopped typing (the amount counts from the
          // first digit, the description from two letters)
          if (!done || (st.kb && Date.now() - tourTyping.at < IDLE)) return;
          clearTimers();
          setSkipStep(false);
          swapText(NICE + st.c, true);
          later(() => R.i === k && go(k + 1), 900);
        }, 200);
        later(() => R.i === k && setSkipStep(true), 15000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measureStep, vh],
  );

  // every 40 ms: where the parts are now; the next step shows once they have stopped moving
  const tick = useCallback(() => {
    const st = STEPS[R.i];
    if (!st) return;
    const now = Date.now();
    const ct = live.current.tab;
    if (R.seenTab !== ct) {
      if (R.seenTab !== -1) {
        R.clrUntil = now + 1600;
        clear(true);
      }
      R.seenTab = ct;
    }
    const after = (m: Measured) => {
      const T = m.ok ? [m.u.l, m.u.t, m.u.r, m.u.b].map(Math.round).join(',') : 'none';
      R.stab = T === R.key ? R.stab + 1 : 0;
      R.key = T;
      if (R.ph === 0) {
        const el = now - R.t0;
        if (el < 280 || (R.stab < 3 && el < 1600) || now < R.clrUntil) return;
        R.ph = 1;
        R.clrUntil = 0;
        clear(false);
        hide(false);
      }
      if (st.keep && m.ok && m.last.b > m.navTop - 4) scrollBy(Math.ceil(m.last.b - (m.navTop - 12)));
    };
    if (st.t) measureStep(st.t, after);
    else after(NONE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureStep]);

  const start = useCallback(() => {
    const L = live.current;
    if (isTourRunning() || !(L.state.start > 0) || L.demo) return;
    store.tourStart();
    setTourRunning(true);
    setOn(true);
    setPaused(false);
    R.paused = false;
    R.seenTab = -1;
    R.clrUntil = 0;
    clear(false);
    fade.value = withTiming(1, { duration: 400, easing: EASE });
    if (L.tab !== 0) router.navigate('/');
    const sc = tabScrolls[0];
    if (sc) {
      const { ref } = sc;
      runOnUI(() => {
        'worklet';
        scrollTo(ref, 0, 0, false);
      })();
    }
    go(0);
    if (R.loop) clearInterval(R.loop);
    R.loop = setInterval(tick, 40);
    stopKb();
    R.kb = setInterval(kbTick, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, go, tick]);
  tour.start = start;

  end.current = (done: boolean) => {
    if (!isTourRunning()) return;
    clearTimers();
    if (R.loop) clearInterval(R.loop);
    R.loop = null;
    R.i = -1;
    stopKb();
    Keyboard.dismiss();
    setTourRunning(false);
    tourBubble.value = { y: 0, h: 0, on: false };
    tourHole.value = { l: 0, t: 0, r: 0, b: 0, on: false };
    fade.value = withTiming(0, { duration: 400, easing: EASE });
    setTimeout(() => setOn(false), 420);
    router.navigate('/');
    store.tourEnd(); // the real data comes back; the screens start fresh on Home
    toast(done ? TOUR_DONE : TOUR_SKIPPED);
  };

  // the edit sheet is a window over the tour: wait until it closes, then pick the step up again
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const pz = tourBus.sheet;
      if (pz === R.paused) return;
      R.paused = pz;
      setPaused(pz);
      if (!pz && R.i >= 0) go(R.i);
    }, 100);
    return () => clearInterval(id);
  }, [on, go, R]);

  // a new user sees the tour on their own once (prototype: 1.1 s after the app opens)
  const autoTried = useRef(false);
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    if (autoTried.current || !store.ready || demo) return;
    if (!(state.start > 0) || state.tutSeen) return;
    autoTried.current = true;
    setTimeout(() => startRef.current(), 1100);
  }, [store.ready, state.start, state.tutSeen, demo]);

  useEffect(() => () => {
    clearTimers();
    stopKb();
    if (R.loop) clearInterval(R.loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a drag on the cover or the bubble scrolls the page in front (on the UI thread), and flings on
  const page = tabScrolls[tab];
  const dragFrom = useSharedValue(0);
  const flingY = useSharedValue(-1); // the fling's offset; -1 when there is none
  const pageMax = () => {
    'worklet';
    if (!page) return 0;
    const g = measure(page.ref);
    return Math.max(0, page.contentH.value - (g ? g.height : vh));
  };
  const pagePan = Gesture.Pan()
    .enabled(!!page && !paused)
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onBegin(() => {
      cancelAnimation(flingY);
      flingY.value = -1;
    })
    .onStart(() => {
      if (page) dragFrom.value = page.offset.value;
    })
    .onUpdate((e) => {
      if (page) scrollTo(page.ref, 0, Math.min(pageMax(), Math.max(0, dragFrom.value - e.translationY)), false);
    })
    .onEnd((e) => {
      if (!page) return;
      flingY.value = page.offset.value;
      flingY.value = withDecay({ velocity: -e.velocityY, clamp: [0, pageMax()] }, () => {
        flingY.value = -1;
      });
    });
  useAnimatedReaction(
    () => flingY.value,
    (y) => {
      if (y >= 0 && page) scrollTo(page.ref, 0, y, false);
    },
    [page],
  );

  if (!on) return null;
  const st = STEPS[i];
  const dim = light ? 'rgba(232,240,235,0.38)' : 'rgba(2,7,4,0.36)';
  const edge = light ? 'rgba(18,184,95,0.28)' : 'rgba(120,255,190,0.22)';
  const pane = (s: object, k: number) => (
    <Animated.View key={k} style={[st_.pane, s]}>
      <BlurView intensity={12} tint={light ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dim }]} />
    </Animated.View>
  );
  return (
    <GestureDetector gesture={pagePan}>
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 50 }, root]} pointerEvents={paused ? 'none' : 'box-none'}>
        {!paused && (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, panes]} pointerEvents="box-none">
              {[paneTop, paneBottom, paneLeft, paneRight].map(pane)}
            </Animated.View>
            <Animated.View pointerEvents="none" style={[st_.ring, ring]} />
            <Animated.View
              onLayout={(e: LayoutChangeEvent) => {
                bw.value = e.nativeEvent.layout.width;
                bh.value = e.nativeEvent.layout.height;
              }}
              pointerEvents={shown ? 'auto' : 'none'}
              style={[st_.bub, { width: Math.min(340, vw - 24), backgroundColor: c.card, borderColor: edge, boxShadow: light ? '0 18px 44px rgba(13,31,21,0.2)' : '0 18px 44px rgba(0,0,0,0.5)' }, bubble]}
            >
              <Animated.View style={[st_.arrow, { backgroundColor: c.card, borderColor: edge }, arrow]} />
              <Text style={[st_.cnt, { color: c.accent }]}>{i + 1 + ' / ' + STEPS.length}</Text>
              <Animated.Text style={[st_.txt, { color: ok ? c.accent : c.ink }, words]}>{text}</Animated.Text>
              <View style={st_.row}>
                <Pressable accessibilityRole="button" onPress={() => go(R.i + 1)} disabled={!skipStep} style={{ opacity: skipStep ? 1 : 0 }}>
                  <Text style={[st_.sk2, { color: c.mute }]}>Skip step</Text>
                </Pressable>
                {st && !st.act && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => (st.end ? end.current(true) : go(R.i + 1))}
                    style={({ pressed }) => [st_.nx, { backgroundColor: c.accent }, pressed && { transform: [{ scale: 0.97 }] }]}
                  >
                    <Text style={[st_.nxT, { color: c.onAccent }]}>{st.btn || 'Next'}</Text>
                  </Pressable>
                )}
              </View>
              <View style={st_.pr}>
                <Animated.View style={[st_.prB, { backgroundColor: c.accent }, bar]} />
              </View>
            </Animated.View>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => end.current(false)}
          style={[
            st_.skip,
            { top: insets.top + 10 },
            light ? { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(18,184,95,0.3)' } : { backgroundColor: 'rgba(10,24,16,0.88)', borderColor: 'rgba(120,255,190,0.25)' },
          ]}
        >
          <Text style={[st_.skipT, { color: c.ink }]}>Skip tour</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

/** What the tour shows over the edit sheet while it waits (prototype .tut.pz). */
export function TourPauseNote() {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: vw } = useWindowDimensions();
  const edge = name === 'light' ? 'rgba(18,184,95,0.28)' : 'rgba(120,255,190,0.22)';
  return (
    <View pointerEvents="none" style={[st_.bub, { position: 'absolute', top: insets.top + 58, left: (vw - Math.min(340, vw - 24)) / 2, width: Math.min(340, vw - 24), backgroundColor: c.card, borderColor: edge }]}>
      <Text style={[st_.txt, { color: c.ink, marginBottom: 0 }]}>Close this window first, then we carry on with the tour.</Text>
    </View>
  );
}

const st_ = StyleSheet.create({
  pane: { position: 'absolute', overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(34,224,122,0.8)', boxShadow: '0 0 24px rgba(34,224,122,0.28)' },
  bub: { position: 'absolute', left: 0, top: 0, borderWidth: 1, borderRadius: 18, paddingTop: 13, paddingHorizontal: 16, paddingBottom: 12 },
  arrow: { position: 'absolute', width: 12, height: 12, borderTopWidth: 1, borderLeftWidth: 1 },
  cnt: { fontFamily: inter[700], fontSize: 9.6, lineHeight: 13.92, letterSpacing: 1.344, textTransform: 'uppercase' },
  txt: { marginTop: 5, marginBottom: 10, fontFamily: inter[400], fontSize: 15.52, lineHeight: 22.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 36 },
  sk2: { paddingVertical: 4, fontFamily: inter[500], fontSize: 12.8, lineHeight: 18.56, textDecorationLine: 'underline' },
  nx: { marginLeft: 'auto', paddingVertical: 9, paddingHorizontal: 20, borderRadius: 12 },
  nxT: { fontFamily: inter[700], fontSize: 14.4, lineHeight: 20.88 },
  pr: { height: 3, borderRadius: 2, backgroundColor: 'rgba(127,127,127,0.2)', marginTop: 10, overflow: 'hidden' },
  prB: { height: '100%' },
  skip: { position: 'absolute', right: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  skipT: { fontFamily: inter[600], fontSize: 13.12, lineHeight: 19.02 },
});

/** The keyboard's height on the UI thread (the web has no keyboard tracking: 0). */
function useKeyboardHeight() {
  const zero = useSharedValue(0);
  // the platform never changes while the app runs, so the hook order stays the same
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return Platform.OS === 'web' ? zero : useAnimatedKeyboard().height;
}
