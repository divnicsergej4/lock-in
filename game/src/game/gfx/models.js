// 3D modeli napravljeni kodom: vojnici, puška i vojni predmeti (džakovi s peskom, prepreke, tenkovi...).
// Boje su "upečene" u model (vertex colors) zajedno sa blagim senčenjem pri dnu (ambient occlusion),
// pa svaki model može da se nacrta jednim pozivom bez obzira na to koliko ima delova.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// Jedan deo modela: oblik + boja + položaj/okret/veličina.
export function part(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
  g.applyMatrix4(_m);
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

// Spaja delove u jedan model i dodaje senčenje pri dnu (tamnije bliže zemlji).
export function build(parts, { aoHeight = 0, aoBase = 0, aoStrength = 0.35 } = {}) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (aoHeight > 0) {
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - aoBase) / aoHeight));
      const k = 1 - aoStrength * (1 - t) * (1 - t);
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
  }
  g.computeBoundingSphere();
  g.userData.shared = true;
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, ws = 10, hs = 8, ...rest) => new THREE.SphereGeometry(r, ws, hs, ...rest);

// ---------------- VOJNICI ----------------

export const TEAM_COLORS = {
  blue: { body: 0x2f7bff, dark: 0x1d4fb8, pants: 0x1b3f8f, vest: 0x2a5aa8, helmet: 0x2c63d6, pack: 0x23467e },
  red: { body: 0xff4646, dark: 0xb82424, pants: 0x8c1f25, vest: 0xa8323a, helmet: 0xd8323a, pack: 0x7c2228 },
};
const SKIN = 0xffcf9e;
const BOOT = 0x2b2420;
const GLOVE = 0x3b3029;
const BELT = 0x3d2f24;

const soldierCache = new Map();

// Telo vojnika (sve što se ne pomera posebno): trup, prsluk, opasač, glava, oči, šlem, ranac.
export function soldierBody(team) {
  const key = 'body-' + team;
  if (soldierCache.has(key)) return soldierCache.get(key);
  const c = TEAM_COLORS[team];
  const g = build(
    [
      part(new THREE.CapsuleGeometry(0.15, 0.18, 2, 7), c.body, { pos: [0, 0.57, 0], scale: [1, 1, 0.85] }),
      part(box(0.32, 0.22, 0.25), c.vest, { pos: [0, 0.61, -0.005] }),
      part(box(0.07, 0.07, 0.04), c.dark, { pos: [-0.075, 0.57, -0.135] }),
      part(box(0.07, 0.07, 0.04), c.dark, { pos: [0.075, 0.57, -0.135] }),
      part(cyl(0.158, 0.158, 0.055, 8), BELT, { pos: [0, 0.44, 0], scale: [1, 1, 0.85] }),
      part(box(0.05, 0.045, 0.02), 0xd9b347, { pos: [0, 0.44, -0.137] }),
      part(sph(0.135, 8, 6), SKIN, { pos: [0, 0.92, 0] }),
      part(box(0.03, 0.04, 0.02), 0x1b1b22, { pos: [-0.048, 0.925, -0.127] }),
      part(box(0.03, 0.04, 0.02), 0x1b1b22, { pos: [0.048, 0.925, -0.127] }),
      part(sph(0.158, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), c.helmet, { pos: [0, 0.955, 0.005], scale: [1, 0.9, 1.06] }),
      part(cyl(0.172, 0.172, 0.03, 8), c.dark, { pos: [0, 0.955, 0.005], scale: [1, 1, 1.06] }),
      part(box(0.24, 0.26, 0.13), c.pack, { pos: [0, 0.62, 0.175] }),
      part(cyl(0.055, 0.055, 0.26, 5), 0x8a7d5c, { pos: [0, 0.79, 0.17], rot: [0, 0, Math.PI / 2] }),
    ],
    { aoHeight: 0.5, aoBase: 0.3, aoStrength: 0.3 },
  );
  soldierCache.set(key, g);
  return g;
}

// Noga: pantalone i čizma. Vrh noge (kuk) je u tački 0, pa se lako okreće.
export function soldierLeg(team) {
  const key = 'leg-' + team;
  if (soldierCache.has(key)) return soldierCache.get(key);
  const c = TEAM_COLORS[team];
  const g = build([
    part(box(0.11, 0.25, 0.12), c.pants, { pos: [0, -0.125, 0] }),
    part(box(0.12, 0.11, 0.17), BOOT, { pos: [0, -0.3, -0.025] }),
  ]);
  soldierCache.set(key, g);
  return g;
}

// Ruka: rukav i rukavica. Vrh ruke (rame) je u tački 0.
export function soldierArm(team) {
  const key = 'arm-' + team;
  if (soldierCache.has(key)) return soldierCache.get(key);
  const c = TEAM_COLORS[team];
  const g = build([
    part(box(0.085, 0.2, 0.095), c.body, { pos: [0, -0.1, 0] }),
    part(box(0.03, 0.03, 0.1), c.dark, { pos: [0, -0.02, 0] }),
    part(box(0.08, 0.08, 0.09), GLOVE, { pos: [0, -0.24, 0] }),
  ]);
  soldierCache.set(key, g);
  return g;
}

