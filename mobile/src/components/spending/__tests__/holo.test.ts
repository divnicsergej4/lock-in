// The ring must sit and move exactly like the prototype's. The prototype's own hFit/hPose/hGo code is
// run here (cut out of index.html) and compared with the port.

import vm from 'vm';

import { fnSource, stmtSource } from '@/logic/__tests__/prototype';

import { HP, holoLayout, hPose, springStep, SPRING_DT, settled, SPRING_MAX_S, swipeTarget } from '../holo';

/** The prototype's ring code with its layout for a given screen width. */
function prototypeRing(W: number) {
  const ctx: Record<string, any> = { Math };
  vm.createContext(ctx);
  const src = [stmtSource("var hst=$('vzc')"), fnSource('hm'), fnSource('hPose')]
    .join('\n')
    .replace("var hst=$('vzc'),hpan=qa('#vzc .vzs'),HN=hpan.length,hring=$('hring'),", 'var HN=3,');
  vm.runInContext(src, ctx);
  // hFit's sizing part
  vm.runInContext(
    `var W=${W};hpw=Math.round(Math.min(W-(W<370?44:64),400));var th=HRY*Math.PI/180,f=HP/(HP+HZ-HCV*hpw/2*Math.sin(th));HX=Math.max(24,(W/2-8)/f-hpw/2*Math.cos(th));HB=hpw*HBF;`,
    ctx,
  );
  return ctx;
}

/** Projects a point of a panel with the CSS transform vs. the React Native one. */
function project(tf: { x: number; z: number; ry: number }, X: number, rn: boolean) {
  const r = (tf.ry * Math.PI) / 180;
  // rotateY, then translate, then perspective (CSS order, rightmost first)
  const xr = X * Math.cos(r);
  const zr = -X * Math.sin(r);
  if (!rn) return ((xr + tf.x) * HP) / (HP - (zr + tf.z));
  const k = HP / (HP - tf.z);
  const P2 = HP - tf.z;
  return (k * (xr + tf.x) * P2) / (P2 - zr);
}

describe('the ring sits like the prototype', () => {
  test.each([375, 390, 393, 430, 360])('layout and pose at width %i', (W) => {
    const proto = prototypeRing(W);
    const L = holoLayout(W);
    expect(L.pw).toBe(proto.hpw);
    expect(L.HX).toBeCloseTo(proto.HX, 9);
    expect(L.HB).toBeCloseTo(proto.HB, 9);
    for (let p = -3; p <= 3; p += 0.07)
      for (const sp of [0, 0.3, 1])
        for (let i = 0; i < 3; i++) {
          const a = hPose(i, p, sp, L);
          const b = proto.hPose(i, p, sp);
          const m = /translate3d\(([-\d.]+)px,0,([-\d.]+)px\) rotateY\(([-\d.]+)deg\)/.exec(b.tf)!;
          expect(a.x.toFixed(2)).toBe(m[1]);
          expect(a.z.toFixed(2)).toBe(m[2]);
          expect(a.ry.toFixed(2)).toBe(m[3]);
          expect(a.opacity.toFixed(3)).toBe(b.op);
          expect(a.dim.toFixed(3)).toBe(b.dim);
          expect(String(a.depth)).toBe(b.z);
        }
  });

  test('the transform without translateZ projects every point exactly like the CSS one', () => {
    const L = holoLayout(390);
    for (let p = 0; p < 3; p += 0.05)
      for (let i = 0; i < 3; i++) {
        const q = hPose(i, p, 1, L);
        for (let X = -L.pw / 2; X <= L.pw / 2; X += 20) expect(project(q, X, true)).toBeCloseTo(project(q, X, false), 9);
      }
  });
});

describe('the ring settles like the prototype', () => {
  /** The prototype's spring path (hGo). */
  function protoPath(p0: number, t: number, v0: number) {
    let p = p0;
    let v = v0;
    const S = [p];
    let T = 0;
    const dt = 1 / 120;
    while (T < 2.2) {
      const ac = -190 * (p - t) - 24 * v;
      v += ac * dt;
      p += v * dt;
      T += dt;
      S.push(p);
      if (Math.abs(p - t) < 0.0008 && Math.abs(v) < 0.003) break;
    }
    S[S.length - 1] = t;
    return S;
  }

  test.each([
    [0.3, 1, 0],
    [1.7, 1, -4],
    [0, 2, 6],
    [2.4, 3, 1.5],
  ])('from %f to %i at speed %f', (p0, t, v0) => {
    const want = protoPath(p0, t, v0);
    const got = [p0];
    let p = p0;
    let v = v0;
    let T = 0;
    while (T < SPRING_MAX_S) {
      [p, v] = springStep(p, v, t);
      T += SPRING_DT;
      got.push(p);
      if (settled(p, v, t)) break;
    }
    got[got.length - 1] = t;
    expect(got.length).toBe(want.length);
    got.forEach((x, k) => expect(x).toBeCloseTo(want[k], 12));
  });

  test('swipe end: nearest panel after a short glide, at most two away, speed capped', () => {
    const step = holoLayout(390).step;
    expect(swipeTarget(0.4, 0, 0, step)).toEqual({ t: 0, v: -0 });
    expect(swipeTarget(0.6, 0, 0, step).t).toBe(1);
    expect(swipeTarget(0.2, 0, -2000, step).t).toBe(1); // fast flick left turns one panel on
    expect(swipeTarget(2.4, 0, -9000, step)).toEqual({ t: 2, v: 6 });
  });
});
