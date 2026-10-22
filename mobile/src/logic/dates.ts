export const DAY_MS = 864e5;

/** Local midnight of the day `t` falls on. */
export function day0(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Midnight `n` calendar days after `t` (safe across DST changes). */
export function dAdd(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** Day key used for check-ins, same format as the prototype: "2026-10-22" without zero padding ("2026-1-5"). */
export function dayKey(t: number): string {
  const d = new Date(t);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/** Month key, e.g. "2026-10". */
export function monthKey(t: number): string {
  const d = new Date(t);
  return d.getFullYear() + '-' + (d.getMonth() + 1);
}

/** Months between the month of `t` and the month of `now` (0 = same month, -1 = last month). */
export function monthOffset(t: number, now: number): number {
  const a = new Date(t);
  const b = new Date(now);
  return a.getFullYear() * 12 + a.getMonth() - (b.getFullYear() * 12 + b.getMonth());
}

export function daysInMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** "Oct 22, 2026" */
export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