// Puška (gleda ka -z). Vrh cevi je na z = -0.42.
export const MUZZLE_Z = -0.42;
let rifleGeo;
export function rifle() {
  if (rifleGeo) return rifleGeo;
  rifleGeo = build([
    part(box(0.07, 0.1, 0.34), 0x2f333b, { pos: [0, 0, 0] }),
    part(cyl(0.02, 0.02, 0.24, 6), 0x1e2126, { pos: [0, 0.01, -0.29], rot: [Math.PI / 2, 0, 0] }),
    part(box(0.05, 0.13, 0.07), 0x24272d, { pos: [0, -0.1, -0.05], rot: [0.25, 0, 0] }),
    part(box(0.06, 0.09, 0.17), 0x6b4a2e, { pos: [0, -0.02, 0.24] }),
    part(box(0.03, 0.04, 0.08), 0x16181c, { pos: [0, 0.07, -0.02] }),
  ]);
  return rifleGeo;
}

// Pali vojnik (za animaciju umiranja): ceo vojnik u jednom komadu, ruke uz telo.
export function fallenSoldier(team) {
  const key = 'fallen-' + team;
  if (soldierCache.has(key)) return soldierCache.get(key);
  const legs = [-1, 1].map((s) => soldierLeg(team).clone().translate(s * 0.075, 0.36, 0));
  const arms = [-1, 1].map((s) => {
    const a = soldierArm(team).clone();
    a.applyMatrix4(new THREE.Matrix4().makeRotationX(0.5));
    a.translate(s * 0.19, 0.73, 0);
    return a;
  });
  const g = mergeGeometries([soldierBody(team).clone(), ...legs, ...arms], false);
  g.userData.shared = true;
  soldierCache.set(key, g);
  return g;
}

// Okrugla senka ispod
export const shadowPlane = (size) => {
  const g = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
  g.userData.shared = true;
  return g;
};

// ---------------- VOJNI PREDMETI ----------------

const propCache = new Map();
function cached(key, fn) {
  if (!propCache.has(key)) propCache.set(key, fn());
  return propCache.get(key);
}

// Zid od džakova sa peskom (dužina ~1.6, gleda ka putu)
export const sandbags = () =>
  cached('sandbags', () => {
    const parts = [];
    const tones = [0xcdb27c, 0xc2a56c, 0xd6be8c];
    for (let row = 0; row < 3; row++) {
      const n = 4 - (row === 2 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.42 + (row % 2) * 0.1;
        parts.push(part(sph(0.5, 8, 5), tones[(i + row) % 3], { pos: [x, 0.11 + row * 0.19, 0], scale: [0.4, 0.2, 0.26] }));
      }
    }
    return build(parts, { aoHeight: 0.5, aoStrength: 0.35 });
  });

// Protivtenkovski "jež": tri prekrštene metalne grede
export const hedgehog = () =>
  cached('hedgehog', () =>
    build(
      [
        part(box(0.12, 0.12, 1.3), 0x55595f, { pos: [0, 0.42, 0], rot: [0.6, 0, 0] }),
        part(box(0.12, 0.12, 1.3), 0x6a5040, { pos: [0, 0.42, 0], rot: [-0.6, 0, 0] }),
        part(box(1.3, 0.12, 0.12), 0x4b4f55, { pos: [0, 0.42, 0], rot: [0, 0, 0.6] }),
      ],
      { aoHeight: 0.8, aoStrength: 0.3 },
    ),
  );

// Bure (crveno sa žutom trakom = eksplozivno)
export const barrel = () =>
  cached('barrel', () =>
    build(
      [
        part(cyl(0.22, 0.22, 0.62, 12), 0xc7352c, { pos: [0, 0.31, 0] }),
        part(cyl(0.225, 0.225, 0.06, 12), 0xffc934, { pos: [0, 0.31, 0] }),
        part(cyl(0.226, 0.226, 0.03, 12), 0x8e2620, { pos: [0, 0.1, 0] }),
        part(cyl(0.226, 0.226, 0.03, 12), 0x8e2620, { pos: [0, 0.52, 0] }),
        part(cyl(0.2, 0.2, 0.02, 12), 0x9d2a23, { pos: [0, 0.625, 0] }),
      ],
      { aoHeight: 0.5, aoStrength: 0.35 },
    ),
  );

// Drveni sanduk
export const crate = () =>
  cached('crate', () =>
    build(
      [
        part(box(0.55, 0.55, 0.55), 0xb5844e, { pos: [0, 0.275, 0] }),
        part(box(0.57, 0.08, 0.57), 0x8a5f34, { pos: [0, 0.06, 0] }),
        part(box(0.57, 0.08, 0.57), 0x8a5f34, { pos: [0, 0.49, 0] }),
        part(box(0.08, 0.57, 0.57), 0x8a5f34, { pos: [0, 0.275, 0] }),
      ],
      { aoHeight: 0.5, aoStrength: 0.35 },
    ),
  );

// Uništen tenk (izgoreo)
export const tankWreck = () =>
  cached('tank', () =>
    build(
      [
        part(box(1.7, 0.55, 2.7), 0x56603f, { pos: [0, 0.55, 0] }),
        part(box(1.5, 0.25, 2.4), 0x3f4630, { pos: [0, 0.9, 0.05] }),
        part(box(0.45, 0.5, 2.9), 0x2a2a2a, { pos: [-0.95, 0.3, 0] }),
        part(box(0.45, 0.5, 2.9), 0x2a2a2a, { pos: [0.95, 0.3, 0] }),
        part(cyl(0.62, 0.72, 0.45, 10), 0x4a5236, { pos: [0.1, 1.25, 0.2], rot: [0, 0, 0.12] }),
        part(cyl(0.08, 0.08, 1.7, 8), 0x33372a, { pos: [0.35, 1.05, -0.95], rot: [1.25, 0.3, 0] }),
        part(box(0.9, 0.06, 0.9), 0x1e1e1c, { pos: [-0.2, 1.03, 0.6], rot: [0, 0.4, 0] }),
      ],
      { aoHeight: 1.1, aoStrength: 0.45 },
    ),
  );

