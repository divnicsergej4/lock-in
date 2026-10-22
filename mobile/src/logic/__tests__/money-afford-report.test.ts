import {
  canIAfford,
  rateTo,
  V_ALMOST_ALL,
  V_BIG_PART,
  V_EASY,
  V_FIXED_COSTS,
  V_IN_ENVELOPES,
  V_MUST,
  V_NOT_ENOUGH,
  V_OVER_HALF,
  VERDICTS_BY_WORK,
} from '../afford';
import { parseAmount } from '../format';
import { currentBalance, freeBalance, monthByCategory, upcomingFixed } from '../money';
import { monthGrade } from '../report';
import type { Envelope } from '../types';
import { at, exp, NOW, state } from './helpers';

const env = (b: number, t = 0, due = 0, n = 'Trip'): Envelope => ({ id: n, n, b, t, due });

describe('money', () => {
  test('balance ignores expenses paid in the second currency', () => {
    const s = state({ start: 1000, added: 200, exp: [exp(100, 'Food', NOW), exp(50, 'Food', NOW, { c2: true, oa: 6000 })] });
    expect(currentBalance(s)).toBe(1100);
  });

  test('Available = balance minus envelopes', () => {
    expect(freeBalance(state({ start: 1000, env: [env(300), env(150)] }))).toBe(550);
  });

  test('month by category', () => {
    const s = state({ exp: [exp(10, 'Coffee', NOW), exp(5, 'Coffee', NOW), exp(40, 'Food', at(2026, 9, 3))] });
    expect(monthByCategory(s, 0, NOW)).toEqual({ byCat: { Coffee: 15 }, total: 15 });
    expect(monthByCategory(s, -1, NOW)).toEqual({ byCat: { Food: 40 }, total: 40 });
  });

  test('upcoming fixed costs skip ones already paid this month', () => {
    const s = state({
      rec: [
        { k: 'o', cat: 'Rent', amt: 400, day: 31, note: 'Flat' },
        { k: 'o', cat: 'Gym', amt: 30, day: 25 },
        { k: 'o', cat: 'Subscription', amt: 10, day: 1, last: '2026-10' },
        { k: 'i', cat: 'Salary', amt: 1500, day: 1 },
      ],
    });
    expect(upcomingFixed(s, NOW)).toEqual({ sum: 430, list: [{ n: 'Gym', a: 30, d: 25 }, { n: 'Flat', a: 400, d: 31 }] });
  });

  test('parseAmount drops thousands commas and spaces', () => {
    expect(parseAmount('1,250.50')).toBe(1250.5);
    expect(parseAmount(' 12 000 ')).toBe(12000);
  });
});

describe('Can I afford it?', () => {
  test('checks that come first', () => {
    expect(canIAfford(state({ start: 100 }), 150, '', NOW).verdict).toBe(V_NOT_ENOUGH);
    expect(canIAfford(state({ start: 100, env: [env(80)] }), 50, '', NOW).verdict).toBe(V_IN_ENVELOPES);
    const rec = [{ k: 'o' as const, cat: 'Rent', amt: 400, day: 30 }];
    expect(canIAfford(state({ start: 500, rec }), 200, '', NOW).verdict).toBe(V_FIXED_COSTS);
  });

  test('without a salary: share of free money', () => {
    const s = state({ start: 1000 });
    expect(canIAfford(s, 50, '', NOW).verdict).toBe(V_EASY);
    expect(canIAfford(s, 200, '', NOW).verdict).toBe(V_MUST);
    expect(canIAfford(s, 400, '', NOW).verdict).toBe(V_BIG_PART);
    expect(canIAfford(s, 700, '', NOW).verdict).toBe(V_OVER_HALF);
    expect(canIAfford(s, 900, '', NOW).verdict).toBe(V_ALMOST_ALL);
  });

  test('with a salary: by days of work (22 working days)', () => {
    const s = state({ start: 100000, income: 2200 }); // 100 per working day
    expect(canIAfford(s, 500, 'Shoes', NOW)).toEqual({
      verdict: VERDICTS_BY_WORK[0],
      lines: ['After buying it you’d have 99,500 EUR of free money left.', 'Shoes = 5 days of work for you.'],
    });
    expect(canIAfford(s, 1500, '', NOW).verdict).toBe(VERDICTS_BY_WORK[1]);
    expect(canIAfford(s, 6000, '', NOW).verdict).toBe(VERDICTS_BY_WORK[5]);
  });

  test('says which goal the purchase pushes back', () => {
    const s = state({ start: 1000, env: [env(100, 600, at(2026, 11, 1))] }); // free 900, goal needs 500 more
    expect(canIAfford(s, 300, '', NOW).lines).toContain('You have enough free money for this and for all your goals.');
    expect(canIAfford(s, 600, '', NOW).lines).toContain('Your free money would have covered “Trip”. After this you’d need to set aside about 20 EUR a day until Nov 1, 2026');
  });

  test('rateTo picks day / week / month', () => {
    expect(rateTo(100, at(2026, 11, 1), NOW)).toMatchObject({ u: 'd', dl: 10, a: 10 });
    expect(rateTo(700, at(2026, 12, 31), NOW)).toMatchObject({ u: 'w', dl: 70, a: 70 });
    expect(rateTo(100, at(2027, 6, 1), NOW).u).toBe('m');
    expect(rateTo(100, at(2026, 10, 20), NOW).past).toBe(true);
  });
});

describe('monthly report grade', () => {
  test('nothing spent this month: no grade', () => {
    expect(monthGrade(state(), NOW)).toBeNull();
  });

  test.each([
    [500, 'A'],
    [700, 'B'],
    [900, 'C'],
    [1000, 'D'],
    [1001, 'F'],
  ])('with income 1000, spent %s -> %s', (spent, g) => {
    expect(monthGrade(state({ income: 1000, exp: [exp(spent, 'Food', NOW)] }), NOW)?.grade).toBe(g);
  });

  test('without income: compared to last month, or not enough data', () => {
    const last = exp(100, 'Food', at(2026, 9, 10));
    expect(monthGrade(state({ exp: [last, exp(90, 'Food', NOW)] }), NOW)?.grade).toBe('A');
    expect(monthGrade(state({ exp: [last, exp(130, 'Food', NOW)] }), NOW)?.grade).toBe('D');
    expect(monthGrade(state({ exp: [exp(130, 'Food', NOW)] }), NOW)).toEqual({ grade: '–', line: 'I need more data for a real verdict.' });
  });
});
