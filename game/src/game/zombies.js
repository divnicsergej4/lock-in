// Zombiji i čudovišta: modeli, kretanje, napad, reakcije na pogodak, umiranje i trake života.
// Svaka vrsta zombija se crta odjednom ("instancing"), pa ih može biti mnogo.
import * as THREE from 'three';
import { part, build, shadowPlane } from './models.js';
import { shadowTexture } from './textures.js';
import { LANE_X, DIVIDER_HALF } from './config.js';

// hp = život, speed = brzina, dmg = koliko vojnika ubije (ili u sekundi za one koji se "zakače"),
// attach = ostaje i napada dok ne umre, coin = nagrada, scale = veličina, bar = širina trake života
export const ZTYPES = {
  walker: { hp: 3, speed: 2.6, dmg: 1, attach: false, coin: 1, scale: 1.18, bar: 0.75, cap: 90 },
  runner: { hp: 2, speed: 5.6, dmg: 1, attach: false, coin: 1, scale: 1.08, bar: 0.65, cap: 50 },
  brute: { hp: 18, speed: 1.9, dmg: 3, attach: true, coin: 5, scale: 1.8, bar: 1.2, cap: 16 },
  mutant: { hp: 90, speed: 1.5, dmg: 6, attach: true, coin: 20, scale: 2.6, bar: 1.9, cap: 4 },
  boss: { hp: 400, speed: 1.0, dmg: 9, attach: true, coin: 100, scale: 4.0, bar: 0, cap: 1 },
};

const PALETTE = {
  walker: { shirt: 0x6f8794, shirt2: 0x52666f, pants: 0x3d3a4a, skin: 0x93c06e },
  runner: { shirt: 0xa05a46, shirt2: 0x7a3f30, pants: 0x34384a, skin: 0xa9cc7c },
  brute: { shirt: 0x55603f, shirt2: 0x3d4630, pants: 0x2f2b28, skin: 0x7ea65f },
  mutant: { shirt: 0x5a3d6e, shirt2: 0x40284f, pants: 0x2a2233, skin: 0x9a78b8 },
  boss: { shirt: 0x4a4f57, shirt2: 0x2f3338, pants: 0x262626, skin: 0x5f8048 },
};

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);
const HIP_Y = 0.36;
const SHOULDER_Y = 0.72;

const geoCache = new Map();
function zombieBody(type) {
  const key = 'zb-' + type;
  if (geoCache.has(key)) return geoCache.get(key);
  const c = PALETTE[type];
  const lean = [-0.35, 0, 0];
  const parts = [
    // Pogrbljen trup sa pocepanom košuljom
    part(new THREE.CapsuleGeometry(0.16, 0.2, 2, 7), c.shirt, { pos: [0, 0.58, -0.03], rot: lean, scale: [1, 1, 0.85] }),
    part(box(0.12, 0.1, 0.03), c.shirt2, { pos: [0.06, 0.62, -0.17], rot: lean }),
    part(box(0.08, 0.12, 0.03), 0x7a2a22, { pos: [-0.07, 0.52, -0.15], rot: lean }),
    // Glava (napred), crvene oči koje svetle, usta
    part(sph(0.14, 8, 6), c.skin, { pos: [0, 0.9, -0.14] }),
    part(box(0.035, 0.03, 0.02), 0xff3a1a, { pos: [-0.05, 0.92, -0.27] }),
    part(box(0.035, 0.03, 0.02), 0xff3a1a, { pos: [0.05, 0.92, -0.27] }),
    part(box(0.08, 0.035, 0.02), 0x3a1414, { pos: [0, 0.84, -0.265] }),
    part(sph(0.05, 6, 4), 0xe58fa0, { pos: [0.07, 1.0, -0.1] }),
  ];
  if (type === 'brute' || type === 'boss') {
    parts.push(part(sph(0.2, 8, 6), c.skin, { pos: [0, 0.5, -0.12], scale: [1, 0.9, 0.9] })); // stomak
  }
  if (type === 'mutant') {
    // Svetleći izraslini i bodlje na leđima
    [[0.12, 0.7, -0.12], [-0.1, 0.6, -0.14], [0.05, 0.5, -0.16], [-0.13, 0.82, -0.05]].forEach((p) =>
      parts.push(part(sph(0.045, 6, 4), 0x9dff4a, { pos: p })),
    );
    for (let i = 0; i < 4; i++) parts.push(part(new THREE.ConeGeometry(0.04, 0.18, 5), 0xe8e0d0, { pos: [0, 0.55 + i * 0.1, 0.13], rot: [0.9, 0, 0] }));
  }
  if (type === 'boss') {
    // Oklop, rogovi
    parts.push(part(box(0.38, 0.22, 0.3), 0x6d737c, { pos: [0, 0.68, -0.02], rot: lean }));
    parts.push(part(box(0.16, 0.08, 0.2), 0x8a9099, { pos: [-0.2, 0.78, 0] }));
    parts.push(part(box(0.16, 0.08, 0.2), 0x8a9099, { pos: [0.2, 0.78, 0] }));
    parts.push(part(new THREE.ConeGeometry(0.035, 0.16, 5), 0xf0e6d0, { pos: [-0.08, 1.05, -0.12], rot: [0, 0, 0.5] }));
    parts.push(part(new THREE.ConeGeometry(0.035, 0.16, 5), 0xf0e6d0, { pos: [0.08, 1.05, -0.12], rot: [0, 0, -0.5] }));
  }
  const g = build(parts, { aoHeight: 0.5, aoBase: 0.3, aoStrength: 0.3 });
  geoCache.set(key, g);
  return g;
}