// Vojni šator
export const tent = () =>
  cached('tent', () =>
    build(
      [
        part(cyl(0.95, 0.95, 1.9, 3), 0x6f7d48, { pos: [0, 0.48, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1] }),
        part(box(0.5, 0.6, 0.02), 0x3d4527, { pos: [0, 0.32, -0.96] }),
      ],
      { aoHeight: 1, aoStrength: 0.4 },
    ),
  );

// Betonski bunker sa otvorom i džakovima na vrhu
export const bunker = () =>
  cached('bunker', () => {
    const parts = [
      part(box(2, 0.9, 1.4), 0x9c9d94, { pos: [0, 0.45, 0] }),
      part(box(2.1, 0.12, 1.5), 0x86877f, { pos: [0, 0.95, 0] }),
      part(box(1.1, 0.16, 0.05), 0x1d1f22, { pos: [0, 0.62, -0.71] }),
    ];
    for (let i = 0; i < 4; i++) parts.push(part(sph(0.5, 8, 5), 0xcdb27c, { pos: [-0.66 + i * 0.44, 1.1, -0.45], scale: [0.4, 0.2, 0.26] }));
    return build(parts, { aoHeight: 1.1, aoStrength: 0.4 });
  });

// Osmatračnica
export const watchtower = () =>
  cached('tower', () => {
    const wood = 0x8b6239;
    const parts = [];
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => parts.push(part(box(0.12, 3, 0.12), wood, { pos: [sx * 0.55, 1.5, sz * 0.55], rot: [sz * -0.05, 0, sx * 0.05] }))),
    );
    parts.push(part(box(1.5, 0.12, 1.5), 0x7a5531, { pos: [0, 2.8, 0] }));
    parts.push(part(box(1.5, 0.45, 0.06), 0x9a6f43, { pos: [0, 3.05, -0.72] }));
    parts.push(part(box(1.5, 0.45, 0.06), 0x9a6f43, { pos: [0, 3.05, 0.72] }));
    parts.push(part(box(0.06, 0.45, 1.5), 0x9a6f43, { pos: [-0.72, 3.05, 0] }));
    parts.push(part(box(0.06, 0.45, 1.5), 0x9a6f43, { pos: [0.72, 3.05, 0] }));
    parts.push(part(new THREE.ConeGeometry(1.2, 0.7, 4), 0x5e6b3c, { pos: [0, 3.95, 0], rot: [0, Math.PI / 4, 0] }));
    [-1, 1].forEach((s) => parts.push(part(box(0.06, 0.9, 0.06), wood, { pos: [s * 0.68, 3.5, -0.68] })));
    [-1, 1].forEach((s) => parts.push(part(box(0.06, 0.9, 0.06), wood, { pos: [s * 0.68, 3.5, 0.68] })));
    return build(parts, { aoHeight: 1.5, aoStrength: 0.35 });
  });

// Busen trave (nekoliko tankih vlati)
export const grassTuft = () =>
  cached('tuft', () => {
    const parts = [];
    const tones = [0x5fc24a, 0x76d457, 0x4fae3f];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push(
        part(new THREE.ConeGeometry(0.05, 0.38, 3), tones[i % 3], {
          pos: [Math.cos(a) * 0.07, 0.17, Math.sin(a) * 0.07],
          rot: [Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35],
        }),
      );
    }
    return build(parts, { aoHeight: 0.3, aoStrength: 0.4 });
  });

// Cveće (žuto i belo)
export const flower = () =>
  cached('flower', () =>
    build([
      part(cyl(0.012, 0.012, 0.25, 4), 0x4fae3f, { pos: [0, 0.12, 0] }),
      part(sph(0.06, 6, 4), 0xffe14d, { pos: [0, 0.26, 0] }),
      part(sph(0.05, 6, 4), 0xffffff, { pos: [0.08, 0.22, 0.02] }),
    ]),
  );

