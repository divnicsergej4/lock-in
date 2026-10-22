// Recurring entries (rent, salary, subscriptions...) and the subscriptions list ("Don't use it").

import { daysInMonth, monthKey } from './dates';
import { fmt, ordinal, parseAmount } from './format';
import { clone, fail, type ActionResult, type AppState, type Recurring } from './types';

export const RECURRING_OUT_CATEGORIES = ['Gym', 'Rent', 'Subscription', 'Other'];
export const RECURRING_IN_CATEGORIES = ['Salary', 'Gift'];

/**
 * Logs every recurring entry whose day has come this month and that wasn't logged yet
 * (at noon on that day). Run it when the app opens and before anything is shown.
 * Returns the same object when nothing changed.
 */
export function processRecurring(s: AppState, now: number): AppState {
  const k = monthKey(now);
  const d = new Date(now);
  const dim = daysInMonth(now);
  let n: AppState | null = null;
  (s.rec || []).forEach((r0, i) => {
    if (r0.last === k) return;
    const dd = Math.min(r0.day, dim);
    if (d.getDate() < dd) return;
    n = n || clone(s);
    const r = n.rec[i];
    const t = new Date(d.getFullYear(), d.getMonth(), dd, 12).getTime();
    if (r.k === 'o') n.exp.push({ amt: r.amt, cat: r.cat, t, note: r.note || '', auto: true });
    else {
      n.added = (n.added || 0) + r.amt;
      (n.ins = n.ins || []).push({ amt: r.amt, t, type: r.cat, note: r.note || '', auto: true });
    }
    r.last = k;
  });
  return n || s;
}

export interface NewRecurring {
  kind: 'o' | 'i';
  amount: string | number;
  day: string | number;
  note: string;
  cat: string;
}

/** Adds a recurring entry. If its day already passed this month, the first one is logged next month. */
export function addRecurring(s: AppState, input: NewRecurring, now: number): ActionResult {
  const v = parseAmount(input.amount);
  const d = Math.round(parseAmount(input.day));
  const note = input.note.trim();
  if (!(v > 0)) return fail('Enter the amount');
  if (!(d >= 1 && d <= 31)) return fail('Enter a day from 1 to 31');
  if (!note) return fail('Enter a description');
  const today = new Date(now);
  const r: Recurring = { k: input.kind, amt: v, day: d, note, cat: input.cat };
  if (today.getDate() >= Math.min(d, daysInMonth(now))) r.last = monthKey(now);
  const n = clone(s);
  (n.rec = n.rec || []).push(r);
  const y = today.getFullYear();
  const m = today.getMonth() + (r.last ? 1 : 0);
  const first = new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
  return { ok: true, state: n, toast: 'First automatic entry: ' + first.getDate() + '.' + (first.getMonth() + 1) + '.' };
}

export function deleteRecurring(s: AppState, i: number): AppState {
  const n = clone(s);
  n.rec.splice(i, 1);
  return n;
}

/** Recurring list, sorted by day of month. `i` is the index in s.rec. */
export function recurringList(s: AppState): { i: number; day: string; note: string; cat: string; amount: string; income: boolean }[] {
  const R = s.rec || [];
  return R.map((_, i) => i)
    .sort((x, y) => R[x].day - R[y].day || x - y)
    .map((i) => {
      const r = R[i];
      const income = r.k !== 'o';
      return { i, day: ordinal(r.day), note: r.note || '', cat: r.cat, amount: (income ? '+' : '−') + fmt(r.amt), income };
    });
}

export const RECURRING_EMPTY = 'No recurring entries yet.';

// ---- subscriptions ----

export interface Subscription {
  name: string;
  cat: string;
  amt: number;
  day?: number;
  /** what "Don't use it" does */
  source: { kind: 'exp'; i: number } | { kind: 'rec'; i: number };
  line: string; // "9.99 a month, on the 5th"
}

/** Expenses marked as monthly subscriptions + recurring "Subscription" entries. */
export function subscriptions(s: AppState): { list: Subscription[]; total: number; summary: string } {
  const list: Subscription[] = [];
  let total = 0;
  s.exp.forEach((x, i) => {
    if (x.sub) {
      list.push({ name: x.note || x.cat, cat: x.cat, amt: x.amt, source: { kind: 'exp', i }, line: '' });
      total += x.amt;
    }
  });
  (s.rec || []).forEach((r, i) => {
    if (r.k === 'o' && r.cat === 'Subscription') {
      list.push({ name: r.note || '', cat: r.cat, amt: r.amt, day: r.day, source: { kind: 'rec', i }, line: '' });
      total += r.amt;
    }
  });
  list.sort((x, y) => (x.day || 99) - (y.day || 99));
  list.forEach((q) => (q.line = fmt(q.amt) + ' a month' + (q.day ? ', on the ' + ordinal(q.day) : '')));
  const summary = list.length
    ? 'You pay ' + fmt(total) + ' ' + s.cur + ' per month, which is ' + fmt(total * 12) + ' per year. Which of these do you actually use?'
    : 'Add a recurring entry with the “Subscription” category (above) or mark an expense as a monthly subscription and it will show up here.';
  return { list, total, summary };
}

export const DONT_USE_IT = "Don't use it";

/** "Don't use it": an expense stops being a subscription; a recurring one is cancelled. */
export function dropSubscription(s: AppState, sub: Subscription): { state: AppState; toast?: string } {
  const n = clone(s);
  if (sub.source.kind === 'exp') {
    if (n.exp[sub.source.i]) n.exp[sub.source.i].sub = false;
    return { state: n };
  }
  const r = n.rec[sub.source.i];
  if (!r) return { state: n };
  n.rec.splice(sub.source.i, 1);
  return { state: n, toast: 'Cancelled: ' + r.note + '. It won’t be logged every month anymore. Don’t forget to cancel it with them too.' };
}