function zombieArm(type) {
  const key = 'za-' + type;
  if (geoCache.has(key)) return geoCache.get(key);
  const c = PALETTE[type];
  const g = build([
    part(box(0.085, 0.16, 0.09), c.shirt, { pos: [0, -0.08, 0] }),
    part(box(0.07, 0.16, 0.075), c.skin, { pos: [0, -0.22, 0] }),
    part(box(0.08, 0.06, 0.08), c.skin, { pos: [0, -0.32, 0] }),
  ]);
  geoCache.set(key, g);
  return g;
}

function zombieLeg(type) {
  const key = 'zl-' + type;
  if (geoCache.has(key)) return geoCache.get(key);
  const c = PALETTE[type];
  const g = build([
    part(box(0.11, 0.26, 0.12), c.pants, { pos: [0, -0.13, 0] }),
    part(box(0.11, 0.09, 0.16), 0x3a2e26, { pos: [0, -0.31, -0.02] }),
  ]);
  geoCache.set(key, g);
  return g;
}

let mat;
let shadowMat;
let barBgMat;
let barMat;
function materials() {
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.userData.shared = true;
    shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x0d1d10, transparent: true, opacity: 0.4, depthWrite: false });
    shadowMat.userData.shared = true;
    barBgMat = new THREE.MeshBasicMaterial({ color: 0x1a0d10, transparent: true, opacity: 0.75, depthWrite: false });
    barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false });
  }
  return { mat, shadowMat, barBgMat, barMat };
}

const _root = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const SHADOW = shadowPlane(1);

class Rig {
  constructor(scene, type) {
    const cap = ZTYPES[type].cap;
    const { mat: m, shadowMat: sm } = materials();
    const make = (geo, material, n, shadow) => {
      const mesh = new THREE.InstancedMesh(geo, material, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = shadow;
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    };
    this.shadow = make(SHADOW, sm, cap, false);
    this.shadow.renderOrder = -1;
    this.body = make(zombieBody(type), m, cap, true);
    this.arms = make(zombieArm(type), m, cap * 2, false);
    this.legs = make(zombieLeg(type), m, cap * 2, false);
    for (let i = 0; i < cap; i++) this.body.setColorAt(i, _c.set(0xffffff));
    this.meshes = [this.shadow, this.body, this.arms, this.legs];
    this.n = 0;
  }
}

export class Horde {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.rigs = {};
    for (const t of Object.keys(ZTYPES)) this.rigs[t] = new Rig(scene, t);
    this.list = [];
    this.hpMul = 1;

