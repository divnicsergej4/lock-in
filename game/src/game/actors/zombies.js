// Zombiji: modeli, kretanje, napad na junaka, reakcije na pogodak, gorenje, umiranje i trake života.
// Svaka vrsta zombija se crta odjednom ("instancing"), pa ih na ekranu može biti mnogo.
import * as THREE from 'three';
import { part, build, shadowPlane } from '../gfx/models.js';
import { shadowTexture } from '../fx/textures.js';
import { LANE_X, LANE_HALF, MEDIAN_START_Z, ZOMBIE_SIDE, HERO_Z } from '../core/config.js';

// hp = život, speed = brzina (m/s), dmg = šteta junaku po udarcu, coin = nagrada,
// scale = veličina, radius = koliko je "širok" (za pogotke i guranje), cap = najviše odjednom
export const ZTYPES = {
  walker: { name: 'ZOMBI', hp: 30, speed: 2.0, dmg: 8, coin: 2, scale: 1.6, radius: 0.36, cap: 90, attackEvery: 0.9 },
  runner: { name: 'TRKAČ', hp: 20, speed: 4.6, dmg: 6, coin: 3, scale: 1.5, radius: 0.33, cap: 50, attackEvery: 0.7 },
  brute: { name: 'GRMALJ', hp: 240, speed: 1.35, dmg: 22, coin: 12, scale: 2.5, radius: 0.62, cap: 12, attackEvery: 1.3 },
  bloater: { name: 'NADUVENKO', hp: 55, speed: 1.5, dmg: 26, coin: 5, scale: 1.75, radius: 0.5, cap: 16, attackEvery: 1, explodes: true },
};

export const PALETTE = {
  walker: { shirt: 0x6f8794, shirt2: 0x52666f, pants: 0x3d3a4a, skin: 0x93c06e },
  runner: { shirt: 0xa05a46, shirt2: 0x7a3f30, pants: 0x34384a, skin: 0xa9cc7c },
  brute: { shirt: 0x55603f, shirt2: 0x3d4630, pants: 0x2f2b28, skin: 0x7ea65f },
  bloater: { shirt: 0x8a8f5a, shirt2: 0x6b6f43, pants: 0x3a3a2c, skin: 0x9fc25a },
  boss: { shirt: 0x4a4f57, shirt2: 0x2f3338, pants: 0x262626, skin: 0x5f8048 },
  mutant: { shirt: 0x5a3d6e, shirt2: 0x40284f, pants: 0x2a2233, skin: 0x9a78b8 },
};

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);
export const HIP_Y = 0.36;
export const SHOULDER_Y = 0.72;

const geoCache = new Map();

