// Automatski igrač za proveru težine (pokreće igru u pregledaču bez ekrana i igra nivoe).
// Upotreba: npm run build:link, pa: node scripts/sim-bot.cjs <folder sa zwrapped.html> 1,2,3   (EV=1 za dnevnik događaja)
// zwrapped.html = dist/zombie-rush-3d.html umotan u <!doctype html><html><body>...</body></html>
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2]; const levels = (process.argv[3]||'1').split(',').map(Number); const shots = process.argv[4] === 'shots';
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,300)); });
  await page.goto('file://' + out + '/zwrapped.html');
  await page.waitForTimeout(3500);
  if (shots) await page.screenshot({ path: `${out}/z-menu.png` });
  await page.evaluate(() => { const g = window.__game; g.running = false;
    window.__bot = (g) => {
      const p = g.player; const front = p.z - p.depth();
      if (g.phase === 'boss') { g.steerTo(0); return; }
      const leftThreat = g.horde.list.filter(z => z.alive && z.x < 0 && front - z.z < 26 && front - z.z > -1).length;
      let side = leftThreat >= 5 ? -1 : 1;
      let x = side * 3;
      if (side > 0) {
        const pri = { weapon: 9, double: 7, sold20: 6, dmg10: 5, rate15: 5, speed20: 4, sold10: 3, sold5: 2 };
        const row = g.world.cubes.filter(c => c.alive && front - c.z < 24 && front - c.z > -0.5).sort((a, b) => b.z - a.z);
        if (row.length) { const z0 = row[0].z; const best = row.filter(c => Math.abs(c.z - z0) < 0.5).sort((a, b) => pri[b.kind] - pri[a.kind])[0]; x = Math.max(2.35, Math.min(3.65, best.x)); }
      }
      const sp = g.world.spikes.find(s => s.alive && Math.sign(s.x) === side && front - s.z < 9 && front - s.z > -1);
      if (sp) x = side * 3 + (sp.x > side * 3 ? -0.65 : 0.65);
      g.steerTo(x);
    };
    window.__run = (sec, stop) => { const g = window.__game; let log = [];
      for (let i = 0; i < sec * 60; i++) { window.__bot(g); g.time += 1/60; g.update(1/60);
        if (i % 120 === 0) log.push(`${(g.time).toFixed(0)}s ${g.phase} z${g.player.z.toFixed(0)} n${g.player.count} t${g.stats.tier} k${g.kills} boss${g.world.boss ? Math.ceil(g.world.boss.hp) : '-'}`);
        if (stop && stop(g)) break; if (g.phase === 'won' || g.phase === 'lost') break; }
      g.render(); return { ui: { ...g.ui, toast: g.ui.toast && g.ui.toast.text }, log };
    };
  });
  for (const lv of levels) {
    await page.evaluate((l) => { const g = window.__game; g.loadLevel(l); g.intro = 1; g.start(); g.time = 0; }, lv);
    if (shots) {
      for (const [name, sec] of [['z-a', 3], ['z-b', 5], ['z-c', 6], ['z-d', 7]]) {
        const r = await page.evaluate((s) => window.__run(s), sec); await page.waitForTimeout(500);
        await page.screenshot({ path: `${out}/${name}${lv}.png` }); console.log(name, JSON.stringify(r.ui).slice(0, 200));
      }
      const r2 = await page.evaluate(() => window.__run(200, (g) => g.phase === 'boss' && (g.__bb = (g.__bb||0)+1) > 150));
      await page.waitForTimeout(500); await page.screenshot({ path: `${out}/z-boss${lv}.png` }); console.log('boss', JSON.stringify(r2.ui).slice(0, 200));
    }
    const r = await page.evaluate(() => window.__run(240));
    console.log('LEVEL', lv, r.ui.phase, 'count', r.ui.count, 'tier', r.ui.tier, 'kills', r.ui.kills, 'coins', r.ui.earned);
    console.log(r.log.join(' | '));
    if (process.env.EV) console.log('DOGADJAJI:', await page.evaluate(() => (window.__game.events_log || []).join(', ')));
    if (shots) { await page.evaluate(() => window.__run(2.5)); await page.waitForTimeout(800); await page.screenshot({ path: `${out}/z-end${lv}.png` }); }
  }
  console.log(errs.slice(0, 8).join('\n'));
  await browser.close();
})();
