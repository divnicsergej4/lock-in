// Every Skia drawing uses the app's Canvas (components/SkiaCanvas.tsx), which is made anew when its screen comes back
// to the front; a Canvas straight from '@shopify/react-native-skia' stays blank after its screen was hidden on iOS.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

test("no file takes Canvas straight from '@shopify/react-native-skia'", () => {
  const bad = files(SRC).filter((f) => {
    if (f.endsWith(join('components', 'SkiaCanvas.tsx'))) return false;
    const imports = readFileSync(f, 'utf8').match(/import\s*\{[^}]*\}\s*from\s*'@shopify\/react-native-skia'/g) ?? [];
    return imports.some((i) => /[{,\s]Canvas[\s,}]/.test(i));
  });
  expect(bad.map((f) => relative(SRC, f))).toEqual([]);
});

test('the app Canvas is used where Skia draws', () => {
  const users = files(SRC).filter((f) => /from '(@\/components|\.\.?)\/(\.\.\/)*SkiaCanvas'/.test(readFileSync(f, 'utf8')));
  expect(users.length).toBeGreaterThanOrEqual(6);
});