// Neprijateljska tvrđava: zid sa zupcima, dve kule, kapija, džakovi ispred
export function fortress() {
  const stone = 0xe3dac8;
  const stoneDark = 0xc9bea8;
  const roof = 0xd8323a;
  const parts = [
    part(box(5.4, 3.4, 3), stone, { pos: [0, 1.7, 0] }),
    part(box(5.5, 0.25, 3.1), stoneDark, { pos: [0, 3.45, 0] }),
    part(box(1.5, 2, 0.12), 0x5a3a24, { pos: [0, 1, 1.52] }),
    part(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16, 1, false, 0, Math.PI), 0x5a3a24, { pos: [0, 2, 1.52], rot: [Math.PI / 2, 0, -Math.PI / 2] }),
    part(box(0.12, 2, 0.14), 0x3b2616, { pos: [0, 1, 1.56] }),
  ];
  for (let i = 0; i < 6; i++) parts.push(part(box(0.5, 0.5, 0.5), stoneDark, { pos: [-2.45 + i * 0.98, 3.8, 1.25] }));
  // Tamne linije između kamenih blokova
  for (let r = 0; r < 4; r++) parts.push(part(box(5.42, 0.04, 3.02), stoneDark, { pos: [0, 0.75 + r * 0.75, 0] }));
  [-1, 1].forEach((side) => {
    parts.push(part(cyl(1.05, 1.15, 5, 14), stone, { pos: [side * 3.2, 2.5, 0.4] }));
    parts.push(part(cyl(1.2, 1.2, 0.3, 14), stoneDark, { pos: [side * 3.2, 5.05, 0.4] }));
    parts.push(part(new THREE.ConeGeometry(1.4, 2.1, 14), roof, { pos: [side * 3.2, 6.25, 0.4] }));
    parts.push(part(box(0.35, 0.6, 0.1), 0x3a2a20, { pos: [side * 3.2, 3.5, 1.5] }));
    parts.push(part(box(0.35, 0.6, 0.1), 0x3a2a20, { pos: [side * 3.2, 1.8, 1.5] }));
  });
  return build(parts, { aoHeight: 2.5, aoStrength: 0.35 });
}

// ---------------- PREDMETI ZA RAZLIČITA OKRUŽENJA ----------------

// Uništen automobil
export const carWreck = () =>
  cached('car', () =>
    build(
      [
        part(box(1.5, 0.5, 3), 0x8a3a32, { pos: [0, 0.45, 0] }),
        part(box(1.3, 0.45, 1.5), 0x6e2e28, { pos: [0, 0.9, 0.15], rot: [0, 0, 0.05] }),
        part(box(1.25, 0.35, 0.05), 0x2a3440, { pos: [0, 0.92, -0.62], rot: [0.5, 0, 0] }),
        part(cyl(0.3, 0.3, 0.2, 10), 0x1e1e1e, { pos: [-0.75, 0.25, -0.95], rot: [0, 0, Math.PI / 2] }),
        part(cyl(0.3, 0.3, 0.2, 10), 0x1e1e1e, { pos: [0.75, 0.25, -0.95], rot: [0, 0, Math.PI / 2] }),
        part(cyl(0.3, 0.3, 0.2, 10), 0x1e1e1e, { pos: [-0.75, 0.2, 0.95], rot: [0.3, 0, Math.PI / 2] }),
        part(box(0.3, 0.12, 0.05), 0xfff1b0, { pos: [-0.5, 0.55, -1.52] }),
        part(box(0.3, 0.12, 0.05), 0x555555, { pos: [0.5, 0.55, -1.52] }),
      ],
      { aoHeight: 0.8, aoStrength: 0.45 },
    ),
  );

// Porušena zgrada sa prozorima
export const ruinBuilding = () =>
  cached('ruin', () => {
    const wall = 0x9a8f86;
    const parts = [
      part(box(3.4, 4.2, 2.6), wall, { pos: [0, 2.1, 0] }),
      part(box(1.6, 1.4, 2.6), wall, { pos: [-0.9, 4.9, 0] }),
      part(box(3.5, 0.15, 2.7), 0x7d736b, { pos: [0, 2.2, 0] }),
    ];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const lit = (r + c) % 3 === 0;
        parts.push(part(box(0.55, 0.65, 0.05), lit ? 0xffcf7a : 0x2b2f38, { pos: [-1.05 + c * 1.05, 1.2 + r * 1.8, 1.31] }));
      }
    }
    parts.push(part(box(0.8, 1.2, 0.05), 0x3b2a20, { pos: [0, 0.6, 1.32] }));
    return build(parts, { aoHeight: 2, aoStrength: 0.35 });
  });

// Ulična svetiljka
export const streetLamp = () =>
  cached('lamp', () =>
    build([
      part(cyl(0.06, 0.08, 3.4, 6), 0x3a3f46, { pos: [0, 1.7, 0] }),
      part(box(0.7, 0.07, 0.1), 0x3a3f46, { pos: [0.3, 3.35, 0] }),
      part(box(0.3, 0.12, 0.2), 0xfff0b0, { pos: [0.6, 3.27, 0] }),
    ]),
  );

// Kaktus
export const cactus = () =>
  cached('cactus', () =>
    build(
      [
        part(cyl(0.18, 0.2, 1.8, 8), 0x4f9a46, { pos: [0, 0.9, 0] }),
        part(cyl(0.12, 0.12, 0.6, 8), 0x4f9a46, { pos: [0.3, 0.9, 0], rot: [0, 0, Math.PI / 2] }),
        part(cyl(0.11, 0.11, 0.6, 8), 0x4f9a46, { pos: [0.45, 1.2, 0] }),
        part(cyl(0.1, 0.1, 0.5, 8), 0x4f9a46, { pos: [-0.28, 1.25, 0], rot: [0, 0, Math.PI / 2] }),
        part(cyl(0.09, 0.09, 0.45, 8), 0x4f9a46, { pos: [-0.42, 1.5, 0] }),
      ],
      { aoHeight: 1, aoStrength: 0.3 },
    ),
  );

