// The shared goal's ring with the gold lock in the middle (Andrija's design). The ring fills with one segment per
// member, in their colour, as a share of the target. Pins sit at 25, 50, 75 and 100%: passed ones are full gold,
// the next one is empty. When a pin is passed it pops (the caller adds the haptic); at 100% the shackle lifts
// until its right leg leaves the body, and the ring glows. Everything moves on the UI thread (Reanimated shared
// values drawn by Skia), like the holo ring.

import { BlurMask, Canvas, Circle, DashPathEffect, Group, Path, RadialGradient, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Easing, useDerivedValue, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { useLook } from './look';
import { GOLD, PINS } from '@/logic/goals';

export type Seg = { key: string; color: string; from: number; to: number }; // fractions of the target, 0..1

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** A circle path that starts at the top and goes clockwise, so start/end are fractions of the way round. */
function ringPath(cx: number, cy: number, r: number) {
  const p = Skia.PathBuilder.Make();
  p.addArc({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, -90, 359.99);
  return p.detach();
}

function Segment({ seg, path, width, gap }: { seg: Seg; path: ReturnType<typeof ringPath>; width: number; gap: number }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    a.value = withTiming(seg.from, { duration: 900, easing: EASE });
    b.value = withTiming(Math.max(seg.from, seg.to - (seg.to < 0.999 ? gap : 0)), { duration: 900, easing: EASE });
  }, [seg.from, seg.to, gap, a, b]);
  const end = useDerivedValue(() => Math.max(a.value + 0.0001, b.value));
  return <Path path={path} style="stroke" strokeWidth={width} strokeCap="butt" color={seg.color} start={a} end={end} />;
}

function Pin({ x, y, r, state, pulse, bg }: { x: number; y: number; r: number; state: 'passed' | 'next' | 'later'; pulse: number; bg: string }) {
  const s = useSharedValue(1);
  const ripple = useSharedValue(0);
  useEffect(() => {
    if (!pulse) return;
    s.value = withSequence(withTiming(1.9, { duration: 170, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 9, stiffness: 180 }));
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [pulse, s, ripple]);
  const transform = useDerivedValue(() => [{ scale: s.value }]);
  const rippleT = useDerivedValue(() => [{ scale: 1 + ripple.value * 2.6 }]);
  const ro = useDerivedValue(() => (ripple.value > 0 && ripple.value < 1 ? 1 - ripple.value : 0));
  const fill = state === 'passed' ? GOLD : bg;
  return (
    <Group>
      <Group transform={rippleT} origin={vec(x, y)} opacity={ro}>
        <Circle cx={x} cy={y} r={r} color={GOLD} style="stroke" strokeWidth={1.4} />
      </Group>
      <Group transform={transform} origin={vec(x, y)}>
        <Circle cx={x} cy={y} r={r + 2.5} color={bg} />
        <Circle cx={x} cy={y} r={r} color={fill} />
        <Circle cx={x} cy={y} r={r} color={GOLD} style="stroke" strokeWidth={state === 'later' ? 1.5 : 2.2} opacity={state === 'later' ? 0.55 : 1} />
      </Group>
    </Group>
  );
}

/** The lock itself: shackle (long left leg, short right leg), body, light band, keyhole. `open`: 0 shut, 1 open. */
function Lock({ cx, cy, w, open }: { cx: number; cy: number; w: number; open: SharedValue<number> }) {
  const g = useLook();
  const bw = w;
  const bh = w * 0.78;
  const bx = cx - bw / 2;
  const by = cy - bh * 0.18;
  const sw = w * 0.17; // shackle thickness
  const inner = bw * 0.62; // distance between the legs' centres
  const lx = cx - inner / 2;
  const rx = cx + inner / 2;
  const top = by - w * 0.62;
  const lift = w * 0.36;
  const shackle = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(lx, by + bh * 0.45);
    p.lineTo(lx, top + inner / 2);
    p.arcToOval({ x: lx, y: top, width: inner, height: inner }, 180, 180, false);
    p.lineTo(rx, by + bh * 0.08);
    return p.detach();
  }, [lx, rx, by, bh, top, inner]);
  const transform = useDerivedValue(() => [{ translateY: -lift * open.value }]);
  return (
    <Group>
      <Group transform={transform}>
        <Path path={shackle} style="stroke" strokeWidth={sw} strokeCap="round" color={GOLD} />
      </Group>
      <RoundedRect x={bx} y={by} width={bw} height={bh} r={bh * 0.2} color={GOLD} />
      <RoundedRect x={bx - w * 0.04} y={by - w * 0.02} width={bw + w * 0.08} height={w * 0.11} r={w * 0.055} color="rgba(255,236,180,0.55)" />
      <Circle cx={cx} cy={by + bh * 0.42} r={bw * 0.085} color={g.onGold} />
      <RoundedRect x={cx - bw * 0.035} y={by + bh * 0.42} width={bw * 0.07} height={bh * 0.28} r={bw * 0.035} color={g.onGold} />
    </Group>
  );
}

const CONFETTI = [
  [0.27, 0.15, '#5aa9f0', 0], [0.65, 0.17, GOLD, 0], [0.8, 0.27, '#ff7eb6', 1], [0.18, 0.24, '#22e07a', 1],
  [0.86, 0.52, '#22e07a', 0], [0.13, 0.53, '#ff7eb6', 0], [0.22, 0.76, '#5aa9f0', 1], [0.75, 0.73, GOLD, 1],
] as const;

