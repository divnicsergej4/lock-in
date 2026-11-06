// Kocke sa nagradama u desnoj traci. Vojnici ih gađaju; kad kocka pukne, dobiješ nagradu.
// Ako vojska udari u celu kocku, gubi vojnike, a nagrade nema.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { textGeometry } from './text3d.js';

// Vrste kocki. tier = koliko je nagrada vredna (bolje = lepša kocka)
export const CUBE_TYPES = {
  sold5: { value: '+5', caption: 'VOJNIKA', color: 0x47a8ff, hp: 9, tier: 0, apply: { soldiers: 5 }, toast: '+5 VOJNIKA' },
  sold10: { value: '+10', caption: 'VOJNIKA', color: 0x2f86ff, hp: 16, tier: 0, apply: { soldiers: 10 }, toast: '+10 VOJNIKA' },
  sold20: { value: '+20', caption: 'VOJNIKA', color: 0x2a5ef0, hp: 28, tier: 1, apply: { soldiers: 20 }, toast: '+20 VOJNIKA' },
  dmg10: { value: '+10%', caption: 'ŠTETA', color: 0xff6f3c, hp: 18, tier: 0, apply: { dmg: 0.1 }, toast: 'ŠTETA +10%' },
  rate15: { value: '+15%', caption: 'PALJBA', color: 0xffa51f, hp: 18, tier: 0, apply: { rate: 0.15 }, toast: 'BRZINA PALJBE +15%' },
  speed20: { value: '+20%', caption: 'BRZINA', color: 0x2fcf7a, hp: 22, tier: 1, apply: { speed: 0.2 }, toast: 'BRZINA NAPADA +20%' },
  double: { value: '×2', caption: 'DUPLA ŠTETA', color: 0xa64dff, hp: 30, tier: 2, apply: { double: 8 }, toast: 'DUPLA ŠTETA 8 s!' },
  weapon: { value: 'NOVO', caption: 'ORUŽJE', color: 0xffc21f, hp: 38, tier: 2, apply: { weapon: 1 }, toast: 'NOVO ORUŽJE!' },
};

const SIZE = 1.8;
let cubeGeo;
let ringGeo;
function geos() {
  if (!cubeGeo) {
    cubeGeo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 3, 0.18);
    cubeGeo.userData.shared = true;
    ringGeo = new THREE.TorusGeometry(SIZE * 0.82, 0.05, 6, 40);
    ringGeo.rotateX(Math.PI / 2);
    ringGeo.userData.shared = true;
  }
  return { cubeGeo, ringGeo };
}

export class UpgradeCube {
  constructor(parent, kind, x, z, hpMul) {
    const def = CUBE_TYPES[kind];
    this.kind = kind;
    this.def = def;
    this.x = x;
    this.z = z;
    this.hp = Math.round(def.hp * hpMul);
    this.maxHp = this.hp;
    this.pending = 0;
    this.alive = true;
    this.punch = 0;
    this.flash = 0;
    this.parent = parent;

    const { cubeGeo: g, ringGeo: rg } = geos();
    const color = new THREE.Color(def.color);
    this.mat = new THREE.MeshLambertMaterial({ color, emissive: color.clone().multiplyScalar(0.18 + def.tier * 0.12) });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group = new THREE.Group();
    this.group.position.set(x, SIZE / 2 + 0.05, z);
    this.group.add(this.mesh);

    // Natpis na prednjoj strani (okrenut ka vojsci)
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dark = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.45) });
    this.textMats = [white, dark];
    const big = new THREE.Mesh(textGeometry(def.value, 0.12), [white, dark]);
    const bigScale = def.value.length > 3 ? 0.42 : 0.62;
    big.scale.setScalar(bigScale);
    big.position.set(0, 0.22, SIZE / 2 + 0.02);
    const small = new THREE.Mesh(textGeometry(def.caption, 0.04), white);
    small.scale.setScalar(def.caption.length > 8 ? 0.17 : 0.22);
    small.position.set(0, -0.25, SIZE / 2 + 0.02);
    this.group.add(big, small);

    // Traka "života" kocke
    this.barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.14), new THREE.MeshBasicMaterial({ color: 0x0f1a2a, transparent: true, opacity: 0.7 }));
    this.barBg.position.set(0, -0.6, SIZE / 2 + 0.03);
    const fg = new THREE.PlaneGeometry(1.24, 0.09);
    fg.translate(0.62, 0, 0);
    this.barFg = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.barFg.position.set(-0.62, -0.6, SIZE / 2 + 0.04);
    this.group.add(this.barBg, this.barFg);

    // Bolje nagrade: svetleći prsten koji se vrti
    if (def.tier >= 1) {
      this.ringMat = new THREE.MeshBasicMaterial({ color: def.tier === 2 ? 0xfff3a0 : 0xd8f0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
      this.ring = new THREE.Mesh(rg, this.ringMat);
      this.ring.position.y = -SIZE / 2 + 0.1;
      this.group.add(this.ring);
    }
    parent.add(this.group);
  }

  // Tačka u koju se gađa
  aimPoint() {
    return [this.x, SIZE / 2, this.z + SIZE / 2];
  }

  hit(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.punch = 1;
    this.flash = 1;
    if (this.hp <= 0) {
      this.alive = false;
      this.group.visible = false;
      return true;
    }
    return false;
  }

  update(dt, t) {
    if (!this.alive) return;
    this.punch = Math.max(0, this.punch - dt * 6);
    this.flash = Math.max(0, this.flash - dt * 8);
    const s = 1 + this.punch * 0.08;
    this.mesh.scale.set(s, s, s);
    this.mesh.rotation.y = Math.sin(this.punch * 9) * 0.04;
    const glow = 0.18 + this.def.tier * 0.12 + Math.sin(t * 4 + this.x) * 0.05 * this.def.tier;
    this.mat.emissive.set(this.def.color).multiplyScalar(glow + this.flash * 0.8);
    this.group.position.y = SIZE / 2 + 0.05 + Math.sin(t * 2 + this.z) * 0.06 * this.def.tier;
    const k = Math.max(0, this.hp / this.maxHp);
    this.barFg.scale.x = Math.max(0.001, k);
    this.barFg.material.color.setHSL(0.33 * k, 0.85, 0.55);
    if (this.ring) {
      this.ring.rotation.y = t * 1.5;
      this.ring.position.y = -SIZE / 2 + 0.1 + ((t * 0.8) % 1) * SIZE;
      this.ringMat.opacity = 0.8 * (1 - ((t * 0.8) % 1));
    }
  }

  dispose() {
    this.parent.remove(this.group);
    this.mat.dispose();
    this.textMats.forEach((m) => m.dispose());
    this.barBg.geometry.dispose();
    this.barBg.material.dispose();
    this.barFg.geometry.dispose();
    this.barFg.material.dispose();
    if (this.ringMat) this.ringMat.dispose();
  }
}

export const CUBE_SIZE = SIZE;
