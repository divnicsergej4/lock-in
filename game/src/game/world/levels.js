// Nivoi: talasi zombija (sve teži), polja napredovanja, eksplozivna buradi i šef na svakom trećem nivou.
import { createRng } from '../core/rng.js';
import { themeFor } from './themes.js';
import { LANE_X } from '../core/config.js';
import { WEAPON_ORDER } from '../combat/weapons.js';

const COST = { walker: 1, runner: 1.4, bloater: 2.6, brute: 6 };

export function getLevel(n) {
  const rng = createRng(n * 7907 + 3);
  const L = Math.min(n, 20);
  const bossLevel = n % 3 === 0;
  const waveCount = n === 1 ? 4 : Math.min(9, 4 + Math.floor((n + 1) / 2));
  // Prva dva nivoa su uvod: manje zombija dok igrač uči
  const ease = n === 1 ? 0.7 : n === 2 ? 0.85 : 1;
  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    const last = w === waveCount - 1;
    let budget = 5 + L * 1.25 + w * (1.6 + L * 0.35);
    if (last) budget *= 1.45;
    budget *= ease;
    const groups = [];
    const addGroup = (type, count, from) => {
      if (count > 0) groups.push({ type, count, from });
    };
    // Krupni zombiji i naduvenci se pojavljuju od drugog nivoa
    if (n >= 2 && (w >= 2 || (n >= 4 && w >= 1)) && rng.chance(0.35 + L * 0.03)) {
      const c = 1 + (rng.chance(L * 0.04) ? 1 : 0);
      addGroup('brute', c, 'front');
      budget -= c * COST.brute;
    }
    if (n >= 2 && rng.chance(0.4 + L * 0.03)) {
      const c = 1 + Math.floor(rng.range(0, 1 + L * 0.15));
      addGroup('bloater', c, rng.chance(0.5) ? 'front' : 'alleyL');
      budget -= c * COST.bloater;
    }
    if (w >= 1 || n >= 2) {
      const c = Math.round(rng.range(0.15, 0.35) * budget / COST.runner);
      addGroup('runner', c, rng.chance(0.6) ? 'front' : 'alleyL');
      budget -= c * COST.runner;
    }
    // Ostatak su obični zombiji: deo spreda, deo iz bočnih ulica
    const walkers = Math.max(3, Math.round(budget));
    const fromAlley = Math.round(walkers * rng.range(0.15, 0.4));
    addGroup('walker', walkers - fromAlley, 'front');
    addGroup('walker', fromAlley, 'alleyL');
    // Od trećeg nivoa zombiji ponekad dolaze i sa desne strane (kroz polja napredovanja)
    if (n >= 3 && w >= 1 && rng.chance(0.25 + L * 0.03)) addGroup('runner', 2 + Math.floor(L / 3), 'alleyR');
    waves.push({ groups, label: last ? (bossLevel ? 'POSLEDNJI TALAS!' : 'VELIKI TALAS!') : `TALAS ${w + 1}`, spawnTime: 5 + w * 0.6 });
  }

  // Eksplozivna buradi u levoj traci
  const barrels = [];
  const barrelCount = 2 + (n % 2);
  for (let i = 0; i < barrelCount; i++) barrels.push({ x: -LANE_X + rng.range(-1.4, 1.4), z: -14 - i * 11 - rng.range(0, 4) });

  return {
    number: n,
    theme: themeFor(n),
    waves,
    barrels,
    boss: bossLevel ? (Math.floor(n / 3) % 2 === 1 ? 'giant' : 'queen') : null,
    // Zombiji jačaju sve brže kako nivoi rastu (da nadogradnje ne učine igru prelakom)
    hpMul: 1 + 0.13 * (n - 1) + 0.014 * (n - 1) * (n - 1),
    dmgMul: 1 + 0.08 * (n - 1),
    speedMul: 1 + 0.015 * L,
    chargeMul: 1 + 0.12 * (n - 1),
    coinMul: 1 + 0.08 * (n - 1),
  };
}

// Bira sledeći red polja napredovanja (par polja jedno pored drugog, ili jedno široko).
// state = { ammo, ammoPerShot, weapon, multishot, rowIndex, needAmmo }
export function nextFieldRow(rng, n, state) {
  const L = Math.min(n, 20);
  const xs = [LANE_X - 1.15, LANE_X + 1.15];
  const numeric = (stat, min, max, neg = 0) => {
    let value = Math.round(rng.range(min, max) / 5) * 5;
    if (neg && rng.chance(neg)) value = -Math.round(rng.range(5, 10 + L * 1.5) / 5) * 5;
    return { type: stat, value };
  };
  const special = () => {
    const pool = [
      ['bullets2', 3], ['damage2', 3], ['rate', 2.5], ['fire', 2],
      ['bullets3', 0.6 + L * 0.08], ['damage3', 0.6 + L * 0.08],
    ];
    if (WEAPON_ORDER.indexOf(state.weapon) < WEAPON_ORDER.length - 1) pool.push(['weapon', 1.8]);
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let r = rng.next() * total;
    for (const [k, w] of pool) {
      if ((r -= w) <= 0) return { type: k };
    }
    return { type: 'bullets2' };
  };
  const ammoBase = 15 + Math.min(15, L);

  // Kad junaku ponestaje municije, odmah dolazi polje sa municijom
  if (state.needAmmo) {
    return [{ ...numeric('ammo', ammoBase, ammoBase + 15), x: xs[0] }, { ...(rng.chance(0.5) ? special() : numeric('ammo', ammoBase, ammoBase + 10, 0.5)), x: xs[1] }];
  }
  // Ponekad jedno široko polje preko cele trake
  if (rng.chance(0.14)) {
    const f = rng.chance(0.5) ? special() : numeric('ammo', ammoBase + 10, ammoBase + 25);
    return [{ ...f, x: LANE_X, halfW: 2.2 }];
  }
  const pick = () => {
    const r = rng.next();
    if (r < 0.36) return numeric('ammo', ammoBase - 5, ammoBase + 10, 0.22);
    if (r < 0.5) return numeric('health', 15, 30, 0.25);
    if (r < 0.58) return numeric('coins', 15, 40, 0.15);
    return special();
  };
  const a = pick();
  let b = pick();
  for (let i = 0; i < 4 && b.type === a.type; i++) b = pick();
  return rng.chance(0.5) ? [{ ...a, x: xs[0] }, { ...b, x: xs[1] }] : [{ ...b, x: xs[0] }, { ...a, x: xs[1] }];
}
