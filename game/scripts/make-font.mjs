// Pretvara font Lilita One (.ttf) u oblik koji three.js zna da pretvori u 3D slova.
// Pokreće se samo kad menjamo font: node scripts/make-font.mjs
import opentype from 'opentype.js';
import { writeFileSync, readFileSync } from 'node:fs';

const src = 'node_modules/@expo-google-fonts/lilita-one/400Regular/LilitaOne_400Regular.ttf';
const buf = readFileSync(src);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const chars = '0123456789+-x×÷/ ABCDEFGHIJKLMNOPQRSTUVWXYZ!';
const scale = 1000 / font.unitsPerEm;
const r = (v) => Math.round(v * scale);
const glyphs = {};
for (const ch of chars) {
  const g = font.charToGlyph(ch);
  if (!g || (g.index === 0 && ch !== ' ')) { console.log('nema znaka', ch); continue; }
  const o = g.getPath(0, 0, font.unitsPerEm).commands.map((c) => {
    // opentype ima y na dole, three.js na gore
    switch (c.type) {
      case 'M': return `m ${r(c.x)} ${r(-c.y)}`;
      case 'L': return `l ${r(c.x)} ${r(-c.y)}`;
      case 'Q': return `q ${r(c.x)} ${r(-c.y)} ${r(c.x1)} ${r(-c.y1)}`;
      case 'C': return `b ${r(c.x)} ${r(-c.y)} ${r(c.x1)} ${r(-c.y1)} ${r(c.x2)} ${r(-c.y2)}`;
      default: return 'z';
    }
  }).join(' ');
  const bb = g.getBoundingBox();
  glyphs[ch] = { ha: r(g.advanceWidth), x_min: r(bb.x1), x_max: r(bb.x2), o };
}
const out = {
  glyphs,
  familyName: 'Lilita One',
  resolution: 1000,
  ascender: r(font.ascender),
  descender: r(font.descender),
  underlineThickness: 50,
  boundingBox: { yMin: r(font.tables.head.yMin), xMin: r(font.tables.head.xMin), yMax: r(font.tables.head.yMax), xMax: r(font.tables.head.xMax) },
};
writeFileSync('src/game/fonts/lilita.json', JSON.stringify(out));
console.log('glifova:', Object.keys(glyphs).length);
