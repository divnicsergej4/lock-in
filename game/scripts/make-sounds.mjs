// Pravi WAV fajlove (za telefon) od istog koda koji web koristi za zvuk: src/audio/synth.js
// Pokreni: node scripts/make-sounds.mjs   (rezultat: assets/audio/*.wav i src/audio/files.native.js)
import { writeFileSync } from 'node:fs';
import { SOUNDS, MUSIC, generateMusic, SR } from '../src/audio/synth.js';

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

let total = 0;
const lines = [];
for (const [name, def] of Object.entries(SOUNDS)) {
  const buf = wav(def.gen());
  writeFileSync(`assets/audio/${name}.wav`, buf);
  total += buf.length;
  lines.push(`  ${name}: require('../../assets/audio/${name}.wav'),`);
}
for (const m of MUSIC) {
  const buf = wav(generateMusic(m));
  writeFileSync(`assets/audio/music-${m}.wav`, buf);
  total += buf.length;
  lines.push(`  'music-${m}': require('../../assets/audio/music-${m}.wav'),`);
}
writeFileSync(
  'src/audio/files.native.js',
  `// Ovaj fajl pravi skripta scripts/make-sounds.mjs (ne menjati ručno).\n// Spisak zvučnih fajlova za telefon.\nexport const FILES = {\n${lines.join('\n')}\n};\n`,
);
console.log('Napravljeno', lines.length, 'zvučnih fajlova,', Math.round(total / 1024), 'KB');
