// Meci, sačme, rakete i plazma. Svaki projektil leti ka metu, pogađa ga i nanosi štetu.
// Sve se ponovo koristi (pooling).
import * as THREE from 'three';

const MAX = 420;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();

export class Projectiles {
  constructor(scene, effects) {
    this.effects = effects;
    this.list = [];
    // Svetle "linije" (meci, sačma, plazma)
    this.tracers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX,
    );
    this.tracers.setColorAt(0, _c.set(0xffffff));
    // Rakete
    const rocketGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8).rotateX(Math.PI / 2);
    this.rockets = new THREE.InstancedMesh(rocketGeo, new THREE.MeshLambertMaterial({ color: 0x55603f }), 40);
    [this.tracers, this.rockets].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    });
    this.tracers.renderOrder = 4;
  }

  // from = [x,y,z], target = objekat sa aimPoint(), w = oružje
  // Vraća false ako nema mesta za novi projektil
  fire(from, target, dmg, w, speedMul = 1, spread = 0) {
    if (this.list.length >= MAX) return false;
    const tp = target.aimPoint();
    let dx = tp[0] - from[0] + spread * (Math.random() - 0.5);
    const dy = tp[1] - from[1] + spread * 0.3 * (Math.random() - 0.5);
    const dz = tp[2] - from[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const speed = w.speed * speedMul;
    this.list.push({
      x: from[0], y: from[1], z: from[2],
      vx: (dx / len) * speed, vy: (dy / len) * speed, vz: (dz / len) * speed,
      target, dmg, w, life: len / speed + 0.05, age: 0,
    });
    if (w.kind === 'rocket') this.effects.smokePuff(from[0], from[1], from[2]);
    return true;
  }

  // onHit(projektil, meta) se poziva kad projektil stigne do mete
  update(dt, onHit) {
    let nt = 0;
    let nr = 0;
    const alive = [];
    for (const pr of this.list) {
      pr.age += dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      if (pr.age >= pr.life) {
        onHit(pr, pr.target);
        continue;
      }
      _d.set(pr.vx, pr.vy, pr.vz).normalize();
      _q.setFromUnitVectors(_z, _d);
      const w = pr.w;
      if (w.kind === 'rocket') {
        _m.compose(_p.set(pr.x, pr.y, pr.z), _q, _s.set(1, 1, 1));
        this.rockets.setMatrixAt(nr++, _m);
        if (Math.random() < 0.7) this.effects.rocketTrail(pr.x - _d.x * 0.25, pr.y, pr.z - _d.z * 0.25);
      } else {
        const len = w.kind === 'plasma' ? 1.2 : w.kind === 'heavy' ? 1.0 : w.kind === 'pellet' ? 0.45 : 0.8;
        _m.compose(_p.set(pr.x, pr.y, pr.z), _q, _s.set(w.width, w.width, len));
        this.tracers.setMatrixAt(nt, _m);
        this.tracers.setColorAt(nt++, _c.set(w.color));
      }
      alive.push(pr);
    }
    this.list = alive;
    this.tracers.count = nt;
    this.rockets.count = nr;
    this.tracers.instanceMatrix.needsUpdate = true;
    if (this.tracers.instanceColor) this.tracers.instanceColor.needsUpdate = true;
    this.rockets.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.tracers.count = 0;
    this.rockets.count = 0;
  }
}
