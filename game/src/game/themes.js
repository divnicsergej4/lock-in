// Okruženja: svaki nivo izgleda drugačije (nebo, tlo, put, svetlo, predmeti pored puta).
export const THEMES = [
  {
    name: 'GRAD U SUMRAK',
    skyTop: 0x3c4f8f, horizon: 0xf3b48a, fogNear: 38, fogFar: 120,
    ground: [92, 90, 88], ground2: [86, 84, 82], road: 0x5a5e66, roadLine: 0xffd34a,
    hemiSky: 0xffd8b8, hemiGround: 0x3d4450, hemi: 1.15, sun: 0xffc48a, sunInt: 2.2, exposure: 1.05,
    props: ['ruin', 'ruin', 'car', 'lamp', 'bags', 'hedge', 'barrels'],
  },
  {
    name: 'PUSTINJA',
    skyTop: 0x3f8fd8, horizon: 0xf6dcae, fogNear: 45, fogFar: 140,
    ground: [226, 194, 140], ground2: [219, 186, 132], road: 0xa48d6c, roadLine: 0xffffff,
    hemiSky: 0xfff0d8, hemiGround: 0x9c7a50, hemi: 1.2, sun: 0xfff0d0, sunInt: 2.5, exposure: 1.0,
    props: ['cactus', 'cactus', 'rocks', 'tank', 'bags', 'car', 'tent'],
  },
  {
    name: 'ŠUMA',
    skyTop: 0x3d9df2, horizon: 0xc4ecff, fogNear: 45, fogFar: 140,
    ground: [120, 198, 92], ground2: [112, 190, 86], road: 0x8d8478, roadLine: 0xffffff,
    hemiSky: 0xd8efff, hemiGround: 0x5f7f48, hemi: 1.2, sun: 0xfff0d8, sunInt: 2.4, exposure: 1.05,
    props: ['tree', 'tree', 'tree', 'tent', 'tower', 'bags', 'rocks'],
  },
  {
    name: 'SNEG',
    skyTop: 0x7fa6d6, horizon: 0xe8f2ff, fogNear: 35, fogFar: 115,
    ground: [236, 242, 250], ground2: [228, 236, 246], road: 0x8f99a6, roadLine: 0xffc21f,
    hemiSky: 0xeef6ff, hemiGround: 0x9aa8bc, hemi: 1.15, sun: 0xffffff, sunInt: 1.9, exposure: 0.95,
    props: ['pine', 'pine', 'pine', 'bunker', 'crates', 'rocks', 'tank'],
  },
  {
    name: 'OTROVNA ZONA',
    skyTop: 0x2c3a2a, horizon: 0xa9c46e, fogNear: 30, fogFar: 105,
    ground: [92, 108, 62], ground2: [86, 102, 58], road: 0x4b5047, roadLine: 0x9dff4a,
    hemiSky: 0xd8ffb0, hemiGround: 0x3a4a2a, hemi: 1.1, sun: 0xe8ffc0, sunInt: 2.0, exposure: 1.05,
    props: ['deadtree', 'deadtree', 'barrels', 'car', 'tank', 'rocks', 'hedge'],
  },
];

export function themeFor(level) {
  return THEMES[(level - 1) % THEMES.length];
}
