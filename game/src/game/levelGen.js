// Pravi nivo: talasi zombija (leva traka), redovi kocki sa nagradama (desna traka),
// prepreke, buradi, novčići i šef na kraju. Svaki sledeći nivo je teži.
import { createRng } from './rng.js';
import { LANE_X } from './config.js';
import { themeFor } from './themes.js';

export function generateLevel(n) {
  const rng = createRng(n * 7919 + 13);
  const L = Math.min(n, 12);
  const length = 230 + 22 * Math.min(n, 8);
  const items = [];
  const zombieHp = 1 + 0.15 * (n - 1);
  const cubeHp = 1 + 0.12 * (n - 1);

  // Koje kocke mogu da se pojave (bolje češće na težim nivoima)
  const table = [
    ['sold5', 5], ['sold10', 5], ['sold20', 2 + L * 0.3], ['dmg10', 4], ['rate15', 4], ['speed20', 3], ['double', 1.2 + L * 0.15],
  ];
  const pick = () => {
    const total = table.reduce((a, [, w]) => a + w, 0);
    let r = rng.next() * total;
    for (const [k, w] of table) {
      if ((r -= w) <= 0) return k;
    }
    return 'sold5';
  };

  const weaponRows = new Set();
  const weaponCount = n === 1 ? 2 : n < 4 ? 2 : 3;
  let z = -26;
  let section = 0;
  const sections = [];
  while (z > -length) {
    sections.push(z);
    z -= rng.range(20, 26);
  }
  // Raspoređujemo kocke sa novim oružjem ravnomerno kroz nivo
  for (let i = 0; i < weaponCount; i++) weaponRows.add(Math.floor(((i + 0.6) / (weaponCount + 0.2)) * sections.length));

  sections.forEach((sz, idx) => {
    section++;
    // Desna traka: red kocki (skoro uvek)
    if (weaponRows.has(idx)) {
      const side = rng.chance(0.5) ? -1 : 1;
      items.push({ kind: 'cubeRow', z: sz, cubes: [{ kind: 'weapon', x: LANE_X + side }, { kind: pick(), x: LANE_X - side }] });
    } else if (rng.chance(0.85)) {
      items.push({ kind: 'cubeRow', z: sz, cubes: [{ kind: pick(), x: LANE_X - 1 }, { kind: pick(), x: LANE_X + 1 }] });
    }
    // Leva traka: talas zombija
    if (idx > 0) {
      const groups = [];
      const base = 3 + Math.round(L * 0.7) + Math.round(idx * 0.5 + idx * idx * 0.06);
      groups.push({ type: 'walker', count: base });
      if (idx % 2 === 1) groups.push({ type: 'runner', count: 1 + Math.round(L * 0.4 + idx * 0.3) });
      if (n >= 2 && idx % 3 === 2 && idx > 2) groups.push({ type: 'brute', count: 1 + Math.floor(L / 4) });
      if (n >= 3 && idx === Math.floor(sections.length * 0.6)) groups.push({ type: 'mutant', count: 1 });
      if (n === 1 && idx === sections.length - 2) groups.push({ type: 'brute', count: 1 });
      items.push({ kind: 'wave', z: sz - 8, groups });
      // Eksplozivna buradi pored zombija
      if (rng.chance(0.5)) items.push({ kind: 'barrel', z: sz - 4, x: -LANE_X + rng.range(-1.6, 1.6) });
    }
    // Ponekad zombiji i u desnoj traci (na težim nivoima)
    if (n >= 3 && rng.chance(0.25)) items.push({ kind: 'wave', z: sz - 14, groups: [{ type: 'runner', count: 2 + Math.floor(L / 2) }], right: true });
    // Prepreke sa šiljcima (pola trake)
    if (idx > 1 && rng.chance(0.35)) {
      const lane = rng.chance(0.6) ? 1 : -1;
      items.push({ kind: 'spikes', z: sz - 15, x: lane * LANE_X + (rng.chance(0.5) ? -1.1 : 1.1) });
    }
    // Novčići (nagrada)
    if (rng.chance(0.55)) {
      const lane = rng.chance(0.65) ? -1 : 1;
      items.push({ kind: 'coins', z: sz - 12, x: lane * LANE_X + rng.range(-0.6, 0.6), count: 5 });
    }
  });

  const arenaZ = -length - 10;
  return {
    number: n,
    // Na težim nivoima kreće se sa većom vojskom i boljim oružjem
    startArmy: Math.min(45, 15 + 3 * (n - 1)),
    startTier: Math.min(3, Math.floor((n - 1) / 3)),
    theme: themeFor(n),
    length,
    items,
    arenaZ,
    zombieHp,
    cubeHp,
    boss: { hp: 260 * (1 + 0.45 * (n - 1)), minionEvery: Math.max(1.4, 3 - n * 0.15) },
  };
}
