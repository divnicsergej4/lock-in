// The demo must be the same data the prototype's demoData() makes (same seeded random, same order of
// draws, same rounding), with the app's English category names.

import { demoData, teamSummary } from '../demo';

import { at, state } from './helpers';
import { prototype, TO_PROTO } from './prototype';

const FROM_PROTO: Record<string, string> = Object.fromEntries(Object.entries(TO_PROTO).map(([en, sr]) => [sr, en]));

function protoDemo(now: number, cur: string) {
  const p = prototype(now);
  p.S = { cur, lang: 'en', theme: 'dark', roast: 2, g: 'm', exp: [], start: 1 };
  const d = p.call('demoData');
  const cat = (c: string) => FROM_PROTO[c] || c;
  return {
    exp: d.exp.map((e: any) => {
      const o: any = { amt: e.amt, cat: cat(e.cat), t: e.t, note: e.note };
      if (e.auto) o.auto = true;
      if (e.sub) o.sub = true;
      return o;
    }),
    ins: d.ins.map((e: any) => ({ amt: e.amt, t: e.t, type: cat(e.type), note: e.note })),
    start: d.start,
    added: d.added,
    income: d.income,
    env: d.env,
    lim: Object.fromEntries(Object.entries(d.lim).map(([k, v]) => [cat(k), v])),
    plan: { items: Object.fromEntries(Object.entries(d.plan.items).map(([k, v]) => [cat(k), v])), save: d.plan.save },
    rec: d.rec.map((r: any) => ({ ...r, cat: cat(r.cat) })),
    team: d.team,
    t0: d.t0,
    tk0: d.tk0,
  };
}

describe('demo', () => {
  test.each([
    [at(2026, 10, 24, 14), 'EUR'],
    [at(2026, 10, 24, 7), 'RSD'],
    [at(2026, 3, 1, 9), 'USD'],
    [at(2027, 1, 31, 22), 'GBP'],
    [at(2026, 12, 5, 12), 'JPY'],
  ])('same as the prototype at %s in %s', (now, cur) => {
    const want = protoDemo(now, cur);
    const got = demoData(state({ cur, roast: 2 }), now);
    expect(got.exp).toEqual(want.exp);
    expect(got.ins).toEqual(want.ins);
    expect([got.start, got.added, got.income]).toEqual([want.start, want.added, want.income]);
    // envelope names: the prototype's L() gives the English ones
    expect(got.env).toEqual(want.env);
    expect(got.lim).toEqual(want.lim);
    expect(got.plan).toEqual(want.plan);
    expect(got.rec).toEqual(want.rec);
    expect(got.team).toEqual(want.team);
    expect([got.t0, got.tk0]).toEqual([want.t0, want.tk0]);
  });

  test('keeps the user’s currency, theme and roast level, and is marked as toured', () => {
    const d = demoData(state({ cur: 'USD', theme: 'light', roast: 0 }), at(2026, 10, 24, 14));
    expect([d.cur, d.theme, d.roast, d.tutSeen]).toEqual(['USD', 'light', 0, 1]);
    expect(d.exp.length).toBeGreaterThan(60);
  });

  test('shared goal summary', () => {
    const d = demoData(state({ cur: 'EUR' }), at(2026, 10, 24, 14));
    const t = teamSummary(d)!;
    expect(t.name).toBe('Summer trip to Greece');
    expect(t.line).toBe('1,020 / 2,040 EUR');
    expect(t.pct).toBe(50);
    expect(t.people).toEqual(['Me: 440', 'Marko: 320', 'Ana: 260']);
  });
});
