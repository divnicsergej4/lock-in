// The intro character (asleep in the chair, money flies off, phone buzzes, he locks in), drawn with
// Skia from the prototype's SVG. Every animated part reads the scene clock on the UI thread, so the
// motion never waits for JavaScript.

import { Canvas, Circle, Group, Oval, Path, RadialGradient, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ANIMS, GRADIENTS, KEYFRAMES, TREE, VIEWBOX } from './character.data';
import { evaluate, fnsMatrix, withOrigin, type Anim, type Node } from './cssAnim';

const toSk = (m: number[]) => {
  'worklet';
  return Skia.Matrix([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]);
};

/** A group moved by its CSS animations. `clock` < 0 means "no animation" (reduced motion). */
function AnimGroup({ an, clock, children }: { an: Anim; clock: SharedValue<number>; children: ReactNode }) {
  const state = useDerivedValue(() => {
    const t = clock.value;
    if (t < 0) return { opacity: an.baseOpacity == null ? 1 : an.baseOpacity, fns: an.baseTransform };
    return evaluate(an, KEYFRAMES, t);
  });
  const matrix = useDerivedValue(() => toSk(withOrigin(fnsMatrix(state.value.fns), an.origin)));
  const opacity = useDerivedValue(() => state.value.opacity);
  return (
    <Group matrix={matrix} opacity={opacity}>
      {children}
    </Group>
  );
}

function Shape({ n }: { n: Node }) {
  const stroke =
    n.stroke != null ? { style: 'stroke' as const, strokeWidth: n.sw, strokeCap: (n.cap as 'round') || 'butt', strokeJoin: (n.join as 'round') || 'miter', color: n.stroke } : null;
  const grad = n.fillGrad ? GRADIENTS[n.fillGrad] : null;
  const paints = [n.fill || grad ? { key: 'f', fill: true } : null, stroke ? { key: 's', fill: false } : null].filter(Boolean) as { key: string; fill: boolean }[];
  return (
    <>
      {paints.map(({ key, fill }) => {
        const p = fill ? { color: n.fill || '#000' } : stroke!;
        let shader: ReactNode = null;
        if (fill && grad) {
          // objectBoundingBox radial gradient: centred on the shape, as wide/tall as the shape
          const [cx, cy, rx, ry] = n.circle ? [n.circle[0], n.circle[1], n.circle[2], n.circle[2]] : n.ellipse!;
          shader = (
            <RadialGradient
              c={vec(cx, cy)}
              r={rx}
              colors={grad.stops.map((s) => s.color)}
              positions={grad.stops.map((s) => s.offset)}
              transform={[{ scaleY: ry / rx }]}
              origin={vec(cx, cy)}
            />
          );
        }
        if (n.d) return <Path key={key} path={n.d} {...p}>{shader}</Path>;
        if (n.circle) return <Circle key={key} cx={n.circle[0]} cy={n.circle[1]} r={n.circle[2]} {...p}>{shader}</Circle>;
        if (n.ellipse) {
          const [cx, cy, rx, ry] = n.ellipse;
          return <Oval key={key} x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} {...p}>{shader}</Oval>;
        }
        const [x, y, w, h, r] = n.rect!;
        return <RoundedRect key={key} x={x} y={y} width={w} height={h} r={r} {...p}>{shader}</RoundedRect>;
      })}
    </>
  );
}

function Draw({ n, clock }: { n: Node; clock: SharedValue<number> }) {
  let el: ReactNode = n.g ? n.g.map((c, i) => <Draw key={i} n={c} clock={clock} />) : <Shape n={n} />;
  if (n.m || n.o != null) el = <Group matrix={n.m ? toSk(n.m) : undefined} opacity={n.o}>{el}</Group>;
  if (n.anim)
    el = (
      <AnimGroup an={ANIMS[n.anim]} clock={clock}>
        {el}
      </AnimGroup>
    );
  return <>{el}</>;
}

/** Room around the drawing: the money, the "!" and the padlock fly a little outside the frame. */
const PAD = 28;

/**
 * The character, `width` points wide (height follows the 300×264 drawing). The canvas is a bit
 * larger than its layout box so nothing gets cut off; it doesn't change the layout.
 */
export function Character({ width, clock, opacity }: { width: number; clock: SharedValue<number>; opacity?: SharedValue<number> }) {
  const s = width / VIEWBOX[0];
  const height = VIEWBOX[1] * s;
  return (
    <Canvas pointerEvents="none" style={{ position: 'absolute', left: -PAD, top: -PAD, width: width + PAD * 2, height: height + PAD * 2 }}>
      <Group transform={[{ translateX: PAD }, { translateY: PAD }, { scale: s }]} opacity={opacity}>
        {TREE.map((n, i) => (
          <Draw key={i} n={n} clock={clock} />
        ))}
      </Group>
    </Canvas>
  );
}

export const characterHeight = (width: number) => (VIEWBOX[1] * width) / VIEWBOX[0];
