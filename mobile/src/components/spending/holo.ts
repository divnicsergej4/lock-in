// The holographic ring's maths, from the prototype (hFit, hPose, hGo, the swipe end): three panels on a
// ring in 3D, the finger turns it, a spring settles it. All worklets: they run on the UI thread every
// frame (120 Hz on ProMotion iPhones), never through JavaScript.

export const HN = 3; // panels
export const HP = 1100; // perspective
const HZ = 200;
const HZE = 150;
const HZB = 130;
const HRY = 34; // side panel turn (deg)
const HRYE = 16;
const HXE = 70;
const HBF = 0.36;
const HCV = 1;
export const HPT = 20; // space above the panels
export const HPB = 60; // space below (the glowing base)

export interface HoloLayout {
  W: number; // ring width (the whole screen)
  pw: number; // panel width
  HX: number;
  HB: number;
  step: number; // finger travel for one panel
}

/** Panel width and how far the side panels sit (prototype hFit). */
export function holoLayout(W: number): HoloLayout {
  const pw = Math.round(Math.min(W - (W < 370 ? 44 : 64), 400));
  const th = (HRY * Math.PI) / 180;
  const f = HP / (HP + HZ - ((HCV * pw) / 2) * Math.sin(th));
  const HX = Math.max(24, (W / 2 - 8) / f - (pw / 2) * Math.cos(th));
  return { W, pw, HX, HB: pw * HBF, step: pw * 0.85 };
}

/** ((x % 3) + 3) % 3 */
export function hm(x: number) {
  'worklet';
  return ((x % HN) + HN) % HN;
}

export interface Pose {
  x: number;
  z: number;
  ry: number;
  opacity: number;
  dim: number; // darkening of a panel that is turned away
  depth: number; // stacking: higher is in front
}

/** Where panel i is when the ring is at position p; sp = how far the ring has unfolded (0..1). */
export function hPose(i: number, p: number, sp: number, L: HoloLayout): Pose {
  'worklet';
  const d = hm(i - p + 1.5) - 1.5;
  const ad = Math.abs(d);
  const sg = d < 0 ? -1 : 1;
  const a = Math.min(1, ad);
  const e = ad > 1 ? Math.min(1, (ad - 1) / 0.5) : 0;
  const A = a * sp;
  const cur = hm(Math.round(p));
  return {
    x: sg * (L.HX * A + L.HB * Math.sin(Math.PI * A) + HXE * e),
    z: -HZ * A - HZB * Math.sin(Math.PI * A) - HZE * e,
    ry: -HCV * sg * (HRY * A + HRYE * e),
    opacity: (1 - e) * (i === cur ? 1 : Math.min(1, 0.15 + sp * 0.85)),
    dim: Math.min(1, 0.62 * A + 0.38 * e),
    depth: 60 - Math.round(ad * 40),
  };
}

/**
 * CSS "perspective(P) translate3d(x, 0, z) rotateY(ry)" without translateZ, which React Native lacks:
 * moving a plane by z in front of a perspective P projects exactly like scaling by P/(P−z) in front of a
 * perspective of P−z. Same picture, only standard transforms.
 */
export function poseTransform(q: Pose) {
  'worklet';
  return [{ scale: HP / (HP - q.z) }, { perspective: HP - q.z }, { translateX: q.x }, { rotateY: q.ry + 'deg' }];
}

/** One 1/120 s step of the settling spring (prototype hGo: a = −190·(p − t) − 24·v). */
export const SPRING_DT = 1 / 120;
export function springStep(p: number, v: number, t: number): [number, number] {
  'worklet';
  const ac = -190 * (p - t) - 24 * v;
  const nv = v + ac * SPRING_DT;
  return [p + nv * SPRING_DT, nv];
}
export const SPRING_MAX_S = 2.2;
export const settled = (p: number, v: number, t: number) => {
  'worklet';
  return Math.abs(p - t) < 0.0008 && Math.abs(v) < 0.003;
};

/**
 * Where the ring goes when the finger lets go: the nearest panel after a short glide, at most 2 panels
 * from where the drag started, and the starting speed (panels per second, at most 6).
 */
export function swipeTarget(p: number, p0: number, vxPxPerS: number, step: number): { t: number; v: number } {
  'worklet';
  const vp = -vxPxPerS / step;
  const b0 = Math.round(p0);
  let t = Math.round(p + Math.max(-1.2, Math.min(1.2, vp * 0.16)));
  t = Math.max(b0 - 2, Math.min(b0 + 2, t));
  return { t, v: Math.max(-6, Math.min(6, vp)) };
}
