// Brojevi štete koji iskaču iznad pogođenih zombija (beli, žuti za kritičan pogodak, narandžasti za vatru).
// Svaka cifra (0-9) je jedan InstancedMesh, pa i stotine brojeva ne usporavaju igru.
import * as THREE from 'three';
import { textGeometry } from '../gfx/text3d.js';

const CAP = 90;
const LIFE = 0.75;
const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _qi = new THREE.Quaternion();

export class DamageNumbers {
  constructor(scene) {
    this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true });
    this.digits = [];
    for (let d = 0; d <= 9; d++) {
      const mesh = new THREE.InstancedMesh(textGeometry(String(d), 0.02), this.material, CAP);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, _c.set(0xffffff));
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.renderOrder = 20;
      scene.add(mesh);
      this.digits.push(mesh);
    }
    this.list = [];
  }

  spawn(x, y, z, value, color = 0xffffff, size = 0.34) {
    const text = String(Math.max(1, Math.round(value)));
    if (this.list.length > 40) this.list.shift();
    this.list.push({ x: x + (Math.random() - 0.5) * 0.4, y, z, text, color, size, age: 0 });
  }

  update(dt, camera) {
    const counts = new Array(10).fill(0);
    const alive = [];
    for (const n of this.list) {
      n.age += dt;
      if (n.age >= LIFE) continue;
      alive.push(n);
      const k = n.age / LIFE;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.7 : k > 0.7 ? 1.3 * (1 - (k - 0.7) / 0.3) : 1.3 - (k - 0.15) * 0.5;
      const sc = n.size * Math.max(0.01, pop);
      _m.compose(_p.set(n.x, n.y + k * 1.1, n.z), camera.quaternion, _s.set(sc, sc, sc));
      const adv = 0.62;
      const start = -((n.text.length - 1) * adv) / 2;
      _c.set(n.color);
      for (let i = 0; i < n.text.length; i++) {
        const d = n.text.charCodeAt(i) - 48;
        const mesh = this.digits[d];
        const idx = counts[d];
        if (idx >= CAP) continue;
        _local.compose(_p.set(start + i * adv, 0, 0), _qi, _s.set(1, 1, 1));
        mesh.setMatrixAt(idx, _local.premultiply(_m));
        mesh.setColorAt(idx, _c);
        counts[d] = idx + 1;
      }
    }
    this.list = alive;
    this.digits.forEach((mesh, d) => {
      mesh.count = counts[d];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  clear() {
    this.list = [];
    this.digits.forEach((m) => (m.count = 0));
  }
}
