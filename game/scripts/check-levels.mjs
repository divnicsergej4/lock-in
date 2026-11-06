// Provera: da li je svaki nivo moguće preći kad igraš najbolje.
import { generateLevel } from '../src/game/levelGen.js';
import { applyOp } from '../src/game/gates.js';
let ok = true;
for (let n = 1; n <= 30; n++) {
  const lvl = generateLevel(n);
  let c = lvl.startCount, worst = lvl.startCount;
  for (const it of lvl.items) {
    if (it.kind === 'gate') {
      c = Math.max(applyOp(c, it.left), applyOp(c, it.right));
      worst = Math.min(applyOp(worst, it.left), applyOp(worst, it.right));
    } else { c -= it.count; worst -= it.count; }
    if (c <= 0) { ok = false; console.log('nivo', n, 'pao usput'); }
  }
  const win = c > lvl.enemy.count;
  if (!win) ok = false;
  console.log(`nivo ${n}: kapija ${lvl.items.filter(i=>i.kind==='gate').length}, odreda ${lvl.items.filter(i=>i.kind==='squad').length}, najbolje ${c}, neprijatelj ${lvl.enemy.count}, najgore ${worst} ${win ? 'OK' : 'NEMOGUĆE'}`);
}
process.exit(ok ? 0 : 1);
