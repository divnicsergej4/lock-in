// Oružja: svako ima svoju štetu, brzinu paljbe, domet, izgled i vrstu metka.
// Kroz nivo se otključavaju gađanjem kocke "ORUŽJE".
import * as THREE from 'three';
import { part, build } from './models.js';

// dmg = šteta jednog metka, rate = metaka u sekundi po vojniku, speed = brzina metka,
// pellets = sačme po pucnju, pierce = kroz koliko zombija prolazi, splash = poluprečnik eksplozije
export const WEAPONS = [
  { name: 'PIŠTOLJ', dmg: 1.0, rate: 1.5, speed: 30, range: 22, pellets: 1, pierce: 0, splash: 0, kind: 'bullet', color: 0xffe08a, width: 0.05 },
  { name: 'JURIŠNA PUŠKA', dmg: 1.2, rate: 2.0, speed: 36, range: 24, pellets: 1, pierce: 0, splash: 0, kind: 'bullet', color: 0xffd36a, width: 0.055 },
  { name: 'SAČMARICA', dmg: 0.9, rate: 1.3, speed: 30, range: 18, pellets: 3, pierce: 0, splash: 0, kind: 'pellet', color: 0xffb347, width: 0.05 },
  { name: 'MINIGAN', dmg: 0.8, rate: 5.0, speed: 42, range: 24, pellets: 1, pierce: 0, splash: 0, kind: 'bullet', color: 0xfff1a0, width: 0.045 },
  { name: 'TEŠKI MITRALJEZ', dmg: 2.4, rate: 3.0, speed: 45, range: 28, pellets: 1, pierce: 1, splash: 0, kind: 'heavy', color: 0xff9a3c, width: 0.09 },
  { name: 'RAKETAŠ', dmg: 6.0, rate: 0.8, speed: 22, range: 28, pellets: 1, pierce: 0, splash: 2.3, kind: 'rocket', color: 0xff6a2a, width: 0.12 },
  { name: 'PLAZMA TOP', dmg: 4.0, rate: 2.2, speed: 50, range: 30, pellets: 1, pierce: 3, splash: 0, kind: 'plasma', color: 0x5ff0ff, width: 0.11 },
];

export const MAX_TIER = WEAPONS.length - 1;

// Izgled puške za svaki nivo oružja (gleda ka -z, vrh cevi oko z = -0.42 ... -0.6)
const cache = new Map();
export function weaponModel(tier) {
  if (cache.has(tier)) return cache.get(tier);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, h, s = 6) => new THREE.CylinderGeometry(r, r, h, s);
  const X = [Math.PI / 2, 0, 0];
  let parts;
  switch (tier) {
    case 0: // pištolj
      parts = [
        part(box(0.06, 0.09, 0.2), 0x2f333b, { pos: [0, 0, -0.12] }),
        part(box(0.05, 0.12, 0.06), 0x1f2228, { pos: [0, -0.08, -0.05], rot: [0.3, 0, 0] }),
      ];
      break;
    case 1: // jurišna puška
      parts = [
        part(box(0.07, 0.1, 0.34), 0x3b4a2e, { pos: [0, 0, 0] }),
        part(cyl(0.02, 0.26), 0x1e2126, { pos: [0, 0.01, -0.3], rot: X }),
        part(box(0.05, 0.14, 0.07), 0x24272d, { pos: [0, -0.1, -0.05], rot: [0.3, 0, 0] }),
        part(box(0.06, 0.09, 0.17), 0x6b4a2e, { pos: [0, -0.02, 0.24] }),
        part(box(0.03, 0.05, 0.1), 0x16181c, { pos: [0, 0.075, -0.02] }),
      ];
      break;
    case 2: // sačmarica
      parts = [
        part(box(0.075, 0.1, 0.3), 0x2b2b2e, { pos: [0, 0, 0] }),
        part(cyl(0.03, 0.34, 8), 0x1b1c20, { pos: [0, 0.02, -0.3], rot: X }),
        part(cyl(0.028, 0.22, 8), 0x7a4d2a, { pos: [0, -0.04, -0.24], rot: X }),
        part(box(0.07, 0.11, 0.2), 0x7a4d2a, { pos: [0, -0.03, 0.24] }),
      ];
      break;
    case 3: // minigan (više cevi)
      parts = [part(box(0.13, 0.13, 0.3), 0x3a3d44, { pos: [0, 0, 0.02] })];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(part(cyl(0.016, 0.42), 0x24262b, { pos: [Math.cos(a) * 0.045, Math.sin(a) * 0.045, -0.3], rot: X }));
      }
      parts.push(part(cyl(0.07, 0.04, 10), 0x55585f, { pos: [0, 0, -0.44], rot: X }));
      parts.push(part(box(0.1, 0.12, 0.12), 0xc9a227, { pos: [0.1, -0.06, 0.05] }));
      break;
    case 4: // teški mitraljez
      parts = [
        part(box(0.1, 0.13, 0.42), 0x2e3a2a, { pos: [0, 0, 0] }),
        part(cyl(0.035, 0.42, 8), 0x1a1c1f, { pos: [0, 0.02, -0.4], rot: X }),
        part(cyl(0.05, 0.12, 8), 0x2a2c30, { pos: [0, 0.02, -0.58], rot: X }),
        part(box(0.14, 0.1, 0.12), 0x6b5a2a, { pos: [0.09, -0.04, 0.02] }),
        part(box(0.02, 0.14, 0.02), 0x111111, { pos: [0, -0.12, -0.32] }),
      ];
      break;
    case 5: // raketaš (bacač na ramenu)
      parts = [
        part(cyl(0.075, 0.75, 10), 0x4d5a36, { pos: [0, 0.06, -0.08], rot: X }),
        part(cyl(0.085, 0.08, 10), 0x2a2f22, { pos: [0, 0.06, -0.46], rot: X }),
        part(new THREE.ConeGeometry(0.06, 0.12, 8), 0xff5a2a, { pos: [0, 0.06, -0.52], rot: [-Math.PI / 2, 0, 0] }),
        part(box(0.05, 0.12, 0.06), 0x24272d, { pos: [0, -0.06, -0.05] }),
      ];
      break;
    default: // plazma top (futuristički)
      parts = [
        part(box(0.1, 0.12, 0.38), 0xe8eef7, { pos: [0, 0, 0] }),
        part(box(0.12, 0.05, 0.3), 0x2a2f3a, { pos: [0, 0.07, 0] }),
        part(cyl(0.03, 0.3, 8), 0x2a2f3a, { pos: [0, 0, -0.33], rot: X }),
        part(new THREE.TorusGeometry(0.05, 0.015, 6, 12), 0x3ff0ff, { pos: [0, 0, -0.3] }),
        part(new THREE.TorusGeometry(0.05, 0.015, 6, 12), 0x3ff0ff, { pos: [0, 0, -0.4] }),
        part(box(0.04, 0.04, 0.3), 0x3ff0ff, { pos: [0.055, 0, 0] }),
      ];
  }
  const g = build(parts);
  cache.set(tier, g);
  return g;
}

// Vrh cevi za svako oružje (z koordinata)
export const MUZZLE = [-0.24, -0.44, -0.48, -0.47, -0.65, -0.55, -0.5];
