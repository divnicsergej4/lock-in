import { initialState, type AppState, type Expense } from '../types';

/** Local time, so tests behave the same in every time zone. */
export const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

export const NOW = at(2026, 10, 22, 14);

export function state(over: Partial<AppState> = {}): AppState {
  return { ...initialState, start: 1000, t0: at(2026, 10, 1), ...over };
}

export function exp(amt: number, cat: string, t: number, over: Partial<Expense> = {}): Expense {
  return { amt, cat, t, note: 'test', ...over };
}

/** Deterministic "random": returns the given values in turn. */
export function seq(...v: number[]): () => number {
  let i = 0;
  return () => v[i++ % v.length];
}