// Suvo drvo
export const deadTree = () =>
  cached('deadtree', () =>
    build(
      [
        part(cyl(0.1, 0.18, 2.2, 6), 0x4a3a30, { pos: [0, 1.1, 0], rot: [0, 0, 0.08] }),
        part(cyl(0.05, 0.08, 1.1, 5), 0x4a3a30, { pos: [0.35, 1.9, 0], rot: [0, 0, -0.8] }),
        part(cyl(0.04, 0.07, 0.9, 5), 0x4a3a30, { pos: [-0.3, 1.6, 0.1], rot: [0.2, 0, 0.9] }),
        part(cyl(0.03, 0.05, 0.7, 5), 0x4a3a30, { pos: [0.1, 2.4, -0.2], rot: [-0.5, 0, 0.2] }),
      ],
      { aoHeight: 1, aoStrength: 0.3 },
    ),
  );

// Jelka pod snegom
export const snowPine = () =>
  cached('snowpine', () =>
    build(
      [
        part(cyl(0.1, 0.14, 0.7, 6), 0x6b4a32, { pos: [0, 0.35, 0] }),
        part(new THREE.ConeGeometry(0.9, 1.3, 7), 0x2f7a4a, { pos: [0, 1.1, 0] }),
        part(new THREE.ConeGeometry(0.75, 0.5, 7), 0xf4f8ff, { pos: [0, 1.45, 0] }),
        part(new THREE.ConeGeometry(0.65, 1.1, 7), 0x2f7a4a, { pos: [0, 1.85, 0] }),
        part(new THREE.ConeGeometry(0.5, 0.45, 7), 0xf4f8ff, { pos: [0, 2.2, 0] }),
        part(new THREE.ConeGeometry(0.4, 0.8, 7), 0x2f7a4a, { pos: [0, 2.5, 0] }),
        part(new THREE.ConeGeometry(0.22, 0.35, 7), 0xffffff, { pos: [0, 2.82, 0] }),
      ],
      { aoHeight: 1.2, aoStrength: 0.3 },
    ),
  );

// Okruglo drvo
export const roundTree = () =>
  cached('roundtree', () =>
    build(
      [
        part(cyl(0.1, 0.15, 0.9, 6), 0x9a6a3e, { pos: [0, 0.45, 0] }),
        part(new THREE.IcosahedronGeometry(0.85, 1), 0x4fbb4a, { pos: [0, 1.4, 0] }),
        part(new THREE.IcosahedronGeometry(0.5, 1), 0x6fd052, { pos: [0.35, 1.75, 0.2] }),
      ],
      { aoHeight: 1.2, aoStrength: 0.35 },
    ),
  );

// Kamenje
export const rockCluster = (color = 0xa9b1bb) =>
  cached('rocks-' + color, () =>
    build(
      [
        part(new THREE.DodecahedronGeometry(0.5, 0), color, { pos: [0, 0.25, 0], scale: [1.2, 0.8, 1] }),
        part(new THREE.DodecahedronGeometry(0.32, 0), color, { pos: [0.55, 0.15, 0.2], rot: [0.5, 0.3, 0] }),
        part(new THREE.DodecahedronGeometry(0.25, 0), color, { pos: [-0.45, 0.12, -0.25], rot: [0.2, 0.8, 0] }),
      ],
      { aoHeight: 0.6, aoStrength: 0.4 },
    ),
  );

// Prepreka sa šiljcima i bodljikavom žicom (zauzima pola trake)
export const spikeBarricade = () =>
  cached('spikes', () => {
    const parts = [part(box(2, 0.18, 0.18), 0x6b4a2e, { pos: [0, 0.45, 0] })];
    for (let i = 0; i < 4; i++) {
      const x = -0.8 + i * 0.53;
      parts.push(part(box(0.1, 1.1, 0.1), 0x5a3d26, { pos: [x, 0.42, 0], rot: [0.5, 0, 0] }));
      parts.push(part(box(0.1, 1.1, 0.1), 0x5a3d26, { pos: [x, 0.42, 0], rot: [-0.5, 0, 0] }));
      parts.push(part(new THREE.ConeGeometry(0.05, 0.3, 4), 0xc8ccd2, { pos: [x, 0.95, -0.25], rot: [-0.5, 0, 0] }));
      parts.push(part(new THREE.ConeGeometry(0.05, 0.3, 4), 0xc8ccd2, { pos: [x, 0.95, 0.25], rot: [0.5, 0, 0] }));
    }
    parts.push(part(new THREE.TorusGeometry(0.22, 0.015, 4, 10), 0x9aa0a8, { pos: [-0.5, 0.7, 0], scale: [1, 1, 3] }));
    parts.push(part(new THREE.TorusGeometry(0.22, 0.015, 4, 10), 0x9aa0a8, { pos: [0.3, 0.7, 0], scale: [1, 1, 3] }));
    return build(parts, { aoHeight: 0.8, aoStrength: 0.3 });
  });

// Novčić (za skupljanje)
export const coinModel = () =>
  cached('coin', () =>
    build([
      part(cyl(0.32, 0.32, 0.08, 16), 0xffc934, { pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] }),
      part(cyl(0.2, 0.2, 0.1, 12), 0xffe27a, { pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] }),
    ]),
  );

// Betonski zid između traka (segment dužine 2), sa žuto-crnim prugama
export const dividerBlock = () =>
  cached('divider', () =>
    build(
      [
        part(box(0.8, 0.35, 1.96), 0xb7bcc4, { pos: [0, 0.175, 0] }),
        part(box(0.5, 0.35, 1.96), 0xc9ced6, { pos: [0, 0.5, 0] }),
        part(box(0.52, 0.12, 0.5), 0xffc21f, { pos: [0, 0.5, -0.5] }),
        part(box(0.52, 0.12, 0.5), 0x2a2a2a, { pos: [0, 0.5, 0] }),
        part(box(0.52, 0.12, 0.5), 0xffc21f, { pos: [0, 0.5, 0.5] }),
      ],
      { aoHeight: 0.6, aoStrength: 0.4 },
    ),
  );

