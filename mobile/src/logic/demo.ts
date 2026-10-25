// Demo (prototype demoData): two months of made-up data so every screen looks full: coffee almost
// every day, groceries, food, taxis, nights out at the weekend, rent, bills, one Netflix / Spotify /
// gym subscription, salaries, four envelopes, limits, a monthly plan and a shared goal with three people.
// The same date gives the same data (a seeded random), and amounts are scaled to the user's currency.
// The random numbers are drawn in exactly the prototype's order, so both show the same demo.

import { day0, monthKey } from './dates';
import { fmt } from './format';
import { RATES } from './money';
import type { AppState, Expense, Income } from './types';

const DAY = 864e5;

export function demoData(s: AppState, now: number): AppState {
  const n0 = new Date(now);
  const f = RATES.RSD / (RATES[s.cur] || RATES.RSD);
  let sd = n0.getFullYear() * 400 + n0.getMonth() * 32 + n0.getDate();
  const rnd = () => {
    sd = (sd * 1103515245 + 12345) % 2147483648;
    return sd / 2147483648;
  };
  const between = (a: number, b: number) => a + (b - a) * rnd();
  // amounts are written in dinars, then turned into the user's currency and rounded like a person would
  const A = (x: number) => {
    const v = x * f;
    return v >= 100 ? Math.round(v / 10) * 10 : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  };
  const day = (k: number, h = 12, m = 0) => new Date(n0.getFullYear(), n0.getMonth(), n0.getDate() - k, h, m).getTime();
  const ex: Expense[] = [];
  const ins: Income[] = [];
  const T = now;
  const N = 60;
  const gap = 26; // one day without anything logged
  const add = (k: number, h: number, amt: number, cat: string, note: string, o?: Partial<Expense>) => {
    const t = day(k, h, Math.floor(rnd() * 59));
    if (t > T) return;
    ex.push({ amt: A(amt), cat, t, note, ...o });
  };
  for (let k = N; k >= 0; k--) {
    const d = new Date(day(k));
    const wd = d.getDay();
    const dm = d.getDate();
    if (dm === 1) {
      ins.push({ amt: A(95000), t: day(k, 9), type: 'Salary', note: 'Salary' });
      add(k, 10, 22000, 'Rent', 'Rent', { auto: true });
      add(k, 11, 2600, 'Transportation', 'Monthly pass');
    }
    if (dm === 5) add(k, 18, 3500, 'Gym', 'Gym', { sub: true });
    if (dm === 10) add(k, 19, 5500, 'Bills', 'Power and internet');
    if (dm === 12) add(k, 21, 1200, 'Other', 'Netflix', { sub: true });
    if (dm === 18) add(k, 20, 700, 'Other', 'Spotify', { sub: true });
    if (k === gap) continue;
    if (rnd() < 0.85 || k === 0) add(k, k === 0 ? Math.min(9, n0.getHours()) : 9, between(250, 380), 'Coffee', 'coffee');
    if (rnd() < 0.2) add(k, 15, between(250, 380), 'Coffee', 'coffee with a friend');
    if (wd % 3 === 0 || rnd() < 0.12) add(k, 18, between(1800, 4200), 'Groceries', 'groceries');
    if (rnd() < 0.3) {
      // the prototype picks a Serbian and an English note with two draws; only the English one is shown
      const amt = between(600, 1400);
      rnd();
      add(k, 13, amt, 'Food', ['burger', 'pizza', 'gyros'][Math.floor(rnd() * 3)]);
    }
    if (rnd() < 0.25) add(k, 22, between(150, 450), 'Transportation', 'taxi');
    if ((wd === 5 || wd === 6) && rnd() < 0.6) add(k, 23, between(1500, 5500), 'Nights out', 'night out');
    if (rnd() < 0.05) add(k, 17, between(3000, 8000), 'Clothes', 'hoodie');
    if (rnd() < 0.04) add(k, 20, between(1000, 3500), 'Gaming', 'game');
    if (rnd() < 0.05) add(k, 16, between(300, 1500), 'Other', 'bits and pieces');
  }
  ins.push({ amt: A(5000), t: day(40, 14), type: 'Gift', note: 'Birthday' });
  ex.sort((a, b) => a.t - b.t);
  // each subscription is listed once, by its latest payment
  const sn: Record<string, 1> = {};
  for (let j = ex.length - 1; j >= 0; j--)
    if (ex[j].sub) {
      if (sn[ex[j].note]) delete ex[j].sub;
      else sn[ex[j].note] = 1;
    }
  ins.sort((a, b) => a.t - b.t);
  const added = ins.reduce((t, x) => t + x.amt, 0);
  const spent = ex.reduce((t, x) => t + x.amt, 0);
  const mo = monthKey(now);
  const t0 = day(N, 9);
  return {
    v: 1,
    cur: s.cur,
    cur2: null,
    start: A(30000) + Math.max(0, spent - added + A(90000)),
    start2: 0,
    added,
    income: A(95000),
    roast: s.roast,
    theme: s.theme,
    exp: ex,
    ins,
    cats: [],
    env: [
      { id: 'dm1', n: 'Laptop', b: A(42000), t: A(150000), due: T + 210 * DAY },
      { id: 'dm2', n: 'Summer trip', b: A(18000), t: A(80000), due: T + 130 * DAY },
      { id: 'dm3', n: 'Mom’s birthday', b: A(6000), t: A(10000), due: T + 28 * DAY },
      { id: 'dm4', n: 'Emergency', b: A(20000), t: 0, due: 0 },
    ],
    lim: { 'Nights out': A(16000), Coffee: A(9000), Food: A(10000) },
    rec: [
      { k: 'o', amt: A(22000), day: 1, note: 'Rent', cat: 'Rent', last: mo },
      { k: 'o', amt: A(5500), day: 10, note: 'Power and internet', cat: 'Bills', last: mo },
      { k: 'i', amt: A(95000), day: 1, note: 'Salary', cat: 'Salary', last: mo },
    ],
    chk: {},
    t0,
    tk0: day0(t0),
    plan: { items: { Rent: A(22000), Bills: A(5500), Groceries: A(34000) }, save: A(15000) },
    fold: {},
    team: {
      n: 'Summer trip to Greece',
      t: A(240000),
      c: [
        { who: 'Me', amt: A(52000), t: day(30) },
        { who: 'Marko', amt: A(38000), t: day(20) },
        { who: 'Ana', amt: A(31000), t: day(9) },
      ],
    },
    tutSeen: 1,
  };
}

/** The shared goal as the demo shows it: total, percent and what each person put in. */
export function teamSummary(s: AppState): { name: string; line: string; pct: number; people: string[] } | null {
  const T = s.team;
  if (!T || !(T.t > 0)) return null;
  let sum = 0;
  const by: Record<string, number> = {};
  T.c.forEach((c) => {
    sum += c.amt;
    by[c.who] = (by[c.who] || 0) + c.amt;
  });
  const pct = Math.min(100, Math.round((sum / T.t) * 100));

  return { name: T.n, line: fmt(sum) + ' / ' + fmt(T.t) + ' ' + s.cur, pct, people: Object.keys(by).map((k) => k + ': ' + fmt(by[k])) };
}

export const DEMO_ON = 'Demo is on. The numbers are made up, just so you can see how everything looks once it fills up.';
export const DEMO_OFF = 'Demo is off. Your own data is back.';
export const DEMO_NO = 'This is a demo, it’s look only. Exit the demo to log your own.';
