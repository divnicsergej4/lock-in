// Efekti: kockice koje lete kad vojnik padne ili kad prođeš kroz kapiju.
import * as THREE from 'three';

const MAX = 400;
const GRAVITY = -16;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // Svaka kockica ima svoju boju.
    this.mesh.setColorAt(0, _c.set(0xffffff));
    scene.add(this.mesh);
    this.parts = [];
  }

  burst(x, y, z, color, amount = 4, power = 1) {
    for (let i = 0; i < amount; i++) {
      if (this.parts.length >= MAX) this.parts.shift();
      this.parts.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 6 * power,
        vy: (2 + Math.random() * 5) * power,
        vz: (Math.random() - 0.5) * 6 * power,
        rot: Math.random() * 6,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        size: 0.7 + Math.random() * 0.8,
        color,
      });
    }
  }

  update(dt) {
    let n = 0;
    const alive = [];
    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rot += dt * 8;
      const k = 1 - p.age / p.life;
      _e.set(p.rot, p.rot * 0.7, 0);
      _q.setFromEuler(_e);
      _p.set(p.x, p.y, p.z);
      _s.setScalar(p.size * k);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, _c.set(p.color));
      n++;
      alive.push(p);
    }
    this.parts = alive;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.parts = [];
    this.mesh.count = 0;
  }
}
