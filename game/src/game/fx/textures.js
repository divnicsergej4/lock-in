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

// ---------------- Teksture za okruženja ----------------

function makeTex(w, h, fn, { color = true, repeat = true } = {}) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const i = (y * w + x) * 4;
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = Math.max(0, Math.min(255, a));
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Jednostavan "šum" koji se ponavlja bez šava
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smoothNoise(x, y, size, period, seed) {
  const fx = x / size;
  const fy = y / size;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const p = period / size;
  const v = (a, b) => hash(((a % p) + p) % p, ((b % p) + p) % p, seed);
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const top = v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx;
  const bot = v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bot * sy;
}
function fbm(x, y, period, seed) {
  return smoothNoise(x, y, 32, period, seed) * 0.5 + smoothNoise(x, y, 16, period, seed + 1) * 0.3 + smoothNoise(x, y, 8, period, seed + 2) * 0.2;
}

const texCache = new Map();
function cachedTex(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}

// Asfalt sa pukotinama i zakrpama (sivi; boja se podešava materijalom)
export const asphaltTexture = () =>
  cachedTex('asphalt', () => {
    const S = 256;
    const cracks = new Uint8Array(S * S);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let c = 0; c < 9; c++) {
      let x = rnd() * S;
      let y = rnd() * S;
      let a = rnd() * 6.28;
      for (let i = 0; i < 90; i++) {
        a += (rnd() - 0.5) * 0.9;
        x = (x + Math.cos(a) * 1.2 + S) % S;
        y = (y + Math.sin(a) * 1.2 + S) % S;
        cracks[(y | 0) * S + (x | 0)] = 1;
      }
    }
    return makeTex(S, S, (x, y) => {
      const n = fbm(x, y, S, 3);
      const speck = hash(x, y, 9) > 0.93 ? 18 : 0;
      const patch = smoothNoise(x, y, 64, S, 5) > 0.72 ? -14 : 0;
      let v = 118 + (n - 0.5) * 50 + speck + patch;
      if (cracks[y * S + x]) v -= 55;
      return [v, v, v * 1.02];
    });
  });

// Zemljani put sa tragovima točkova (za šumu)
export const dirtTexture = () =>
  cachedTex('dirt', () => {
    const S = 128;
    return makeTex(S, S, (x, y) => {
      const n = fbm(x, y, S, 11);
      const track = Math.abs(((x / S) * 4) % 2 - 1) < 0.18 ? -16 : 0;
      const pebble = hash(x, y, 4) > 0.95 ? 22 : 0;
      const v = (n - 0.5) * 60;
      return [128 + v + track + pebble, 100 + v + track + pebble, 72 + v * 0.8 + track + pebble];
    });
  });

// Pločice trotoara (1 m)
export const sidewalkTexture = () =>
  cachedTex('sidewalk', () => {
    const S = 64;
    return makeTex(S, S, (x, y) => {
      const edge = x < 2 || y < 2 ? -38 : 0;
      const n = (fbm(x * 2, y * 2, S * 2, 21) - 0.5) * 30;
      const v = 168 + n + edge;
      return [v, v, v];
    });
  });

// Fasada: 4 modula (svaki 4 m širok i 3 m visok) sa po dva prozora: tamno staklo, razbijeno, zakovano daskama, osvetljeno.
// style: 'city' ili 'ruin'. Zid je svetao da bi ga boja zgrade (vertex color) obojila.
export const facadeTexture = (style = 'city') =>
  cachedTex('facade-' + style, () => {
    const W = 512;
    const H = 128;
    const ruin = style === 'ruin';
    return makeTex(W, H, (x, y) => {
      const mod = Math.floor(x / 128);
      const lx = x % 128;
      const ly = y;
      const n = (fbm(x, y, W, ruin ? 41 : 31) - 0.5) * (ruin ? 70 : 36);
      let wall = 205 + n;
      // tragovi gareži (ruševine) i fleke
      if (ruin && smoothNoise(x, y, 32, W, 44) > 0.6) wall -= 70;
      // horizontalna linija sprata
      if (ly < 4) wall -= 30;
      let col = [wall, wall * 0.97, wall * 0.94];
      for (const wx of [24, 74]) {
        const inX = lx >= wx && lx < wx + 30;
        const inY = ly >= 34 && ly < 100;
        const frame = lx >= wx - 3 && lx < wx + 33 && ly >= 31 && ly < 103;
        if (frame && !(inX && inY)) col = [wall * 0.78, wall * 0.76, wall * 0.74];
        if (ly >= 28 && ly < 31 && lx >= wx - 5 && lx < wx + 35) col = [wall * 0.62, wall * 0.6, wall * 0.58];
        if (inX && inY) {
          const gx = lx - wx;
          const gy = ly - 34;
          const kind = ruin ? [1, 1, 2, 3][(mod + (wx > 50 ? 1 : 0)) % 4] : (mod + (wx > 50 ? 2 : 0)) % 4;
          if (kind === 0) {
            // tamno staklo sa odsjajem
            const sh = gx + gy * 0.6 < 18 ? 25 : 0;
            col = [38 + sh + gy * 0.4, 48 + sh + gy * 0.4, 62 + sh + gy * 0.5];
          } else if (kind === 1) {
            // razbijeno: crna rupa sa ostacima stakla
            const shard = hash(gx, gy, 3) > 0.86 && (gy < 10 || gx < 6) ? 70 : 0;
            col = [14 + shard, 15 + shard, 18 + shard * 1.1];
          } else if (kind === 2) {
            // zakovano daskama
            const plank = Math.floor(gy / 13) % 2 === 0;
            const v = plank ? 130 : 110;
            col = [v + n * 0.4, v * 0.75, v * 0.5];
            if (gy % 13 < 2) col = [70, 50, 34];
          } else {
            // osvetljen prozor (topla svetlost iza zavese)
            const curtain = gx < 9 || gx > 21 ? 0.75 : 1;
            col = [255 * curtain, 196 * curtain, 110 * curtain];
          }
          if (gx === 14 || gx === 15) col = [wall * 0.7, wall * 0.68, wall * 0.66];
        }
      }
      return col;
    });
  });

