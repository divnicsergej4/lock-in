// Svi vizuelni efekti na jednom mestu: eksplozije (bljesak, vatra, dim, krhotine, varnice, udarni talas,
// nagoreli trag na zemlji), bljesak puške, meci, varnice od pogotka, prašina, konfete.
// Sve se ponovo koristi (pooling) da bi igra radila glatko na telefonu.
import * as THREE from 'three';
import { ParticlePool } from './Particles.js';
import { shadowTexture } from './textures.js';

const MAX_DEBRIS = 400;
const MAX_TRACERS = 120;
const MAX_RINGS = 8;
const MAX_SCORCH = 12;
const GRAVITY = -16;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _dir = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const rnd = (a, b) => a + Math.random() * (b - a);

const C = {
  fire: new THREE.Color(1.0, 0.55, 0.15),
  fireHot: new THREE.Color(1.0, 0.85, 0.4),
  flash: new THREE.Color(1.0, 0.9, 0.6),
  spark: new THREE.Color(1.0, 0.75, 0.3),
  smokeDark: new THREE.Color(0x3b3a3d),
  smoke: new THREE.Color(0x6d6b6e),
  smokeLight: new THREE.Color(0xb9b4ad),
  dust: new THREE.Color(0xd8c9a8),
  muzzle: new THREE.Color(1.0, 0.8, 0.35),
};

export class Effects {
  constructor(scene, { quality, fog } = {}) {
    this.scene = scene;
    this.quality = quality || { particles: 1 };
    this.shake = 0; // Game čita i troši

    this.smoke = new ParticlePool(scene, { max: Math.round(320 * this.quality.particles), fog });
    this.glow = new ParticlePool(scene, { max: Math.round(320 * this.quality.particles), glow: true });

    // Krhotine i konfete (male kocke koje padaju i odskaču)
    this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_DEBRIS);
    this.debrisMesh.setColorAt(0, _c.set(0xffffff));
    this.prep(this.debrisMesh);
    this.debrisMesh.castShadow = true;
    this.debris = [];