// Telo zombija (pogrbljen trup, glava napred, crvene oči). Model gleda ka -z, visina ~1.1 pri veličini 1.
export function zombieBody(type) {
  const key = 'zb-' + type;
  if (geoCache.has(key)) return geoCache.get(key);
  const c = PALETTE[type];
  const lean = [-0.35, 0, 0];
  const parts = [
    part(new THREE.CapsuleGeometry(0.16, 0.2, 2, 7), c.shirt, { pos: [0, 0.58, -0.03], rot: lean, scale: [1, 1, 0.85] }),
    part(box(0.12, 0.1, 0.03), c.shirt2, { pos: [0.06, 0.62, -0.17], rot: lean }),
    part(box(0.08, 0.12, 0.03), 0x7a2a22, { pos: [-0.07, 0.52, -0.15], rot: lean }),
    part(sph(0.14, 8, 6), c.skin, { pos: [0, 0.9, -0.14] }),
    part(box(0.035, 0.03, 0.02), 0xff3a1a, { pos: [-0.05, 0.92, -0.27] }),
    part(box(0.035, 0.03, 0.02), 0xff3a1a, { pos: [0.05, 0.92, -0.27] }),
    part(box(0.08, 0.035, 0.02), 0x3a1414, { pos: [0, 0.84, -0.265] }),
    part(sph(0.05, 6, 4), 0xe58fa0, { pos: [0.07, 1.0, -0.1] }),
  ];
  if (type === 'brute' || type === 'boss') {
    parts.push(part(sph(0.2, 8, 6), c.skin, { pos: [0, 0.5, -0.12], scale: [1, 0.9, 0.9] }));
  }
  if (type === 'bloater') {
    // Ogroman naduven stomak sa svetlećim izraslinama
    parts.push(part(sph(0.3, 10, 8), c.skin, { pos: [0, 0.52, -0.08], scale: [1.05, 0.95, 1] }));
    [[0.15, 0.62, -0.32], [-0.18, 0.5, -0.3], [0.05, 0.4, -0.36], [-0.05, 0.7, -0.3], [0.24, 0.45, -0.18]].forEach((p) =>
      parts.push(part(sph(0.055, 6, 4), 0xc6ff4a, { pos: p })),
    );
  }
  if (type === 'mutant') {
    [[0.12, 0.7, -0.12], [-0.1, 0.6, -0.14], [0.05, 0.5, -0.16], [-0.13, 0.82, -0.05]].forEach((p) =>
      parts.push(part(sph(0.045, 6, 4), 0x9dff4a, { pos: p })),
    );
    for (let i = 0; i < 4; i++) parts.push(part(new THREE.ConeGeometry(0.04, 0.18, 5), 0xe8e0d0, { pos: [0, 0.55 + i * 0.1, 0.13], rot: [0.9, 0, 0] }));
  }
  if (type === 'boss') {
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

export function zombieArm(type) {
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

export function zombieLeg(type) {
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

let mats;
function materials() {
  if (!mats) {
    mats = {
      body: new THREE.MeshLambertMaterial({ vertexColors: true }),
      shadow: new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x05080a, transparent: true, opacity: 0.45, depthWrite: false }),
      barBg: new THREE.MeshBasicMaterial({ color: 0x14080a, transparent: true, opacity: 0.8, depthWrite: false }),
      bar: new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }),
    };
    Object.values(mats).forEach((m) => (m.userData.shared = true));
  }
  return mats;
}

const _root = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const SHADOW = shadowPlane(1);
const MAX_BARS = 90;

class Rig {
  constructor(scene, type) {
    const cap = ZTYPES[type].cap;
    const m = materials();
    const make = (geo, material, n, shadow) => {
      const mesh = new THREE.InstancedMesh(geo, material, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = shadow;
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    };
    this.shadow = make(SHADOW, m.shadow, cap, false);
    this.shadow.renderOrder = -1;
    this.body = make(zombieBody(type), m.body, cap, true);
    this.arms = make(zombieArm(type), m.body, cap * 2, false);
    this.legs = make(zombieLeg(type), m.body, cap * 2, false);
    for (let i = 0; i < cap; i++) this.body.setColorAt(i, _c.set(0xffffff));
    this.body.instanceColor.setUsage(THREE.DynamicDrawUsage);
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
    this.dmgMul = 1;
    this.speedMul = 1;
    this.events = [];

    const m = materials();
    const fg = new THREE.PlaneGeometry(1, 1);
    fg.translate(0.5, 0, 0);
    this.barBg = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.barBg, MAX_BARS);
    this.barFg = new THREE.InstancedMesh(fg, m.bar, MAX_BARS);
    this.barFg.setColorAt(0, _c.set(0xffffff));
    [this.barBg, this.barFg].forEach((b, i) => {
      b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      b.frustumCulled = false;
      b.count = 0;
      b.renderOrder = 6 + i;
      scene.add(b);
    });
  }

  clear() {
    this.list = [];
  }

  countAlive() {
    let n = 0;
    for (const z of this.list) if (z.alive) n++;
    return n;
  }

