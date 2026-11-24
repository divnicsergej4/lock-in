// Generates src/components/intro/character.data.ts from the prototype (../index.html):
// the intro character SVG (shapes, colours, gradients) and its CSS animations (keyframes, timing).
// Run again whenever the character changes in the prototype:  node scripts/gen-intro.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '../../index.html'), 'utf8').replace(/\r\n/g, '\n');

// ---------- SVG ----------
const svgStart = html.indexOf('<svg class="chr3"');
const svgEnd = html.indexOf('</svg>', svgStart) + 6;
const svg = html.slice(svgStart, svgEnd);

function parseXml(src) {
  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z0-9:-]+="[^"]*")*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const [, close, tag, rawAttrs, selfClose] = m;
    if (close) {
      stack.pop();
      continue;
    }
    const attrs = {};
    rawAttrs.replace(/([a-zA-Z0-9:-]+)="([^"]*)"/g, (_, k, v) => (attrs[k] = v));
    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root.children[0];
}

const svgTree = parseXml(svg);
const [w0, h0] = svgTree.attrs.viewBox.split(/\s+/).slice(2).map(Number);

// gradients
const gradients = {};
const defs = svgTree.children.find((c) => c.tag === 'defs');
for (const g of defs.children) {
  gradients[g.attrs.id] = {
    type: g.tag === 'radialGradient' ? 'radial' : 'linear',
    x1: +(g.attrs.x1 ?? 0),
    y1: +(g.attrs.y1 ?? 0),
    x2: +(g.attrs.x2 ?? 1),
    y2: +(g.attrs.y2 ?? 0),
    stops: g.children.map((s) => ({ offset: +s.attrs.offset, color: rgba(s.attrs['stop-color'], +(s.attrs['stop-opacity'] ?? 1)) })),
  };
}

function rgba(hex, a = 1) {
  if (hex === 'none') return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// SVG transform attribute -> matrix [a,b,c,d,e,f]
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function parseTransformAttr(t) {
  let m = [1, 0, 0, 1, 0, 0];
  t.replace(/(\w+)\(([^)]*)\)/g, (_, f, args) => {
    const a = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (f === 'translate') m = mul(m, [1, 0, 0, 1, a[0], a[1] || 0]);
    else if (f === 'scale') m = mul(m, [a[0], 0, 0, a[1] ?? a[0], 0, 0]);
    else if (f === 'rotate') {
      const r = (a[0] * Math.PI) / 180;
      const [cx, cy] = [a[1] || 0, a[2] || 0];
      m = mul(m, [1, 0, 0, 1, cx, cy]);
      m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
      m = mul(m, [1, 0, 0, 1, -cx, -cy]);
    } else throw new Error('transform ' + f);
  });
  return m.map((v) => Math.round(v * 1e6) / 1e6);
}

// ---------- CSS ----------
// every rule that mentions .chr3, plus all @keyframes
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
function blocks(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const sel = src.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (depth && j < src.length) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
    out.push({ sel, body: src.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
const all = blocks(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<style>/, ''));
const keyframes = {};
const rules = {};
for (const b of all) {
  const sel = b.sel.replace(/^[\s\S]*\}/, '').trim();
  if (sel.startsWith('@keyframes')) {
    const name = sel.split(/\s+/)[1];
    keyframes[name] = blocks(b.body).map((k) => ({ offsets: k.sel.split(',').map((o) => (o.trim() === 'from' ? 0 : o.trim() === 'to' ? 1 : parseFloat(o) / 100)), decl: decls(k.body) }));
  } else if (sel.startsWith('@media')) continue;
  else
    for (const s of sel.split(',')) {
      const m = /^\.chr3 \.([\w-]+)$/.exec(s.trim());
      if (m) rules[m[1]] = { ...(rules[m[1]] || {}), ...decls(b.body) };
    }
}
function decls(body) {
  const o = {};
  body.split(';').forEach((d) => {
    const k = d.indexOf(':');
    if (k > 0) o[d.slice(0, k).trim()] = d.slice(k + 1).trim();
  });
  return o;
}

// transform value -> normalized function list
function parseTransform(v) {
  if (!v || v === 'none') return [];
  const out = [];
  v.replace(/(\w+)\(([^)]*)\)/g, (_, f, args) => {
    const a = args.split(',').map((x) => parseFloat(x));
    if (f === 'rotate') out.push(['r', a[0]]);
    else if (f === 'translate') out.push(['t', a[0], a[1] || 0]);
    else if (f === 'translateX') out.push(['t', a[0], 0]);
    else if (f === 'translateY') out.push(['t', 0, a[0]]);
    else if (f === 'scale') out.push(['s', a[0], a[1] ?? a[0]]);
    else if (f === 'scaleY') out.push(['s', 1, a[0]]);
    else if (f === 'scaleX') out.push(['s', a[0], 1]);
    else throw new Error('css transform ' + f);
  });
  return out;
}

