// Automatski igrač za proveru težine nivoa (pokreće web verziju u pregledaču bez ekrana i igra nivoe).
// Upotreba (iz foldera game/):
//   npm run build:link
//   node scripts/sim-bot.cjs 1,2,3
//   LOADOUT='{"weapon":"shotgun","dmgMul":1.4,"rateMul":1.2,"ammo":140,"maxHp":160}' node scripts/sim-bot.cjs 4,5,6
// Ispisuje za svaki nivo da li je pređen, broj ubijenih zombija, zlatnike, zvezdice i preostalo zdravlje.
// Igrač: brani se od zombija koji su blizu, kupi najbolja polja (municija kad je malo), puni zaključana polja.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const levels = (process.argv[2] || '1').split(',').map(Number);
  const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'zombie-rush-3d.html'), 'utf8');
  const wrapped = path.join(__dirname, '..', 'dist', 'sim-bot-page.html');
  fs.writeFileSync(wrapped, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">' + html + '</body></html>');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('GREŠKA ' + e.message));
  await page.goto('file://' + wrapped);
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    const g = window.__game;
    g.running = false;
    window.__brain = (g) => {
      const h = g.hero;
      const r = g.run;
      // pretnje: zombiji blizu ili ispred na levoj strani
      let threat = null;
      let td = 1e9;
      for (const z of g.horde.list) {
        if (!z.alive) continue;
        const d = Math.hypot(z.x - h.x, z.z);
        const danger = -z.z < 16 || d < 7;
        if (danger && d < td) { td = d; threat = z; }
      }
      let tx = h.x;
      const fieldsSoon = g.fields.filter((f) => !f.passed && f.z > -16);
      const ammoLow = r.ammo < 12;
      if (threat && (!ammoLow || td < 6)) tx = Math.max(-4.5, Math.min(4.5, threat.x));
      else if (fieldsSoon.length) {
        const score = (f) => (f.def.kind === 'numeric' ? (f.value > 0 ? (f.type === 'ammo' ? (ammoLow ? 200 : 40) : 25) + f.value : -50) : f.unlocked ? 120 : f.charge / Math.max(1, f.need) * 100 - 20);
        const best = fieldsSoon.sort((a, b) => b.z - a.z || score(b) - score(a));
        const row = best.filter((f) => Math.abs(f.z - best[0].z) < 1);
        row.sort((a, b) => score(b) - score(a));
        tx = row[0].x;
      } else if (g.boss && g.boss.alive) tx = g.boss.x;
      else tx = -2.8;
      g.targetX = Math.max(-4.55, Math.min(4.55, tx));
      g.input.down = true;
    };
    window.__play = (sec, stop) => {
      const g = window.__game;
      const log = [];
      for (let i = 0; i < sec * 60; i++) {
        if (g.mode === 'play' && (g.phase === 'fight' || g.phase === 'boss')) window.__brain(g);
        g.time += 1 / 60;
        g.update(1 / 60);
        if (i % 300 === 0 && g.run) log.push(`${Math.round(g.run.time)}s ${g.phase} hp${Math.round(g.run.hp)} am${Math.floor(g.run.ammo)} ${g.run.weapon} x${g.run.multishot} d${g.run.dmgMult} k${g.run.kills} w${g.waveIndex + 1} z${g.horde.countAlive()}`);
        if (stop && stop(g)) break;
        if (g.phase === 'won' || g.phase === 'lost') break;
      }
      g.render();
      return log;
    };
  });
  const lo = JSON.parse(process.env.LOADOUT || '{"weapon":"pistol","dmgMul":1,"rateMul":1,"ammo":80,"maxHp":100}');
  for (const lv of levels) {
    await page.evaluate(([l, loadout]) => window.__game.startLevel(l, loadout), [lv, lo]);
    await page.evaluate(() => window.__play(400));
    const r = await page.evaluate(() => ({ phase: window.__game.phase, result: window.__game.result }));
    const x = r.result || {};
    console.log(`NIVO ${lv}: ${r.phase === 'won' ? 'PREĐEN' : 'IZGUBLJEN'} | ubijeno ${x.kills} | zlatnici ${x.coins}` + (x.won ? ` | zvezdice ${x.stars} | zdravlje ${Math.round(x.hpPct * 100)}%` : ` | pređeno ${Math.round((x.progress || 0) * 100)}%`));
  }
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})();
