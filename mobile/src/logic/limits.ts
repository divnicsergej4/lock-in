// Monthly limit per category (Spending tab).

import { parseAmount } from './format';
import { monthByCategory } from './money';
import { clone, fail, type ActionResult, type AppState } from './types';

/** Sets a limit; 0 removes it. */
export function setLimit(s: AppState, cat: string | undefined, amount: string | number): ActionResult {
  const v = parseAmount(amount);
  if (!cat || isNaN(v)) return fail('Pick a category and enter an amount');
  const n = clone(s);
  n.lim = n.lim || {};
  if (v > 0) n.lim[cat] = v;
  else delete n.lim[cat];
  return { ok: true, state: n, toast: v > 0 ? 'Limit set 🎯' : 'Limit removed' };
}

export interface LimitRow {
  cat: string;
  spent: number;
  limit: number;
  pct: number; // can be over 100
  over: boolean; // red
  near: boolean; // amber, 80% or more
}

/** Limit bars, in the order the limits were set. */
export function limitRows(s: AppState, now: number): LimitRow[] {
  const o = monthByCategory(s, 0, now).byCat;
  return Object.keys(s.lim || {}).map((cat) => {
    const limit = s.lim[cat];
    const spent = o[cat] || 0;
    const pct = Math.round((spent / limit) * 100);
    return { cat, spent, limit, pct, over: pct > 100, near: pct <= 100 && pct >= 80 };
  });
}

export const LIMITS_HINT = 'Enter 0 to remove a limit.';
export const LIMITS_EMPTY = 'Set a monthly limit for a category, e.g. café 40.';
