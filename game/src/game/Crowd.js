// Vojska: gomila vojnika koja se kreće zajedno, raste, smanjuje se i trči.
// Svi vojnici se crtaju odjednom ("instancing"), pa i 160 vojnika radi glatko na telefonu.
import * as THREE from 'three';
import { COLORS, MAX_RENDERED, SPIRAL, ROAD_HALF } from './config.js';
import { CountLabel } from './pixelText.js';

const GEO = {
  body: new THREE.CapsuleGeometry(0.17, 0.26, 3, 8),
  head: new THREE.SphereGeometry(0.14, 10, 8),
  helmet: new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  gun: new THREE.BoxGeometry(0.07, 0.07, 0.42),
};
Object.values(GEO).forEach((g) => (g.userData.shared = true));

const materialCache = new Map();
function mat(color) {
  if (!materialCache.has(color)) {
    const m = new THREE.MeshLambertMaterial({ color });
    m.userData.shared = true;
    materialCache.set(color, m);
  }
  return materialCache.get(color);
}

const GOLDEN = 2.399963;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export class Crowd {
  constructor(scene, { team = 'blue', count = 1, x = 0, z = 0, formation = 'blob' } = {}) {
    this.scene = scene;
    this.team = team;
    this.facing = team === 'blue' ? Math.PI : 0; // plavi gledaju napred (-z), crveni ka igraču
    this.formation = formation;
    this.x = x;
    this.z = z;
    this.count = count;
    this.moving = false;
    this.cheer = false;
    this.lean = 0; // nagib pri skretanju

    const main = team === 'blue' ? COLORS.blue : COLORS.red;
    const dark = team === 'blue' ? COLORS.blueDark : COLORS.redDark;
    this.meshes = [
      new THREE.InstancedMesh(GEO.body, mat(main), MAX_RENDERED),
      new THREE.InstancedMesh(GEO.head, mat(COLORS.skin), MAX_RENDERED),
      new THREE.InstancedMesh(GEO.helmet, mat(dark), MAX_RENDERED),
      new THREE.InstancedMesh(GEO.gun, mat(COLORS.gun), MAX_RENDERED),
    ];
    this.meshes.forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    });

    // Trenutni položaj svakog vojnika u odnosu na sredinu vojske.
    this.ox = new Float32Array(MAX_RENDERED);
    this.oz = new Float32Array(MAX_RENDERED);
    this.phase = new Float32Array(MAX_RENDERED);
    for (let i = 0; i < MAX_RENDERED; i++) this.phase[i] = Math.random() * Math.PI * 2;
    this.rendered = 0;
    this.syncRendered(true);

    this.label = new CountLabel(team === 'blue' ? COLORS.blueDark : COLORS.redDark);
    this.label.group.scale.setScalar(0.62);
    scene.add(this.label.group);
  }

  // Koliko vojnika zapravo crtamo (najviše MAX_RENDERED).
  syncRendered(instant = false) {
    const target = Math.min(this.count, MAX_RENDERED);
    for (let i = this.rendered; i < target; i++) {
      if (instant) {
        const [sx, sz] = this.slot(i, target);
        this.ox[i] = sx;
        this.oz[i] = sz;
      } else {
        // Novi vojnici izlaze iz sredine vojske i raštrkaju se.
        this.ox[i] = (Math.random() - 0.5) * 0.4;
        this.oz[i] = (Math.random() - 0.5) * 0.4;
      }
    }
    this.rendered = target;
  }

  setCount(n) {
    this.count = Math.max(0, Math.round(n));
    this.syncRendered(false);
  }

  // Ubija k vojnika i vraća gde su stajali (za efekat eksplozije).
  kill(k) {
    const before = this.rendered;
    this.count = Math.max(0, this.count - k);
    const after = Math.min(this.count, MAX_RENDERED);
    const spots = [];
    for (let i = after; i < before; i++) {
      spots.push([this.x + this.ox[i], 0.4, this.z + this.oz[i]]);
    }
    this.rendered = after;
    return spots;
  }

  slot(i, n) {
    if (this.formation === 'block') {
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
      const rows = Math.ceil(n / cols);
      const c = i % cols;
      const r = Math.floor(i / cols);
      const sp = 0.52;
      return [(c - (cols - 1) / 2) * sp, (r - (rows - 1) / 2) * sp * -1];
    }
    const r = SPIRAL * Math.sqrt(i + 0.35);
    const a = i * GOLDEN;
    let sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r * 0.9;
    // Ako je vojska šira od puta, malo je "stisnemo" sa strane.
    const maxR = this.radius();
    const allowed = ROAD_HALF - 0.35;
    if (maxR > allowed) sx *= allowed / maxR;
    return [sx, sz];
  }

  radius() {
    const n = Math.max(1, Math.min(this.count, MAX_RENDERED));
    if (this.formation === 'block') {
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
      return (cols * 0.52) / 2;
    }
    return SPIRAL * Math.sqrt(n) + 0.25;
  }

  // Dubina vojske napred-nazad (za sudar sa neprijateljem).
  depth() {
    if (this.formation === 'block') {
      const n = Math.max(1, Math.min(this.count, MAX_RENDERED));
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
      return (Math.ceil(n / cols) * 0.52) / 2 + 0.2;
    }
    return Math.min(this.radius(), SPIRAL * Math.sqrt(MAX_RENDERED)) * 0.9;
  }

  update(dt, t) {
    const n = this.rendered;
    const k = 1 - Math.exp(-dt * 9);
    const [body, head, helmet, gun] = this.meshes;
    const run = this.moving ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const [sx, sz] = this.slot(i, n);
      this.ox[i] += (sx - this.ox[i]) * k;
      this.oz[i] += (sz - this.oz[i]) * k;
      const ph = this.phase[i] + t * 13;
      let bob = run * Math.abs(Math.sin(ph)) * 0.12;
      if (this.cheer) bob = Math.max(0, Math.sin(this.phase[i] + t * 9)) * 0.45;
      const wx = this.x + this.ox[i];
      const wz = this.z + this.oz[i];
      const sway = run * Math.sin(ph) * 0.12;
      _e.set(run * 0.18 * (this.team === 'blue' ? 1 : -1), this.facing + sway * 0.6, this.lean + sway * 0.3);
      _q.setFromEuler(_e);

      _p.set(wx, 0.38 + bob, wz);
      _m.compose(_p, _q, _s);
      body.setMatrixAt(i, _m);

      _p.set(wx, 0.78 + bob, wz);
      _m.compose(_p, _q, _s);
      head.setMatrixAt(i, _m);
      _p.y += 0.02;
      _m.compose(_p, _q, _s);
      helmet.setMatrixAt(i, _m);

      // Puška ispred vojnika, u pravcu u kom gleda.
      const dir = this.team === 'blue' ? -1 : 1;
      _p.set(wx + 0.12, 0.5 + bob, wz + dir * 0.18);
      _m.compose(_p, _q, _s);
      gun.setMatrixAt(i, _m);
    }
    this.meshes.forEach((m) => {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    });

    this.label.set(this.count);
    this.label.group.visible = this.count > 0;
    this.label.group.position.set(this.x, 1.75 + Math.min(this.radius(), 3) * 0.12, this.z - (this.team === 'blue' ? 0 : 0.3));
    this.label.group.rotation.x = -0.45;
  }

  dispose() {
    this.meshes.forEach((m) => {
      this.scene.remove(m);
      m.dispose();
    });
    this.scene.remove(this.label.group);
    this.label.dispose();
  }
}
