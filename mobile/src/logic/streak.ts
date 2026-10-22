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
