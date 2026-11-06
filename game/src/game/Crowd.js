// Vojska: gomila vojnika koja se kreće zajedno, raste, smanjuje se, trči, puca i slavi.
// Animacije: stajanje (disanje), trčanje, nišanjenje, trzaj puške, pogodak, slavlje,
// sa glatkim prelazima. Svaki vojnik je malo drugačiji (veličina, brzina, ritam), da ne liče na robote.
// Svi vojnici se crtaju odjednom ("instancing"), pa i 160 vojnika radi glatko na telefonu.
import * as THREE from 'three';
import { MAX_RENDERED, SPIRAL, ROAD_HALF } from './config.js';
import { CountLabel } from './text3d.js';
import { shadowTexture } from './textures.js';
import { soldierBody, soldierLeg, soldierArm, rifle, shadowPlane, MUZZLE_Z } from './models.js';

let bodyMat;
let shadowMat;
function mats() {
  if (!bodyMat) {
    bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    bodyMat.userData.shared = true;
    shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x0d1d30, transparent: true, opacity: 0.42, depthWrite: false });
    shadowMat.userData.shared = true;
  }
  return { bodyMat, shadowMat };
}
const SHADOW_GEO = shadowPlane(0.8);

const HIP_Y = 0.36;
const SHOULDER_Y = 0.73;
const GOLDEN = 2.399963;

const _root = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _rot = new THREE.Matrix4();
const _rot2 = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _white = new THREE.Color(1, 1, 1);
const _flash = new THREE.Color();

