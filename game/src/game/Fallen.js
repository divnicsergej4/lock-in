// Animacija umiranja: vojnik odleti malo unazad, padne na leđa, poleži i polako utone u zemlju.
import * as THREE from 'three';
import { fallenSoldier } from './models.js';

const MAX = 90;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

let sharedMat;
function material() {
  if (!sharedMat) {
    sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    sharedMat.userData.shared = true;
  }
  return sharedMat;
}

export class Fallen {
  constructor(scene, team) {
    this.mesh = new THREE.InstancedMesh(fallenSoldier(team), material(), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.list = [];
  }

  // yaw = u kom pravcu je vojnik gledao; pada unazad
  add(x, z, yaw, scale = 1) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      x, z, yaw: yaw + (Math.random() - 0.5) * 0.8, scale,
      age: 0,
      push: 0.6 + Math.random() * 0.8,
      side: (Math.random() - 0.5) * 0.6,
      life: 1.6 + Math.random() * 0.5,
    });
  }

  update(dt) {
    let n = 0;
    const alive = [];
    for (const f of this.list) {
      f.age += dt;
      if (f.age >= f.life) continue;
      const t = Math.min(1, f.age / 0.38);
      const ease = 1 - (1 - t) * (1 - t);
      // pad unazad (+ okret oko x) uz mali skok
      const fall = ease * (Math.PI / 2 - 0.08);
      const hop = Math.sin(t * Math.PI) * 0.35;
      const back = ease * f.push;
      const sink = f.age > f.life - 0.6 ? (f.age - (f.life - 0.6)) / 0.6 : 0;
      const bx = Math.sin(f.yaw) * back;
      const bz = Math.cos(f.yaw) * back;
      _e.set(fall, f.yaw, f.side * ease);
      _q.setFromEuler(_e);
      _p.set(f.x + bx, hop - sink * 0.35 + 0.02, f.z + bz);
      _s.setScalar(f.scale * (1 - sink * 0.5));
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(n++, _m);
      alive.push(f);
    }
    this.list = alive;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.mesh.count = 0;
  }
}
