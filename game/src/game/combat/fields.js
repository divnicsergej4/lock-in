// Polja napredovanja: dolaze desnom trakom ka junaku. Junak ih pokupi kad stane ispod njih.
// - Brojna polja (municija, zdravlje, zlatnici): svaki pogodak povećava broj za 1 (i minus može da postane plus).
// - Specijalna polja (×2 metaka, ×3 štete, vatreni metci, novo oružje, brža paljba): zaključana su dok ih
//   ne napuniš pucanjem; zaključano polje ne daje ništa.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { textGeometry } from '../gfx/text3d.js';
import { FIELD_SPEED, HERO_Z } from '../core/config.js';

export const FIELD_TYPES = {
  ammo: { kind: 'numeric', stat: 'ammo', caption: 'MUNICIJA', color: 0x22b35e, max: 99 },
  health: { kind: 'numeric', stat: 'health', caption: 'ZDRAVLJE', color: 0xe8457a, max: 99 },
  coins: { kind: 'numeric', stat: 'coins', caption: 'ZLATNIKA', color: 0xe0a800, max: 199 },
  bullets2: { kind: 'special', label: '×2', caption: 'METAKA', color: 0x2f86ff, charge: 45, toast: '×2 METAKA!' },
  bullets3: { kind: 'special', label: '×3', caption: 'METAKA', color: 0x1f5fe0, charge: 95, toast: '×3 METAKA!' },
  damage2: { kind: 'special', label: '×2', caption: 'ŠTETA', color: 0xff6a2a, charge: 55, toast: '×2 ŠTETA!' },
  damage3: { kind: 'special', label: '×3', caption: 'ŠTETA', color: 0xe8401a, charge: 110, toast: '×3 ŠTETA!' },
  fire: { kind: 'special', label: 'VATRA', caption: 'VATRENI METCI', color: 0xff3d12, charge: 65, toast: 'VATRENI METCI!' },
  weapon: { kind: 'special', label: 'NOVO', caption: 'ORUŽJE', color: 0xffc21f, charge: 130, toast: 'NOVO ORUŽJE!' },
  rate: { kind: 'special', label: '+30%', caption: 'PALJBA', color: 0xa64dff, charge: 50, toast: 'BRŽA PALJBA!' },
};

const HEIGHT = 2.35;
const RED = 0xe03a3a;

function panelGeometry(w, h, color) {
  const geo = new THREE.PlaneGeometry(w, h, 1, 6);
  const c = new THREE.Color(color);
  const pos = geo.getAttribute('position');
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + h / 2) / h;
    cols.push(c.r, c.g, c.b, 0.72 - t * 0.42);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4));
  return geo;
}

let lockGeo;
function lockGeometry() {
  if (!lockGeo) {
    const body = new THREE.BoxGeometry(0.46, 0.38, 0.08).toNonIndexed();
    const shackle = new THREE.TorusGeometry(0.15, 0.045, 6, 14, Math.PI).toNonIndexed();
    shackle.translate(0, 0.19, 0);
    lockGeo = mergeGeometries([body, shackle], false);
    lockGeo.userData.shared = true;
  }
  return lockGeo;
}

// Okvir (dva stuba + gornja traka) kao jedan model; boja gornje trake se menja kad se polje otključa
function frameGeometry(w) {
  const post = (x) => new THREE.BoxGeometry(0.14, HEIGHT + 0.2, 0.14).translate(x, (HEIGHT + 0.2) / 2, 0).toNonIndexed();
  const top = new THREE.BoxGeometry(w + 0.25, 0.22, 0.22).translate(0, HEIGHT + 0.1, 0).toNonIndexed();
  const parts = [post(-(w / 2 + 0.05)), post(w / 2 + 0.05), top];
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const n = geo.getAttribute('position').count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geo.userData.topStart = n - top.getAttribute('position').count;
  return geo;
}

