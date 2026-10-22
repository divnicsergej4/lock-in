/** Money/number formatting like the prototype's fmt(): en-US grouping, up to 2 decimals. */
export function fmt(n: number): string {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function fmt0(n: number): string {
  return fmt(Math.round(n));
}

/**
 * Parses an amount typed by the user, like the prototype's num() in English mode:
 * spaces and thousands commas are dropped ("1,250.50" -> 1250.5).
 */
export function parseAmount(raw: string): number {
  const v = String(raw).trim().replace(/\s/g, '').replace(/,/g, '');
  return parseFloat(v);
}

export function pick<T>(a: readonly T[], rand: () => number = Math.random): T {
  return a[Math.floor(rand() * a.length)];
}
