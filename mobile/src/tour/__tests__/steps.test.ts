// The tour's texts and buttons are the prototype's English ones, step for step.

import vm from 'vm';

import { fnSource } from '@/logic/__tests__/prototype';

import { STEPS } from '../steps';

function prototypeSteps() {
  const ctx: Record<string, unknown> = { S: { lang: 'en' }, TUT: { v: {} } };
  vm.createContext(ctx);
  vm.runInContext(fnSource('L') + '\n' + fnSource('tutSteps') + '\nthis.__s=tutSteps();', ctx);
  return ctx.__s as { c: string; btn?: string; end?: number; tab?: number; act?: unknown; pos?: string; keep?: number }[];
}

describe('tour steps', () => {
  const P = prototypeSteps();
  test('38 steps, like the prototype', () => {
    expect(P.length).toBe(38);
    expect(STEPS.length).toBe(38);
  });
  test.each(STEPS.map((s, i) => [i + 1, s] as const))('step %i: same text, tab, button and kind', (n, s) => {
    const p = P[n - 1];
    // deliberate: the app has no language setting, so step 37 doesn't name one
    expect(s.c).toBe(n === 37 ? p.c.replace('language, ', '') : p.c);
    expect(s.btn).toBe(p.btn);
    expect(!!s.end).toBe(!!p.end);
    expect(s.tab).toBe(p.tab);
    expect(!!s.act).toBe(!!p.act);
    expect(s.pos).toBe(p.pos);
    expect(!!s.keep).toBe(!!p.keep);
  });
});
