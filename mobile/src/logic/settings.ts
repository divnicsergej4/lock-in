// More tab: Settings and Backup (prototype n-go, st-c2, st-age, rm-on / rm-t, remChk, bk-out / bk-in, reset).

import { dayKey } from './dates';
import { parseAmount } from './format';
import { todayCount } from './money';
import { clone, fail, initialState, type ActionResult, type AppState } from './types';

/** "Monthly salary" → Save. */
export function setIncome(s: AppState, amount: string): ActionResult {
  const v = parseAmount(amount);
  if (!(v > 0)) return fail('Enter income amount');
  return { ok: true, state: { ...s, income: v }, toast: 'Income saved 💰' };
}

/**
 * "Save second currency": `cur` '' means none. A new currency starts from the typed balance (0 if
 * empty); the same currency only takes a new balance when one is typed.
 */
export function setSecondCurrency(s: AppState, cur: string, balance: string): ActionResult {
  if (cur === s.cur) return fail('Pick a currency different from your main one');
  const v = balance.trim() === '' ? NaN : parseAmount(balance);
  const n = clone(s);
  if (cur && cur !== n.cur2) {
    n.cur2 = cur;
    n.start2 = v >= 0 ? v : 0;
  } else if (cur && !isNaN(v)) n.start2 = v;
  if (!cur) n.cur2 = null;
  return { ok: true, state: n, toast: 'Second currency saved' };
}

/** Age (optional): 10–119 is kept, anything else clears it. Returns the new state and the field's text. */
export function setAge(s: AppState, raw: string): { state: AppState; field: string } {
  const ag = parseInt(raw, 10);
  const n = clone(s);
  if (ag >= 10 && ag < 120) {
    n.age = ag;
    return { state: n, field: String(ag) };
  }
  delete n.age;
  return { state: n, field: '' };
}

/** "Make backup": the whole state as text. */
export const backupText = (s: AppState) => JSON.stringify(s);
export const BACKUP_READY = 'Backup ready, copy the text 📋';

/** "Import": a backup must have a numeric starting balance and a list of expenses. */
export function importBackup(text: string): ActionResult {
  try {
    const d = JSON.parse(text);
    if (!d || typeof d.start !== 'number' || !Array.isArray(d.exp)) throw new Error('not a backup');
    return { ok: true, state: { ...initialState, ...d, v: 1 }, toast: 'Data imported ✅' };
  } catch {
    return fail("That text isn't a valid backup");
  }
}

/** "Reset everything": back to a brand-new app (the intro runs again). */
export function resetAll(): ActionResult {
  return { ok: true, state: { ...initialState }, toast: 'Everything deleted. Fresh start!' };
}

/** Reminder on / off (keeps the time; 20:00 by default). */
export function setReminder(s: AppState, on: boolean, time?: string): ActionResult {
  const rem = { on, time: time || (s.rem && s.rem.time) || '20:00' };
  return { ok: true, state: { ...s, rem }, toast: on ? 'Reminder on' : 'Reminder off' };
}
export function setReminderTime(s: AppState, time: string): AppState {
  return { ...s, rem: { on: !!(s.rem && s.rem.on), time } };
}

/**
 * Home shows the reminder (prototype remChk) once its time has passed today, when nothing was logged
 * today, today wasn't checked in, and it wasn't answered with "I didn't spend today".
 */
export function reminderDue(s: AppState, now: number): boolean {
  const R = s.rem;
  if (!R || !R.on) return false;
  const d = new Date(now);
  const [h, m] = (R.time || '20:00').split(':').map(Number);
  const due = d.getHours() * 60 + d.getMinutes() >= h * 60 + m;
  const k = dayKey(now);
  return due && todayCount(s, now) === 0 && !(s.chk || {})[k] && s.remDis !== k;
}

export const REMINDER_TITLE = "You haven't logged any expenses today";
export const REMINDER_TEXT = 'Log them now while you remember.';