// ---------------- PREDMETI ZA ZOMBI APOKALIPSU ----------------

// Kontejner za smeće
export const dumpster = () =>
  cached('dumpster', () =>
    build(
      [
        part(box(1.9, 1.15, 1.1), 0x2f6b46, { pos: [0, 0.62, 0] }),
        part(box(1.95, 0.08, 1.15), 0x24543a, { pos: [0, 1.22, 0.02], rot: [-0.15, 0, 0] }),
        part(box(1.92, 0.12, 0.06), 0x1f3d2c, { pos: [0, 0.95, -0.56] }),
        part(cyl(0.08, 0.08, 0.06, 8), 0x1a1a1a, { pos: [-0.8, 0.07, -0.45], rot: [0, 0, Math.PI / 2] }),
        part(cyl(0.08, 0.08, 0.06, 8), 0x1a1a1a, { pos: [0.8, 0.07, -0.45], rot: [0, 0, Math.PI / 2] }),
      ],
      { aoHeight: 0.8, aoStrength: 0.4 },
    ),
  );

// Kese sa smećem
export const trashBags = () =>
  cached('trash', () =>
    build(
      [
        part(sph(0.35, 8, 6), 0x23262b, { pos: [0, 0.28, 0], scale: [1, 0.85, 0.9] }),
        part(sph(0.3, 8, 6), 0x2c3036, { pos: [0.45, 0.24, 0.15], scale: [1, 0.8, 1] }),
        part(sph(0.26, 8, 6), 0x1f2226, { pos: [0.15, 0.55, 0.05], scale: [1, 0.8, 1] }),
        part(box(0.3, 0.02, 0.2), 0xd8d0b8, { pos: [-0.4, 0.02, 0.2], rot: [0, 0.6, 0] }),
      ],
      { aoHeight: 0.5, aoStrength: 0.35 },
    ),
  );

// Saobraćajni čunj
export const trafficCone = () =>
  cached('cone', () =>
    build([
      part(box(0.42, 0.05, 0.42), 0xd8501f, { pos: [0, 0.025, 0] }),
      part(new THREE.ConeGeometry(0.17, 0.6, 10), 0xff6a1f, { pos: [0, 0.33, 0] }),
      part(cyl(0.115, 0.125, 0.09, 10), 0xf2f2f2, { pos: [0, 0.32, 0] }),
    ]),
  );

// Gomila ruševina (beton, cigle, armatura)
export const rubblePile = () =>
  cached('rubble', () => {
    const parts = [];
    const cols = [0x8d8a85, 0x77736d, 0x9b6a52, 0x6a665f];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 0.3 + (i % 3) * 0.35;
      parts.push(part(box(0.5 + (i % 2) * 0.3, 0.25 + (i % 3) * 0.12, 0.45), cols[i % 4], {
        pos: [Math.cos(a) * r, 0.12 + (i % 3) * 0.08, Math.sin(a) * r],
        rot: [i * 0.4, i * 0.9, i * 0.3],
      }));
    }
    parts.push(part(box(0.9, 0.5, 0.8), 0x7f7b75, { pos: [0, 0.3, 0], rot: [0.2, 0.5, 0.1] }));
    parts.push(part(cyl(0.015, 0.015, 1.1, 4), 0x5a3a26, { pos: [0.2, 0.6, 0], rot: [0.6, 0, 0.4] }));
    parts.push(part(cyl(0.015, 0.015, 0.9, 4), 0x5a3a26, { pos: [-0.25, 0.5, 0.1], rot: [-0.5, 0, -0.3] }));
    return build(parts, { aoHeight: 0.6, aoStrength: 0.45 });
  });

// Hidrant
export const hydrant = () =>
  cached('hydrant', () =>
    build([
      part(cyl(0.13, 0.15, 0.55, 10), 0xc8322b, { pos: [0, 0.28, 0] }),
      part(sph(0.14, 10, 6), 0xc8322b, { pos: [0, 0.56, 0] }),
      part(cyl(0.06, 0.06, 0.38, 8), 0xa82a24, { pos: [0, 0.38, 0], rot: [0, 0, Math.PI / 2] }),
    ]),
  );

