// One formatter for the whole app, made once: on Android, Hermes runs Intl through Java, and
// toLocaleString() builds a new formatter on every call (slow enough to hold up taps when a screen shows
// many amounts). Same output as Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }).
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const seen = new Map<number, string>();

/** Money/number formatting like the prototype's fmt(): en-US grouping, up to 2 decimals. */
export function fmt(n: number): string {
  const v = Number(n);
  // 0 and -0 are one key in a Map but print differently
  if (v === 0) return NF.format(v);
  let s = seen.get(v);
  if (s === undefined) {
    if (seen.size > 5000) seen.clear();
    s = NF.format(v);
    seen.set(v, s);
  }
  return s;
}

export function fmt0(n: number): string {
  return fmt(Math.round(n));
}

/**
 * Parses an amount typed by the user, like the prototype's num() in English mode:
 * spaces and thousands commas are dropped ("1,250.50" -> 1250.5), and "1.250" or "12.000.000"
 * (dots as thousands separators) count as whole numbers.
 */
export function parseAmount(raw: string | number): number {
  let v = String(raw).trim().replace(/\s/g, '').replace(/,/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  return parseFloat(v);
}

/** "1st", "2nd", "3rd", "4th", "11th", "21st"... (prototype's suffix rule). */
export function ordinal(d: number): string {
  return d + (['st', 'nd', 'rd'][(((d + 90) % 100) - 10) % 10 - 1] || 'th');
}

/** "day" / "days" */
export function days(n: number): string {
  return n === 1 ? 'day' : 'days';
}

export function pick<T>(a: readonly T[], rand: () => number = Math.random): T {
  return a[Math.floor(rand() * a.length)];
}
