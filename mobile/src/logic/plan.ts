// Plan of the month (Savings tab): planned spending per category + a savings goal.

import { daysInMonth } from './dates';
import { fmt, fmt0, parseAmount } from './format';
import { monthByCategory, monthlyIncome } from './money';
import { clone, fail, type ActionResult, type AppState } from './types';

export interface PlanCalc {
  inc: number;
  planned: number;
  save: number;
  free: number; // income − planned − savings
  unplanned: number; // spent this month in categories outside the plan
  rem: number; // free − unplanned
  perDay: number; // rem spread over the days left in the month (today included)
  items: Record<string, number>;
  spent: Record<string, number>;
}

export function planCalc(s: AppState, now: number): PlanCalc {
  const P = s.plan || { items: {}, save: 0 };
  const items = P.items || {};
  const inc = monthlyIncome(s);
  const spent = monthByCategory(s, 0, now).byCat;
  let planned = 0;
  let unplanned = 0;
  for (const k in items) planned += items[k];
  for (const k in spent) if (!(k in items)) unplanned += spent[k];
  const free = inc - planned - (P.save || 0);
  const daysLeft = daysInMonth(now) - new Date(now).getDate() + 1;
  return { inc, planned, save: P.save || 0, free, unplanned, rem: free - unplanned, perDay: (free - unplanned) / daysLeft, items, spent };
}

export type PlanStatus = 'no-income' | 'empty' | 'over-salary' | 'over-plan' | 'ok';

/** Plan card text: one hint line, or the calculation plus a status line. */
export function planText(s: AppState, now: number): { status: PlanStatus; lines: string[] } {
  const c = planCalc(s, now);
  const cu = ' ' + s.cur;
  if (c.inc <= 0) return { status: 'no-income', lines: ['Enter your monthly income on Home so I can calculate how much you can spend.'] };
  if (!Object.keys(c.items).length && !c.save) return { status: 'empty', lines: ['Add at least one planned expense or savings goal.'] };
  const lines = [
    'Salary ' + fmt(c.inc) + ' − planned ' + fmt(c.planned) + ' − savings ' + fmt(c.save) + ' = ' + fmt(c.free) + cu + ' free this month.',
    'Already spent outside the plan: ' + fmt(c.unplanned) + cu + '.',
  ];
  if (c.free < 0) return { status: 'over-salary', lines: [...lines, "The plan doesn't add up: expenses and savings exceed your salary🥀"] };
  if (c.rem < 0) return { status: 'over-plan', lines: [...lines, 'You went over the plan by ' + fmt(-c.rem) + cu + ', your savings goal is at risk... think about that'] };
  // The prototype shows "(oko N per day)" here: "oko" is a Serbian word its translation missed.
  return { status: 'ok', lines: [...lines, 'You can still spend ' + fmt(c.rem) + cu + ' (about ' + fmt0(c.perDay) + ' per day) and stay on track'] };
}

/** Planned categories with what was spent on them this month. */
export function planRows(s: AppState, now: number): { cat: string; spent: number; planned: number; pct: number; over: boolean }[] {
  const c = planCalc(s, now);
  return Object.keys(c.items).map((cat) => {
    const spent = c.spent[cat] || 0;
    const pct = Math.round((spent / c.items[cat]) * 100);
    return { cat, spent, planned: c.items[cat], pct, over: pct > 100 };
  });
}

export function setPlanItem(s: AppState, cat: string | undefined, amount: string | number): ActionResult {
  const v = parseAmount(amount);
  if (!cat || !(v > 0)) return fail('Pick a category and enter an amount');
  const n = clone(s);
  n.plan = n.plan || { items: {}, save: 0 };
  n.plan.items = n.plan.items || {};
  n.plan.items[cat] = v;
  return { ok: true, state: n, toast: '' };
}

export function removePlanItem(s: AppState, cat: string): AppState {
  const n = clone(s);
  if (n.plan && n.plan.items) delete n.plan.items[cat];
  return n;
}

export function setPlanSave(s: AppState, amount: string | number): ActionResult {
  const v = parseAmount(amount);
  if (isNaN(v) || v < 0) return fail('Enter the amount');
  const n = clone(s);
  n.plan = n.plan || { items: {}, save: 0 };
  n.plan.save = v;
  return { ok: true, state: n, toast: 'Savings goal saved' };
}
