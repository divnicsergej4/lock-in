import { day0, daysInMonth, monthKey, monthOffset } from './dates';
import type { AppState } from './types';

/** Balance in the main currency (expenses paid in the second currency don't touch it). */
export function currentBalance(s: AppState): number {
  return s.start + (s.added || 0) - s.exp.reduce((t, x) => t + (x.c2 ? 0 : x.amt), 0);
}

export function envelopeSum(s: AppState): number {
  return (s.env || []).reduce((a, e) => a + (e.b || 0), 0);
}

/** "Available" on Home: balance minus money sitting in envelopes. */
export function freeBalance(s: AppState): number {
  return currentBalance(s) - envelopeSum(s);
}

export function monthlyIncome(s: AppState): number {
  return s.income > 0 ? s.income : 0;
}

/** Everything spent in the month of `now`. */
export function monthSpent(s: AppState, now: number): number {
  return s.exp.reduce((ms, x) => (monthOffset(x.t, now) === 0 ? ms + x.amt : ms), 0);
}

/** Spending by category for a month: offset 0 = this month, -1 = last month. */
export function monthByCategory(s: AppState, offset: number, now: number): { byCat: Record<string, number>; total: number } {
  const byCat: Record<string, number> = {};
  let total = 0;
  s.exp.forEach((x) => {
    if (monthOffset(x.t, now) === offset) {
      byCat[x.cat] = (byCat[x.cat] || 0) + x.amt;
      total += x.amt;
    }
  });
  return { byCat, total };
}

/** Expenses the user logged today (automatic ones don't count). */
export function todayCount(s: AppState, now: number): number {
  const d = day0(now);
  return s.exp.filter((x) => !x.auto && x.t >= d).length;
}

/** Recurring expenses that still come this month. */
export function upcomingFixed(s: AppState, now: number): { sum: number; list: { n: string; a: number; d: number }[] } {
  const k = monthKey(now);
  const dim = daysInMonth(now);
  const list: { n: string; a: number; d: number }[] = [];
  let sum = 0;
  (s.rec || []).forEach((r) => {
    if (r.k !== 'o' || r.last === k) return;
    list.push({ n: r.note || r.cat, a: r.amt, d: Math.min(r.day, dim) });
    sum += r.amt;
  });
  list.sort((x, y) => x.d - y.d);
  return { sum, list };
}
