// A small CSS animation engine, so the intro character moves exactly like the prototype's CSS.
// Same rules as the browser: keyframes are kept per property, the timing function applies to each
// keyframe interval, missing 0%/100% keyframes use the element's own (base) value, fill-mode and
// alternate direction work as in CSS, and of several animations on one element the last one that is
// in effect wins. All functions are worklets: they run on the UI thread every frame.

/** A transform function: rotate (deg), translate (x, y) or scale (x, y). */
export type Fn = ['r', number] | ['t', number, number] | ['s', number, number];

export interface Keyframes {
  opacity?: [number, number][];
  transform?: [number, Fn[]][];
}

export interface AnimSpec {
  name: string;
  dur: number; // ms
  delay: number; // ms
  tf: number[]; // cubic-bezier x1, y1, x2, y2
  iter: number; // -1 = infinite
  dir: string;
  fill: string;
}

export interface Anim {
  origin: number[]; // transform-origin in the element's own coordinates
  baseOpacity: number | null;
  baseTransform: Fn[];
  list: AnimSpec[];
}

export interface Gradient {
  type: 'radial' | 'linear';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: { offset: number; color: string }[];
}

export interface Node {
  anim?: string;
  m?: number[]; // own transform attribute, as a matrix
  o?: number; // own opacity
  g?: Node[];
  d?: string;
  circle?: number[];
  ellipse?: number[];
  rect?: number[];
  fill?: string;
  fillGrad?: string;
  stroke?: string;
  sw?: number;
  cap?: string;
  join?: string;
}

/** cubic-bezier(x1, y1, x2, y2) at progress x, like the browser (Newton steps, then bisection). */
export function bezier(p: number[], x: number): number {
  'worklet';
  if (x <= 0) return p[1] === 0 && p[0] === 0 ? 0 : x <= 0 ? (p[0] > 0 ? (p[1] / p[0]) * x : 0) : 0;
  if (x >= 1) return 1;
  const [x1, y1, x2, y2] = p;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const e = sx(t) - x;
    if (Math.abs(e) < 1e-7) return ((ay * t + by) * t + cy) * t;
    const dx = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(dx) < 1e-6) break;
    t -= e / dx;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  while (lo < hi && hi - lo > 1e-7) {
    const v = sx(t);
    if (Math.abs(v - x) < 1e-7) break;
    if (x > v) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return ((ay * t + by) * t + cy) * t;
}

/** Where an animation is at time t: its iteration progress (0..1), or -1 when it isn't in effect. */
export function progress(a: AnimSpec, t: number): number {
  'worklet';
  const local = t - a.delay;
  const fillsBack = a.fill === 'both' || a.fill === 'backwards';
  const fillsFwd = a.fill === 'both' || a.fill === 'forwards';
  const total = a.iter < 0 ? Infinity : a.dur * a.iter;
  let iterIdx: number;
  let p: number;
  if (local < 0) {
    if (!fillsBack) return -1;
    iterIdx = 0;
    p = 0;
  } else if (local >= total) {
    if (!fillsFwd) return -1;
    // the end of the last iteration (an iteration count like 2.5 ends half way)
    const whole = Math.ceil(a.iter) - 1;
    iterIdx = whole;
    p = a.iter - whole;
    if (p === 0) p = 1;
  } else {
    iterIdx = Math.floor(local / a.dur);
    p = (local - iterIdx * a.dur) / a.dur;
  }
  const rev = a.dir === 'reverse' || (a.dir === 'alternate' && iterIdx % 2 === 1) || (a.dir === 'alternate-reverse' && iterIdx % 2 === 0);
  return rev ? 1 - p : p;
}

function seg<T>(frames: [number, T][], base: T, p: number): [T, T, number] {
  'worklet';
  // implicit 0% and 100% keyframes use the base value
  const f: [number, T][] = frames.slice();
  if (f[0][0] !== 0) f.unshift([0, base]);
  if (f[f.length - 1][0] !== 1) f.push([1, base]);
  let i = 0;
  while (i < f.length - 2 && p >= f[i + 1][0]) i++;
  // several keyframes at the same offset (e.g. "0%,92%,100%"): use the last one
  const a = f[i];
  const b = f[i + 1];
  const span = b[0] - a[0];
  return [a[1], b[1], span > 0 ? (p - a[0]) / span : 1];
}

const ident = (f: Fn): Fn => {
  'worklet';
  return f[0] === 'r' ? ['r', 0] : f[0] === 't' ? ['t', 0, 0] : ['s', 1, 1];
};

/** Interpolates two transform lists that share the same functions (CSS uses identity for "none"). */
export function lerpFns(a: Fn[], b: Fn[], k: number): Fn[] {
  'worklet';
  const n = Math.max(a.length, b.length);
  const out: Fn[] = [];
  for (let i = 0; i < n; i++) {
    const x = a[i] || ident(b[i]);
    const y = b[i] || ident(a[i]);
    if (x[0] === 'r') out.push(['r', x[1] + ((y as ['r', number])[1] - x[1]) * k]);
    else out.push([x[0], x[1] + (y[1] - x[1]) * k, x[2] + ((y as ['t', number, number])[2] - x[2]) * k] as Fn);
  }
  return out;
}

/** Opacity and transform functions of an animated element at time t (ms since the scene started). */
export function evaluate(an: Anim, KF: Record<string, Keyframes>, t: number): { opacity: number; fns: Fn[] } {
  'worklet';
  const baseO = an.baseOpacity == null ? 1 : an.baseOpacity;
  let opacity = baseO;
  let fns = an.baseTransform;
  for (let i = 0; i < an.list.length; i++) {
    const a = an.list[i];
    const kf = KF[a.name];
    const p = progress(a, t);
    if (p < 0) continue;
    if (kf.opacity) {
      const [x, y, k] = seg(kf.opacity, baseO, p);
      // like CSS: an overshooting curve can't push opacity outside 0..1
      opacity = Math.min(1, Math.max(0, x + (y - x) * bezier(a.tf, k)));
    }
    if (kf.transform) {
      const [x, y, k] = seg(kf.transform, an.baseTransform, p);
      fns = lerpFns(x, y, bezier(a.tf, k));
    }
  }
  return { opacity, fns };
}

/** The transform functions as a matrix [a, b, c, d, e, f], without the origin. */
export function fnsMatrix(fns: Fn[]): number[] {
  'worklet';
  let m = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < fns.length; i++) {
    const f = fns[i];
    let n: number[];
    if (f[0] === 'r') {
      const r = (f[1] * Math.PI) / 180;
      n = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
    } else if (f[0] === 't') n = [1, 0, 0, 1, f[1], f[2]];
    else n = [f[1], 0, 0, f[2], 0, 0];
    m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  return m;
}

/** translate(origin) · transform · translate(−origin), as a matrix. */
export function withOrigin(m: number[], o: number[]): number[] {
  'worklet';
  const ox = o[0];
  const oy = o[1];
  return [m[0], m[1], m[2], m[3], m[4] + ox - (m[0] * ox + m[2] * oy), m[5] + oy - (m[1] * ox + m[3] * oy)];
}
