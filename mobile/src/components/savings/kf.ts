// Keyframes the way the prototype's CSS / Web Animations write them: values at offsets, each interval with
// its own easing (cubic-bezier), linear in between. Worklets: evaluated on the UI thread every frame.

import { bezier } from '@/components/intro/cssAnim';

export type Ease = number[];
export const EASE: Ease = [0.25, 0.1, 0.25, 1];
export const EASE_IN: Ease = [0.42, 0, 1, 1];
export const EASE_OUT: Ease = [0, 0, 0.58, 1];
export const EASE_IN_OUT: Ease = [0.42, 0, 0.58, 1];
export const LINEAR: Ease = [0, 0, 1, 1];

/** One keyframe: at offset `o` the values `v`; `e` eases the interval up to the next keyframe. */
export interface Frame {
  o: number;
  v: number[];
  e?: Ease;
}

/** The values at progress k (0..1, clamped). */
export function kf(frames: Frame[], k: number): number[] {
  'worklet';
  const p = Math.min(1, Math.max(0, k));
  let i = 0;
  while (i < frames.length - 2 && p > frames[i + 1].o) i++;
  const a = frames[i];
  const b = frames[i + 1];
  const span = b.o - a.o;
  const raw = span > 0 ? (p - a.o) / span : 1;
  const e = a.e ?? LINEAR;
  const t = e === LINEAR ? raw : bezier(e, raw);
  return a.v.map((x, j) => x + (b.v[j] - x) * t);
}

/** Progress of an animation `dur` long that starts `delay` after the clock's 0. */
export function phase(clock: number, delay: number, dur: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (clock - delay) / dur));
}

/** A colour mixed with white: CSS color-mix(in srgb, hex p, #fff), as [r, g, b]. */
export function mixWhite(hex: string, p: number): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v * p + 255 * (1 - p));
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}
export const rgba = (c: [number, number, number], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
