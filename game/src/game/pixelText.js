// "Pikselni" 3D tekst sastavljen od kockica.
// Ne koristimo prave fontove jer na telefonu (bez pregledača) nema načina da se slova nacrtaju u 3D.
import * as THREE from 'three';

// Svako slovo je 3 kolone x 5 redova; '#' je kockica.
const GLYPHS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  x: ['...', '#.#', '.#.', '#.#', '...'],
  '/': ['.#.', '...', '###', '...', '.#.'], // znak deljenja ÷
};

const cache = new Map();
const BOX = new THREE.BoxGeometry(1, 1, 1);
const BOX_POS = BOX.toNonIndexed().getAttribute('position').array;
const BOX_NRM = BOX.toNonIndexed().getAttribute('normal').array;

// Vraća geometriju (oblik) za dati tekst. Visina teksta je 1, sredina je u (0,0).
export function textGeometry(text) {
  const key = String(text);
  if (cache.has(key)) {
    // Pomeramo na kraj reda da se skoro korišćeni natpisi ne bi brisali.
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const cells = [];
  const chars = key.split('');
  const charW = 3;
  const gap = 1;
  const totalW = chars.length * charW + (chars.length - 1) * gap;
  chars.forEach((ch, ci) => {
    const g = GLYPHS[ch];
    if (!g) return;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r][c] === '#') cells.push([ci * (charW + gap) + c, r]);
      }
    }
  });

  const s = 1 / 5; // jedna kockica
  const pos = new Float32Array(cells.length * BOX_POS.length);
  const nrm = new Float32Array(cells.length * BOX_NRM.length);
  cells.forEach(([cx, cy], i) => {
    const ox = (cx - (totalW - 1) / 2) * s;
    const oy = (2 - cy) * s;
    for (let v = 0; v < BOX_POS.length; v += 3) {
      pos[i * BOX_POS.length + v] = BOX_POS[v] * s * 1.02 + ox;
      pos[i * BOX_POS.length + v + 1] = BOX_POS[v + 1] * s * 1.02 + oy;
      pos[i * BOX_POS.length + v + 2] = BOX_POS[v + 2] * s * 0.6;
    }
    nrm.set(BOX_NRM, i * BOX_NRM.length);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.userData.width = totalW * s;
  geo.userData.shared = true;
  cache.set(key, geo);
  // Brojevi iznad vojske se stalno menjaju; da ne bi zauzimali memoriju, čistimo stare.
  if (cache.size > 400) {
    const oldest = cache.keys().next().value;
    cache.get(oldest).dispose();
    cache.delete(oldest);
  }
  return geo;
}

// Natpis sa pločicom iza (kao balončić sa brojem vojnika).
export class CountLabel {
  constructor(color) {
    this.group = new THREE.Group();
    this.plateMat = new THREE.MeshBasicMaterial({ color });
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), this.plateMat);
    this.textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.text = new THREE.Mesh(textGeometry('0'), this.textMat);
    this.text.position.z = 0.08;
    this.group.add(this.plate, this.text);
    this.value = null;
  }

  set(value) {
    if (value === this.value) return;
    this.value = value;
    const geo = textGeometry(String(value));
    this.text.geometry = geo;
    this.plate.scale.set(geo.userData.width + 0.5, 1.5, 1);
  }

  dispose() {
    this.plate.geometry.dispose();
    this.plateMat.dispose();
    this.textMat.dispose();
  }
}