// Svetli prozori za noć (samo osvetljeni prozori svetle, ostalo crno)
export const facadeGlowTexture = (style = 'city') =>
  cachedTex('facadeGlow-' + style, () => {
    const W = 512;
    const H = 128;
    const ruin = style === 'ruin';
    return makeTex(W, H, (x, y) => {
      const mod = Math.floor(x / 128);
      const lx = x % 128;
      for (const wx of [24, 74]) {
        if (lx >= wx && lx < wx + 30 && y >= 34 && y < 100) {
          const kind = ruin ? [1, 1, 2, 3][(mod + (wx > 50 ? 1 : 0)) % 4] : (mod + (wx > 50 ? 2 : 0)) % 4;
          if (kind === 3) return ruin ? [255, 110, 30] : [255, 190, 100];
        }
      }
      return [0, 0, 0];
    });
  });

// Prizemlje: izlozi, vrata, roletne i table prodavnica u boji
export const shopTexture = () =>
  cachedTex('shop', () => {
    const W = 512;
    const H = 128;
    const signs = [[200, 50, 45], [40, 110, 190], [50, 150, 80], [220, 170, 40]];
    return makeTex(W, H, (x, y) => {
      const mod = Math.floor(x / 128);
      const lx = x % 128;
      const n = (fbm(x, y, W, 51) - 0.5) * 30;
      let col = [190 + n, 186 + n, 180 + n];
      // tabla sa nazivom radnje
      if (y >= 96 && y < 116 && lx > 6 && lx < 122) {
        const s = signs[mod];
        const letters = y > 101 && y < 111 && lx > 20 && lx < 108 && hash(Math.floor(lx / 6), mod, 2) > 0.35;
        col = letters ? [235, 230, 210] : s;
      }
      if (mod === 1) {
        // spuštena roletna
        if (lx > 10 && lx < 118 && y > 6 && y < 92) {
          const stripe = Math.floor(y / 5) % 2 ? 150 : 128;
          col = [stripe + n, stripe + n, stripe + 6 + n];
        }
      } else {
        // izlog
        if (lx > 8 && lx < 80 && y > 18 && y < 90) {
          const sh = lx - 8 + (y - 18) * 0.5 < 30 ? 30 : 0;
          const broken = mod === 2 && hash(lx, y, 6) > 0.8 && y > 50;
          col = broken ? [12, 12, 14] : [30 + sh, 42 + sh, 55 + sh];
        }
        // vrata
        if (lx > 90 && lx < 118 && y > 6 && y < 86) col = [70, 52, 38];
        if (lx > 112 && lx < 115 && y > 40 && y < 46) col = [210, 190, 90];
      }
      return col;
    });
  });

// Mrlja (krv, gar) sa nepravilnim ivicama; boja se podešava materijalom
export const splatTexture = () =>
  cachedTex('splat', () => {
    const S = 64;
    return makeTex(
      S,
      S,
      (x, y) => {
        const dx = (x - S / 2) / (S / 2);
        const dy = (y - S / 2) / (S / 2);
        const a = Math.atan2(dy, dx);
        const r = Math.hypot(dx, dy);
        const edge = 0.55 + 0.18 * Math.sin(a * 5 + 1) + 0.1 * Math.sin(a * 11 + 3) + (hash(Math.round(a * 8), 0, 3) - 0.5) * 0.2;
        let alpha = r < edge ? 1 : 0;
        if (hash(x, y, 8) > 0.985 && r < 0.95) alpha = 1;
        const shade = 200 + (hash(x >> 2, y >> 2, 4) - 0.5) * 60;
        return [shade, shade, shade, alpha * 255];
      },
      { repeat: false },
    );
  });

// Mek krug svetla (za lampe, vatru, sjaj na zemlji)
export const glowTexture = () =>
  cachedTex('glow', () => {
    const S = 64;
    return makeTex(
      S,
      S,
      (x, y) => {
        const d = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5) / (S / 2);
        const a = Math.max(0, 1 - d);
        return [255, 255, 255, a * a * 255];
      },
      { repeat: false, color: false },
    );
  });
