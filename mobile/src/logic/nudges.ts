// Local notifications, as plain logic (no Expo here): when the expense reminder and the "don't waste money"
// nudges go off, and which nudge text is used. src/notifications/local.ts schedules them on the phone.

import { dayKey } from './dates';
import { todayCount } from './money';
import type { AppState } from './types';

// ---------------------------------------------------------------------------
// Sergej's texts (26 Oct 2026), copied exactly: do not "fix" spelling, quotes, spaces or emojis.
// ---------------------------------------------------------------------------
/** The rotation: 9:00 and 15:00 on a day with nothing logged yet, and 21:00 on a day with something logged. */
export const NUDGES = [
  'remember what you’re saving for, g',
  'every bit you don’t spend today goes to your goal😉',
  'these ‘small’ purchases add up by the end of the month',
  'boy, you gonna save up a little bit or what?',
  'lock in. no random buys today. stay focused.',
  'your goal won’t fund itself. keep going 💪',
  'future you is watching. make them proud 😌',
  'a coffee here, a snack there… it all counts',
  'skip one thing today. your savings will thank you',
  'today’s a good day to spend nothing 😌',
  'you don’t need it. you just saw it.',
];
/** Every day at 20:00, only if nothing was logged that day; not part of the rotation. */
export const STREAK_NUDGE = 'you’ve been doing good. don’t ruin the streak now 🔥';

/**
 * Sergej's schedule: on a day with nothing logged, 9:00 and 15:00 (rotation) and 20:00 (STREAK_NUDGE); once
 * something is logged that day, the rest of the day's are dropped and one comes at 21:00 (rotation). "Logged"
 * also counts "I didn't spend anything today" (it keeps the streak too). Never between 23:00 and 9:00.
 */
export const NOT_LOGGED_HOURS = [9, 15] as const;
export const STREAK_HOUR = 20;
export const LOGGED_HOUR = 21;
/** How far ahead they are scheduled. iOS keeps at most 64: 10 days × 3 nudges + 10 reminders = 40. */
export const DAYS_AHEAD = 10;

const at = (base: number, dayOffset: number, h: number, m = 0) => {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

/** Done for today: something logged, or "I didn't spend anything today" / the reminder card answered. */
export function loggedToday(s: AppState, now: number): boolean {
  const k = dayKey(now);
  return todayCount(s, now) > 0 || !!(s.chk || {})[k] || s.remDis === k;
}

/**
 * The rotation text for a slot: walks through NUDGES in order, three slots a day (9, 15, 21), so two in a row
 * are never the same and every text comes up.
 */
export function rotationText(t: number): string {
  const d = new Date(t);
  const day = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  const slot = d.getHours() < 12 ? 0 : d.getHours() < 18 ? 1 : 2;
  return NUDGES[(day * 3 + slot) % NUDGES.length];
}

export type Planned = { at: number; body: string };

/** The nudges from now on for DAYS_AHEAD days (only times still ahead, at least a minute away). */
export function nudgePlan(s: AppState, now: number, days = DAYS_AHEAD): Planned[] {
  const out: Planned[] = [];
  const add = (t: number, body: string) => t > now + 60_000 && out.push({ at: t, body });
  for (let d = 0; d < days; d++) {
    if (d === 0 && loggedToday(s, now)) {
      const t = at(now, 0, LOGGED_HOUR);
      add(t, rotationText(t));
      continue;
    }
    for (const h of NOT_LOGGED_HOURS) {
      const t = at(now, d, h);
      add(t, rotationText(t));
    }
    add(at(now, d, STREAK_HOUR), STREAK_NUDGE);
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
  const out: number[] = [];
  for (let d = loggedToday(s, now) ? 1 : 0; d < days; d++) {
    const t = at(now, d, h, m);
    if (t > now + 60_000) out.push(t);
  }
  return out;
}
