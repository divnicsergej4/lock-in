// Data for the Spending tab: the three ring panels (donut, 30-day line, calendar) and the list of all
// transactions. Same numbers as the prototype's dnRender, lnRender, cal and txRender.

import { allCategories, categoryColor } from './categories';
import { day0, daysInMonth } from './dates';
import { fmt } from './format';
import { dayInOut, monthByCategory } from './money';
import type { AppState } from './types';

// ---------------- donut: top 5 categories this month ----------------

export const DONUT_R = 88;
export const DONUT_C = 2 * Math.PI * DONUT_R;

export interface DonutArc {
  cat: string;
  color: string;
  width: number; // stroke width (20 for the selected one, 14 otherwise)
  dash: number; // visible length
  gap: number; // the rest of the circle
  offset: number; // stroke-dashoffset
  round: boolean; // round line caps (more than one category)
}

export interface Donut {
  month: string; // "Oct 2026"
  empty: boolean;
  arcs: DonutArc[];
  selected: string;
  selectedAmount: number;
  caption: string; // "Top 5 categories this month"
  rows: { cat: string; color: string; pct: number; amount: number; on: boolean }[];
}

/** `selected`: the category the user tapped (falls back to the biggest). */
export function donut(s: AppState, now: number, selected?: string): Donut {
  const a = monthByCategory(s, 0, now);
  const ks = Object.keys(a.byCat)
    .sort((x, y) => a.byCat[y] - a.byCat[x])
    .slice(0, 5);
  const month = new Date(now).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (!ks.length) return { month, empty: true, arcs: [], selected: '', selectedAmount: 0, caption: '', rows: [] };
  let tot = 0;
  ks.forEach((k) => (tot += a.byCat[k]));
  const s0 = selected && ks.includes(selected) ? selected : ks[0];
  const n = ks.length;
  const g = n > 1 ? 10 : 0;
  const mn = n > 1 ? 38 : 0;
  // every arc gets at least 38 px of circle so small categories stay visible; the rest is shared out
  const raw = ks.map((k) => (a.byCat[k] / tot) * DONUT_C);
  let fix = 0;
  let fr = 0;
  raw.forEach((v) => (v < mn ? (fix += mn) : (fr += v)));
  const sc = fr > 0 ? (DONUT_C - fix) / fr : 1;
  const A = raw.map((v) => (v < mn ? mn : v * sc));
  let off = 0;
  const arcs = ks.map((k, i) => {
    const sw = k === s0 ? 20 : 14;
    const L = n > 1 ? Math.max(A[i] - g - sw, 0.5) : DONUT_C;
    const arc = { cat: k, color: categoryColor(s, k), width: sw, dash: L, gap: DONUT_C - L, offset: -(off + g / 2 + (n > 1 ? sw / 2 : 0)), round: n > 1 };
    off += A[i];
    return arc;
  });
  return {
    month,
    empty: false,
    arcs,
    selected: s0,
    selectedAmount: a.byCat[s0],
    caption: 'Top ' + n + ' categories this month',
    rows: ks.map((k) => ({ cat: k, color: categoryColor(s, k), pct: Math.round((a.byCat[k] / a.total) * 100), amount: a.byCat[k], on: k === s0 })),
  };
}

export const DONUT_EMPTY = 'No expenses this month.';

// ---------------- line: money in and out over the last 30 days ----------------

export interface LineDay {
  t: number;
  i: number;
  o: number;
  c: number; // running total (in − out) since the first of the 30 days
}

export interface LineChart {
  W: number;
  H: number;
  days: LineDay[];
  points: [number, number][];
  zeroY: number;
  length: number; // of the line, for the draw-in
  labels: { x: number; text: string; anchor: 'start' | 'middle' | 'end' }[];
  received: number;
  spent: number;
  saved: number; // received − spent (negative = in the red)
  x: (k: number) => number;
  y: (v: number) => number;
}

const P = 8; // padding inside the chart
export const LINE_LABEL_SPACE = 16; // room under the chart for the dates
const dl = (t: number) => {
  const d = new Date(t);
  return d.getDate() + '.' + (d.getMonth() + 1) + '.';
};

export function lineChart(s: AppState, now: number, W: number, H: number): LineChart {
  const n = 30;
  const d0 = new Date(day0(now));
  const days: LineDay[] = [];
  let c = 0;
  let received = 0;
  let spent = 0;
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - i).getTime();
    const io = dayInOut(s, t);
    c += io.i - io.o;
    received += io.i;
    spent += io.o;
    days.push({ t, i: io.i, o: io.o, c });
  }
  const cs = days.map((x) => x.c);
  const mn = Math.min(0, ...cs);
  const mx = Math.max(0, ...cs);
  const rg = mx - mn || 1;
  const x = (k: number) => P + (k * (W - 2 * P)) / (n - 1);
  const y = (v: number) => H - P - ((v - mn) / rg) * (H - 2 * P);
  const points = days.map((d, k) => [x(k), y(d.c)] as [number, number]);
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return {
    W,
    H,
    days,
    points,
    zeroY: y(0),
    length,
    labels: [
      { x: P, text: dl(days[0].t), anchor: 'start' },
      { x: x(15), text: dl(days[15].t), anchor: 'middle' },
      { x: W - P, text: 'today', anchor: 'end' },
    ],
    received,
    spent,
    saved: received - spent,
    x,
    y,
  };
}

