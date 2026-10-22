// Monthly report grade (More tab). Texts: docs/FORE.md, section 5.

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
