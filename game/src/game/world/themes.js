// Okruženja: napuštene ulice (sumrak), razoreni grad (noć, požari), mračna šuma (noć, magla, mesec).
// Svaki nivo koristi jedno okruženje; smenjuju se redom.
export const THEMES = [
  {
    id: 'streets',
    name: 'NAPUŠTENE ULICE',
    skyTop: 0x56657f, horizon: 0xdcb48d, stars: false, moon: false,
    fog: { color: 0xc4a98f, near: 34, far: 100 },
    hemi: { sky: 0xe2e8f2, ground: 0x4a4036, intensity: 1.3 },
    sun: { color: 0xffd6a2, intensity: 2.1 },
    exposure: 1.05,
    ground: [96, 88, 78], ground2: [88, 80, 71],
    road: 0x8f9298, roadTex: 'asphalt', sidewalk: 0xb5b0a8, lines: 0xe9e2c9,
    buildings: { style: 'city', colors: [0xbca68c, 0xa3917e, 0xa8604a, 0x7f8c98, 0xcbb898, 0x8c7a6a], night: false },
    fires: 3, lamps: 'off', ambient: 'dust', baseLight: false, fieldGlow: 0x5fd0ff,
  },
  {
    id: 'ruins',
    name: 'RAZORENI GRAD',
    skyTop: 0x0c0e18, horizon: 0x7c2c1c, stars: true, moon: false,
    fog: { color: 0x3b1d18, near: 28, far: 90 },
    hemi: { sky: 0xc0a8c8, ground: 0x4a3028, intensity: 1.75 },
    sun: { color: 0xffb080, intensity: 2.2 },
    exposure: 1.38,
    ground: [62, 54, 50], ground2: [56, 49, 45],
    road: 0x8a8a92, roadTex: 'asphalt', sidewalk: 0x9a958f, lines: 0xc9b98a,
    buildings: { style: 'ruin', colors: [0x8a8076, 0x766d64, 0x9a7564, 0x6a6a74, 0x857366], night: true },
    fires: 11, lamps: 'flicker', ambient: 'embers', baseLight: true, fieldGlow: 0x6ad8ff, night: true,
  },
  {
    id: 'forest',
    name: 'MRAČNA ŠUMA',
    skyTop: 0x050a14, horizon: 0x1e3a4c, stars: true, moon: true,
    fog: { color: 0x1f3646, near: 22, far: 80 },
    hemi: { sky: 0x9ab8d8, ground: 0x2a3a26, intensity: 1.7 },
    sun: { color: 0xc0d4ff, intensity: 2.1 },
    exposure: 1.38,
    ground: [44, 60, 38], ground2: [40, 55, 34],
    road: 0x9a8a72, roadTex: 'dirt', sidewalk: 0x6a5a48, lines: 0x000000,
    buildings: null,
    fires: 2, lamps: 'none', ambient: 'fireflies', baseLight: true, fieldGlow: 0x7dffb0, night: true,
  },
];

// Raspored okruženja: susedni nivoi su uvek različiti, a šefovi (svaki 3. nivo) se smenjuju kroz sva tri okruženja
export function themeFor(level) {
  const n = level - 1;
  return THEMES[(n + Math.floor(n / 3)) % THEMES.length];
}