const EASE = { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };
function parseAnimation(v) {
  return v.split(/,(?![^(]*\))/).map((one) => {
    const parts = one.trim().match(/cubic-bezier\([^)]*\)|\S+/g);
    const a = { name: '', dur: 0, delay: 0, tf: EASE.ease, iter: 1, dir: 'normal', fill: 'none' };
    let times = 0;
    for (const p of parts) {
      if (/^[\d.]+m?s$/.test(p)) {
        const ms = p.endsWith('ms') ? parseFloat(p) : parseFloat(p) * 1000;
        if (times++ === 0) a.dur = ms;
        else a.delay = ms;
      } else if (p.startsWith('cubic-bezier')) a.tf = p.slice(13, -1).split(',').map(Number);
      else if (EASE[p]) a.tf = EASE[p];
      else if (p === 'infinite') a.iter = -1;
      else if (/^\d+(\.\d+)?$/.test(p)) a.iter = +p;
      else if (['alternate', 'reverse', 'alternate-reverse'].includes(p)) a.dir = p;
      else if (['both', 'forwards', 'backwards'].includes(p)) a.fill = p;
      else a.name = p;
    }
    if (!keyframes[a.name]) throw new Error('no keyframes ' + a.name);
    return a;
  });
}

// keyframes per property (CSS builds a keyframe list for each property separately)
const usedKeyframes = {};
function keyframesFor(name) {
  if (usedKeyframes[name]) return;
  const per = { opacity: [], transform: [] };
  for (const k of keyframes[name])
    for (const off of k.offsets) {
      if ('opacity' in k.decl) per.opacity.push([off, +k.decl.opacity]);
      if ('transform' in k.decl) per.transform.push([off, parseTransform(k.decl.transform)]);
    }
  for (const p of ['opacity', 'transform']) per[p].sort((x, y) => x[0] - y[0]);
  usedKeyframes[name] = {
    ...(per.opacity.length ? { opacity: per.opacity } : {}),
    ...(per.transform.length ? { transform: per.transform } : {}),
  };
}

// animated classes on elements ("c3bill b1" merges the rules of both classes)
const anims = {};
function animFor(cls) {
  if (anims[cls] !== undefined) return anims[cls] ? cls : null;
  const r = {};
  for (const c of cls.split(/\s+/)) Object.assign(r, rules[c] || {});
  if (!r.animation && !r.transform && !r.opacity) {
    anims[cls] = null;
    return null;
  }
  const origin = (r['transform-origin'] || '0 0').split(/\s+/).map((x) => parseFloat(x));
  const list = r.animation ? parseAnimation(r.animation) : [];
  list.forEach((a) => keyframesFor(a.name));
  anims[cls] = {
    origin,
    baseOpacity: r.opacity != null ? +r.opacity : null,
    baseTransform: parseTransform(r.transform),
    list,
  };
  return cls;
}

