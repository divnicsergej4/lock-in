// Monthly report (More tab). Texts: docs/FORE.md, section 5.

import { fmt } from './format';
import { monthByCategory, monthlyIncome } from './money';
import type { AppState } from './types';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F' | '–';

export const GRADE_LINES: Record<Grade, string> = {
  A: "That's how it's done 💪",
  B: 'Solid, but we know you can do better.',
  C: 'Average. Your goal is watching',
  D: "You've almost spent it all, bro...",
  F: 'You spent more than you earned. stop.',
  '–': 'I need more data for a real verdict.',
};

export const REPORT_EMPTY = 'No expenses this month.';

/**
 * With an income: share of it spent this month. Without one: compared to last month.
 * Returns null when nothing was spent this month.
 */
export function monthGrade(s: AppState, now: number): { grade: Grade; line: string } | null {
  const a = monthByCategory(s, 0, now);
  const b = monthByCategory(s, -1, now);
  if (!Object.keys(a.byCat).length) return null;
  const inc = monthlyIncome(s);
  let g: Grade;
  if (inc > 0) {
    const r = a.total / inc;
    g = r <= 0.5 ? 'A' : r <= 0.7 ? 'B' : r <= 0.9 ? 'C' : r <= 1 ? 'D' : 'F';
  } else if (b.total > 0) {
    const r = a.total / b.total;
    g = r <= 0.9 ? 'A' : r <= 1 ? 'B' : r <= 1.2 ? 'C' : 'D';
  } else g = '–';
  return { grade: g, line: GRADE_LINES[g] };
}

export interface MonthReport {
  grade: Grade;
  spent: string; // "Spent 420 EUR (+12% vs last month)."
  topCat: string;
  top: string; // "Most goes to Coffee (85)."
  left: string | null; // "You have left 380." (only with a monthly income)
  verdict: string;
}

/** The whole report card; null when nothing was spent this month (show REPORT_EMPTY). */
export function monthReport(s: AppState, now: number): MonthReport | null {
  const g = monthGrade(s, now);
  if (!g) return null;
  const a = monthByCategory(s, 0, now);
  const b = monthByCategory(s, -1, now);
  const inc = monthlyIncome(s);
  const ks = Object.keys(a.byCat).sort((x, y) => a.byCat[y] - a.byCat[x]);
  const topCat = ks[0];
  return {
    grade: g.grade,
    spent: 'Spent ' + fmt(a.total) + ' ' + s.cur + (b.total > 0 ? ' (' + (a.total >= b.total ? '+' : '') + Math.round((a.total / b.total - 1) * 100) + '% vs last month)' : '') + '.',
    topCat,
    top: 'Most goes to ' + topCat + ' (' + fmt(a.byCat[topCat]) + ').',
    left: inc > 0 ? 'You have left ' + fmt(inc - a.total) + '.' : null,
    verdict: g.line,
  };
}
