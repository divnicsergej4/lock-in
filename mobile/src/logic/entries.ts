// Logging, editing and deleting expenses and income (prototype handlers e-go, a-go, ed-ok and the ✕ in history).

import { days, fmt, parseAmount } from './format';
import { convert } from './money';
import { expenseMessage } from './roasts';
import { streakInfo } from './streak';
import { clone, fail, type ActionResult, type AppState } from './types';

export interface ExpenseInput {
  amount: string | number;
  cat: string;
  note: string;
  sub?: boolean; // monthly subscription
  envId?: string; // pay from this envelope
  inSecond?: boolean; // amount is in the second currency
}

/** Logs an expense. The toast is the roast (FORE.md) plus the streak line when it was the first entry today. */
export function addExpense(s: AppState, input: ExpenseInput, now: number, rand: () => number = Math.random): ActionResult {
  const a = parseAmount(input.amount);
  const c = input.cat;
  if (!(a > 0)) return fail('Enter the amount.');
  if (!c) return fail('You have to say what it was spent on.');
  const note = input.note.trim();
  if (!note) return fail('Enter a description (e.g. lunch with a friend).');

  const before = streakInfo(s, now);
  const n = clone(s);
  const second = !!(input.inSecond && n.cur2);
  const e = {
    amt: second ? convert(n, a) : a,
    ...(second ? { oa: a, c2: true } : {}),
    cat: c,
    t: now,
    sub: !!input.sub,
    note,
  } as AppState['exp'][number];
  n.exp.push(e);
  const env = (n.env || []).find((x) => x.id === input.envId);
  if (env) {
    const take = Math.min(env.b, e.amt);
    env.b -= take;
    e.env = env.id;
    e.envAmt = take;
  }

  let toast = expenseMessage(n, e, now, rand);
  const after = streakInfo(n, now);
  if (!before.todayChecked && after.n > 0) toast += '\n🔥 Day logged: ' + after.n + ' ' + days(after.n) + ' in a row';
  return { ok: true, state: n, toast };
}

export interface IncomeInput {
  amount: string | number;
  type: string; // 'Salary' | 'Gift'
  note: string;
  inSecond?: boolean;
}

export function addIncome(s: AppState, input: IncomeInput, now: number): ActionResult {
  const v = parseAmount(input.amount);
  const note = input.note.trim();
  if (!(v > 0)) return fail('Enter the amount');
  if (!input.type) return fail('Choose: salary or gift');
  if (!note) return fail('Enter a description');
  const n = clone(s);
  n.ins = n.ins || [];
  const second = !!(input.inSecond && n.cur2);
  if (second) n.ins.push({ amt: convert(n, v), oa: v, c2: true, t: now, type: input.type, note });
  else {
    n.added = (n.added || 0) + v;
    n.ins.push({ amt: v, t: now, type: input.type, note });
  }
  const toast = 'Added ' + fmt(v) + ' ' + (second ? n.cur2 : n.cur) + ' 💰' + ((n.env || []).length ? '\nSplit it into envelopes under Savings.' : '');
  return { ok: true, state: n, toast };
}

/** Deletes an expense; money it took from an envelope goes back into that envelope. */
export function deleteExpense(s: AppState, i: number): AppState {
  const n = clone(s);
  const x = n.exp[i];
  if (!x) return n;
  const env = x.env ? (n.env || []).find((e) => e.id === x.env) : undefined;
  if (env) env.b += x.envAmt || 0;
  n.exp.splice(i, 1);
  return n;
}

export function deleteIncome(s: AppState, i: number): AppState {
  const n = clone(s);
  const x = n.ins[i];
  if (!x) return n;
  if (!x.c2) n.added = (n.added || 0) - x.amt;
  n.ins.splice(i, 1);
  return n;
}

export interface EditInput {
  amount: string | number;
  note: string;
  cat: string; // category for an expense, type ('Salary' / 'Gift') for income
}

/** The pencil in history. The amount is edited in the currency it was logged in. */
export function editEntry(s: AppState, kind: 'exp' | 'ins', i: number, input: EditInput): ActionResult {
  const v = parseAmount(input.amount);
  const note = input.note.trim();
  if (!(v > 0)) return fail('Enter the amount');
  if (!note) return fail('Enter a description');
  const n = clone(s);
  if (kind === 'exp') {
    const e = n.exp[i];
    if (!e) return fail('Enter the amount');
    e.cat = input.cat;
    setAmount(n, e, v);
    e.note = note;
  } else {
    const e = n.ins[i];
    if (!e) return fail('Enter the amount');
    if (!e.c2) n.added = (n.added || 0) - e.amt + v;
    e.type = input.cat;
    setAmount(n, e, v);
    e.note = note;
  }
  return { ok: true, state: n, toast: 'Updated ✅' };
}

function setAmount(s: AppState, e: { amt: number; oa?: number; c2?: boolean }, v: number) {
  if (e.c2) {
    e.oa = v;
    e.amt = convert(s, v);
  } else e.amt = v;
}

/** The value the edit form starts with: the amount in the currency it was logged in. */
export function editAmount(e: { amt: number; oa?: number; c2?: boolean }): string {
  return String(e.c2 ? e.oa : e.amt);
}
