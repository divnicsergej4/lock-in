// Challenge of the week (Home) and "We noticed" spending patterns (Spending).

import { isNeed } from './categories';
import { DAY_MS, monthOffset } from './dates';
import { fmt } from './format';
import { daysOfData, totalSpent } from './money';
import { categoryStreak } from './streak';
import type { AppState } from './types';

export interface Challenge {
  label: string; // "Challenge of the week"
  cat: string | null;
  title: string; // "7 days without: Coffee"
  text: string;
  run: number; // 0..7
  done: boolean;
}

/**
 * The want (not need) category with the most money in the last 30 days;
 * the run counts days in a row without spending on it.
 */
export function weeklyChallenge(s: AppState, now: number): Challenge {
  const from = now - 30 * DAY_MS;
  const byc: Record<string, number> = {};
  s.exp.forEach((x) => {
    if (x.t >= from && !x.auto && !isNeed(x.cat)) byc[x.cat] = (byc[x.cat] || 0) + x.amt;
  });
  const cat = Object.keys(byc).sort((a, b) => byc[b] - byc[a])[0] || null;
  const label = 'Challenge of the week';
  if (!cat) return { label, cat: null, title: '', text: 'Log a few expenses and I’ll pick a challenge for you.', run: 0, done: false };
  const cs = categoryStreak(s, cat, now);
  const run = Math.min(cs, 7);
  return {
    label,
    cat,
    title: '7 days without: ' + cat,
    text: 'That’s where most of your money goes. Your run: ' + run + ' / 7 days.' + (cs >= 7 ? ' Challenge complete! 🏆' : ''),
    run,
    done: cs >= 7,
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PATTERNS_EMPTY = 'I need at least 2 weeks of expenses to spot patterns.';

/** "We noticed": the expensive weekday (after 2 weeks of data) and categories up 20%+ on last month. */
export function patterns(s: AppState, now: number): string[] {
  const out: string[] = [];
  const dy = daysOfData(s, now);
  if (dy >= 14) {
    const sm = [0, 0, 0, 0, 0, 0, 0];
    const weeks = Math.floor(dy / 7) + 1;
    const avg = totalSpent(s) / dy;
    let bi = 0;
    s.exp.forEach((x) => (sm[new Date(x.t).getDay()] += x.amt));
    sm.forEach((v, i) => {
      if (v > sm[bi]) bi = i;
    });
    if (sm[bi] / weeks > avg * 1.3)
      out.push('Your biggest spending day is ' + WEEKDAYS[bi] + ': about ' + fmt(sm[bi] / weeks - avg) + ' ' + s.cur + ' more than an average day.');
  }
  const cm: Record<string, number> = {};
  const lm: Record<string, number> = {};
  s.exp.forEach((x) => {
    const k = monthOffset(x.t, now);
    if (k === 0) cm[x.cat] = (cm[x.cat] || 0) + x.amt;
    if (k === -1) lm[x.cat] = (lm[x.cat] || 0) + x.amt;
  });
  Object.keys(cm).forEach((k) => {
    if (lm[k] && cm[k] >= lm[k] * 1.2) out.push('You spent ' + Math.round((cm[k] / lm[k] - 1) * 100) + '% more on ' + k + ' this month than last month.');
  });
  return out;
}