// Automobil (bez rotacije); color = boja karoserije
export const car = (color = 0x8a3a32, burnt = false) =>
  cached('car-' + color + burnt, () => {
    const body = burnt ? 0x2b2622 : color;
    const top = burnt ? 0x1f1b18 : new THREE.Color(color).multiplyScalar(0.8).getHex();
    return build(
      [
        part(box(1.75, 0.6, 4.1), body, { pos: [0, 0.55, 0] }),
        part(box(1.55, 0.55, 2.1), top, { pos: [0, 1.1, 0.25] }),
        part(box(1.45, 0.45, 0.06), burnt ? 0x0c0c0c : 0x26323e, { pos: [0, 1.12, -0.82], rot: [0.55, 0, 0] }),
        part(box(1.45, 0.4, 0.06), burnt ? 0x0c0c0c : 0x26323e, { pos: [0, 1.1, 1.32], rot: [-0.5, 0, 0] }),
        part(box(1.57, 0.36, 1.6), burnt ? 0x0c0c0c : 0x2a3540, { pos: [0, 1.1, 0.25] }),
        ...[[-0.85, -1.3], [0.85, -1.3], [-0.85, 1.35], [0.85, 1.35]].map(([x, z]) =>
          part(cyl(0.34, 0.34, 0.25, 12), 0x161616, { pos: [x, 0.34, z], rot: [0, 0, Math.PI / 2] }),
        ),
        part(box(0.36, 0.14, 0.05), burnt ? 0x222222 : 0xfff1c0, { pos: [-0.55, 0.62, -2.06] }),
        part(box(0.36, 0.14, 0.05), burnt ? 0x222222 : 0xfff1c0, { pos: [0.55, 0.62, -2.06] }),
        part(box(0.36, 0.12, 0.05), burnt ? 0x222222 : 0xb01818, { pos: [-0.6, 0.66, 2.06] }),
        part(box(0.36, 0.12, 0.05), burnt ? 0x222222 : 0xb01818, { pos: [0.6, 0.66, 2.06] }),
        part(box(1.8, 0.18, 0.12), 0x3a3a3a, { pos: [0, 0.4, -2.08] }),
      ],
      { aoHeight: 0.9, aoStrength: 0.45 },
    );
  });

// Policijski auto (rotacija se dodaje posebno da bi mogla da trepće)
export const policeCar = () =>
  cached('police', () =>
    build(
      [
        part(box(1.75, 0.6, 4.1), 0xf2f2f2, { pos: [0, 0.55, 0] }),
        part(box(1.77, 0.25, 1.6), 0x1a2a4a, { pos: [0, 0.6, 0.2] }),
        part(box(1.55, 0.55, 2.1), 0x1a2a4a, { pos: [0, 1.1, 0.25] }),
        part(box(1.57, 0.36, 1.6), 0x26323e, { pos: [0, 1.1, 0.25] }),
        ...[[-0.85, -1.3], [0.85, -1.3], [-0.85, 1.35], [0.85, 1.35]].map(([x, z]) =>
          part(cyl(0.34, 0.34, 0.25, 12), 0x161616, { pos: [x, 0.34, z], rot: [0, 0, Math.PI / 2] }),
        ),
        part(box(0.9, 0.08, 0.3), 0x333333, { pos: [0, 1.4, 0.2] }),
      ],
      { aoHeight: 0.9, aoStrength: 0.45 },
    ),
  );

// Panj/oboreno stablo
export const log = () =>
  cached('log', () =>
    build(
      [
        part(cyl(0.28, 0.32, 3.2, 10), 0x5a3f2c, { pos: [0, 0.3, 0], rot: [0, 0, Math.PI / 2] }),
        part(cyl(0.24, 0.24, 0.02, 10), 0xb08a5c, { pos: [1.61, 0.3, 0], rot: [0, 0, Math.PI / 2] }),
        part(cyl(0.05, 0.03, 0.7, 5), 0x4a3324, { pos: [0.4, 0.62, 0.1], rot: [0.5, 0, 0.3] }),
      ],
      { aoHeight: 0.6, aoStrength: 0.35 },
    ),
  );

// Tamni bor (šuma)
export const darkPine = () =>
  cached('darkpine', () =>
    build(
      [
        part(cyl(0.12, 0.2, 1.4, 6), 0x3d2b1f, { pos: [0, 0.7, 0] }),
        part(new THREE.ConeGeometry(1.5, 2.2, 8), 0x1e3d2a, { pos: [0, 2.1, 0] }),
        part(new THREE.ConeGeometry(1.2, 2.0, 8), 0x234a31, { pos: [0, 3.2, 0] }),
        part(new THREE.ConeGeometry(0.85, 1.8, 8), 0x285237, { pos: [0, 4.2, 0] }),
        part(new THREE.ConeGeometry(0.45, 1.3, 8), 0x2d5a3c, { pos: [0, 5.1, 0] }),
      ],
      { aoHeight: 2.2, aoStrength: 0.45 },
    ),
  );

// Žbun
export const bush = () =>
  cached('bush', () =>
    build(
      [
        part(new THREE.IcosahedronGeometry(0.6, 1), 0x2f5a2a, { pos: [0, 0.4, 0], scale: [1.2, 0.8, 1.1] }),
        part(new THREE.IcosahedronGeometry(0.45, 1), 0x386b31, { pos: [0.5, 0.35, 0.2] }),
        part(new THREE.IcosahedronGeometry(0.4, 1), 0x264b23, { pos: [-0.45, 0.3, -0.15] }),
      ],
      { aoHeight: 0.6, aoStrength: 0.4 },
    ),
  );