    const { barBgMat: bg, barMat: fg } = materials();
    const barGeo = new THREE.PlaneGeometry(1, 1);
    barGeo.translate(0.5, 0, 0); // traka raste od leve ivice
    this.barBg = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), bg, 120);
    this.barFg = new THREE.InstancedMesh(barGeo, fg, 120);
    this.barFg.setColorAt(0, _c.set(0xffffff));
    [this.barBg, this.barFg].forEach((b, i) => {
      b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      b.frustumCulled = false;
      b.count = 0;
      b.renderOrder = 5 + i;
      scene.add(b);
    });
  }

  clear() {
    this.list = [];
  }

  spawn(type, x, z, { state = 'idle' } = {}) {
    const def = ZTYPES[type];
    const alive = this.list.filter((zz) => zz.type === type).length;
    if (alive >= def.cap) return null;
    const hp = def.hp * this.hpMul;
    const zb = {
      type, def, x, z, hp, maxHp: hp, pending: 0,
      speed: def.speed * (0.85 + Math.random() * 0.3),
      state, t: 0, phase: Math.random() * 6.28, hitT: 0, knock: 0, deadT: 0,
      scale: def.scale * (0.92 + Math.random() * 0.16),
      tint: 0.85 + Math.random() * 0.25,
      attackT: 0, yawJ: (Math.random() - 0.5) * 0.4, alive: true,
    };
    zb.aimPoint = () => [zb.x, 0.75 * zb.scale, zb.z];
    this.list.push(zb);
    return zb;
  }

  // Šteta zombiju; vraća true ako je umro
  damage(zb, dmg, fromZ) {
    if (!zb.alive) return false;
    zb.hp -= dmg;
    zb.hitT = 1;
    zb.knock = Math.min(0.6, zb.knock + 0.25 / zb.def.scale);
    if (zb.hp <= 0) {
      zb.alive = false;
      zb.state = 'dying';
      zb.deadT = 0;
      const s = zb.def.scale;
      this.effects.goo(zb.x, 0.6 * s, zb.z, s);
      return true;
    }
    return false;
  }

  aliveList() {
    return this.list.filter((zb) => zb.alive);
  }

  // Kretanje i animacija; army = { x, z, front, radius, lane }
  update(dt, t, army, camera) {
    for (const r of Object.values(this.rigs)) r.n = 0;
    const keep = [];
    let bars = 0;
    for (const zb of this.list) {
      zb.t += dt;
      if (zb.hitT > 0) zb.hitT = Math.max(0, zb.hitT - dt * 5);
      zb.knock = Math.max(0, zb.knock - dt * 2);
      if (zb.state === 'dying') {
        zb.deadT += dt;
        if (zb.deadT > 1.6) continue;
      } else {
        this.think(zb, dt, army);
      }
      if (zb.z > army.z + 18) continue; // ostao daleko iza vojske
      keep.push(zb);
      this.pose(zb, t);
      // Traka života
      if (zb.alive && zb.def.bar > 0 && (zb.hp < zb.maxHp || zb.def.attach) && bars < 120) {
        const w = zb.def.bar;
        const y = 1.25 * zb.scale + 0.25;
        _q.copy(camera.quaternion);
        _root.compose(_p.set(zb.x, y, zb.z), _q, _s.set(w + 0.08, 0.16, 1));
        this.barBg.setMatrixAt(bars, _root);
        const k = Math.max(0, zb.hp / zb.maxHp);
        _local.compose(_p.set(-w / 2, 0, 0.01), new THREE.Quaternion(), _s.set(w * k, 0.1, 1));
        _out.compose(_p.set(zb.x, y, zb.z), _q, new THREE.Vector3(1, 1, 1)).multiply(_local);
        this.barFg.setMatrixAt(bars, _out);
        this.barFg.setColorAt(bars, _c.setHSL(0.33 * k, 0.9, 0.5));
        bars++;
      }
    }
    this.list = keep;
    for (const r of Object.values(this.rigs)) {
      r.shadow.count = r.body.count = r.n;
      r.arms.count = r.legs.count = r.n * 2;
      r.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
      r.body.instanceColor.needsUpdate = true;
    }
    this.barBg.count = this.barFg.count = bars;
    this.barBg.instanceMatrix.needsUpdate = true;
    this.barFg.instanceMatrix.needsUpdate = true;
    if (this.barFg.instanceColor) this.barFg.instanceColor.needsUpdate = true;
  }

  // Ponašanje: stoje dok se vojska ne približi, onda jurišaju; preskaču zid ako je vojska u drugoj traci
  think(zb, dt, army) {
    const dz = army.front - zb.z; // koliko je vojska ispred zombija (pozitivno = vojska još nije stigla)
    if (zb.state === 'idle') {
      if (dz < 34) zb.state = 'chase';
      return;
    }
    if (zb.state === 'attack') {
      // Zakačen za vojsku: kreće se sa njom i udara
      zb.z = Math.min(zb.z, army.front - 0.2);
      zb.z += (army.front - 0.3 - zb.z) * Math.min(1, dt * 6);
      zb.x += (army.x + zb.attachX - zb.x) * Math.min(1, dt * 4);
      zb.attackT += dt;
      return;
    }
    const sameLane = Math.sign(zb.x) === Math.sign(army.x) || army.lane === 0;
    let tx = zb.x;
    if (sameLane || dz < 10) {
      tx = army.x + (zb.phase - 3.14) * 0.35;
    } else {
      tx = Math.sign(zb.x) * LANE_X + (zb.phase - 3.14) * 0.3;
    }
    const climbing = Math.abs(zb.x) < DIVIDER_HALF + 0.3 && army.lane !== 0;
    const sp = zb.speed * (climbing ? 0.45 : 1) * (1 - zb.knock * 0.8);
    zb.z += sp * dt - zb.knock * dt * 3;
    zb.x += Math.max(-1, Math.min(1, tx - zb.x)) * dt * (dz < 10 ? 3.2 : 1.2);
  }

  pose(zb, t) {
    const rig = this.rigs[zb.type];
    const i = rig.n++;
    const s = zb.scale;
    const walking = zb.state === 'chase';
    const freq = zb.type === 'runner' ? 12 : zb.type === 'walker' ? 6 : 4;
    const ph = zb.phase + t * freq * (walking ? 1 : 0.3);
    const sw = Math.sin(ph);
    let pitch = -0.1 - (zb.type === 'runner' ? 0.25 : 0) + zb.hitT * 0.45;
    let roll = Math.sin(ph * 0.5) * 0.12;
    let y = walking ? Math.abs(Math.cos(ph)) * 0.05 * s : 0;
    let sink = 0;
    if (zb.state === 'dying') {
      const k = Math.min(1, zb.deadT / 0.35);
      pitch = -(1 - (1 - k) * (1 - k)) * (Math.PI / 2 - 0.1);
      roll = 0;
      y = Math.sin(k * Math.PI) * 0.2;
      sink = zb.deadT > 1.0 ? (zb.deadT - 1.0) / 0.6 : 0;
    }
    // Preskakanje zida između traka
    const ax = Math.abs(zb.x);
    if (zb.alive && ax < DIVIDER_HALF + 0.35) y += (1 - ax / (DIVIDER_HALF + 0.35)) * 0.55;
    _e.set(pitch, Math.PI + zb.yawJ * (walking ? 1 : 0.4), roll);
    _q.setFromEuler(_e);
    _root.compose(_p.set(zb.x, y - sink * 0.4 * s, zb.z), _q, _s.setScalar(s * (1 - sink * 0.4)));
    rig.body.setMatrixAt(i, _root);
    const f = 1 + zb.hitT * 2.2;
    rig.body.setColorAt(i, _c.setRGB(f * zb.tint, f * (zb.hitT > 0 ? 0.8 : 1) * zb.tint, f * zb.tint));
    _local.makeTranslation(zb.x, 0.02, zb.z);
    _local.elements[0] = _local.elements[10] = 0.8 * s * (1 - sink);
    rig.shadow.setMatrixAt(i, _local);

    // Noge
    const legA = walking ? sw * 0.6 : 0;
    for (let side = 0; side < 2; side++) {
      _rot.makeRotationX(side ? legA : -legA);
      _local.makeTranslation((side ? 1 : -1) * 0.08, HIP_Y, 0).multiply(_rot);
      rig.legs.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
    }
    // Ruke ispružene napred; pri napadu mašu, pri umiranju padaju
    let armBase = walking ? 1.45 : 0.9 + Math.sin(t * 2 + zb.phase) * 0.1;
    if (zb.state === 'attack') armBase = 1.2 + Math.sin(zb.attackT * 14) * 0.6;
    if (zb.state === 'dying') armBase = 2.4;
    for (let side = 0; side < 2; side++) {
      const wob = Math.sin(ph + side * 1.7) * 0.18;
      _rot.makeRotationX(armBase + wob);
      _local.makeTranslation((side ? 1 : -1) * 0.2, SHOULDER_Y, -0.08).multiply(_rot);
      rig.arms.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
    }
  }
}
