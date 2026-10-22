import { DAY_MS, day0, daysInMonth, monthKey, monthOffset } from './dates';
import { fmt } from './format';
import type { AppState } from './types';

// Rough rates to EUR, typed in by hand in the prototype (not live).
export const RATES: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.05, RSD: 0.0085, BAM: 0.51, MKD: 0.0163, JPY: 0.0061, CAD: 0.67, AUD: 0.61, SEK: 0.087, NOK: 0.086, DKK: 0.134, PLN: 0.23, CZK: 0.04, HUF: 0.0025, RON: 0.2, TRY: 0.027, BGN: 0.51 };

/** An amount in the second currency, in the main currency. */
export function convert(s: AppState, v: number): number {
  return s.cur2 ? (v * RATES[s.cur2]) / RATES[s.cur] : v;
}

/** Balance in the main currency (expenses paid in the second currency don't touch it). */
export function currentBalance(s: AppState): number {
  return s.start + (s.added || 0) - s.exp.reduce((t, x) => t + (x.c2 ? 0 : x.amt), 0);
}

/** Balance in the second currency. */
export function secondBalance(s: AppState): number {
  let b = s.start2 || 0;
  (s.ins || []).forEach((x) => {
    if (x.c2) b += x.oa || 0;
  });
  s.exp.forEach((x) => {
    if (x.c2) b -= x.oa || 0;
  });
  return b;
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

export function totalSpent(s: AppState): number {
  return s.exp.reduce((a, e) => a + e.amt, 0);
}

/** Days since the first expense (or setup, if earlier), as a fraction. 0 without expenses. */
export function daysOfData(s: AppState, now: number): number {
  if (!s.exp.length) return 0;
  let f = Math.min(...s.exp.map((x) => x.t));
  if (s.t0 && s.t0 < f) f = s.t0;
  return (now - f) / DAY_MS;
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

/** Line under "Available" when there is money in envelopes ('' otherwise). */
export function accountLine(s: AppState): string {
  const es = envelopeSum(s);
  return es > 0 ? 'In your account ' + fmt(currentBalance(s)) + ' ' + s.cur + ', of which ' + fmt(es) + ' in envelopes.' : '';
}

/** "Spent X of Y" (shown on Home when there is no monthly income). */
export function spentLine(s: AppState): string {
  const all = s.start + (s.added || 0);
  return 'Spent ' + fmt(all - currentBalance(s)) + ' of ' + fmt(all) + ' ' + s.cur;
}

/** Money in and out on one calendar day. */
export function dayInOut(s: AppState, t: number): { i: number; o: number } {
  const a = day0(t);
  const d = new Date(t);
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  let i = 0;
  let o = 0;
  (s.ins || []).forEach((x) => {
    if (x.t >= a && x.t < b) i += x.amt;
  });
  s.exp.forEach((x) => {
    if (x.t >= a && x.t < b) o += x.amt;
  });
  return { i, o };
}

/** "Spent today 12 EUR, received 50 EUR" */
export function todayLine(s: AppState, now: number): string {
  const io = dayInOut(s, now);
  return 'Spent today ' + fmt(io.o) + ' ' + s.cur + (io.i > 0 ? ', received ' + fmt(io.i) + ' ' + s.cur : '');
}

export { daysInMonth };
