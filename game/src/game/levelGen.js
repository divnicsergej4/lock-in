// Pravi nivo: raspored kapija, malih crvenih odreda i završne crvene vojske.
// Nivo se računa tako da je pobeda moguća ako biraš pametno, a sve je teže kako nivo raste.

import { createRng } from './rng.js';
import { GOOD_OPS, BAD_OPS, applyOp } from './gates.js';
import { SEGMENT, START_ARMY } from './config.js';

export function generateLevel(levelNumber, startCount = START_ARMY) {
  const rng = createRng(levelNumber * 9973 + 17);
  const gateCount = Math.min(4 + levelNumber, 9);
  const items = [];
  let best = startCount;
  let z = -34;

  for (let i = 0; i < gateCount; i++) {
    const pair = makeGatePair(rng, best);
    const [left, right] = rng.chance(0.5) ? pair : [pair[1], pair[0]];
    items.push({ kind: 'gate', z, left, right });
    best = Math.max(applyOp(best, left), applyOp(best, right));

    const canSquad = levelNumber >= 2 && i > 0 && i < gateCount - 1;
    if (canSquad && rng.chance(0.4 + Math.min(levelNumber, 8) * 0.03)) {
      const count = Math.max(3, Math.round(best * rng.range(0.22, 0.38)));
      items.push({ kind: 'squad', z: z - SEGMENT * 0.5, x: rng.range(-1.6, 1.6), count });
      best -= count;
    }
    z -= SEGMENT;
  }

  const finishZ = z - 6;
  const ratio = Math.min(0.85, 0.5 + 0.04 * (levelNumber - 1));
  const enemyCount = Math.max(6, Math.round(best * ratio));

  return {
    number: levelNumber,
    startCount,
    items,
    finishZ,
    enemy: { z: finishZ - 16, count: enemyCount },
    bestPossible: best,
  };
}

function makeGatePair(rng, current) {
  // Ne dozvoljavamo da množenje napravi ogromne brojeve.
  const goods = GOOD_OPS.filter((op) => {
    if (op.type !== 'mul') return true;
    if (op.value === 3) return current < 50;
    return current < 140;
  });
  if (rng.chance(0.3)) {
    // Dve dobre kapije: treba izabrati bolju.
    const a = rng.pick(goods);
    let b = rng.pick(goods);
    for (let t = 0; t < 5 && b === a; t++) b = rng.pick(goods);
    return [a, b];
  }
  return [rng.pick(goods), rng.pick(BAD_OPS)];
}
