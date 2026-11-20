// Oružja: šteta, brzina paljbe, potrošnja municije, vrsta metka, izgled i cena u prodavnici.
import * as THREE from 'three';
import { part, build } from '../gfx/models.js';

// dmg = šteta jednog metka, rate = pucnjeva u sekundi, pellets = sačme po pucnju,
// spread = rasipanje, ammoPerShot = koliko municije troši jedan pucanj,
// speed = brzina metka (m/s), range = domet, splash = poluprečnik eksplozije (bacač granata)
export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'PIŠTOLJ', dmg: 12, rate: 3.68, pellets: 1, spread: 0.01, ammoPerShot: 1,
    speed: 86, range: 62, kind: 'bullet', tracer: 0xffe08a, width: 0.05, knock: 0.18, recoil: 0.6, price: 0,
    desc: 'Pouzdan i precizan.',
  },
  shotgun: {
    id: 'shotgun', name: 'SAČMARICA', dmg: 9, rate: 1.67, pellets: 6, spread: 0.16, ammoPerShot: 1,
    speed: 71, range: 34, kind: 'pellet', tracer: 0xffb347, width: 0.045, knock: 0.55, recoil: 1.0, price: 450,
    desc: 'Razara zombije izbliza.',
  },
  rifle: {
    id: 'rifle', name: 'JURIŠNA PUŠKA', dmg: 10, rate: 9.2, pellets: 1, spread: 0.025, ammoPerShot: 0.5,
    speed: 98, range: 64, kind: 'bullet', tracer: 0xffd36a, width: 0.05, knock: 0.14, recoil: 0.45, price: 1300,
    desc: 'Brza paljba, štedi municiju.',
  },
  minigun: {
    id: 'minigun', name: 'MINIGAN', dmg: 8, rate: 18.4, pellets: 1, spread: 0.05, ammoPerShot: 0.25,
    speed: 103, range: 62, kind: 'bullet', tracer: 0xfff1a0, width: 0.045, knock: 0.1, recoil: 0.3, spinUp: 0.4, price: 3200,
    desc: 'Zid od metaka.',
  },
  launcher: {
    id: 'launcher', name: 'BACAČ GRANATA', dmg: 60, rate: 1.44, pellets: 1, spread: 0, ammoPerShot: 2,
    speed: 34, range: 60, kind: 'grenade', splash: 3.4, tracer: 0xff7a2a, width: 0.12, knock: 1, recoil: 1.2, price: 6500,
    desc: 'Eksplozije koje čiste celu grupu.',
  },
};

export const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'minigun', 'launcher'];

export function nextWeapon(id) {
  const i = WEAPON_ORDER.indexOf(id);
  return i >= 0 && i < WEAPON_ORDER.length - 1 ? WEAPON_ORDER[i + 1] : null;
}

// Vrh cevi (z u lokalnim koordinatama puške; puška gleda ka -z)
export const MUZZLE_Z = { pistol: -0.19, shotgun: -0.68, rifle: -0.53, minigun: -0.64, launcher: -0.47 };

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 8) => new THREE.CylinderGeometry(r, r, h, s);
const X = [Math.PI / 2, 0, 0];
const METAL = 0x2c3038;
const DARK = 0x1b1d22;
const WOOD = 0x7a4d2a;

const cache = new Map();

// Model puške koju junak drži. Vraća { body, spinner } (spinner = cevi minigana koje se vrte).
export function weaponGeometry(id) {
  if (cache.has(id)) return cache.get(id);
  let body;
  let spinner = null;
  switch (id) {
    case 'pistol':
      body = build([
        part(box(0.05, 0.06, 0.22), METAL, { pos: [0, 0.03, -0.08] }),
        part(box(0.045, 0.12, 0.065), DARK, { pos: [0, -0.04, 0.01], rot: [0.25, 0, 0] }),
        part(box(0.02, 0.02, 0.03), 0xd0d0d0, { pos: [0, 0.07, -0.17] }),
      ]);
      break;
    case 'shotgun':
      body = build([
        part(box(0.065, 0.085, 0.24), METAL, { pos: [0, 0, 0] }),
        part(cyl(0.024, 0.56), DARK, { pos: [0, 0.022, -0.4], rot: X }),
        part(cyl(0.02, 0.44), METAL, { pos: [0, -0.026, -0.34], rot: X }),
        part(box(0.07, 0.055, 0.15), WOOD, { pos: [0, -0.03, -0.3] }),
        part(box(0.055, 0.1, 0.3), WOOD, { pos: [0, -0.035, 0.26] }),
        part(box(0.04, 0.1, 0.06), DARK, { pos: [0, -0.07, 0.07], rot: [0.3, 0, 0] }),
      ]);
      break;
    case 'rifle':
      body = build([
        part(box(0.065, 0.095, 0.38), 0x3b4a2e, { pos: [0, 0, -0.02] }),
        part(box(0.07, 0.075, 0.22), 0x2f3a24, { pos: [0, 0.005, -0.3] }),
        part(cyl(0.016, 0.24), DARK, { pos: [0, 0.015, -0.42], rot: X }),
        part(box(0.05, 0.17, 0.075), DARK, { pos: [0, -0.12, -0.08], rot: [0.22, 0, 0] }),
        part(box(0.055, 0.11, 0.24), 0x2f3a24, { pos: [0, -0.02, 0.28] }),
        part(box(0.035, 0.05, 0.12), DARK, { pos: [0, 0.075, -0.05] }),
        part(box(0.04, 0.1, 0.05), DARK, { pos: [0, -0.08, 0.08], rot: [0.3, 0, 0] }),
      ]);
      break;
    case 'minigun':
      body = build([
        part(box(0.15, 0.15, 0.34), 0x3a3d44, { pos: [0, 0, 0.06] }),
        part(cyl(0.075, 0.05, 12), 0x55585f, { pos: [0, 0, -0.62], rot: X }),
        part(box(0.05, 0.08, 0.2), DARK, { pos: [0, 0.12, 0.02] }),
        part(box(0.12, 0.14, 0.14), 0xb38f2a, { pos: [0.13, -0.05, 0.08] }),
        part(cyl(0.035, 0.12, 8), DARK, { pos: [0, -0.1, 0.18] }),
      ]);
      spinner = build(
        Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return part(cyl(0.014, 0.56, 6), 0x24262b, { pos: [Math.cos(a) * 0.045, Math.sin(a) * 0.045, -0.36], rot: X });
        }).concat([part(cyl(0.06, 0.04, 10), 0x6a6d74, { pos: [0, 0, -0.2], rot: X })]),
      );
      break;
    default:
      body = build([
        part(cyl(0.055, 0.46, 10), 0x4d5a36, { pos: [0, 0.03, -0.21], rot: X }),
        part(cyl(0.062, 0.05, 10), 0x2a2f22, { pos: [0, 0.03, -0.44], rot: X }),
        part(cyl(0.095, 0.13, 10), 0x5e6b45, { pos: [0, -0.04, 0.0], rot: X }),
        part(box(0.05, 0.12, 0.06), DARK, { pos: [0, -0.09, 0.08], rot: [0.3, 0, 0] }),
        part(box(0.05, 0.09, 0.24), 0x3d4630, { pos: [0, -0.01, 0.24] }),
        part(box(0.02, 0.06, 0.02), 0xff7a2a, { pos: [0, 0.1, -0.38] }),
      ]);
  }
  const out = { body, spinner };
  cache.set(id, out);
  return out;
}
