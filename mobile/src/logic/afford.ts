// "Can I afford it?" Texts are Sergej's: copy exactly (see docs/FORE.md, section 4).

import { day0, DAY_MS, formatDate } from './dates';
import { fmt, fmt0 } from './format';
import { currentBalance, freeBalance, monthlyIncome, upcomingFixed } from './money';
import type { AppState } from './types';

/** By working days of salary the item costs, cheapest to most expensive (one step per 10 days). */
export const VERDICTS_BY_WORK = [
  'Easy, go for it 😎',
  'If you really must... 🤨',
  'Think hard, that\'s almost a month of work 😬',
  'Bro, that\'s more than a month of work 🥀',
  'Almost two months of work. Put the phone down 💀',
  'Bro, are you seriously asking me this 💀',
];

export const V_NOT_ENOUGH = 'You don’t even have that much right now 🥀';
export const V_IN_ENVELOPES = 'You don\'t have that much free money. You\'d have to take it from your envelopes';
export const V_FIXED_COSTS = 'You could, but then you can’t cover the fixed costs still coming 🥀';
export const V_EASY = 'Easy, go for it!';
export const V_MUST = 'If you really must... 🤨';
export const V_BIG_PART = 'Think hard, that’s a big part of your free money 😬';
export const V_OVER_HALF = 'Bro, that’s more than half of your free money 🥀';
export const V_ALMOST_ALL = 'That\'s almost all of your free money. Lock in';

/** Working days in a month, for "days of work". */
export const WORK_DAYS = 22;

/** How much to put aside per day/week/month to reach `rem` by `due` (prototype rateTo). */
export function rateTo(rem: number, due: number, now: number): { a?: number; u?: 'd' | 'w' | 'm'; dl: number; past?: boolean; today?: boolean } {
  const dl = Math.round((day0(due) - day0(now)) / DAY_MS);
  if (dl < 0) return { past: true, dl };
  if (dl === 0) return { today: true, dl: 0 };
  if (dl <= 31) return { a: rem / dl, u: 'd', dl };
  if (dl <= 92) return { a: rem / (dl / 7), u: 'w', dl };
  return { a: rem / (dl / 30.4), u: 'm', dl };
}

export function rateText(r: { a?: number; u?: 'd' | 'w' | 'm' }, cur: string): string {
  return fmt0(Math.ceil(r.a || 0)) + ' ' + cur + ' ' + { d: 'a day', w: 'a week', m: 'a month' }[r.u || 'd'];
}

export const AFFORD_NO_PRICE = 'Enter the price.';

export function canIAfford(s: AppState, price: number, name: string, now: number): { verdict: string; lines: string[] } {
  const p = price;
  const n = name.trim() || 'That';
  const bal = currentBalance(s);
  const fr = freeBalance(s);
  const U = upcomingFixed(s, now);
  const left = fr - p;
  const inc = monthlyIncome(s);
  const wd = inc > 0 ? p / (inc / WORK_DAYS) : null;
  const cu = ' ' + s.cur;
  const lines: string[] = [];
  let verdict: string;

  if (p > bal) verdict = V_NOT_ENOUGH;
  else if (p > fr) verdict = V_IN_ENVELOPES;
  else if (U.sum > 0 && left < U.sum) verdict = V_FIXED_COSTS;
  else if (wd != null) verdict = VERDICTS_BY_WORK[Math.min(5, Math.floor(wd / 10))];
  else {
    const r = p / Math.max(fr, 1);
    verdict = r < 0.1 ? V_EASY : r < 0.25 ? V_MUST : r < 0.5 ? V_BIG_PART : r < 0.8 ? V_OVER_HALF : V_ALMOST_ALL;
  }

  if (p <= fr) lines.push('After buying it you’d have ' + fmt(left) + cu + ' of free money left.');
  else if (p <= bal) lines.push('Only ' + fmt(Math.max(fr, 0)) + cu + ' is free, the rest is in envelopes.');
  if (U.sum > 0) lines.push('Fixed costs still coming this month: ' + U.list.map((x) => x.n + ' ' + fmt(x.a) + ' (' + x.d + ')').join(', ') + '.');
  if (wd != null) lines.push(n + ' = ' + fmt(Math.round(wd * 10) / 10) + ' days of work for you.');

  // Which savings goal would the purchase push back? Free money fills goals by nearest deadline.
  const G = (s.env || []).filter((e) => e.t > 0 && e.b < e.t).sort((x, y) => (x.due || 9e15) - (y.due || 9e15));
  if (G.length && p <= bal) {
    const alloc = (F: number) =>
      G.map((e) => {
        const rem = e.t - e.b;
        const c = Math.max(0, Math.min(rem, F));
        F -= c;
        return rem - c;
      });
    const A0 = alloc(fr);
    const A1 = alloc(fr - p);
    let hit = -1;
    for (let gi = 0; gi < G.length; gi++)
      if (A1[gi] > A0[gi] + 0.5) {
        hit = gi;
        break;
      }
    if (hit < 0) lines.push('You have enough free money for this and for all your goals.');
    else {
      const g = G[hit];
      const gn = '“' + g.n + '”';
      const r0 = g.due ? rateTo(A0[hit], g.due, now) : null;
      const r1 = g.due ? rateTo(A1[hit], g.due, now) : null;
      if (r1 && r1.a) {
        if (A0[hit] <= 0.5) lines.push('Your free money would have covered ' + gn + '. After this you’d need to set aside about ' + rateText(r1, s.cur) + ' until ' + formatDate(g.due));
        else lines.push('To reach ' + gn + ' by ' + formatDate(g.due) + ' you’d set aside about ' + rateText(r1, s.cur) + ' instead of ' + rateText(r0!, s.cur) + '.');
      } else lines.push('For ' + gn + ' you’d then still need ' + fmt(A1[hit]) + cu + ' instead of ' + fmt(A0[hit]) + cu + '.');
    }
  }
  return { verdict, lines };
}
