// Pravi jedan HTML fajl sa celom igrom (za probu preko linka u pregledaču telefona).
// Pokreni posle `npm run export:web`. Rezultat: dist/zombie-rush-3d.html
// Fontovi i ostali fajlovi se ubacuju direktno u HTML, pa link radi bez ičega drugog.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const dir = 'dist/_expo/static/js/web';
const file = readdirSync(dir).find((f) => f.endsWith('.js'));
let js = readFileSync(`${dir}/${file}`, 'utf8');

const MIME = { '.ttf': 'font/ttf', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
function walk(d) {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
let inlined = 0;
try {
  for (const p of walk('dist/assets')) {
    const url = '/' + p.slice('dist/'.length);
    if (!js.includes(url)) continue;
    const mime = MIME[extname(p)] || 'application/octet-stream';
    const data = `data:${mime};base64,${readFileSync(p).toString('base64')}`;
    js = js.split(url).join(data);
    inlined++;
  }
} catch {
  // nema foldera assets
}
js = js.replace(/<\/script/gi, '<\\/script');

const html = `<title>Zombie Rush 3D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  :root { --sky: #1a2230; color-scheme: light; }
  html, body { height: 100%; }
  body { background: var(--sky); overflow: hidden; overscroll-behavior: none; }
  #root { display: flex; height: 100%; flex: 1; touch-action: none; user-select: none; -webkit-user-select: none; }
</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync('dist/zombie-rush-3d.html', html);
console.log('Napravljeno: dist/zombie-rush-3d.html', Math.round(html.length / 1024), 'KB, ubačeno fajlova:', inlined);