export class UpgradeField {
  constructor(parent, type, x, z, { halfW = 1.05, value = 10, chargeMul = 1 } = {}) {
    this.def = FIELD_TYPES[type];
    this.type = type;
    this.parent = parent;
    this.x = x;
    this.z = z;
    this.halfW = halfW;
    this.height = HEIGHT;
    this.alive = true;
    this.passed = false;
    this.value = value;
    this.need = Math.round((this.def.charge || 0) * chargeMul);
    this.charge = 0;
    this.unlocked = this.def.kind !== 'special';
    this.punch = 0;
    this.flash = 0;
    this.fade = 0;

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    const w = halfW * 2 - 0.12;
    this.panelMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.panel = new THREE.Mesh(panelGeometry(w, HEIGHT, this.currentColor()), this.panelMat);
    this.panel.position.y = HEIGHT / 2;
    this.group.add(this.panel);

    // Okvir
    this.frameMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x000000 });
    this.frame = new THREE.Mesh(frameGeometry(w), this.frameMat);
    this.group.add(this.frame);
    this.ownGeos = [this.frame.geometry, this.panel.geometry];

    // Natpisi
    this.white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    this.side = this.white;
    this.big = new THREE.Mesh(textGeometry(this.labelText(), 0.12), this.white);
    this.big.position.set(0, 1.42, 0.06);
    this.small = new THREE.Mesh(textGeometry(this.def.caption, 0.03), this.white);
    this.small.position.set(0, 0.82, 0.06);
    const cap = this.def.caption;
    this.small.scale.setScalar(cap.length > 10 ? 0.2 : cap.length > 7 ? 0.25 : 0.3);
    this.group.add(this.big, this.small);
    this.fitBig();

    // Specijalna polja: katanac i traka punjenja
    if (this.def.kind === 'special') {
      this.lockMat = new THREE.MeshLambertMaterial({ color: 0xc9ced6, emissive: 0x202428 });
      this.lock = new THREE.Mesh(lockGeometry(), this.lockMat);
      this.lock.position.set(0, 2.02, 0.08);
      this.group.add(this.lock);
      this.barBg = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.16), new THREE.MeshBasicMaterial({ color: 0x0b1018, transparent: true, opacity: 0.75 }));
      this.barBg.position.set(0, 0.45, 0.07);
      const fg = new THREE.PlaneGeometry(w * 0.8 - 0.06, 0.1);
      fg.translate((w * 0.8 - 0.06) / 2, 0, 0);
      this.barFg = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xffd34a }));
      this.barFg.position.set(-(w * 0.8 - 0.06) / 2, 0.45, 0.08);
      this.barFg.scale.x = 0.001;
      this.group.add(this.barBg, this.barFg);
      this.ownGeos.push(this.barBg.geometry, fg);
    }
    parent.add(this.group);
    this.refreshLook();
  }

  labelText() {
    if (this.def.kind === 'numeric') return (this.value > 0 ? '+' : '') + Math.round(this.value);
    return this.def.label;
  }

  currentColor() {
    if (this.def.kind === 'numeric') return this.value >= 0 ? this.def.color : RED;
    return this.unlocked ? this.def.color : 0x6b7380;
  }

  isGood() {
    return this.def.kind === 'numeric' ? this.value > 0 : this.unlocked;
  }

  fitBig() {
    const w = this.big.geometry.userData.width || 1;
    const maxW = this.halfW * 2 - 0.5;
    this.big.scale.setScalar(Math.min(0.75, maxW / w));
  }

  refreshLook() {
    const col = new THREE.Color(this.currentColor());
    const geo = this.panel.geometry;
    const c = geo.getAttribute('color');
    for (let i = 0; i < c.count; i++) c.setXYZ(i, col.r, col.g, col.b);
    c.needsUpdate = true;
    // Gornja traka okvira dobija boju polja (stubovi ostaju beli)
    const fc = this.frame.geometry.getAttribute('color');
    for (let i = this.frame.geometry.userData.topStart; i < fc.count; i++) fc.setXYZ(i, col.r * 1.3, col.g * 1.3, col.b * 1.3);
    fc.needsUpdate = true;
    if (this.lock) this.lock.visible = !this.unlocked;
  }

  // Pogodak metkom. Vraća 'up' (broj porastao), 'charge', 'unlock' ili null.
  hit(dmg) {
    if (!this.alive || this.passed) return null;
    this.punch = 1;
    this.flash = 1;
    if (this.def.kind === 'numeric') {
      const before = Math.round(this.value);
      this.value = Math.min(this.def.max, this.value + 1);
      if (Math.round(this.value) !== before) {
        const wasNeg = before < 0;
        this.big.geometry = textGeometry(this.labelText(), 0.12);
        this.fitBig();
        if (wasNeg !== this.value < 0) this.refreshLook();
      }
      return 'up';
    }
    if (this.unlocked) return 'charge';
    this.charge += dmg;
    if (this.charge >= this.need) {
      this.unlocked = true;
      this.refreshLook();
      return 'unlock';
    }
    return 'charge';
  }

  update(dt, t, speedMul = 1) {
    this.z += FIELD_SPEED * speedMul * dt;
    if (this.passed) {
      // Kad stigne do junaka, brzo se skupi i nestane (da ne prekrije pogled)
      this.fade = Math.min(1, this.fade + dt * 5);
      if (this.fade >= 1) this.alive = false;
    }
    this.group.position.z = this.z;
    this.punch = Math.max(0, this.punch - dt * 7);
    this.flash = Math.max(0, this.flash - dt * 9);
    const s = (1 + this.punch * 0.05) * (1 - this.fade * 0.8);
    this.group.scale.set(s, s, 1);
    // Blizu junaka ploča postaje providnija, da se vide zombiji i junak
    const near = Math.min(1, Math.max(0, (this.z + 7) / 6));
    const glow = this.isGood() ? 0.12 * Math.sin(t * 5 + this.x) : 0;
    this.panelMat.opacity = (1 - this.fade) * (0.85 + glow + this.flash * 0.5) * (1 - near * 0.55);
    this.white.opacity = 1 - this.fade;
    // Daleka polja ne crtaju sitne detalje (natpis ispod, traku punjenja), to se ionako ne vidi
    const far = this.z < -44;
    this.small.visible = !far;
    if (this.barBg) this.barBg.visible = this.barFg.visible = !far;
    if (this.barFg) {
      const k = this.unlocked ? 1 : Math.min(1, this.charge / Math.max(1, this.need));
      this.barFg.scale.x = Math.max(0.001, k);
      this.barFg.material.color.set(this.unlocked ? 0x7dff6a : 0xffd34a);
      this.lock.rotation.z = Math.sin(t * 9) * 0.05 * this.flash;
    }
  }

  // Da li je polje stiglo do junaka
  arrived() {
    return !this.passed && this.z >= HERO_Z - 0.25;
  }

  dispose() {
    this.parent.remove(this.group);
    this.ownGeos.forEach((g) => g.dispose());
    [this.panelMat, this.frameMat, this.white, this.lockMat, this.barBg && this.barBg.material, this.barFg && this.barFg.material]
      .filter(Boolean)
      .forEach((m) => m.dispose());
  }
}