/** Text under the chart for one day, in parts so the numbers can be coloured. */
export function lineTip(d: LineDay): { date: string; received: string; spent: string; label: string; net: string; saved: boolean } {
  const dn = d.i - d.o;
  return { date: dl(d.t), received: fmt(d.i), spent: fmt(d.o), label: dn >= 0 ? 'saved' : 'minus', net: fmt(Math.abs(dn)), saved: dn >= 0 };
}

export const LINE_HINT = 'Tap the chart, or hold your finger and drag, to see each day.';

// ---------------- calendar: spending per day of a month ----------------

export interface CalendarCell {
  day: number; // 0 = empty cell before the 1st
  amount: number;
  label: string; // "12", "1.2K"
  alpha: number; // green background strength (0 = no spending)
  today: boolean;
}

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function calendar(s: AppState, year: number, month: number, now: number): { title: string; cells: CalendarCell[]; total: number } {
  const dim = daysInMonth(new Date(year, month, 1).getTime());
  const off = (new Date(year, month, 1).getDay() + 6) % 7;
  const v = new Array(dim + 1).fill(0);
  let total = 0;
  s.exp.forEach((x) => {
    const d = new Date(x.t);
    if (d.getFullYear() === year && d.getMonth() === month) {
      v[d.getDate()] += x.amt;
      total += x.amt;
    }
  });
  let mx = 1;
  v.forEach((a) => (mx = Math.max(mx, a)));
  const td = new Date(now);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < off; i++) cells.push({ day: 0, amount: 0, label: '', alpha: 0, today: false });
  for (let i = 1; i <= dim; i++) {
    const a = v[i];
    cells.push({
      day: i,
      amount: a,
      label: a >= 1000 ? (a / 1000).toFixed(1) + 'K' : String(Math.round(a)),
      alpha: a > 0 ? +(0.25 + (0.65 * a) / mx).toFixed(2) : 0,
      today: td.getFullYear() === year && td.getMonth() === month && td.getDate() === i,
    });
  }
  const title = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' (' + fmt(total) + ' ' + s.cur + ')';
  return { title, cells, total };
}

/** What a tap on a calendar day shows. */
export function calendarDay(s: AppState, year: number, month: number, day: number): { head: string; summary: string; items: { cat: string; color: string; text: string }[]; more: string } {
  const t = new Date(year, month, day).getTime();
  const io = dayInOut(s, t);
  const nt = io.i - io.o;
  const r = s.exp.filter((x) => {
    const d = new Date(x.t);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
  return {
    head: day + '.' + (month + 1) + '.',
    summary: ' Received ' + fmt(io.i) + ', spent ' + fmt(io.o) + ', ' + (nt >= 0 ? 'saved ' + fmt(nt) : 'minus ' + fmt(-nt)),
    items: r.slice(0, 3).map((x) => ({ cat: x.cat, color: categoryColor(s, x.cat), text: ' ' + x.cat + ': ' + fmt(x.amt) })),
    more: r.length ? (r.length > 3 ? '… and ' + (r.length - 3) + ' more' : '') : 'No expenses that day.',
  };
}

// ---------------- all transactions ----------------

export type TxFilter = 'all' | 'in' | 'out';

export type TxRow =
  | { kind: 'date'; key: string; text: string }
  | { kind: 'tx'; key: string; ref: { list: 'exp' | 'ins'; i: number }; income: boolean; cat: string; color: string; icon: string; note: string; auto: boolean; amount: string };

/** Newest first, at most 150, with a date heading for each day ("21.10.2026."). */
export function transactions(s: AppState, filter: TxFilter): TxRow[] {
  const L: { k: 'o' | 'i'; i: number; a: number; t: number; c: string; n: string; au?: boolean; c2?: boolean; oa?: number }[] = [];
  if (filter !== 'in') s.exp.forEach((e, i) => L.push({ k: 'o', i, a: e.amt, t: e.t, c: e.cat, n: e.note || '', au: e.auto, c2: e.c2, oa: e.oa }));
  if (filter !== 'out') (s.ins || []).forEach((e, i) => L.push({ k: 'i', i, a: e.amt, t: e.t, c: e.type || 'Salary', n: e.note || '', au: e.auto, c2: e.c2, oa: e.oa }));
  L.sort((x, y) => y.t - x.t);
  const rows: TxRow[] = [];
  let last = '';
  L.slice(0, 150).forEach((x) => {
    const d = new Date(x.t);
    const ds = d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() + '.';
    if (ds !== last) {
      rows.push({ kind: 'date', key: 'd' + ds, text: ds });
      last = ds;
    }
    const income = x.k === 'i';
    rows.push({
      kind: 'tx',
      key: x.k + x.i,
      ref: { list: income ? 'ins' : 'exp', i: x.i },
      income,
      cat: x.c,
      color: income ? (x.c === 'Gift' ? '#ff7eb6' : '#22e07a') : categoryColor(s, x.c),
      icon: income ? (x.c === 'Gift' ? 'Gift' : 'Salary') : x.c,
      note: x.n,
      auto: !!x.au,
      amount: (income ? '+' : '−') + (x.c2 ? fmt(x.oa || 0) + ' ' + s.cur2 : fmt(x.a)),
    });
  });
  return rows;
}

export const TX_EMPTY = 'No transactions yet.';

/** Categories offered when editing an expense: the list, plus the expense's own if it isn't in it. */
export function editCategories(s: AppState, cat: string): string[] {
  const all = allCategories(s);
  return all.includes(cat) ? all : [...all, cat];
}