// ---------- tree ----------
const INHERIT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'];
let usedGradients = new Set();
function convert(node, inherited) {
  const a = node.attrs;
  const paint = { ...inherited };
  for (const k of INHERIT) if (a[k] != null) paint[k] = a[k];
  const out = {};
  if (a.class) {
    const k = animFor(a.class);
    if (k) out.anim = k;
  }
  if (a.transform) {
    if (out.anim && anims[out.anim].list.some((x) => usedKeyframes[x.name].transform)) throw new Error('CSS transform would override the transform attribute on .' + a.class);
    out.m = parseTransformAttr(a.transform);
  }
  const op = a.opacity != null ? +a.opacity : 1;
  if (op !== 1) {
    // the element's own opacity attribute; an animated opacity (CSS) replaces it
    if (out.anim && anims[out.anim].baseOpacity == null) anims[out.anim].baseOpacity = op;
    if (!out.anim) out.o = op;
  }
  if (node.tag === 'g') {
    out.g = node.children.map((c) => convert(c, paint));
    return out;
  }
  const fill = paint.fill ?? '#000';
  const stroke = paint.stroke ?? 'none';
  if (fill.startsWith('url(')) {
    const id = fill.slice(5, -1);
    usedGradients.add(id);
    out.fillGrad = id;
  } else if (fill !== 'none') out.fill = rgba(fill);
  if (stroke !== 'none') {
    out.stroke = rgba(stroke);
    out.sw = +(paint['stroke-width'] ?? 1);
    if (paint['stroke-linecap']) out.cap = paint['stroke-linecap'];
    if (paint['stroke-linejoin']) out.join = paint['stroke-linejoin'];
  }
  const n = (k) => +(a[k] ?? 0);
  if (node.tag === 'path') out.d = a.d;
  else if (node.tag === 'circle') out.circle = [n('cx'), n('cy'), n('r')];
  else if (node.tag === 'ellipse') out.ellipse = [n('cx'), n('cy'), n('rx'), n('ry')];
  else if (node.tag === 'rect') out.rect = [n('x'), n('y'), n('width'), n('height'), n('rx')];
  else throw new Error('tag ' + node.tag);
  return out;
}

const tree = svgTree.children.filter((c) => c.tag !== 'defs').map((c) => convert(c, {}));
const grads = Object.fromEntries([...usedGradients].map((id) => [id, gradients[id]]));
for (const k of Object.keys(anims)) if (!anims[k]) delete anims[k];

const outFile = path.join(here, '../src/components/intro/character.data.ts');
fs.writeFileSync(
  outFile,
  `// GENERATED by scripts/gen-intro.mjs from index.html (the prototype). Do not edit by hand.
import type { Anim, Keyframes, Node, Gradient } from './cssAnim';

export const VIEWBOX = [${w0}, ${h0}] as const;
export const GRADIENTS: Record<string, Gradient> = ${JSON.stringify(grads)};
export const KEYFRAMES: Record<string, Keyframes> = ${JSON.stringify(usedKeyframes)};
export const ANIMS: Record<string, Anim> = ${JSON.stringify(anims)};
export const TREE: Node[] = ${JSON.stringify(tree)};
`,
);
console.log('wrote', path.relative(process.cwd(), outFile), Object.keys(anims).length, 'animated classes,', Object.keys(usedKeyframes).length, 'keyframes');

// ---------- category icons (prototype ICO, keyed by the app's English category names) ----------
const icoStart = html.indexOf('var ICO=');
const icoEnd = html.indexOf('};', icoStart) + 1;
const ICO = JSON.parse(html.slice(icoStart + 8, icoEnd));
const EN = { Namirnice: 'Groceries', Hrana: 'Food', Kafić: 'Coffee', Odeća: 'Clothes', Obuća: 'Shoes', Teretana: 'Gym', Prevoz: 'Transportation', Računi: 'Bills', Kirija: 'Rent', Pretplata: 'Subscription', Izlasci: 'Nights out', Igrice: 'Gaming', Ostalo: 'Other', Plata: 'Salary', Poklon: 'Gift', _: '_' };
const icons = {};
for (const [k, v] of Object.entries(ICO)) if (EN[k]) icons[EN[k]] = v;
const icoFile = path.join(here, '../src/components/categoryIcons.data.ts');
fs.writeFileSync(
  icoFile,
  `// GENERATED by scripts/gen-intro.mjs from index.html (the prototype's ICO). Do not edit by hand.
// Inner SVG of each category icon (viewBox 0 0 24 24, drawn as lines). "_" is used for the user's own categories.
export const CATEGORY_ICONS: Record<string, string> = ${JSON.stringify(icons, null, 2)};
`,
);
console.log('wrote', path.relative(process.cwd(), icoFile), Object.keys(icons).length, 'icons');
