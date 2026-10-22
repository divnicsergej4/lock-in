// The intro character must move exactly like in the prototype. character.browser.json holds what the
// browser itself computed for every animated part of the prototype's character (all animations paused
// at 43 moments of the scene); the engine must give the same transform and opacity at each moment.

import { ANIMS, KEYFRAMES } from '../character.data';
import { bezier, evaluate, fnsMatrix } from '../cssAnim';
import browser from './character.browser.json';

const B = browser as unknown as { times: number[]; out: Record<string, [string, number][]> };

const parse = (t: string) => (t === 'none' ? [1, 0, 0, 1, 0, 0] : t.slice(7, -1).split(',').map(Number));

describe('same motion as the browser, for every animated part', () => {
  const classes = Object.keys(B.out).filter((c) => ANIMS[c]);

  test('every animated part of the prototype is in the data', () => {
    const animatedInBrowser = Object.keys(B.out).filter((c) => B.out[c].some(([tr, o]) => tr !== B.out[c][0][0] || o !== B.out[c][0][1]));
    expect(animatedInBrowser.filter((c) => !ANIMS[c])).toEqual([]);
  });

  // Parts whose CSS animates only opacity keep their own transform attribute, which the browser
  // reports as the computed transform; the renderer applies that attribute separately.
  const cssMovesIt = (cls: string) => ANIMS[cls].baseTransform.length > 0 || ANIMS[cls].list.some((a) => KEYFRAMES[a.name].transform);

  const close = (a: number[], b: number[]) => a.every((v, k) => Math.abs(v - b[k]) <= 2e-3);

  test.each(classes)('.%s', (cls) => {
    B.times.forEach((t, i) => {
      const [tr, op] = B.out[cls][i];
      // a sample exactly on the border of two iterations may land on either side in the browser
      const tries = [t, t - 1e-3].map((x) => evaluate(ANIMS[cls], KEYFRAMES, x));
      const want = parse(tr);
      const okM = !cssMovesIt(cls) || tries.some((r) => close(fnsMatrix(r.fns), want));
      if (!okM) throw new Error(`.${cls} at ${t} ms: matrix ${fnsMatrix(tries[0].fns).map((x) => x.toFixed(4))} but browser ${tr}`);
      if (!tries.some((r) => Math.abs(r.opacity - op) <= 2e-3)) throw new Error(`.${cls} at ${t} ms: opacity ${tries[0].opacity} but browser ${op}`);
    });
  });
});

describe('cubic-bezier', () => {
  test('linear and the CSS keywords', () => {
    expect(bezier([0, 0, 1, 1], 0.37)).toBeCloseTo(0.37, 6);
    expect(bezier([0.25, 0.1, 0.25, 1], 0.5)).toBeCloseTo(0.8024, 3); // ease
    expect(bezier([0.42, 0, 0.58, 1], 0.5)).toBeCloseTo(0.5, 6); // ease-in-out
  });

  test('overshoot curve used by the character', () => {
    // cubic-bezier(.3,1.45,.55,1) goes above 1 before settling
    const ys = Array.from({ length: 50 }, (_, i) => bezier([0.3, 1.45, 0.55, 1], i / 49));
    expect(Math.max(...ys)).toBeGreaterThan(1.05);
    expect(ys[49]).toBe(1);
  });
});