const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class Crowd {
  constructor(scene, { team = 'blue', count = 1, x = 0, z = 0, formation = 'blob', fallen = null, effects = null } = {}) {
    this.scene = scene;
    this.team = team;
    this.yaw = team === 'blue' ? 0 : Math.PI;
    this.dir = team === 'blue' ? -1 : 1; // pravac "napred" po z osi
    this.formation = formation;
    this.x = x;
    this.z = z;
    this.count = count;
    this.fallen = fallen;
    this.effects = effects;

    // Šta vojska trenutno radi (Game postavlja), i glatki prelazi između toga
    this.moving = false;
    this.aim = false;
    this.cheer = false;
    this.wRun = 0;
    this.wAim = 0;
    this.wCheer = 0;
    this.lean = 0;

    const { bodyMat: bm, shadowMat: sm } = mats();
    const N = MAX_RENDERED;
    const make = (geo, material, cap = N, shadow = true) => {
      const m = new THREE.InstancedMesh(geo, material, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = shadow;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.shadow = make(SHADOW_GEO, sm, N, false);
    this.shadow.renderOrder = -1;
    this.body = make(soldierBody(team), bm);
    // Senku u svetlu bacaju samo tela (noge, ruke i puške imaju meku senku ispod), da bi bilo brže
    this.legs = make(soldierLeg(team), bm, N * 2, false);
    this.arms = make(soldierArm(team), bm, N * 2, false);
    this.gun = make(rifle(), bm, N, false);
    for (let i = 0; i < N; i++) this.body.setColorAt(i, _white);
    this.body.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.meshes = [this.shadow, this.body, this.legs, this.arms, this.gun];

    // Podaci za svakog vojnika
    this.ox = new Float32Array(N);
    this.oz = new Float32Array(N);
    this.phase = new Float32Array(N);
    this.speedMul = new Float32Array(N);
    this.scale = new Float32Array(N);
    this.jitter = new Float32Array(N);
    this.hitT = new Float32Array(N);
    this.recoil = new Float32Array(N);
    for (let i = 0; i < N; i++) this.randomize(i);
    this.rendered = 0;
    this.syncRendered(true);

    this.label = new CountLabel(team === 'blue' ? 0x1f5fe0 : 0xd8323a);
    this.label.group.scale.setScalar(0.62);
    scene.add(this.label.group);
    this.labelPop = 0;
    this.muzzleBudget = 0;
  }

  randomize(i) {
    this.phase[i] = Math.random() * Math.PI * 2;
    this.speedMul[i] = 0.9 + Math.random() * 0.2;
    this.scale[i] = 0.93 + Math.random() * 0.14;
    this.jitter[i] = Math.random() - 0.5;
    this.hitT[i] = 0;
    this.recoil[i] = 0;
  }

  syncRendered(instant = false) {
    const target = Math.min(this.count, MAX_RENDERED);
    for (let i = this.rendered; i < target; i++) {
      this.randomize(i);
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
    // Kad se vojska smanji na lošoj kapiji, višak pada
    if (this.count < before) this.dropTo(Math.min(this.count, MAX_RENDERED));
    this.syncRendered(false);
  }

  dropTo(after) {
    const spots = [];
    for (let i = after; i < this.rendered; i++) {
      const x = this.x + this.ox[i];
      const z = this.z + this.oz[i];
      spots.push([x, 0.5, z]);
      if (this.fallen) this.fallen.add(x, z, this.yaw, this.scale[i]);
    }
    this.rendered = Math.min(this.rendered, after);
    return spots;
  }

  // Ubija k vojnika (padaju na zemlju) i vraća gde su stajali.
  kill(k) {
    this.count = Math.max(0, this.count - k);
    this.labelPop = Math.max(this.labelPop, 0.5);
    return this.dropTo(Math.min(this.count, MAX_RENDERED));
  }

  // Nekoliko vojnika u prednjim redovima se trgne od pogotka
  hit(n = 1, towardZ = this.z) {
    for (let t = 0; t < n; t++) {
      const i = this.pickFront(towardZ);
      if (i >= 0) this.hitT[i] = 1;
    }
  }

  pickFront(towardZ) {
    const n = this.rendered;
    if (!n) return -1;
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
    return best;
  }

  frontSoldier(towardZ) {
    const i = this.pickFront(towardZ);
    if (i < 0) return null;
    return [this.x + this.ox[i], 0.72, this.z + this.oz[i]];
  }

  randomFoot() {
    if (!this.rendered) return null;
    const i = Math.floor(Math.random() * this.rendered);
    return [this.x + this.ox[i], this.z + this.oz[i]];
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
    // Glatki prelazi između stanja (oko 0.2 s)
    this.wCheer = approach(this.wCheer, this.cheer ? 1 : 0, 6, dt);
    this.wAim = approach(this.wAim, this.aim && !this.cheer ? 1 : 0, 8, dt);
    this.wRun = approach(this.wRun, this.moving && !this.cheer ? 1 - this.wAim * 0.55 : 0, 7, dt);
    const wRun = this.wRun;
    const wAim = this.wAim;
    const wCheer = this.wCheer;
    const wIdle = Math.max(0, 1 - wRun - wAim - wCheer);

    const n = this.rendered;
    const k = 1 - Math.exp(-dt * 9);
    this.muzzleBudget = Math.min(3, this.muzzleBudget + dt * 14);
    const fireRate = 1.4;

    for (let i = 0; i < n; i++) {
      const [sx, sz] = this.slot(i, n);
      this.ox[i] += (sx - this.ox[i]) * k;
      this.oz[i] += (sz - this.oz[i]) * k;
      const sc = this.scale[i];
      const ph = this.phase[i] + t * (wAim > 0.5 ? 9 : 13) * this.speedMul[i];
      const s = Math.sin(ph);
      const jit = this.jitter[i];

      // Pucanje i trzaj
      if (wAim > 0.6 && Math.random() < dt * fireRate) {
        this.recoil[i] = 1;
        if (this.effects && this.muzzleBudget >= 1) {
          this.muzzleBudget -= 1;
          this.fireMuzzle(i);
        }
      }
      const rec = this.recoil[i];
      if (rec > 0) this.recoil[i] = Math.max(0, rec - dt * 7);
      const hit = this.hitT[i];
      if (hit > 0) this.hitT[i] = Math.max(0, hit - dt * 4);

      // Položaj celog vojnika
      const breathe = Math.sin(t * 2.2 + this.phase[i]) * 0.012;
      const jump = wCheer * Math.max(0, Math.sin(this.phase[i] + t * 8)) * 0.42;
      const bob = wRun * Math.abs(Math.cos(ph)) * 0.08 + wIdle * breathe + jump;
      const pitch = -0.14 * wRun + hit * 0.5 + rec * 0.08 - wAim * 0.04;
      const yaw = this.yaw + wRun * s * 0.07 + wAim * jit * 0.25 + wIdle * Math.sin(t * 0.7 + this.phase[i]) * 0.08;
      const pushBack = hit * 0.12 * -this.dir;
      _e.set(pitch, yaw, this.lean * (1 - wCheer));
      _q.setFromEuler(_e);
      const wx = this.x + this.ox[i];
      const wz = this.z + this.oz[i] + pushBack;
      _root.compose(_p.set(wx, bob, wz), _q, _s.set(sc, sc, sc));

      _local.makeTranslation(wx, 0.02, wz);
      _local.elements[0] = _local.elements[10] = sc;
      this.shadow.setMatrixAt(i, _local);
      this.body.setMatrixAt(i, _root);
      if (hit > 0) {
        const f = 1 + hit * 1.6;
        this.body.setColorAt(i, _flash.setRGB(f, f, f));
      } else {
        this.body.setColorAt(i, _white);
      }

      // Noge: mašu u trku, raširene kad nišane, u slavlju malo skupljene
      const legA = wRun * s * 0.8;
      const spread = wAim * 0.12;
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        const swing = (side ? legA : -legA) + wAim * (side ? -0.25 : 0.2);
        _rot.makeRotationX(swing);
        _rot2.makeRotationZ(sign * spread);
        _local.makeTranslation(sign * 0.075, HIP_Y, 0).multiply(_rot2).multiply(_rot);
        this.legs.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
      }

      // Ruke: drže pušku (u trku niže, pri nišanjenju podignuto), u slavlju gore
      let armA = 1.0 * wIdle + (1.15 + s * 0.1) * wRun + 1.5 * wAim - rec * 0.25;
      armA = armA * (1 - wCheer) + (2.75 + Math.sin(t * 10 + this.phase[i]) * 0.3) * wCheer;
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        _rot.makeRotationX(armA + (side ? 0.18 : 0) * (1 - wCheer));
        _rot2.makeRotationZ(sign * 0.12 * wCheer);
        _local.makeTranslation(sign * 0.19, SHOULDER_Y, 0).multiply(_rot2).multiply(_rot);
        this.arms.setMatrixAt(i * 2 + side, _out.multiplyMatrices(_root, _local));
      }

      // Puška
      if (wCheer > 0.5) {
        _local.makeTranslation(0.07, 1.28, 0).multiply(_rot.makeRotationX(Math.PI / 2));
      } else {
        const gy = 0.6 * (1 - wAim) + 0.75 * wAim + wRun * Math.abs(s) * 0.015;
        const gz = -0.26 * (1 - wAim) - 0.34 * wAim + rec * 0.09;
        _local.makeTranslation(0.08, gy, gz).multiply(_rot.makeRotationX(-0.15 * (1 - wAim) * wRun - rec * 0.18));
      }
      this.gun.setMatrixAt(i, _out.multiplyMatrices(_root, _local));
    }
    for (const m of this.meshes) {
      m.count = m === this.legs || m === this.arms ? n * 2 : n;
      m.instanceMatrix.needsUpdate = true;
    }
    this.body.instanceColor.needsUpdate = true;

    // Broj iznad vojske, "skoči" kad se promeni
    this.label.set(this.count);
    this.labelPop = Math.max(0, this.labelPop - dt * 4);
    this.label.group.scale.setScalar(0.62 * (1 + this.labelPop * 0.35));
    this.label.group.visible = this.count > 0;
    this.label.group.position.set(this.x, 1.95 + Math.min(this.radius(), 3) * 0.12, this.z);
    this.label.group.rotation.x = -0.5;
  }

  // Bljesak na vrhu cevi vojnika i
  fireMuzzle(i) {
    this.gun.getMatrixAt(i, _out);
    _v.set(0, 0.01, MUZZLE_Z).applyMatrix4(_out);
    this.effects.muzzle(_v.x, _v.y, _v.z, this.dir);
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
