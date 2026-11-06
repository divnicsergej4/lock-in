// Pravi jedan HTML fajl sa celom igrom (za probu preko linka u pregledaču telefona).
// Pokreni posle `npm run export:web`. Rezultat: dist/army-rush-3d.html
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = 'dist/_expo/static/js/web';
const file = readdirSync(dir).find((f) => f.endsWith('.js'));
const js = readFileSync(`${dir}/${file}`, 'utf8').replace(/<\/script/gi, '<\\/script');

const html = `<title>Army Rush 3D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  :root { --sky: #8fd6ff; color-scheme: light; }
  html, body { height: 100%; }
  body { background: var(--sky); overflow: hidden; overscroll-behavior: none; }
  #root { display: flex; height: 100%; flex: 1; touch-action: none; user-select: none; -webkit-user-select: none; }
</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync('dist/army-rush-3d.html', html);
console.log('Napravljeno: dist/army-rush-3d.html', Math.round(html.length / 1024), 'KB');
