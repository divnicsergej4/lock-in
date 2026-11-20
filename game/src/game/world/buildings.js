// Zgrade pored puta. Svaka zgrada je napravljena od kutija sa teksturom fasade (prozori na spratovima,
// izlozi u prizemlju) i detaljima (krovni uređaji, rezervoari, protivpožarne stepenice, tende).
// Sve zgrade jedne strane se spajaju u jedan model, pa se crtaju jednim pozivom.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MOD_W = 4; // jedan modul fasade je 4 m širok
const MOD_H = 3; // i 3 m visok (jedan sprat)
const SHOP_H = 3.4;
const WALL_UV = [0.012, 0.02]; // tačka teksture gde je samo zid

const _c = new THREE.Color();

// Kutija sa UV koordinatama u metrima (tekstura se ponavlja po spratovima i modulima)
function facadeBox(w, h, d, x, y, z, color, { uOff = 0, plain = false, vMod = MOD_H } = {}) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const uv = g.getAttribute('uv');
  // Redosled strana u BoxGeometry: +x, -x, +y, -y, +z, -z (po 6 temena posle toNonIndexed)
  const faceW = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 6; k++) {
      const i = f * 6 + k;
      if (plain || f === 2 || f === 3) {
        uv.setXY(i, WALL_UV[0], WALL_UV[1]);
      } else {
        uv.setXY(i, (uv.getX(i) * faceW[f]) / MOD_W + uOff, (uv.getY(i) * h) / vMod);
      }
    }
  }
  g.translate(x, y, z);
  _c.set(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// Obična kutija (bez prozora) u boji
function plainBox(w, h, d, x, y, z, color, rot = null) {
  const g = facadeBox(w, h, d, 0, 0, 0, color, { plain: true });
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])));
  g.translate(x, y, z);
  return g;
}

function plainCyl(r, h, x, y, z, color) {
  let g = new THREE.CylinderGeometry(r, r, h, 10).toNonIndexed();
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, WALL_UV[0], WALL_UV[1]);
  g.translate(x, y, z);
  _c.set(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function shade(color, k) {
  return _c.set(color).multiplyScalar(k).getHex();
}

// Pravi sve zgrade jedne strane puta. side = -1 (levo) ili 1 (desno).
// frontX = koliko je fasada udaljena od sredine puta; gaps = z koordinate bočnih ulica.
export function buildStreetSide(rng, { side, frontX, fromZ, toZ, gaps, colors, ruin }) {
  const upper = []; // materijal 0: fasada sa prozorima + detalji
  const shops = []; // materijal 1: prizemlje sa izlozima
  let z = fromZ;
  while (z > toZ) {
    let w = rng.range(7, 12);
    // Ostavi prolaz za bočnu ulicu
    const gap = gaps.find((g) => g < z + 1 && g > z - w - 2.2);
    if (gap !== undefined) {
      w = z - (gap + 1.9);
      if (w < 2.5) {
        z = gap - 1.9;
        continue;
      }
    }
    const depth = rng.range(7, 10);
    const floors = ruin ? rng.int(2, 5) : rng.int(2, 6);
    const color = rng.pick(colors);
    const cx = side * (frontX + depth / 2);
    const cz = z - w / 2;
    const uOff = rng.int(0, 3);
    const totalH = SHOP_H + floors * MOD_H;

    shops.push(facadeBox(depth, SHOP_H, w, cx, SHOP_H / 2, cz, 0xffffff, { uOff: rng.int(0, 3), vMod: SHOP_H }));
    if (!ruin) {
      upper.push(facadeBox(depth, floors * MOD_H, w, cx, SHOP_H + (floors * MOD_H) / 2, cz, color, { uOff }));
      // Venac na vrhu i ravni krov
      upper.push(plainBox(depth + 0.35, 0.35, w + 0.35, cx, totalH + 0.12, cz, shade(color, 0.72)));
      // Krovni detalji
      if (rng.chance(0.7)) upper.push(plainBox(1.1, 0.8, 1.2, cx + rng.range(-2, 2), totalH + 0.7, cz + rng.range(-w / 3, w / 3), 0x9aa0a6));
      if (rng.chance(0.4)) upper.push(plainCyl(0.9, 1.6, cx + rng.range(-1.5, 1.5), totalH + 1.1, cz + rng.range(-w / 4, w / 4), 0x6b5a48));
      if (rng.chance(0.4)) upper.push(plainCyl(0.04, 2.6, cx, totalH + 1.4, cz + rng.range(-w / 3, w / 3), 0x2a2a2a));
    } else {
      // Ruševina: nazubljen vrh od nekoliko delova različite visine, armatura i gar
      const pieces = rng.int(2, 3);
      for (let i = 0; i < pieces; i++) {
        const pw = w / pieces;
        const pf = Math.max(1, floors - rng.int(0, 2));
        const ph = pf * MOD_H - rng.range(0, 1.6);
        const pz = z - pw * (i + 0.5);
        upper.push(facadeBox(depth, ph, pw, cx, SHOP_H + ph / 2, pz, i % 2 ? color : shade(color, 0.85), { uOff: uOff + i }));
        upper.push(plainBox(depth * 0.9, 0.25, pw * 0.9, cx, SHOP_H + ph + 0.05, pz, 0x3a3532, [rng.range(-0.1, 0.1), 0, rng.range(-0.15, 0.15)]));
        for (let r = 0; r < 3; r++) {
          upper.push(plainBox(0.05, rng.range(0.6, 1.5), 0.05, cx + rng.range(-depth / 3, depth / 3), SHOP_H + ph + 0.5, pz + rng.range(-pw / 3, pw / 3), 0x5a3a26, [rng.range(-0.4, 0.4), 0, rng.range(-0.4, 0.4)]));
        }
      }
    }
    // Protivpožarne stepenice na fasadi
    if (!ruin && floors >= 3 && rng.chance(0.45)) {
      const fx = side * frontX - side * 0.45;
      for (let f = 1; f < floors; f++) {
        const y = SHOP_H + f * MOD_H - 0.1;
        upper.push(plainBox(0.9, 0.06, 2.6, fx, y, cz, 0x26292d));
        upper.push(plainBox(0.04, 0.9, 2.6, fx - side * 0.43, y + 0.45, cz, 0x26292d));
        upper.push(plainBox(0.7, 0.04, 0.04, fx, y - 1.4, cz, 0x26292d, [0.95, 0, 0]));
      }
    }
    // Tenda iznad izloga
    if (rng.chance(ruin ? 0.25 : 0.6)) {
      const awning = rng.pick([0xb8322a, 0x2a5aa8, 0x2f8a4a, 0xd8a42a, 0x7a3a8a]);
      upper.push(plainBox(1.4, 0.08, Math.min(w - 1, 5), side * (frontX - 0.6), 3.0, cz + rng.range(-1, 1), ruin ? shade(awning, 0.45) : awning, [0, 0, side * 0.35]));
    }
    z -= w;
  }
  const out = [];
  if (upper.length) out.push(mergeGeometries(upper, false));
  if (shops.length) out.push(mergeGeometries(shops, false));
  upper.forEach((g) => g.dispose());
  shops.forEach((g) => g.dispose());
  const merged = mergeGeometries(out, true);
  out.forEach((g) => g.dispose());
  return merged;
}
