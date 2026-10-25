// Local notifications, as plain logic (no Expo here): when the expense reminder and the "don't waste money"
// nudges go off, and which nudge text is used. src/notifications/local.ts schedules them on the phone.

import { dayKey } from './dates';
import { todayCount } from './money';
import type { AppState, RoastLevel } from './types';

// ---------------------------------------------------------------------------
// The nudge texts. PREDLOG (proposal) for Sergej, not approved yet: when he sends his versions, copy them here
// exactly, with his typos, spacing and emojis. Same rules as the roasts (roasts.ts / docs/FORE.md):
//   Gentle: NUDGES_GENTLE only. Normal: NUDGES lines without "!". No mercy: the "!" lines about 70% of the time,
//   the others otherwise. The "!" is a marker and is not shown.
// ---------------------------------------------------------------------------
export const NUDGES_GENTLE = [
  'quick check: do you really need it today? 🙂',
  "every bit you don't spend today goes to your goal 💚",
  'take a breath before you buy anything 🙂',
  "you're doing fine. keep the wallet closed a little longer 💚",
  "remember what you're saving for 🙂",
];
export const NUDGES = [
  'before you buy it: need it or just want it?',
  'your goal is watching. close the shopping app.',
  "that 'small' purchase adds up by the end of the month",
  'is it worth the hours you worked for it?',
  'lock in. no random buys today.',
  "you don't need another one. you know which one.",
  "!put the phone down. you're about to buy something stupid 🥀",
  '!your wallet is crying rn. stop it 😭',
  '!buy that and future you is broke and mad 🥀🥀',
  '!bruh. close the cart. now.',
];

export type NudgeEvery = 6 | 12 | 24;
export const NUDGE_EVERY: NudgeEvery[] = [6, 12, 24];
export const DEFAULT_NUDGE_EVERY: NudgeEvery = 6;
/** Never at night: nothing from 23:00 until 9:00 (phone time). */
export const QUIET_FROM = 23;
export const QUIET_UNTIL = 9;
/** How far ahead they are scheduled. iOS keeps at most 64; 10 days of nudges every 6 h + reminders = 40. */
export const DAYS_AHEAD = 10;

/** One nudge line for this roast level (like pickRoast). */
export function pickNudge(roast: RoastLevel, rand: () => number = Math.random): string {
  const pick = (a: string[]) => a[Math.floor(rand() * a.length) % a.length];
  if (roast === 0) return pick(NUDGES_GENTLE);
  const hard = NUDGES.filter((x) => x[0] === '!');
  const normal = NUDGES.filter((x) => x[0] !== '!');
  const src = roast === 2 && rand() < 0.7 ? hard : normal;
  return pick(src).replace(/^!/, '');
}

/** The hours of a day a nudge goes off: from 9:00 every `every` hours, before 23:00 (6 h: 9, 15, 21; 12 h: 9, 21; 24 h: 9). */
export function nudgeHours(every: NudgeEvery): number[] {
  const out: number[] = [];
  for (let h = QUIET_UNTIL; h < QUIET_FROM; h += every) out.push(h);
  return out;
}

const at = (base: number, dayOffset: number, h: number, m = 0) => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/** When the nudges go off, from now on for DAYS_AHEAD days (only times still ahead, at least a minute away). */
export function nudgeTimes(now: number, every: NudgeEvery, days = DAYS_AHEAD): number[] {
  const out: number[] = [];
  for (let d = 0; d < days; d++) for (const h of nudgeHours(every)) {
    const t = at(now, d, h);
    if (t > now + 60_000) out.push(t);
  }
  return out;
}

/**
 * When the expense reminder goes off (Settings > Reminder, "If you haven't logged anything by then"): every day
 * at the chosen time, but not today if something was already logged, "I didn't spend anything today" was
 * checked, or the card was answered.
 */
export function reminderTimes(s: AppState, now: number, days = DAYS_AHEAD): number[] {
  const R = s.rem;
  if (!R || !R.on) return [];
  const [h, m] = (R.time || '20:00').split(':').map(Number);
  const k = dayKey(now);
  const doneToday = todayCount(s, now) > 0 || !!(s.chk || {})[k] || s.remDis === k;
  const out: number[] = [];
  for (let d = doneToday ? 1 : 0; d < days; d++) {
    const t = at(now, d, h, m);
    if (t > now + 60_000) out.push(t);
  }
  return out;
}
