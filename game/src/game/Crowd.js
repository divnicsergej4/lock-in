// Vojska: gomila vojnika koja se kreće zajedno, raste, smanjuje se i trči.
// Svaki vojnik ima telo, glavu, šlem, ranac, pušku, dve noge i dve ruke koje se pomeraju dok trči.
// Svi vojnici se crtaju odjednom ("instancing"), pa i 160 vojnika radi glatko na telefonu.
import * as THREE from 'three';
import { COLORS, MAX_RENDERED, SPIRAL, ROAD_HALF } from './config.js';
import { CountLabel } from './text3d.js';
import { shadowTexture } from './textures.js';

function shared(g) {
  g.userData.shared = true;
  return g;
}

// Oblici delova tela (vojnik gleda ka -z)
const GEO = {
  torso: shared(new THREE.CapsuleGeometry(0.15, 0.16, 2, 8)),
  head: shared(new THREE.SphereGeometry(0.13, 9, 6)),
  helmet: shared(new THREE.SphereGeometry(0.15, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2)),
  pack: shared(new THREE.BoxGeometry(0.22, 0.24, 0.12)),
  gun: shared(new THREE.BoxGeometry(0.06, 0.09, 0.5)),
  // Noge i ruke su pomerene tako da se okreću oko kuka/ramena
  leg: shared(new THREE.BoxGeometry(0.1, 0.34, 0.11).translate(0, -0.17, 0)),
  arm: shared(new THREE.BoxGeometry(0.08, 0.28, 0.09).translate(0, -0.14, 0)),
  shadow: shared(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2)),
};

const TEAM = {
  blue: { body: COLORS.blue, pants: 0x1b3f96, helmet: 0x2456c9, pack: 0x1d3f7a },
  red: { body: COLORS.red, pants: 0x8e1d22, helmet: 0xc62c33, pack: 0x7a1d22 },
};

const materialCache = new Map();
function mat(color) {
  if (!materialCache.has(color)) {
    const m = new THREE.MeshLambertMaterial({ color });
    m.userData.shared = true;
    materialCache.set(color, m);
  }
  return materialCache.get(color);
}
let shadowMat;
function getShadowMat() {
  if (!shadowMat) {
    shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x10233a, transparent: true, opacity: 0.38, depthWrite: false });
    shadowMat.userData.shared = true;
  }
  return shadowMat;
}

// Fiksni položaji delova u odnosu na vojnika
const LOCAL = {
  torso: new THREE.Matrix4().makeTranslation(0, 0.56, 0),
  head: new THREE.Matrix4().makeTranslation(0, 0.92, 0),
  helmet: new THREE.Matrix4().makeTranslation(0, 0.95, 0),
  pack: new THREE.Matrix4().makeTranslation(0, 0.6, 0.17),
  gun: new THREE.Matrix4().makeTranslation(0.07, 0.64, -0.3),
};
const HIP_Y = 0.36;
const SHOULDER_Y = 0.73;