    // Meci
    this.tracerMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.045, 0.045, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_TRACERS,
    );
    this.prep(this.tracerMesh);
    this.tracers = [];

    // Udarni talasi (prsten koji se širi po zemlji)
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      mesh.visible = false;
      mesh.renderOrder = 1;
      scene.add(mesh);
      this.rings.push({ mesh, age: 0, life: 0.5, size: 1, active: false });
    }

    // Nagoreli tragovi na zemlji posle eksplozije
    this.scorches = [];
    const scorchGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_SCORCH; i++) {
      const mesh = new THREE.Mesh(
        scorchGeo,
        new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x1a1410, transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.scorches.push({ mesh, age: 0, active: false });
    }
    this.scorchIndex = 0;
  }

  prep(mesh) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
  }

  // ---------- Eksplozija u više slojeva ----------
  explosion(x, y, z, scale = 1, { shake = 0.35, scorch = true } = {}) {
    const q = this.quality.particles;
    // 1) Jak bljesak
    this.glow.spawn({ x, y: y + 0.5 * scale, z, life: 0.16, size: 2.5 * scale, endSize: 4.2 * scale, color: C.flash, alpha: 1.6, fadeIn: 0 });
    // 2) Vatrene lopte koje se šire i dižu
    for (let i = 0; i < Math.round(9 * q); i++) {
      const a = Math.random() * 6.28;
      const sp = rnd(1.5, 4) * scale;
      this.glow.spawn({
        x: x + Math.cos(a) * 0.3 * scale, y: y + rnd(0.2, 0.8) * scale, z: z + Math.sin(a) * 0.3 * scale,
        vx: Math.cos(a) * sp, vy: rnd(1.5, 4) * scale, vz: Math.sin(a) * sp,
        life: rnd(0.35, 0.6), size: rnd(0.9, 1.5) * scale, endSize: rnd(1.6, 2.4) * scale,
        color: Math.random() < 0.5 ? C.fire : C.fireHot, alpha: 1.2, drag: 3, fadeIn: 0,
      });
    }
    // 3) Dim koji se širi i polako diže
    for (let i = 0; i < Math.round(10 * q); i++) {
      const a = Math.random() * 6.28;
      const sp = rnd(0.8, 2.6) * scale;
      this.smoke.spawn({
        x: x + Math.cos(a) * 0.4 * scale, y: y + rnd(0.3, 1.2) * scale, z: z + Math.sin(a) * 0.4 * scale,
        vx: Math.cos(a) * sp, vy: rnd(0.8, 2.2), vz: Math.sin(a) * sp,
        life: rnd(1.4, 2.4), size: rnd(1.0, 1.6) * scale, endSize: rnd(2.6, 3.8) * scale,
        color: Math.random() < 0.5 ? C.smokeDark : C.smoke, alpha: 0.85, drag: 1.6, gravity: 0.6, fadeIn: 0.12,
      });
    }
    // 4) Varnice
    for (let i = 0; i < Math.round(14 * q); i++) {
      const a = Math.random() * 6.28;
      const sp = rnd(4, 9) * scale;
      this.glow.spawn({
        x, y: y + 0.5, z, vx: Math.cos(a) * sp, vy: rnd(3, 8), vz: Math.sin(a) * sp,
        life: rnd(0.4, 0.8), size: 0.16 * scale, endSize: 0.05, color: C.spark, alpha: 1.5, gravity: GRAVITY * 0.8, drag: 1, fadeIn: 0,
      });
    }
    // 5) Krhotine
    const dcol = [0x3a3532, 0x6b5a48, 0x8a8a84, 0x2a2624];
    for (let i = 0; i < Math.round(10 * q); i++) this.burst(x, y + 0.4, z, dcol[i % 4], 1, 1.4 * scale, { size: rnd(0.8, 1.6) });
    // 6) Udarni talas
    this.ring(x, z, 5 * scale);
    // 7) Trag na zemlji
    if (scorch) this.scorch(x, z, 2.6 * scale);
    this.shake = Math.max(this.shake, shake * scale);
  }

  ring(x, z, size) {
    const r = this.rings.find((it) => !it.active) || this.rings[0];
    r.active = true;
    r.age = 0;
    r.size = size;
    r.mesh.position.set(x, 0.08, z);
    r.mesh.visible = true;
  }

  scorch(x, z, size) {
    const s = this.scorches[this.scorchIndex++ % MAX_SCORCH];
    s.active = true;
    s.age = 0;
    s.mesh.position.set(x, 0.025, z);
    s.mesh.scale.set(size, 1, size);
    s.mesh.rotation.y = Math.random() * 6;
    s.mesh.visible = true;
  }

  // ---------- Manji efekti ----------
  muzzle(x, y, z, dirZ) {
    this.glow.spawn({ x, y, z, life: 0.07, size: 0.42, endSize: 0.2, color: C.muzzle, alpha: 1.6, fadeIn: 0 });
    this.glow.spawn({ x, y, z: z + dirZ * 0.15, life: 0.05, size: 0.25, endSize: 0.1, color: C.flash, alpha: 1.2, fadeIn: 0 });
  }

  impact(x, y, z) {
    for (let i = 0; i < 3; i++) {
      this.glow.spawn({
        x, y, z, vx: rnd(-3, 3), vy: rnd(1, 4), vz: rnd(-3, 3),
        life: rnd(0.15, 0.3), size: 0.1, endSize: 0.03, color: C.spark, alpha: 1.4, gravity: GRAVITY, fadeIn: 0,
      });
    }
    if (Math.random() < 0.5) {
      this.smoke.spawn({ x, y: y - 0.2, z, vy: 0.6, life: 0.5, size: 0.3, endSize: 0.8, color: C.smokeLight, alpha: 0.45, fadeIn: 0.1 });
    }
  }

  dust(x, z, strength = 1) {
    this.smoke.spawn({
      x: x + rnd(-0.15, 0.15), y: 0.12, z: z + rnd(0, 0.2), vx: rnd(-0.4, 0.4), vy: rnd(0.2, 0.6), vz: rnd(0.5, 1.5),
      life: rnd(0.5, 0.9), size: 0.25 * strength, endSize: 0.9 * strength, color: C.dust, alpha: 0.35, drag: 2, fadeIn: 0.15,
    });
  }

  // Stalni dim (npr. iz zapaljenog tenka)
  smokeColumn(x, y, z) {
    this.smoke.spawn({
      x: x + rnd(-0.2, 0.2), y, z: z + rnd(-0.2, 0.2), vx: rnd(-0.2, 0.3), vy: rnd(1.2, 1.9), vz: rnd(0.2, 0.5),
      life: rnd(2.2, 3.2), size: rnd(0.5, 0.8), endSize: rnd(2.2, 3), color: Math.random() < 0.6 ? C.smokeDark : C.smoke, alpha: 0.6, drag: 0.4, fadeIn: 0.15,
    });
  }

  flame(x, y, z) {
    this.glow.spawn({
      x: x + rnd(-0.25, 0.25), y, z: z + rnd(-0.25, 0.25), vx: rnd(-0.2, 0.2), vy: rnd(1.2, 2.2), vz: rnd(-0.2, 0.2),
      life: rnd(0.35, 0.6), size: rnd(0.45, 0.7), endSize: 0.1, color: Math.random() < 0.5 ? C.fire : C.fireHot, alpha: 1, drag: 1, fadeIn: 0.1,
    });
  }

  // Čestice koje svetlucaju kroz vazduh (atmosfera)
  ambient(x, z) {
    this.glow.spawn({
      x: x + rnd(-10, 10), y: rnd(0.8, 4), z: z + rnd(-20, 6), vx: rnd(-0.2, 0.2), vy: rnd(0.05, 0.2), vz: rnd(-0.2, 0.2),
      life: rnd(2.5, 4), size: 0.07, endSize: 0.07, color: C.fireHot, alpha: 0.35, fadeIn: 0.3,
    });
  }

  // Komadići (kocke) koji lete i odskaču
  burst(x, y, z, color, amount = 4, power = 1, opts = {}) {
    for (let i = 0; i < amount; i++) {
      if (this.debris.length >= MAX_DEBRIS) this.debris.shift();
      this.debris.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 6 * power,
        vy: (2 + Math.random() * 5) * power,
        vz: (Math.random() - 0.5) * 6 * power,
        rot: Math.random() * 6,
        life: (opts.life || 0.7) + Math.random() * 0.4,
        age: 0,
        size: (opts.size || 1) * (0.7 + Math.random() * 0.8),
        gravity: opts.gravity ?? GRAVITY,
        color,
      });
    }
  }

  confetti(x, z, amount = 80) {
    const colors = [0xffc934, 0x2f7bff, 0xff5fa2, 0x5ce07a, 0xffffff, 0xff8a3d];
    for (let i = 0; i < amount; i++) {
      this.burst(x + rnd(-4, 4), rnd(3, 6), z + rnd(-3, 3), colors[i % colors.length], 1, 1.4, { life: 2.2, gravity: -5, size: 0.9 });
    }
  }

  shoot(from, to) {
    if (!from || !to) return;
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    this.tracers.push({ from, dir: [dx / len, dy / len, dz / len], len, age: 0, speed: 40 });
    this.muzzle(from[0], from[1], from[2], dz / len);
  }

  update(dt) {
    this.smoke.update(dt);
    this.glow.update(dt);

    // Krhotine
    let n = 0;
    const alive = [];
    for (const p of this.debris) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy *= -0.3;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      p.z += p.vz * dt;
      p.rot += dt * 8;
      const k = Math.min(1, (1 - p.age / p.life) * 3);
      _e.set(p.rot, p.rot * 0.7, 0);
      _q.setFromEuler(_e);
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.setScalar(p.size * k));
      this.debrisMesh.setMatrixAt(n, _m);
      this.debrisMesh.setColorAt(n, _c.set(p.color));
      n++;
      alive.push(p);
    }
    this.debris = alive;
    this.debrisMesh.count = n;
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;

    // Meci
    n = 0;
    const tAlive = [];
    for (const tr of this.tracers) {
      tr.age += dt;
      const dist = tr.age * tr.speed;
      if (dist >= tr.len) {
        this.impact(tr.from[0] + tr.dir[0] * tr.len, tr.from[1] + tr.dir[1] * tr.len, tr.from[2] + tr.dir[2] * tr.len);
        continue;
      }
      const segLen = Math.min(0.9, tr.len - dist);
      const c = dist + segLen / 2;
      _p.set(tr.from[0] + tr.dir[0] * c, tr.from[1] + tr.dir[1] * c, tr.from[2] + tr.dir[2] * c);
      _q.setFromUnitVectors(_z, _dir.set(tr.dir[0], tr.dir[1], tr.dir[2]));
      _m.compose(_p, _q, _s.set(1, 1, segLen));
      this.tracerMesh.setMatrixAt(n++, _m);
      tAlive.push(tr);
    }
    this.tracers = tAlive;
    this.tracerMesh.count = n;
    this.tracerMesh.instanceMatrix.needsUpdate = true;

    // Udarni talasi
    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const s = 0.3 + r.size * (1 - (1 - t) * (1 - t));
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = 0.75 * (1 - t);
    }

    // Tragovi na zemlji polako nestaju
    for (const s of this.scorches) {
      if (!s.active) continue;
      s.age += dt;
      const o = s.age < 0.2 ? s.age / 0.2 : Math.max(0, 1 - (s.age - 5) / 3);
      s.mesh.material.opacity = 0.7 * o;
      if (s.age > 8) {
        s.active = false;
        s.mesh.visible = false;
      }
    }
  }

  clear() {
    this.smoke.clear();
    this.glow.clear();
    this.debris = [];
    this.tracers = [];
    this.debrisMesh.count = 0;
    this.tracerMesh.count = 0;
    this.rings.forEach((r) => {
      r.active = false;
      r.mesh.visible = false;
    });
    this.scorches.forEach((s) => {
      s.active = false;
      s.mesh.visible = false;
    });
    this.shake = 0;
  }
}