// Napuštena drvena koliba
export const cabin = () =>
  cached('cabin', () => {
    const parts = [];
    for (let i = 0; i < 7; i++) parts.push(part(cyl(0.16, 0.16, 4.4, 8), i % 2 ? 0x6b4a32 : 0x5e412c, { pos: [0, 0.18 + i * 0.32, -1.6], rot: [0, 0, Math.PI / 2] }));
    for (let i = 0; i < 7; i++) parts.push(part(cyl(0.16, 0.16, 4.4, 8), i % 2 ? 0x6b4a32 : 0x5e412c, { pos: [0, 0.18 + i * 0.32, 1.6], rot: [0, 0, Math.PI / 2] }));
    for (let i = 0; i < 7; i++) parts.push(part(cyl(0.16, 0.16, 3.4, 8), 0x654530, { pos: [-2.05, 0.18 + i * 0.32, 0], rot: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 7; i++) parts.push(part(cyl(0.16, 0.16, 3.4, 8), 0x654530, { pos: [2.05, 0.18 + i * 0.32, 0], rot: [Math.PI / 2, 0, 0] }));
    parts.push(part(box(4.9, 0.12, 2.2), 0x3b2a20, { pos: [0, 2.85, -0.9], rot: [0.55, 0, 0] }));
    parts.push(part(box(4.9, 0.12, 2.2), 0x3b2a20, { pos: [0, 2.85, 0.9], rot: [-0.55, 0, 0] }));
    parts.push(part(box(0.9, 1.5, 0.08), 0x2a1d14, { pos: [0.6, 0.75, 1.78] }));
    parts.push(part(box(0.7, 0.6, 0.08), 0xffb35a, { pos: [-1.1, 1.3, 1.78] }));
    return build(parts, { aoHeight: 1.5, aoStrength: 0.35 });
  });

// Logorska vatra (kamenje i drva; plamen se dodaje efektima)
export const campfire = () =>
  cached('campfire', () => {
    const parts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(part(new THREE.DodecahedronGeometry(0.16, 0), 0x6f6a64, { pos: [Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55] }));
    }
    parts.push(part(cyl(0.07, 0.07, 0.9, 6), 0x4a3324, { pos: [0, 0.15, 0], rot: [0, 0.5, Math.PI / 2] }));
    parts.push(part(cyl(0.07, 0.07, 0.9, 6), 0x4a3324, { pos: [0, 0.2, 0], rot: [0, -0.7, Math.PI / 2] }));
    parts.push(part(cyl(0.3, 0.35, 0.05, 10), 0x1a1210, { pos: [0, 0.03, 0] }));
    return build(parts);
  });

// Drvena ograda (segment 2 m)
export const fence = () =>
  cached('fence', () =>
    build([
      part(box(0.1, 1.0, 0.1), 0x5e4532, { pos: [-0.95, 0.5, 0] }),
      part(box(0.1, 1.0, 0.1), 0x5e4532, { pos: [0.95, 0.5, 0] }),
      part(box(2.0, 0.12, 0.05), 0x6e5038, { pos: [0, 0.75, 0] }),
      part(box(2.0, 0.12, 0.05), 0x6e5038, { pos: [0, 0.4, 0], rot: [0, 0, 0.08] }),
    ]),
  );

// Reflektor na stubu (baza junaka)
export const floodlight = () =>
  cached('flood', () =>
    build([
      part(cyl(0.06, 0.09, 3.4, 6), 0x3a3f46, { pos: [0, 1.7, 0] }),
      part(box(0.6, 0.45, 0.25), 0x2a2e33, { pos: [0, 3.45, 0], rot: [0.35, 0, 0] }),
      part(box(0.5, 0.35, 0.03), 0xfff6d0, { pos: [0, 3.42, -0.14], rot: [0.35, 0, 0] }),
    ]),
  );

// Vojni kamion (baza iza junaka)
export const militaryTruck = () =>
  cached('truck', () =>
    build(
      [
        part(box(2.3, 1.0, 6.2), 0x4b5634, { pos: [0, 1.0, 0] }),
        part(box(2.3, 1.3, 1.8), 0x56623c, { pos: [0, 1.95, -2.1] }),
        part(box(2.1, 0.55, 0.06), 0x26323e, { pos: [0, 2.2, -3.0] }),
        part(box(2.35, 1.6, 4.0), 0x5d6a40, { pos: [0, 2.3, 0.95] }),
        ...[[-1.05, -2.1], [1.05, -2.1], [-1.05, 1.0], [1.05, 1.0], [-1.05, 2.3], [1.05, 2.3]].map(([x, z]) =>
          part(cyl(0.5, 0.5, 0.35, 12), 0x161616, { pos: [x, 0.5, z], rot: [0, 0, Math.PI / 2] }),
        ),
        part(box(0.5, 0.5, 0.05), 0xffffff, { pos: [-0.8, 2.3, 2.96] }),
      ],
      { aoHeight: 1.2, aoStrength: 0.4 },
    ),
  );

// Betonska prepreka (džersi)
export const jersey = () =>
  cached('jersey', () =>
    build(
      [
        part(box(0.7, 0.35, 2.4), 0xa9adb3, { pos: [0, 0.175, 0] }),
        part(box(0.42, 0.55, 2.4), 0xb8bcc2, { pos: [0, 0.6, 0] }),
        part(box(0.44, 0.1, 0.6), 0xd94a2a, { pos: [0, 0.82, -0.7] }),
        part(box(0.44, 0.1, 0.6), 0xf2f2f2, { pos: [0, 0.82, 0] }),
        part(box(0.44, 0.1, 0.6), 0xd94a2a, { pos: [0, 0.82, 0.7] }),
      ],
      { aoHeight: 0.6, aoStrength: 0.4 },
    ),
  );

// Strelica na putu (polja dolaze ovom trakom)
export const chevron = () =>
  cached('chevron', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.9, -0.2);
    s.lineTo(0, 0.45);
    s.lineTo(0.9, -0.2);
    s.lineTo(0.9, -0.55);
    s.lineTo(0, 0.1);
    s.lineTo(-0.9, -0.55);
    s.lineTo(-0.9, -0.2);
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.PI);
    g.userData.shared = true;
    return g;
  });