const GOLDEN = 2.399963;
const _root = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export class Crowd {
  constructor(scene, { team = 'blue', count = 1, x = 0, z = 0, formation = 'blob' } = {}) {
    this.scene = scene;
    this.team = team;
    this.yaw = team === 'blue' ? 0 : Math.PI;
    this.formation = formation;
    this.x = x;
    this.z = z;
    this.count = count;
    this.moving = false;
    this.cheer = false;
    this.aim = false; // u borbi: puške napred
    this.lean = 0;

    const c = TEAM[team];
    const N = MAX_RENDERED;
    const make = (geo, material, cap = N) => {
      const m = new THREE.InstancedMesh(geo, material, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.shadow = make(GEO.shadow, getShadowMat());
    this.shadow.renderOrder = -1;
    this.torso = make(GEO.torso, mat(c.body));
    this.head = make(GEO.head, mat(COLORS.skin));
    this.helmet = make(GEO.helmet, mat(c.helmet));
    this.pack = make(GEO.pack, mat(c.pack));
    this.gun = make(GEO.gun, mat(COLORS.gun));
    this.legs = make(GEO.leg, mat(c.pants), N * 2);
    this.arms = make(GEO.arm, mat(c.body), N * 2);
    this.meshes = [this.shadow, this.torso, this.head, this.helmet, this.pack, this.gun, this.legs, this.arms];

    this.ox = new Float32Array(N);
    this.oz = new Float32Array(N);
    this.phase = new Float32Array(N);
    for (let i = 0; i < N; i++) this.phase[i] = Math.random() * Math.PI * 2;
    this.rendered = 0;
    this.syncRendered(true);

    this.label = new CountLabel(team === 'blue' ? 0x1f5fe0 : 0xd8323a);
    this.label.group.scale.setScalar(0.62);
    scene.add(this.label.group);
    this.labelPop = 0;
  }

  syncRendered(instant = false) {
    const target = Math.min(this.count, MAX_RENDERED);
    for (let i = this.rendered; i < target; i++) {
      if (instant) {
        const [sx, sz] = this.slot(i, target);
        this.ox[i] = sx;
        this.oz[i] = sz;
      } else {
        this.ox[i] = (Math.random() - 0.5) * 0.4;
        this.oz[i] = (Math.random() - 0.5) * 0.4;
      }
    }
    this.rendered = target;
  }

  setCount(n) {
    const before = this.count;
    this.count = Math.max(0, Math.round(n));
    if (this.count !== before) this.labelPop = 1;
    this.syncRendered(false);
  }

  // Ubija k vojnika i vraća gde su stajali (za efekte).
  kill(k) {
    const before = this.rendered;
    this.count = Math.max(0, this.count - k);
    const after = Math.min(this.count, MAX_RENDERED);
    const spots = [];
    for (let i = after; i < before; i++) spots.push([this.x + this.ox[i], 0.5, this.z + this.oz[i]]);
    this.rendered = after;
    return spots;
  }

  // Nasumičan vojnik iz prvih redova (za pucanje)
  frontSoldier(towardZ) {
    const n = this.rendered;
    if (!n) return null;
    let best = 0;
    let bestD = Infinity;
    for (let t = 0; t < 4; t++) {
      const i = Math.floor(Math.random() * n);
      const d = Math.abs(this.z + this.oz[i] - towardZ);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return [this.x + this.ox[best], 0.66, this.z + this.oz[best]];
  }

  slot(i, n) {
    if (this.formation === 'block') {
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
      const rows = Math.ceil(n / cols);
      const c = i % cols;
      const r = Math.floor(i / cols);
      const sp = 0.55;
      return [(c - (cols - 1) / 2) * sp + (r % 2) * 0.12, -(r - (rows - 1) / 2) * sp];
    }
    const r = SPIRAL * Math.sqrt(i + 0.35);
    const a = i * GOLDEN;
    let sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r * 0.9;
    const maxR = this.radius();
    const allowed = ROAD_HALF - 0.35;
    if (maxR > allowed) sx *= allowed / maxR;
    return [sx, sz];
  }

  radius() {
    const n = Math.max(1, Math.min(this.count, MAX_RENDERED));
    if (this.formation === 'block') {
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
      return (cols * 0.55) / 2;
    }
    return SPIRAL * Math.sqrt(n) + 0.25;
  }

  depth() {
    if (this.formation === 'block') {
      const n = Math.max(1, Math.min(this.count, MAX_RENDERED));
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
      return (Math.ceil(n / cols) * 0.55) / 2 + 0.2;
    }
    return Math.min(this.radius(), SPIRAL * Math.sqrt(MAX_RENDERED)) * 0.9;
  }

  update(dt, t) {
    const n = this.rendered;
    const k = 1 - Math.exp(-dt * 9);
    const run = this.moving ? 1 : 0;
    const speed = this.aim ? 9 : 13;
    for (let i = 0; i < n; i++) {
      const [sx, sz] = this.slot(i, n);
      this.ox[i] += (sx - this.ox[i]) * k;
      this.oz[i] += (sz - this.oz[i]) * k;
      const ph = this.phase[i] + t * speed;
      const s = Math.sin(ph);
      let bob = run * Math.abs(Math.cos(ph)) * 0.08;
      let jump = 0;
      if (this.cheer) jump = Math.max(0, Math.sin(this.phase[i] + t * 8)) * 0.4;
      const wx = this.x + this.ox[i];
      const wz = this.z + this.oz[i];

      // Ceo vojnik: položaj, okret, nagib napred dok trči i nagib pri skretanju
      _e.set(-run * 0.12, this.yaw + run * s * 0.08, this.lean);
      _q.setFromEuler(_e);
      _p.set(wx, bob + jump, wz);
      _root.compose(_p, _q, _s);

      this.shadow.setMatrixAt(i, _local.makeTranslation(wx, 0.02, wz));
      this.torso.setMatrixAt(i, _out.multiplyMatrices(_root, LOCAL.torso));
      this.head.setMatrixAt(i, _out.multiplyMatrices(_root, LOCAL.head));
      this.helmet.setMatrixAt(i, _out.multiplyMatrices(_root, LOCAL.helmet));
      this.pack.setMatrixAt(i, _out.multiplyMatrices(_root, LOCAL.pack));

      // Noge: mašu napred-nazad suprotno jedna drugoj
      const legA = run * s * 0.75;
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        _rot.makeRotationX(side ? legA : -legA);
        _local.makeTranslation(sign * 0.075, HIP_Y, 0).multiply(_rot);
        this.legs.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
      }

      // Ruke drže pušku napred; kad se slavi, ruke idu gore
      let armA = 1.15 + run * s * 0.12;
      if (this.cheer) armA = 2.7 + Math.sin(t * 10 + this.phase[i]) * 0.3;
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        _rot.makeRotationX(armA + (side ? 0.15 : 0));
        _local.makeTranslation(sign * 0.19, SHOULDER_Y, 0).multiply(_rot);
        this.arms.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
      }

      if (this.cheer) {
        _local.makeTranslation(0.07, 1.25, 0);
        this.gun.setMatrixAt(i, _out.multiplyMatrices(_root, _local).multiply(_rot.makeRotationX(Math.PI / 2)));
      } else {
        this.gun.setMatrixAt(i, _out.multiplyMatrices(_root, LOCAL.gun));
      }
    }
    for (const m of this.meshes) {
      m.count = m === this.legs || m === this.arms ? n * 2 : n;
      m.instanceMatrix.needsUpdate = true;
    }

    // Broj iznad vojske, malo "skoči" kad se promeni
    this.label.set(this.count);
    this.labelPop = Math.max(0, this.labelPop - dt * 4);
    const pop = 0.62 * (1 + this.labelPop * 0.35);
    this.label.group.scale.setScalar(pop);
    this.label.group.visible = this.count > 0;
    this.label.group.position.set(this.x, 1.9 + Math.min(this.radius(), 3) * 0.12, this.z);
    this.label.group.rotation.x = -0.5;
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
