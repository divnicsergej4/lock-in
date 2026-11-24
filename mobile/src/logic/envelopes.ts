// Envelopes and goals (Savings tab: the drawer with coloured folders).

import { rateText, rateTo } from './afford';
import { CATEGORY_COLORS } from './categories';
import { formatDate } from './dates';
import { fmt, parseAmount } from './format';
import { envelopeSum, freeBalance } from './money';
import { clone, fail, type ActionResult, type AppState, type Envelope } from './types';

/** Folder colour: by position in the drawer. */
export const envelopeColor = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

export interface NewEnvelope {
  name: string;
  target?: string | number; // goal amount, optional
  deadlineIn?: string | number; // how many units from today
  unit?: 'd' | 'm' | 'y'; // days, months, years (default months)
}

export function createEnvelope(s: AppState, input: NewEnvelope, now: number, id = 'e' + now.toString(36)): ActionResult {
  const name = input.name.trim();
  if (!name) return fail('Enter an envelope name');
  const t = parseAmount(input.target ?? '');
  const k = Math.round(parseAmount(input.deadlineIn ?? ''));
  const d = new Date(now);
  let due = 0;
  if (k > 0)
    due = (
      input.unit === 'd'
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + k)
        : input.unit === 'y'
          ? new Date(d.getFullYear() + k, d.getMonth(), d.getDate())
          : new Date(d.getFullYear(), d.getMonth() + k, d.getDate())
    ).getTime();
  const n = clone(s);
  (n.env = n.env || []).push({ id, n: name, b: 0, t: t > 0 ? t : 0, due: t > 0 ? due : 0 });
  return { ok: true, state: n, toast: 'Envelope “' + name + '” created. Put some money in it.' };
}

/** "+ Add": only free money can go in. */
export function putIn(s: AppState, i: number, amount: string | number): ActionResult {
  const v = parseAmount(amount);
  if (!s.env[i]) return fail('Enter the amount');
  if (!(v > 0)) return fail('Enter the amount');
  const fr = freeBalance(s);
  if (v > fr) return fail('You don’t have that much free money. Free: ' + fmt(Math.max(fr, 0)) + ' ' + s.cur);
  const n = clone(s);
  const e = n.env[i];
  e.b += v;
  return { ok: true, state: n, toast: 'Added ' + fmt(v) + ' ' + n.cur + ' to “' + e.n + '”' + (e.t > 0 && e.b >= e.t ? '\nGoal reached! 🎉' : '') };
}

/** "− Take out": at most what is inside; it goes back to free money. */
export function takeOut(s: AppState, i: number, amount: string | number): ActionResult {
  let v = parseAmount(amount);
  if (!s.env[i]) return fail('Enter the amount');
  if (!(v > 0)) return fail('Enter the amount');
  const n = clone(s);
  const e = n.env[i];
  v = Math.min(v, e.b);
  e.b -= v;
  return { ok: true, state: n, toast: 'Took ' + fmt(v) + ' ' + n.cur + ' out of “' + e.n + '”. Back in free money.' };
}

export function deleteEnvelope(s: AppState, i: number): ActionResult {
  const n = clone(s);
  n.env.splice(i, 1);
  return { ok: true, state: n, toast: 'Envelope deleted. Its money is free again.' };
}

/** Sum typed into the "split free money" form (empty and non-positive fields count as 0). */
function distributionTotal(amounts: (string | number)[]): number {
  return amounts.reduce<number>((t, x) => {
    const v = parseAmount(x);
    return v > 0 ? t + v : t;
  }, 0);
}

/** Free money left while the user fills in the split form. */
export function leftUnassigned(s: AppState, amounts: (string | number)[]): number {
  return freeBalance(s) - distributionTotal(amounts);
}

export const leftUnassignedLine = (s: AppState, amounts: (string | number)[]) => 'Left unassigned: ' + fmt(leftUnassigned(s, amounts)) + ' ' + s.cur;

/** Splits free money into envelopes; `amounts[i]` goes to envelope i. */
export function distribute(s: AppState, amounts: (string | number)[]): ActionResult {
  if (leftUnassigned(s, amounts) < 0) return fail('You’re assigning more than you have free.');
  const n = clone(s);
  let sum = 0;
  amounts.forEach((x, i) => {
    const v = parseAmount(x);
    if (v > 0 && n.env[i]) {
      n.env[i].b += v;
      sum += v;
    }
  });
  return { ok: true, state: n, toast: sum > 0 ? 'Assigned ' + fmt(sum) + ' ' + n.cur + ' 💪' : 'Nothing assigned.' };
}

/** The folder taken out of the drawer: amount, goal bar and the line under it. */
export function envelopeCard(s: AppState, e: Envelope, now: number): { amount: string; progress: number; text: string } {
  const p = e.t > 0 ? Math.min(100, Math.round((e.b / e.t) * 100)) : 0;
  const missing = fmt(e.t - e.b) + ' ' + s.cur;
  let text: string;
  if (!(e.t > 0)) text = 'No goal, just money set aside.';
  else if (e.b >= e.t) text = 'Goal reached 🎉';
  else {
    const rt = e.due ? rateTo(e.t - e.b, e.due, now) : null;
    text =
      'Goal ' +
      fmt(e.t) +
      ' ' +
      s.cur +
      ', ' +
      (rt
        ? rt.past
          ? 'the deadline has passed, ' + missing + ' still missing.'
          : rt.today
            ? 'the deadline is today, ' + missing + ' still missing.'
            : 'deadline ' + formatDate(e.due) + '. Put in about ' + rateText(rt, s.cur) + '.'
        : missing + ' still missing.');
  }
  return { amount: fmt(e.b), progress: p, text };
}

/** Front of the drawer: "3 envelopes, 450 EUR". */
export function drawerLabel(s: AppState): string {
  const k = (s.env || []).length;
  return k + ' ' + (k === 1 ? 'envelope' : 'envelopes') + ', ' + fmt(envelopeSum(s)) + ' ' + s.cur;
}

export const DRAWER_EMPTY = 'The drawer is empty. Create your first envelope below.';
export const DRAWER_CLOSED_HINT = 'The drawer is closed. Pull the handle down or tap it.';
export const DRAWER_OPEN_HINT = 'Tap an envelope to take it out. Push the handle up to close the drawer.';
export const PAY_FROM_FREE = 'No, from free money';

/** First envelope with an unfinished goal (the prototype's S.goal). */
export function currentGoal(s: AppState): Envelope | null {
  return (s.env || []).find((e) => e.t > 0 && e.b < e.t) || null;
}