export function LockRing({
  size,
  segs,
  passed = [],
  next = null,
  unlocked,
  animateOpen = false,
  pulse = {},
  small = false,
  confetti = false,
}: {
  size: number;
  segs: Seg[];
  passed?: number[];
  next?: number | null;
  unlocked: boolean;
  animateOpen?: boolean; // open the lock with the animation (otherwise an unlocked goal starts open)
  pulse?: Record<number, number>; // pin -> counter: changing it pops that pin
  small?: boolean; // the card in the list: no pins, thicker ring
  confetti?: boolean;
}) {
  const g = useLook();
  const cx = size / 2;
  const cy = size / 2;
  const width = small ? size * 0.09 : size * 0.042;
  const pinR = size * 0.024;
  // room around the ring for the glow, so it fades out before the canvas edge instead of being cut square
  const r = size / 2 - (small ? width / 2 + 5 : pinR + 26);
  const path = useMemo(() => ringPath(cx, cy, r), [cx, cy, r]);
  const open = useSharedValue(unlocked && !animateOpen ? 1 : 0);
  useEffect(() => {
    if (!unlocked) open.value = withTiming(0, { duration: 300 });
    else if (open.value < 1) open.value = withDelay(animateOpen ? 450 : 150, withSpring(1, { damping: 11, stiffness: 120 }));
  }, [unlocked, animateOpen, open]);
  const glow = useDerivedValue(() => Math.min(1, Math.max(0, open.value)));
  const confettiO = useDerivedValue(() => (confetti ? Math.min(1, Math.max(0, open.value)) : 0));

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group opacity={glow}>
        <Circle cx={cx} cy={cy} r={r * 0.86}>
          <RadialGradient c={vec(cx, cy * 0.92)} r={r * 0.86} colors={['rgba(245,200,75,0.32)', 'rgba(245,200,75,0)']} />
        </Circle>
        <Path path={path} style="stroke" strokeWidth={width * 1.6} color="rgba(245,200,75,0.45)">
          <BlurMask blur={small ? 3 : 10} style="normal" />
        </Path>
      </Group>
      <Path path={path} style="stroke" strokeWidth={width} color={g.track} />
      {segs.map((s) => (
        <Segment key={s.key} seg={s} path={path} width={width} gap={segs.length > 1 ? 0.006 : 0} />
      ))}
      {confetti &&
        CONFETTI.map(([x, y, color, line], i) => (
          <Group key={i} opacity={confettiO}>
            {line ? (
              <RoundedRect x={size * x - 5} y={size * y - 2} width={10} height={4} r={2} color={color} transform={[{ rotate: 0.6 + i }]} origin={vec(size * x, size * y)} />
            ) : (
              <Circle cx={size * x} cy={size * y} r={3.2} color={color} />
            )}
          </Group>
        ))}
      {!small &&
        PINS.map((p) => {
          const a = ((p / 100) * 360 - 90) * (Math.PI / 180);
          const state = passed.includes(p) ? 'passed' : next === p ? 'next' : p === 100 ? 'passed' : 'later';
          return <Pin key={p} x={cx + r * Math.cos(a)} y={cy + r * Math.sin(a)} r={pinR} state={state} pulse={pulse[p] ?? 0} bg={g.bg} />;
        })}
      <Lock cx={cx} cy={cy + r * 0.05} w={r * (small ? 0.74 : 0.68)} open={open} />
    </Canvas>
  );
}

/** The empty state: a dashed ring and an outlined lock. */
export function DashedLock({ size }: { size: number }) {
  const cx = size / 2;
  const r = size / 2 - 4;
  const w = size * 0.42;
  const bh = w * 0.78;
  const by = cx - bh * 0.1;
  const inner = w * 0.6;
  const shackle = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(cx - inner / 2, by);
    p.lineTo(cx - inner / 2, by - w * 0.62 + inner / 2);
    p.arcToOval({ x: cx - inner / 2, y: by - w * 0.62, width: inner, height: inner }, 180, 180, false);
    p.lineTo(cx + inner / 2, by);
    return p.detach();
  }, [cx, by, w, inner]);
  const sw = size * 0.035;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={cx} cy={cx} r={r} style="stroke" strokeWidth={size * 0.028} color="rgba(245,200,75,0.38)" strokeCap="round">
        <DashPathEffect intervals={[size * 0.022, size * 0.03]} />
      </Circle>
      <Path path={shackle} style="stroke" strokeWidth={sw} strokeCap="round" color={GOLD} />
      <RoundedRect x={cx - w / 2} y={by} width={w} height={bh} r={bh * 0.2} style="stroke" strokeWidth={sw} color={GOLD} />
      <Circle cx={cx} cy={by + bh * 0.42} r={sw * 0.7} color={GOLD} />
      <RoundedRect x={cx - sw * 0.35} y={by + bh * 0.42} width={sw * 0.7} height={bh * 0.22} r={sw * 0.35} color={GOLD} />
    </Canvas>
  );
}

/** The ring's segments from what each member put in. */
export function segments(members: { id: string; color: string; total: number }[], target: number): Seg[] {
  let at = 0;
  const out: Seg[] = [];
  for (const m of members) {
    if (m.total <= 0) continue;
    const from = Math.min(1, at / target);
    at += m.total;
    const to = Math.min(1, at / target);
    if (to > from) out.push({ key: m.id, color: m.color, from, to });
  }
  return out;
}
