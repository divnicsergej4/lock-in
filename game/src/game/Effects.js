// Efekti: komadići koji lete, meci (svetle linije) u borbi, bljesak puške i konfete za pobedu.
import * as THREE from 'three';

const MAX_PARTS = 500;
const MAX_TRACERS = 120;
const GRAVITY = -16;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _dir = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);

export class Effects {
  constructor(scene) {
    this.scene = scene;

    // Komadići (kockice)
    this.partMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      MAX_PARTS,
    );
    this.partMesh.setColorAt(0, _c.set(0xffffff));
    this.prep(this.partMesh);
    this.parts = [];

    // Meci: izdužene svetle kockice
    this.tracerMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.05, 0.05, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_TRACERS,
    );
    this.prep(this.tracerMesh);
    this.tracers = [];

    // Bljesak cevi i udarci: svetle kuglice
    this.flashMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_TRACERS * 2,
    );
    this.prep(this.flashMesh);
    this.flashes = [];
  }

  prep(mesh) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
  }

  burst(x, y, z, color, amount = 4, power = 1, opts = {}) {
    for (let i = 0; i < amount; i++) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      this.parts.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 6 * power,
        vy: (2 + Math.random() * 5) * power,
        vz: (Math.random() - 0.5) * 6 * power,
        rot: Math.random() * 6,
        life: (opts.life || 0.6) + Math.random() * 0.4,
        age: 0,
        size: (opts.size || 1) * (0.7 + Math.random() * 0.8),
        gravity: opts.gravity ?? GRAVITY,
        color,
      });
    }
  }

  // Konfete za pobedu: padaju polako i vrte se
  confetti(x, z, amount = 80) {
    const colors = [0xffc934, 0x2f7bff, 0xff5fa2, 0x5ce07a, 0xffffff, 0xff8a3d];
    for (let i = 0; i < amount; i++) {
      this.burst(
        x + (Math.random() - 0.5) * 8,
        3 + Math.random() * 3,
        z + (Math.random() - 0.5) * 6,
        colors[i % colors.length],
        1,
        1.4,
        { life: 2.2, gravity: -5, size: 0.9 },
      );
    }
  }

  shoot(from, to) {
    if (!from || !to) return;
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    this.tracers.push({ from, dir: [dx / len, dy / len, dz / len], len, age: 0, speed: 38 });
    this.flash(from[0], from[1], from[2], 0.9);
  }

  flash(x, y, z, size = 1) {
    if (this.flashes.length >= MAX_TRACERS * 2) this.flashes.shift();
    this.flashes.push({ x, y, z, size, age: 0, life: 0.09 });
  }

  update(dt) {
    // Komadići
    let n = 0;
    const alive = [];
    for (const p of this.parts) {
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
      _p.set(p.x, p.y, p.z);
      _s.setScalar(p.size * k);
      _m.compose(_p, _q, _s);
      this.partMesh.setMatrixAt(n, _m);
      this.partMesh.setColorAt(n, _c.set(p.color));
      n++;
      alive.push(p);
    }
    this.parts = alive;
    this.partMesh.count = n;
    this.partMesh.instanceMatrix.needsUpdate = true;
    if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true;

    // Meci
    n = 0;
    const tAlive = [];
    for (const tr of this.tracers) {
      tr.age += dt;
      const dist = tr.age * tr.speed;
      if (dist >= tr.len) {
        this.flash(tr.from[0] + tr.dir[0] * tr.len, tr.from[1] + tr.dir[1] * tr.len, tr.from[2] + tr.dir[2] * tr.len, 1.3);
        continue;
      }
      const segLen = Math.min(0.9, tr.len - dist);
      _p.set(tr.from[0] + tr.dir[0] * (dist + segLen / 2), tr.from[1] + tr.dir[1] * (dist + segLen / 2), tr.from[2] + tr.dir[2] * (dist + segLen / 2));
      _dir.set(tr.dir[0], tr.dir[1], tr.dir[2]);
      _q.setFromUnitVectors(_z, _dir);
      _s.set(1, 1, segLen);
      _m.compose(_p, _q, _s);
      this.tracerMesh.setMatrixAt(n++, _m);
      tAlive.push(tr);
    }
    this.tracers = tAlive;
    this.tracerMesh.count = n;
    this.tracerMesh.instanceMatrix.needsUpdate = true;

    // Bljeskovi
    n = 0;
    const fAlive = [];
    for (const f of this.flashes) {
      f.age += dt;
      if (f.age >= f.life) continue;
      const k = 1 - f.age / f.life;
      _q.identity();
      _p.set(f.x, f.y, f.z);
      _s.setScalar(f.size * (0.6 + k));
      _m.compose(_p, _q, _s);
      this.flashMesh.setMatrixAt(n++, _m);
      fAlive.push(f);
    }
    this.flashes = fAlive;
    this.flashMesh.count = n;
    this.flashMesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.parts = [];
    this.tracers = [];
    this.flashes = [];
    this.partMesh.count = 0;
    this.tracerMesh.count = 0;
    this.flashMesh.count = 0;
  }
}
