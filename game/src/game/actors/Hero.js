// Junak: preživeli sa kačketom, prslukom i rancem. Stoji, pomera se levo-desno i puca napred.
// Animacije: borbeni stav, koraci u stranu, nišanjenje, trzaj puške, pogodak, pad, slavlje, opušten stav u meniju.
import * as THREE from 'three';
import { part, build } from '../gfx/models.js';
import { shadowTexture } from '../fx/textures.js';
import { weaponGeometry, MUZZLE_Z } from '../combat/weapons.js';

const C = {
  skin: 0xf0c08a,
  jacket: 0x55663a,
  jacketDark: 0x3f4d2b,
  vest: 0xc39a62,
  vestDark: 0x8f6e42,
  jeans: 0x34465e,
  boot: 0x2b211b,
  glove: 0x262321,
  cap: 0xc8322b,
  capDark: 0x8e1f1a,
  belt: 0x3b2d22,
  pack: 0x4d5a33,
  roll: 0x8a7a55,
};

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 10) => new THREE.CylinderGeometry(r, r, h, s);

function torsoGeometry() {
  return build(
    [
      part(cyl(0.19, 0.1, 12), C.belt, { pos: [0, 0.0, 0], scale: [1, 1, 0.78] }),
      part(box(0.07, 0.06, 0.03), 0xd9b347, { pos: [0, 0.0, -0.15] }),
      part(new THREE.CapsuleGeometry(0.2, 0.22, 3, 10), C.jacket, { pos: [0, 0.3, 0], scale: [1, 1, 0.72] }),
      part(box(0.42, 0.33, 0.31), C.vest, { pos: [0, 0.31, -0.005] }),
      part(box(0.09, 0.1, 0.04), C.vestDark, { pos: [-0.11, 0.22, -0.165] }),
      part(box(0.09, 0.1, 0.04), C.vestDark, { pos: [0.0, 0.22, -0.165] }),
      part(box(0.09, 0.1, 0.04), C.vestDark, { pos: [0.11, 0.22, -0.165] }),
      part(box(0.05, 0.36, 0.33), C.vestDark, { pos: [0.0, 0.31, 0.0], rot: [0, 0, 0.6] }),
      part(cyl(0.07, 0.12, 8), C.skin, { pos: [0, 0.64, 0] }),
      part(new THREE.SphereGeometry(0.135, 12, 10), C.skin, { pos: [0, 0.8, -0.01] }),
      part(box(0.035, 0.035, 0.02), 0x1b1b22, { pos: [-0.048, 0.81, -0.135] }),
      part(box(0.035, 0.035, 0.02), 0x1b1b22, { pos: [0.048, 0.81, -0.135] }),
      part(box(0.12, 0.05, 0.03), 0x6b4a33, { pos: [0, 0.73, -0.125] }),
      part(new THREE.SphereGeometry(0.145, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.cap, { pos: [0, 0.83, 0.0], scale: [1, 0.85, 1.05] }),
      part(box(0.21, 0.025, 0.13), C.capDark, { pos: [0, 0.835, -0.15] }),
      part(box(0.32, 0.41, 0.18), C.pack, { pos: [0, 0.33, 0.245] }),
      part(box(0.24, 0.16, 0.05), 0x3d4828, { pos: [0, 0.25, 0.345] }),
      part(cyl(0.07, 0.34, 8), C.roll, { pos: [0, 0.57, 0.24], rot: [0, 0, Math.PI / 2] }),
    ],
    { aoHeight: 0.6, aoBase: -0.1, aoStrength: 0.25 },
  );
}

function legGeometry() {
  return build([
    part(box(0.15, 0.62, 0.16), C.jeans, { pos: [0, -0.31, 0] }),
    part(box(0.155, 0.08, 0.165), 0x2c3b50, { pos: [0, -0.36, -0.002] }),
    part(box(0.165, 0.15, 0.27), C.boot, { pos: [0, -0.665, -0.04] }),
  ]);
}

function armGeometry() {
  return build([
    part(box(0.12, 0.3, 0.13), C.jacket, { pos: [0, -0.14, 0] }),
    part(box(0.105, 0.27, 0.115), C.jacketDark, { pos: [0, -0.42, 0] }),
    part(box(0.1, 0.1, 0.11), C.glove, { pos: [0, -0.6, 0] }),
  ]);
}

// Gde puška stoji u odnosu na struk, i kako su ruke postavljene (za svako oružje)
const HOLD = {
  pistol: { mount: [0.02, 0.5, -0.6], r: [1.5, -0.32], l: [1.5, 0.42] },
  shotgun: { mount: [0.1, 0.45, -0.42], r: [1.25, -0.18], l: [1.42, 0.5] },
  rifle: { mount: [0.1, 0.46, -0.44], r: [1.28, -0.18], l: [1.45, 0.5] },
  minigun: { mount: [0.15, 0.3, -0.42], r: [0.95, -0.1], l: [1.15, 0.45] },
  launcher: { mount: [0.12, 0.46, -0.4], r: [1.28, -0.18], l: [1.42, 0.5] },
};

const HIP_Y = 0.74;
const WAIST_Y = 0.82;

export class Hero {
  constructor(scene) {
    this.scene = scene;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.root = new THREE.Group();
    scene.add(this.root);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x05080d, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    shadow.position.y = 0.02;
    shadow.renderOrder = -1;
    this.root.add(shadow);
    this.shadowMesh = shadow;

    this.hips = new THREE.Group();
    this.hips.position.y = HIP_Y;
    this.root.add(this.hips);
    const legGeo = legGeometry();
    this.legs = [-1, 1].map((s) => {
      const m = new THREE.Mesh(legGeo, this.mat);
      m.position.set(s * 0.1, 0, 0);
      m.castShadow = true;
      this.hips.add(m);
      return m;
    });

    this.torso = new THREE.Group();
    this.torso.position.y = WAIST_Y;
    this.root.add(this.torso);
    const body = new THREE.Mesh(torsoGeometry(), this.mat);
    body.castShadow = true;
    this.torso.add(body);

    const armGeo = armGeometry();
    this.arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.25, 0.53, 0);
      const m = new THREE.Mesh(armGeo, this.mat);
      m.castShadow = true;
      pivot.add(m);
      this.torso.add(pivot);
      return pivot;
    });

    this.gunMount = new THREE.Group();
    this.torso.add(this.gunMount);
    this.gunMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.gun = new THREE.Mesh(undefined, this.gunMat);
    this.gun.castShadow = true;
    this.spinner = new THREE.Mesh(undefined, this.gunMat);
    this.gunMount.add(this.gun, this.spinner);

    this.x = 0;
    this.vx = 0;
    this.aimYaw = 0;
    this.recoil = 0;
    this.spin = 0;
    this.spinSpeed = 0;
    this.hurtT = 0;
    this.state = 'play'; // play | menu | dead | victory
    this.stateT = 0;
    this.stepPhase = 0;
    this.setWeapon('pistol');
  }

  setWeapon(id) {
    this.weaponId = id;
    const g = weaponGeometry(id);
    this.gun.geometry = g.body;
    this.spinner.visible = !!g.spinner;
    if (g.spinner) this.spinner.geometry = g.spinner;
    this.hold = HOLD[id] || HOLD.rifle;
    this.muzzleLocal = new THREE.Vector3(0, 0.01, MUZZLE_Z[id] ?? -0.5);
  }

  setState(s) {
    if (this.state !== s) {
      this.state = s;
      this.stateT = 0;
    }
  }

  kick(amount = 1) {
    this.recoil = Math.min(1.4, this.recoil + amount);
  }

  hurt() {
    this.hurtT = 1;
  }

  // Položaj vrha cevi u svetu
  muzzleWorld(out = new THREE.Vector3()) {
    this.gunMount.updateWorldMatrix(true, false);
    return out.copy(this.muzzleLocal).applyMatrix4(this.gunMount.matrixWorld);
  }

  update(dt, t, { firing = false } = {}) {
    this.stateT += dt;
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.hurtT = Math.max(0, this.hurtT - dt * 4);
    const r = this.recoil;

    this.root.position.x = this.x;
    const moving = Math.min(1, Math.abs(this.vx) / 3);
    this.stepPhase += dt * (6 + moving * 8);
    const s = Math.sin(this.stepPhase);

    // Okretanje gornjeg dela tela ka meti
    const yaw = this.aimYaw;
    this.torso.rotation.set(-0.03 + r * 0.05, yaw, -this.vx * 0.02);
    this.hips.rotation.y = yaw * 0.3;

    // Noge: korak u stranu kad se pomera, inače raširen stav
    this.legs.forEach((leg, i) => {
      const side = i ? 1 : -1;
      leg.rotation.set(moving * s * 0.35 * side, 0, side * 0.08 + moving * Math.max(0, s * side) * 0.25 * Math.sign(this.vx || 1));
    });
    const breathe = Math.sin(t * 2.3) * 0.012;
    let rootY = moving * Math.abs(s) * 0.04 + breathe;

    // Ruke i puška
    const h = this.hold;
    let rArm = h.r[0];
    let lArm = h.l[0];
    let mount = h.mount;
    let gunPitch = -r * 0.12;
    if (this.state === 'menu') {
      // Opušten stav: puška spuštena, gleda okolo
      rArm = 0.55;
      lArm = 0.7;
      mount = [0.12, 0.2, -0.32];
      gunPitch = 0.5;
      this.torso.rotation.y = Math.sin(t * 0.4) * 0.35;
    }
    if (this.state === 'victory') {
      const k = Math.min(1, this.stateT * 3);
      rArm = h.r[0] + (2.8 - h.r[0]) * k;
      lArm = h.l[0] + (0.4 - h.l[0]) * k;
      mount = [0.18, 1.2 * k + h.mount[1] * (1 - k), -0.15];
      gunPitch = -1.2 * k;
      rootY += Math.max(0, Math.sin(this.stateT * 7)) * 0.35;
      this.torso.rotation.y = 0;
    }
    this.arms[1].rotation.set(rArm - r * 0.15, 0, h.r[1]);
    this.arms[0].rotation.set(lArm - r * 0.1, 0, h.l[1]);
    this.gunMount.position.set(mount[0], mount[1] + r * 0.03, mount[2] + r * 0.07);
    this.gunMount.rotation.set(gunPitch, 0, 0);

    // Cevi minigana se vrte dok puca
    this.spinSpeed += ((firing ? 28 : 0) - this.spinSpeed) * Math.min(1, dt * 5);
    this.spin += this.spinSpeed * dt;
    this.spinner.rotation.z = this.spin;

    // Pad posle poraza (unazad)
    if (this.state === 'dead') {
      const k = Math.min(1, this.stateT / 0.55);
      const e = 1 - (1 - k) * (1 - k);
      this.root.rotation.x = e * 1.45;
      rootY = Math.sin(k * Math.PI) * 0.25;
      this.arms[1].rotation.x = 2.6 * e;
      this.arms[0].rotation.x = 2.4 * e;
    } else {
      this.root.rotation.x = 0;
    }
    this.root.position.y = rootY;

    // Crveni bljesak kad ga zombi udari
    this.mat.emissive.setRGB(this.hurtT * 0.9, 0, 0);
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.material && o.material !== this.mat && o.material !== this.gunMat) o.material.dispose();
    });
    this.mat.dispose();
    this.gunMat.dispose();
  }
}
