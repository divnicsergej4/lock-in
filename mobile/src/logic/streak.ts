// Streak (flame). Starts at 1; a day counts when the user logs an expense or taps
// "I didn't spend anything today" (only from 20:00). A missed day puts the flame out.

import { dAdd, day0, dayKey } from './dates';
import type { AppState } from './types';

export interface Tier {
  from: number;
  key: string;
  name: string;
}

export const TIERS: Tier[] = [
  { from: 0, key: 'or', name: 'Orange flame' },
  { from: 5, key: 'bl', name: 'Blue flame' },
  { from: 10, key: 'rd', name: 'Red flame' },
  { from: 14, key: 'gd', name: 'Golden flame' },
  { from: 30, key: 'pu', name: 'Purple flame' },
  { from: 60, key: 'gr', name: 'Lock-in green flame' },
  { from: 90, key: 'di', name: 'Diamond flame' },
  { from: 120, key: 'rb', name: 'Rainbow flame' },
  { from: 365, key: 'lg', name: 'Legendary flame 🗿' },
];

export const NO_SPEND_FROM_HOUR = 20;

/** First day the streak counts from: setup day, or an earlier logged expense. */
export function streakStart(s: AppState, now: number): number {
  if (s.tk0) return s.tk0;
  let f = s.t0 || now;
  s.exp.forEach((x) => {
    if (!x.auto && x.t < f) f = x.t;
  });
  return day0(f);
}

/** Every day from the streak start to today, and whether it was checked. */
export function streakDays(s: AppState, now: number): { t: number; k: string; chk: boolean }[] {
  const t0 = streakStart(s, now);
  const today = day0(now);
  const logged: Record<number, 1> = {};
  const ck = s.chk || {};
  s.exp.forEach((x) => {
    if (!x.auto) logged[day0(x.t)] = 1;
  });
  const days: { t: number; k: string; chk: boolean }[] = [];
  for (let t = t0, g = 0; t <= today && g++ < 5000; t = dAdd(t, 1)) {
    const k = dayKey(t);
    days.push({ t, k, chk: !!logged[t] || !!ck[k] });
  }
  return days;
}

/** Current streak. Today always counts; before it, every day must be checked. */
export function streakInfo(s: AppState, now: number): { n: number; todayChecked: boolean } {
  const days = streakDays(s, now);
  const z = days.length - 1;
  if (z < 0) return { n: 1, todayChecked: false };
  let n = 0;
  for (let i = z; i >= 0; i--) {
    if (i === z || days[i].chk) n++;
    else break;
  }
  return { n, todayChecked: days[z].chk };
}

export function tierIndex(streak: number): number {
  let k = 0;
  TIERS.forEach((t, i) => {
    if (streak >= t.from) k = i;
  });
  return k;
}

/** The "I didn't spend anything today" button shows only after 20:00 and if today isn't checked yet. */
export function canCheckInNoSpend(s: AppState, now: number): boolean {
  return !streakInfo(s, now).todayChecked && new Date(now).getHours() >= NO_SPEND_FROM_HOUR;
}

/** Returns the new check-in map with today marked. */
export function checkIn(s: AppState, now: number): AppState['chk'] {
  return { ...(s.chk || {}), [dayKey(now)]: 1 };
}

/** Days in a row (today included) without spending on `cat`, counted back to the streak start. */
export function categoryStreak(s: AppState, cat: string, now: number): number {
  const t0 = streakStart(s, now);
  const has: Record<number, 1> = {};
  s.exp.forEach((x) => {
    if (!x.auto && x.cat === cat) has[day0(x.t)] = 1;
  });
  let n = 0;
  let t = day0(now);
  while (t >= t0 && n < 400) {
    if (has[t]) break;
    n++;
    t = dAdd(t, -1);
  }
  return n;
}

const days = (n: number) => (n === 1 ? 'day' : 'days');

export interface StreakCard {
  n: number;
  label: string; // "days in a row"
  tier: Tier;
  tierName: string;
  progress: number; // 0..100 toward the next tier
  message: string;
  showNoSpend: boolean; // "I didn’t spend anything today" button
}

export const NO_SPEND_BUTTON = 'I didn’t spend anything today';

export function streakCard(s: AppState, now: number): StreakCard {
  const si = streakInfo(s, now);
  const st = si.n;
  const k = tierIndex(st);
  const T = TIERS[k];
  const N = TIERS[k + 1];
  return {
    n: st,
    label: days(st) + ' in a row',
    tier: T,
    tierName: T.name,
    progress: Math.round((N ? (st - T.from) / (N.from - T.from) : 1) * 100),
    message: !si.todayChecked
      ? 'Log today’s spending. Skip a day and the flame goes out.'
      : N
        ? N.from - st + ' more ' + days(N.from - st) + ' to: ' + N.name
        : 'A whole year in a row. Legend.',
    showNoSpend: !si.todayChecked && new Date(now).getHours() >= NO_SPEND_FROM_HOUR,
  };
}

/**
 * Celebrating a new flame tier. Returns the tier to remember as seen, and a toast when a higher
 * tier was just reached (a lower tier after a lost streak is remembered silently).
 */
export function tierUp(s: AppState, now: number): { tierSeen: number; toast: string | null } {
  const st = streakInfo(s, now).n;
  const k = tierIndex(st);
  if (s.tierSeen == null || k <= s.tierSeen) return { tierSeen: k, toast: null };
  return { tierSeen: k, toast: '🔥 ' + TIERS[k].name + '! ' + st + ' ' + days(st) + ' in a row' };
}