  // from: 'front' (iz magle, niz traku) ili 'alley' (iz bočne ulice, ukoso)
  spawn(type, x, z, { from = 'front', menu = false } = {}) {
    const def = ZTYPES[type];
    let n = 0;
    for (const zz of this.list) if (zz.type === type) n++;
    if (n >= def.cap) return null;
    const hp = def.hp * this.hpMul;
    const zb = {
      type, def, x, z, hp, maxHp: hp, alive: true,
      state: menu ? 'menu' : from === 'alley' ? 'enter' : 'walk',
      vx: 0, vz: 0, yaw: Math.PI,
      speed: def.speed * this.speedMul * (0.85 + Math.random() * 0.3),
      laneX: ZOMBIE_SIDE * LANE_X + (Math.random() - 0.5) * (LANE_HALF * 1.5),
      t: 0, phase: Math.random() * 6.28, hitT: 0, knock: 0, deadT: 0,
      scale: def.scale * (0.93 + Math.random() * 0.14),
      tint: 0.85 + Math.random() * 0.25,
      attackT: 0, swingT: 0, burnT: 0, burnDps: 0, burnFx: 0,
      flingY: 0, flingVy: 0, flingVx: 0, flingVz: 0, dmgAcc: 0, dmgTimer: 0,
    };
    zb.aimPoint = () => [zb.x, 0.62 * zb.scale, zb.z];
    this.list.push(zb);
    return zb;
  }

  // Šteta zombiju. Vraća true ako je od ovoga umro.
  damage(zb, dmg, { knock = 0.15, fire = 0, explosive = false, fromX = null } = {}) {
    if (!zb.alive) return false;
    zb.hp -= dmg;
    zb.hitT = 1;
    zb.knock = Math.min(1.2, zb.knock + knock / Math.max(1, zb.def.scale * 0.6));
    zb.dmgAcc += dmg;
    if (fire > 0) {
      zb.burnT = 3;
      zb.burnDps = Math.max(zb.burnDps, fire);
    }
    if (zb.hp <= 0) {
      zb.alive = false;
      zb.state = 'dying';
      zb.deadT = 0;
      if (explosive) {
        const dx = zb.x - (fromX ?? zb.x);
        zb.flingVy = 4 + Math.random() * 3;
        zb.flingVx = Math.sign(dx || Math.random() - 0.5) * (1 + Math.random() * 2);
        zb.flingVz = -2 - Math.random() * 2;
      }
      this.effects.goo(zb.x, 0.6 * zb.scale, zb.z, zb.scale * 0.8);
      if (zb.def.explodes) this.events.push({ type: 'explode', x: zb.x, z: zb.z, zb });
      return true;
    }
    return false;
  }

