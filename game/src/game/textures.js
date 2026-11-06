// Teksture koje pravimo kodom (bez slika), pa rade svuda: na telefonu i u pregledaču.
import * as THREE from 'three';

function dataTexture(size, fn, { repeat = false, color = false } = {}) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = fn((x + 0.5) / size, (y + 0.5) / size);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Mekana okrugla senka.
let shadowTex;
export function shadowTexture() {
  if (!shadowTex) {
    shadowTex = dataTexture(64, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const a = Math.max(0, 1 - d);
      return [0, 0, 0, Math.round(255 * a * a * (3 - 2 * a))];
    });
  }
  return shadowTex;
}

// Put: svetle ploče sa tankim spojevima.
let roadTex;
export function roadTexture() {
  if (!roadTex) {
    roadTex = dataTexture(
      128,
      (u, v) => {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        const line = edge < 0.025 ? 0.9 : 1;
        const shade = 1 - 0.035 * Math.sin(u * 3.1) * Math.sin(v * 2.3);
        const c = 236 * line * shade;
        return [c * 0.95, c * 0.97, c, 255];
      },
      { repeat: true, color: true },
    );
  }
  return roadTex;
}

// Trava: blagi šahovski uzorak (kao pokošen teren).
let grassTex;
export function grassTexture() {
  if (!grassTex) {
    grassTex = dataTexture(
      64,
      (u, v) => {
        const checker = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
        const n = Math.sin(u * 40) * Math.sin(v * 37) * 4;
        const base = checker ? [128, 214, 96] : [116, 202, 88];
        return [base[0] + n, base[1] + n, base[2] + n, 255];
      },
      { repeat: true, color: true },
    );
  }
  return grassTex;
}
