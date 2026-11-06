// Pravi 3D natpise (brojevi na kapijama i iznad vojske) fontom Lilita One.
import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from './fonts/lilita.json';

const font = new Font(fontData);
const cache = new Map();
const MAX_CACHE = 300;

// Geometrija teksta visine ~1, centrirana. depth = debljina slova.
export function textGeometry(text, depth = 0.18) {
  const key = text + '|' + depth;
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const geo = new TextGeometry(String(text), {
    font,
    size: 1,
    depth,
    curveSegments: 3,
    bevelEnabled: depth > 0.05,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
  geo.userData.width = bb.max.x - bb.min.x;
  geo.userData.shared = true;
  cache.set(key, geo);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.get(oldest).dispose();
    cache.delete(oldest);
  }
  return geo;
}

// Zaobljeni pravougaonik (za pločicu iza broja).
const pillCache = new Map();
export function pillGeometry(w, h) {
  const key = Math.round(w * 10);
  if (pillCache.has(key)) return pillCache.get(key);
  const ww = key / 10;
  const r = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-ww / 2 + r, -h / 2);
  s.lineTo(ww / 2 - r, -h / 2);
  s.absarc(ww / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-ww / 2 + r, h / 2);
  s.absarc(-ww / 2 + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 6 });
  geo.userData.shared = true;
  pillCache.set(key, geo);
  return geo;
}

// Natpis sa brojem vojnika: obojena pločica i beli broj.
export class CountLabel {
  constructor(color) {
    this.group = new THREE.Group();
    this.plateMat = new THREE.MeshBasicMaterial({ color });
    this.plate = new THREE.Mesh(pillGeometry(1, 1.3), this.plateMat);
    this.plate.position.z = -0.06;
    this.textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.text = new THREE.Mesh(textGeometry('0', 0.02), this.textMat);
    this.text.position.z = 0.08;
    this.text.scale.setScalar(0.95);
    this.group.add(this.plate, this.text);
    this.value = null;
  }

  set(value) {
    if (value === this.value) return;
    this.value = value;
    const geo = textGeometry(String(value), 0.02);
    this.text.geometry = geo;
    this.plate.geometry = pillGeometry(Math.max(1.3, geo.userData.width * 0.95 + 0.8), 1.3);
  }

  dispose() {
    this.plateMat.dispose();
    this.textMat.dispose();
  }
}