  // hero = { x, z, alive }. Vraća događaje: udarci junaku, eksplozije naduvenka.
  update(dt, t, hero, camera) {
    const events = this.events;
    this.events = [];
    for (const r of Object.values(this.rigs)) r.n = 0;
    const list = this.list;

    // Zombiji se razmiču da ne stoje jedan u drugom
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = (a.def.radius * a.scale + b.def.radius * b.scale) / 1.6;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.0001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push * 0.6;
          b.x += nx * push;
          b.z += nz * push * 0.6;
        }
      }
    }

    const keep = [];
    let bars = 0;
    for (const zb of list) {
      zb.t += dt;
      zb.hitT = Math.max(0, zb.hitT - dt * 5);
      zb.knock = Math.max(0, zb.knock - dt * 3);
      if (zb.state === 'dying') {
        zb.deadT += dt;
        if (zb.flingVy || zb.flingY > 0) {
          zb.flingVy -= 18 * dt;
          zb.flingY = Math.max(0, zb.flingY + zb.flingVy * dt);
          zb.x += zb.flingVx * dt;
          zb.z += zb.flingVz * dt;
          if (zb.flingY === 0 && zb.flingVy < 0) zb.flingVy = 0;
        }
        if (zb.deadT > 1.7) continue;
      } else if (zb.alive) {
        // Gorenje
        if (zb.burnT > 0) {
          zb.burnT -= dt;
          zb.hp -= zb.burnDps * dt;
          zb.dmgAcc += zb.burnDps * dt;
          zb.burnFx += dt * 14;
          while (zb.burnFx >= 1) {
            zb.burnFx -= 1;
            this.effects.flame(zb.x, 0.5 * zb.scale + Math.random() * 0.5 * zb.scale, zb.z);
          }
          if (zb.hp <= 0) {
            zb.alive = false;
            zb.state = 'dying';
            zb.deadT = 0;
            this.effects.goo(zb.x, 0.6 * zb.scale, zb.z, zb.scale * 0.7);
            events.push({ type: 'killed', zb, byFire: true });
            if (zb.def.explodes) events.push({ type: 'explode', x: zb.x, z: zb.z, zb });
          }
        }
        if (zb.alive) this.think(zb, dt, hero, events);
      }
      if (zb.z > HERO_Z + 6) continue;
      keep.push(zb);
      this.pose(zb, t);

      // Traka života (za oštećene i za krupne)
      if (zb.alive && (zb.hp < zb.maxHp || zb.type === 'brute') && bars < MAX_BARS) {
        const w = 0.5 + zb.def.radius * 1.2;
        const y = 1.18 * zb.scale + 0.15;
        _q.copy(camera.quaternion);
        _root.compose(_p.set(zb.x, y, zb.z), _q, _s.set(w + 0.07, 0.13, 1));
        this.barBg.setMatrixAt(bars, _root);
        const k = Math.max(0, zb.hp / zb.maxHp);
        _local.compose(_p.set(-w / 2, 0, 0.01), _qi, _s.set(Math.max(0.001, w * k), 0.08, 1));
        _out.compose(_p.set(zb.x, y, zb.z), _q, _one).multiply(_local);
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
    return events;
  }

  // Ponašanje: hodaju niz levu traku; blizu junaka (ili kad je junak u drugoj traci) presecaju ka njemu i napadaju
  think(zb, dt, hero, events) {
    if (zb.state === 'menu') {
      // U meniju samo lutaju u daljini
      zb.x += Math.sin(zb.t * 0.3 + zb.phase) * dt * 0.3;
      zb.yaw = Math.PI + Math.sin(zb.t * 0.2 + zb.phase) * 0.8;
      return;
    }
    const contact = zb.def.radius * zb.scale * 0.62 + 0.5;
    const hx = hero.x;
    const dxh = hx - zb.x;
    const dzh = HERO_Z - zb.z;
    const dist = Math.hypot(dxh, dzh);

    if (zb.state === 'attack') {
      zb.swingT += dt;
      if (!hero.alive) return;
      if (dist > contact + 0.7) {
        zb.state = 'chase';
        return;
      }
      zb.yaw = Math.atan2(-dxh, -dzh);
      zb.attackT += dt;
      if (zb.attackT >= zb.def.attackEvery) {
        zb.attackT = 0;
        if (zb.def.explodes) {
          zb.hp = 0;
          zb.alive = false;
          zb.state = 'dying';
          zb.deadT = 0;
          events.push({ type: 'explode', x: zb.x, z: zb.z, zb });
        } else {
          events.push({ type: 'hit', dmg: zb.def.dmg * this.dmgMul, zb });
        }
      }
      return;
    }

    let tx;
    let tz;
    if (zb.state === 'enter') {
      // Iz bočne ulice ukoso ka traci
      tx = zb.laneX;
      tz = zb.z + 3;
      if (Math.abs(zb.x - zb.laneX) < 1.2) zb.state = 'walk';
    } else if (zb.state === 'walk') {
      tx = zb.laneX + Math.sin(zb.t * 0.8 + zb.phase) * 0.4;
      tz = HERO_Z;
      const heroOtherSide = Math.sign(hx) !== Math.sign(zb.x);
      if (zb.z > -11 || (!heroOtherSide && dist < 9)) zb.state = 'chase';
    } else {
      tx = hx;
      tz = HERO_Z;
    }
    if (zb.state === 'chase') {
      tx = hx;
      tz = HERO_Z;
      if (dist < contact) {
        zb.state = 'attack';
        zb.attackT = zb.def.attackEvery * 0.55;
        zb.swingT = 0;
        return;
      }
    }
    const dx = tx - zb.x;
    const dz = tz - zb.z;
    const len = Math.hypot(dx, dz) || 1;
    // Preko zida između traka idu sporije (penju se)
    const climbing = Math.abs(zb.x) < 0.55 && zb.z < MEDIAN_START_Z;
    const sp = zb.speed * (climbing ? 0.4 : 1) * (1 - Math.min(0.85, zb.knock * 0.7));
    const ax = (dx / len) * sp;
    const az = (dz / len) * sp;
    const k = Math.min(1, dt * 5);
    zb.vx += (ax - zb.vx) * k;
    zb.vz += (az - zb.vz) * k;
    zb.x += zb.vx * dt;
    zb.z += zb.vz * dt - zb.knock * dt * 4;
    zb.z = Math.min(zb.z, HERO_Z + 0.4);
    if (Math.abs(zb.vx) + Math.abs(zb.vz) > 0.05) zb.yaw = Math.atan2(-zb.vx, -zb.vz);
  }

  pose(zb, t) {
    const rig = this.rigs[zb.type];
    const i = rig.n++;
    const s = zb.scale;
    const moving = zb.state === 'walk' || zb.state === 'chase' || zb.state === 'enter';
    const freq = zb.type === 'runner' ? 12 : zb.type === 'walker' ? 6.5 : zb.type === 'bloater' ? 4.5 : 4;
    const ph = zb.phase + t * freq * (moving ? 1 : 0.25);
    const sw = Math.sin(ph);
    let pitch = -0.1 - (zb.type === 'runner' && moving ? 0.25 : 0) + zb.hitT * 0.45 + zb.knock * 0.2;
    let roll = Math.sin(ph * 0.5) * 0.12;
    let y = moving ? Math.abs(Math.cos(ph)) * 0.05 * s : 0;
    let sink = 0;
    if (zb.state === 'dying') {
      const k = Math.min(1, zb.deadT / 0.4);
      pitch = (1 - (1 - k) * (1 - k)) * (Math.PI / 2 - 0.1); // pada unazad
      roll = zb.flingY > 0 ? zb.deadT * 6 : 0;
      y = Math.sin(k * Math.PI) * 0.15 + zb.flingY;
      sink = zb.deadT > 1.1 ? (zb.deadT - 1.1) / 0.6 : 0;
    }
    // Penjanje preko zida između traka
    if (zb.alive && Math.abs(zb.x) < 0.55 && zb.z < MEDIAN_START_Z) y += (1 - Math.abs(zb.x) / 0.55) * 0.55;
    _e.set(pitch, zb.yaw, roll);
    _q.setFromEuler(_e);
    _root.compose(_p.set(zb.x, y - sink * 0.4 * s, zb.z), _q, _s.setScalar(s * (1 - sink * 0.4)));
    rig.body.setMatrixAt(i, _root);
    // Boja: bljesak kad je pogođen, narandžasto kad gori
    const f = 1 + zb.hitT * 2.2;
    const burn = zb.burnT > 0 ? 0.35 : 0;
    rig.body.setColorAt(i, _c.setRGB(f * zb.tint + burn, f * (zb.hitT > 0 ? 0.8 : 1) * zb.tint * (1 - burn * 0.5), f * zb.tint * (1 - burn)));
    _local.makeTranslation(zb.x, 0.02, zb.z);
    _local.elements[0] = _local.elements[10] = 0.8 * s * (1 - sink) * (1 - Math.min(0.6, zb.flingY * 0.3));
    rig.shadow.setMatrixAt(i, _local);

    const legA = moving ? sw * (zb.type === 'runner' ? 0.85 : 0.6) : 0;
    for (let side = 0; side < 2; side++) {
      _rot.makeRotationX(side ? legA : -legA);
      _local.makeTranslation((side ? 1 : -1) * 0.08, HIP_Y, 0).multiply(_rot);
      rig.legs.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
    }
    // Ruke ispružene napred; pri napadu udaraju, pri umiranju padaju
    let armBase = moving ? 1.45 : 0.9 + Math.sin(t * 2 + zb.phase) * 0.1;
    if (zb.state === 'attack') armBase = 1.2 + Math.sin(zb.swingT * 12) * 0.65;
    if (zb.state === 'dying') armBase = 2.4;
    for (let side = 0; side < 2; side++) {
      const wob = Math.sin(ph + side * 1.7) * 0.18;
      _rot.makeRotationX(armBase + wob);
      _local.makeTranslation((side ? 1 : -1) * 0.2, SHOULDER_Y, -0.08).multiply(_rot);
      rig.arms.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
    }
  }
}
