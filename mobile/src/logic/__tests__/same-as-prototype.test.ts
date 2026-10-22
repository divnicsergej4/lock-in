// Same results as the prototype: random states go through the real prototype code (index.html)
// and through the TypeScript port, and what the user would see must match.
// Known, deliberate differences are listed at the top of each test that has one.

import { AFFORD_NO_PRICE, canIAfford } from '../afford';
import { BASE_CATEGORIES } from '../categories';
import { addExpense, addIncome, deleteExpense, deleteIncome, editEntry } from '../entries';
import { createEnvelope, envelopeCard, putIn, takeOut } from '../envelopes';
import { parseAmount } from '../format';
import { PATTERNS_EMPTY, patterns, weeklyChallenge } from '../insights';
import { LIMITS_EMPTY, LIMITS_HINT, limitRows, setLimit } from '../limits';
import {
  currentBalance,
  daysOfData,
  envelopeSum,
  freeBalance,
  monthByCategory,
  monthSpent,
  secondBalance,
  todayCount,
  todayLine,
  totalSpent,
  upcomingFixed,
} from '../money';
import { planText } from '../plan';
import { addRecurring, DONT_USE_IT, processRecurring, subscriptions } from '../recurring';
import { monthReport, REPORT_EMPTY } from '../report';
import { pickRoast } from '../roasts';
import { categoryStreak, streakCard, streakInfo, tierUp } from '../streak';
import { initialState, type AppState } from '../types';
import { prototype, shown, TO_PROTO, trT, type Proto } from './prototype';

const RUNS = 250;
const DAY = 864e5;

// ---- seeded random ----
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOM = 'Vinyl';
const ALL_CATS = [...BASE_CATEGORIES, CUSTOM, 'Subscription'];

function gen(seed: number): { s: AppState; now: number; r: () => number } {
  const r = mulberry32(seed);
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const oneOf = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const money = () => (r() < 0.7 ? int(1, 300) : Math.round(r() * 30000) / 100);
  // any day of 2026, any hour (month starts and ends included)
  const now = new Date(2026, int(0, 11), oneOf([1, 2, 15, 22, 28, 30, 31]), int(0, 23), int(0, 59)).getTime();
  const cur = oneOf(['EUR', 'USD', 'RSD']);
  const cur2 = r() < 0.3 ? oneOf(['CHF', 'BAM', 'GBP']) : null;
  const t0 = now - int(0, 90) * DAY - int(0, 20) * 36e5;
  const exp: AppState['exp'] = [];
  const nExp = oneOf([0, 1, 3, 8, 20, 50]);
  for (let i = 0; i < nExp; i++) {
    const amt = money();
    const c2 = !!cur2 && r() < 0.15;
    exp.push({
      amt,
      cat: oneOf(ALL_CATS),
      t: now - Math.floor(r() * int(1, 75) * DAY),
      note: oneOf(['lunch', 'Netflix', 'taxi', 'x']),
      ...(r() < 0.1 ? { sub: true } : {}),
      ...(r() < 0.1 ? { auto: true } : {}),
      ...(c2 ? { c2: true, oa: Math.round(amt * 3) } : {}),
    });
  }
  exp.sort((a, b) => a.t - b.t);
  const ins: AppState['ins'] = [];
  for (let i = 0, n = int(0, 3); i < n; i++) {
    const c2 = !!cur2 && r() < 0.3;
    ins.push({ amt: money(), t: now - int(0, 60) * DAY, type: oneOf(['Salary', 'Gift']), note: 'pay', ...(c2 ? { c2: true, oa: int(10, 500) } : {}) });
  }
  const env: AppState['env'] = [];
  for (let i = 0, n = oneOf([0, 1, 2, 4]); i < n; i++) {
    const t = r() < 0.6 ? int(50, 3000) : 0;
    env.push({ id: 'e' + i, n: oneOf(['Trip', 'Car', 'Laptop', 'Rainy day']), b: int(0, 800), t, due: t && r() < 0.8 ? now + int(-20, 400) * DAY : 0 });
  }
  const lim: Record<string, number> = {};
  for (let i = 0, n = int(0, 3); i < n; i++) lim[oneOf(ALL_CATS)] = int(5, 400);
  const rec: AppState['rec'] = [];
  for (let i = 0, n = int(0, 4); i < n; i++) {
    const k = r() < 0.75 ? 'o' : 'i';
    const d = new Date(now);
    rec.push({
      k,
      cat: k === 'o' ? oneOf(['Gym', 'Rent', 'Subscription', 'Other']) : oneOf(['Salary', 'Gift']),
      amt: money(),
      day: int(1, 31),
      note: oneOf(['Spotify', 'Flat', 'Job', 'Gym club']),
      ...(r() < 0.4 ? { last: d.getFullYear() + '-' + (d.getMonth() + 1) } : {}),
    });
  }
  const chk: Record<string, 1> = {};
  for (let i = 0, n = int(0, 10); i < n; i++) {
    const d = new Date(now - int(0, 30) * DAY);
    chk[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()] = 1;
  }
  const items: Record<string, number> = {};
  for (let i = 0, n = int(0, 3); i < n; i++) items[oneOf(ALL_CATS)] = int(10, 500);
  const s: AppState = {
    ...initialState,
    cur,
    cur2,
    start: oneOf([0, 50, 300, 2000, 10000]) + int(0, 999),
    start2: cur2 ? int(0, 1000) : 0,
    added: ins.filter((x) => !x.c2).reduce((a, x) => a + x.amt, 0),
    income: r() < 0.6 ? oneOf([300, 1200, 2500, 5000]) : 0,
    age: r() < 0.7 ? int(14, 70) : undefined,
    roast: oneOf([0, 1, 2] as const),
    exp,
    ins,
    cats: [CUSTOM],
    env,
    lim,
    rec,
    chk,
    t0,
    tk0: 0,
    plan: { items, save: r() < 0.6 ? int(0, 800) : 0 },
    tierSeen: r() < 0.5 ? int(0, 8) : undefined,
  };
  return { s, now, r };
}

// ---- English state -> prototype S ----
const sr = (c: string) => TO_PROTO[c] || c;
const mapKeys = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [sr(k), v]));

function toProto(s: AppState): Record<string, any> {
  const p = JSON.parse(JSON.stringify(s));
  p.lang = 'en';
  p.exp.forEach((x: any) => (x.cat = sr(x.cat)));
  p.ins.forEach((x: any) => (x.type = sr(x.type)));
  p.rec.forEach((x: any) => (x.cat = sr(x.cat)));
  p.lim = mapKeys(p.lim);
  p.plan.items = mapKeys(p.plan.items);
  return p;
}

/** Comparable view of entries (the prototype stores flags as 1, the port as true). */
const normExp = (a: any[]) =>
  a.map((x) => ({ amt: x.amt, cat: sr(x.cat), t: x.t, note: x.note, sub: !!x.sub, auto: !!x.auto, c2: !!x.c2, oa: x.oa ?? null, env: x.env ?? null, envAmt: x.envAmt ?? null }));
const normIns = (a: any[]) => a.map((x) => ({ amt: x.amt, type: sr(x.type), t: x.t, note: x.note, auto: !!x.auto, c2: !!x.c2, oa: x.oa ?? null }));
const normRec = (a: any[]) => a.map((x) => ({ k: x.k, cat: sr(x.cat), amt: x.amt, day: x.day, note: x.note, last: x.last ?? null }));
const normEnv = (a: any[]) => a.map((x) => ({ id: x.id, n: x.n, b: x.b, t: x.t, due: x.due }));

const squash = (t: string) => t.replace(/\s+/g, '');

function setup(seed: number): { s: AppState; now: number; p: Proto; r: () => number } {
  const { s, now, r } = gen(seed);
  const p = prototype(now, mulberry32(seed + 1));
  p.S = toProto(s);
  return { s, now, p, r };
}

const seeds = Array.from({ length: RUNS }, (_, i) => i + 1);

describe('state and balance', () => {
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    expect(currentBalance(s)).toBeCloseTo(p.call('curBal'), 9);
    expect(envelopeSum(s)).toBeCloseTo(p.call('envSum'), 9);
    expect(freeBalance(s)).toBeCloseTo(p.call('freeBal'), 9);
    expect(secondBalance(s)).toBeCloseTo(p.call('bal2'), 9);
    expect(totalSpent(s)).toBeCloseTo(p.call('totalSpent'), 9);
    expect(daysOfData(s, now)).toBeCloseTo(p.call('dys'), 9);
    expect(monthSpent(s, now)).toBeCloseTo(p.call('monthSpent'), 9);
    expect(todayCount(s, now)).toBe(p.call('todayCount'));
    for (const k of [0, -1]) {
      const a = monthByCategory(s, k, now);
      const b = p.call('mcat', k);
      expect(mapKeys(a.byCat)).toEqual(b.o);
      expect(a.total).toBeCloseTo(b.t, 9);
    }
    expect(upcomingFixed(s, now)).toEqual(p.call('upcomingFixed'));
    p.call('todayCard');
    expect(squash(todayLine(s, now))).toBe(squash(shown(p.el('today').innerHTML).join('')));
  });
});

describe('streak, tiers and the streak card', () => {
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    const a = streakInfo(s, now);
    const b = p.call('streakInfo');
    expect(a.n).toBe(b.n);
    expect(a.todayChecked).toBe(!!b.td.chk);
    for (const c of ALL_CATS) expect(categoryStreak(s, c, now)).toBe(p.call('catStreak', sr(c)));

    const card = streakCard(s, now);
    const up = tierUp(s, now);
    p.call('streakCard');
    expect(String(card.n)).toBe(shown(p.el('sk-n').innerHTML).join(''));
    expect(card.label).toBe(shown(p.el('sk-l').innerHTML).join(''));
    expect(card.tierName).toBe(shown(p.el('sk-t').innerHTML).join(''));
    expect(card.progress + '%').toBe(p.el('sk-b').style.width);
    expect(card.message).toBe(shown(p.el('sk-m').innerHTML).join(''));
    expect(card.showNoSpend ? ['I didn’t spend anything today'] : []).toEqual(shown(p.el('sk-ck').innerHTML));
    expect(up.tierSeen).toBe(p.S.tierSeen);
    expect(up.toast ? [up.toast] : []).toEqual(p.toasts.map(trT));
  });
});

describe('challenge of the week, We noticed, subscriptions', () => {
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    p.call('extra');
    const ch = weeklyChallenge(s, now);
    expect(squash(ch.label + ch.title + ch.text)).toBe(squash(shown(p.el('chal').innerHTML).join('')));

    const pat = patterns(s, now);
    expect(pat.length ? pat : [PATTERNS_EMPTY]).toEqual(shown(p.el('pat').innerHTML));

    const sub = subscriptions(s);
    expect(squash(sub.list.map((q) => q.name + q.line + DONT_USE_IT).join('') + sub.summary)).toBe(squash(shown(p.el('subs').innerHTML).join('')));
  });
});

describe('limits', () => {
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    p.call('lims');
    const rows = limitRows(s, now);
    const ours = rows.length ? rows.map((x) => x.cat + x.spent.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '/' + x.limit.toLocaleString('en-US', { maximumFractionDigits: 2 })).join('') + LIMITS_HINT : LIMITS_EMPTY;
    expect(squash(ours)).toBe(squash(shown(p.el('l-out').innerHTML).join('')));
  });

  test.each(seeds.slice(0, 80))('setting a limit, seed %i', (seed) => {
    const { s, p, r } = setup(seed);
    const i = Math.floor(r() * ALL_CATS.length - 1);
    const cats = [...BASE_CATEGORIES, CUSTOM];
    const amount = ['40', '0', '12.5', '', 'abc', '1,000'][seed % 6];
    const a = setLimit(s, cats[i], amount);
    p.click('l-go', { 'l-cat': String(i), 'l-amt': amount });
    if (a.ok) {
      expect(mapKeys(a.state.lim)).toEqual(p.S.lim);
      expect([a.toast]).toEqual(p.toasts.map(trT));
    } else expect([a.error]).toEqual(p.toasts.map(trT));
  });
});

describe('monthly report', () => {
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    p.call('more');
    const rep = monthReport(s, now);
    const ours = rep ? [rep.spent, rep.top, rep.left, rep.verdict].filter(Boolean).join('') : REPORT_EMPTY;
    expect(squash(ours)).toBe(squash(shown(p.el('rep').innerHTML).join('')));
  });
});

describe('plan of the month', () => {
  // Known difference: the prototype shows "(oko N per day)"; "oko" is a Serbian word its translation missed.
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    p.call('planRender');
    const proto = shown(p.el('p-out').innerHTML).map((l) => l.replace(' (oko ', ' (about '));
    expect(planText(s, now).lines).toEqual(proto);
  });
});

describe('Can I afford it?', () => {
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p, r } = setup(seed);
    const price = [String(Math.round(r() * 3000)), String(Math.round(r() * 200) / 10), '0', '', '1,500'][seed % 5];
    const name = seed % 3 ? 'Phone' : '';
    p.click('w-go', { 'w-p': price, 'w-n': name });
    const v = parseAmount(price);
    const ours = v > 0 ? (({ verdict, lines }) => [verdict, ...lines])(canIAfford(s, v, name, now)) : [AFFORD_NO_PRICE];
    expect(ours).toEqual(shown(p.el('w-out').innerHTML));
  });
});

describe('picking a roast: every category × level × age × random roll', () => {
  const levels = [0, 1, 2] as const;
  const ages = [undefined, 15, 19, 20, 24, 34, 67, 119, 120];
  const rolls = [0, 0.2, 0.34, 0.5, 0.69, 0.7, 0.8, 0.99];
  test.each(ALL_CATS)('%s', (cat) => {
    const p = prototype(Date.now());
    for (const roast of levels)
      for (const age of ages)
        for (const r1 of rolls)
          for (const r2 of rolls) {
            const s = { roast, age };
            p.S = { lang: 'en', roast, age };
            const seq = () => {
              let i = 0;
              return () => [r1, r2][i++ % 2];
            };
            p.set('Math', Object.assign(Object.create(Math), { random: seq() }));
            expect(pickRoast(cat, s, seq())).toBe(trT(p.call('pickM', sr(cat))));
          }
  });
});

describe('logging an expense (roast text included, word for word)', () => {
  // Known difference: the 30% check uses the amount in the main currency; the prototype compared
  // the typed amount even when it was in the second currency. Only the main currency is tested here.
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p, r } = setup(seed);
    const cat = r() < 0.05 ? '' : ALL_CATS[Math.floor(r() * ALL_CATS.length)];
    const amount = r() < 0.05 ? '' : String([3, 12.5, 40, 120, 600, 5000][Math.floor(r() * 6)]);
    const note = r() < 0.05 ? '  ' : 'dinner';
    const env = s.env.length && r() < 0.4 ? s.env[Math.floor(r() * s.env.length)].id : '';
    const sub = r() < 0.2;
    const a = addExpense(s, { amount, cat, note, envId: env, sub }, now, mulberry32(seed * 7));
    p.set('Math', Object.assign(Object.create(Math), { random: mulberry32(seed * 7) }));
    p.click('e-go', { 'e-amt': amount, 'e-cat': sr(cat), 'e-note': note, 'e-env': env, 'e-sub': sub });
    if (!a.ok) {
      expect(a.error).toBe(trT(p.el('err').textContent));
      return;
    }
    expect(a.toast).toBe(trT(p.toasts[0]));
    expect(normExp(a.state.exp)).toEqual(normExp(p.S.exp));
    expect(normEnv(a.state.env)).toEqual(normEnv(p.S.env));
  });
});

describe('income, edit, delete', () => {
  test.each(seeds)('seed %i', (seed) => {
    const { s, now, p, r } = setup(seed);
    const second = !!s.cur2 && r() < 0.4;
    const amount = ['250', '0', '1,200', '12.75'][seed % 4];
    const type = r() < 0.1 ? '' : r() < 0.5 ? 'Salary' : 'Gift';
    const a = addIncome(s, { amount, type, note: 'pay', inSecond: second }, now);
    p.set('aCur', second ? 's' : 'm');
    p.click('a-go', { 'a-amt': amount, 'a-type': sr(type), 'a-note': 'pay' });
    expect(p.toasts.map(trT)).toEqual([a.ok ? a.toast : a.error]);
    if (a.ok) {
      expect(a.state.added).toBeCloseTo(p.S.added, 9);
      expect(normIns(a.state.ins)).toEqual(normIns(p.S.ins));
    }
  });

  test.each(seeds)('edit, seed %i', (seed) => {
    const { s, p, r } = setup(seed);
    const kind = s.ins.length && r() < 0.4 ? 'ins' : 'exp';
    const list = kind === 'exp' ? s.exp : s.ins;
    if (!list.length) return;
    const i = Math.floor(r() * list.length);
    const amount = ['33', '0', '7.5'][seed % 3];
    const note = seed % 11 ? 'edited' : '';
    const cat = kind === 'exp' ? ALL_CATS[Math.floor(r() * ALL_CATS.length)] : 'Gift';
    const a = editEntry(s, kind, i, { amount, note, cat });
    p.set('edK', (kind === 'exp' ? 'o' : 'i') + i);
    p.click('ed-ok', { 'ed-amt': amount, 'ed-note': note, 'ed-cat': sr(cat) });
    expect(p.toasts.map(trT)).toEqual([a.ok ? a.toast : a.error]);
    if (a.ok) {
      expect(normExp(a.state.exp)).toEqual(normExp(p.S.exp));
      expect(normIns(a.state.ins)).toEqual(normIns(p.S.ins));
      expect(a.state.added).toBeCloseTo(p.S.added, 9);
    }
  });

  test.each(seeds)('delete, seed %i', (seed) => {
    const { s, p, r } = setup(seed);
    const kind = s.ins.length && r() < 0.4 ? 'i' : 'o';
    const list = kind === 'o' ? s.exp : s.ins;
    if (!list.length) return;
    const i = Math.floor(r() * list.length);
    const n = kind === 'o' ? deleteExpense(s, i) : deleteIncome(s, i);
    const target = { closest: (q: string) => (q === '[data-tx]' ? { getAttribute: () => kind + i } : null) };
    p.click('hist', {}, { target });
    expect(normExp(n.exp)).toEqual(normExp(p.S.exp));
    expect(normIns(n.ins)).toEqual(normIns(p.S.ins));
    expect(normEnv(n.env)).toEqual(normEnv(p.S.env));
    expect(n.added).toBeCloseTo(p.S.added, 9);
  });
});

describe('recurring entries', () => {
  test.each(seeds)('logging what is due, seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    const n = processRecurring(s, now);
    p.call('recProcess');
    expect(normExp(n.exp)).toEqual(normExp(p.S.exp));
    expect(normIns(n.ins)).toEqual(normIns(p.S.ins));
    expect(normRec(n.rec)).toEqual(normRec(p.S.rec));
    expect(n.added).toBeCloseTo(p.S.added, 9);
  });

  test.each(seeds)('adding one, seed %i', (seed) => {
    const { s, now, p, r } = setup(seed);
    const kind = r() < 0.7 ? 'o' : 'i';
    const cat = kind === 'o' ? 'Rent' : 'Salary';
    const amount = ['450', '0', '9.99'][seed % 3];
    const day = ['1', '15', '31', '0', '40', '22'][seed % 6];
    const note = seed % 13 ? 'Flat' : '';
    const a = addRecurring(s, { kind, amount, day, note, cat }, now);
    p.click('r-go', { 'r-k': kind, 'r-amt': amount, 'r-day': day, 'r-note': note, 'r-cat': sr(cat) });
    expect(p.toasts.map(trT)).toEqual([a.ok ? a.toast : a.error]);
    if (a.ok) expect(normRec(a.state.rec)).toEqual(normRec(p.S.rec));
  });
});

describe('envelopes', () => {
  test.each(seeds)('card, seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    s.env.forEach((e, i) => {
      const c = envelopeCard(s, e, now);
      const proto = shown(p.call('envCard', p.S.env[i], i)).slice(0, 2).join('');
      expect(squash(e.n + c.amount + s.cur + c.text)).toBe(squash(proto));
    });
  });

  test.each(seeds)('create, seed %i', (seed) => {
    const { s, now, p } = setup(seed);
    const input = { name: seed % 17 ? 'Trip' : ' ', target: ['600', '', '0', '1,500'][seed % 4], deadlineIn: ['3', '', '0', '14'][seed % 4], unit: (['d', 'm', 'y'] as const)[seed % 3] };
    const a = createEnvelope(s, input, now);
    p.click('en-go', { 'en-n': input.name, 'en-t': input.target, 'en-k': input.deadlineIn, 'en-u': input.unit });
    expect(p.toasts.map(trT)).toEqual([a.ok ? a.toast : a.error]);
    if (a.ok) expect(normEnv(a.state.env)).toEqual(normEnv(p.S.env));
  });

  test.each(seeds)('put in / take out, seed %i', (seed) => {
    const { s, p, r } = setup(seed);
    if (!s.env.length) return;
    const i = Math.floor(r() * s.env.length);
    const mode = r() < 0.5 ? 'in' : 'out';
    const amount = ['50', '0', '100000', '12.5'][seed % 4];
    const a = mode === 'in' ? putIn(s, i, amount) : takeOut(s, i, amount);
    p.set('envMode', { [i]: mode });
    const btn = { getAttribute: (k: string) => (k === 'data-ea' ? 'ok' : String(i)) };
    p.click('env-list', { ['envv' + i]: amount }, { target: { closest: (q: string) => (q === '[data-ea]' ? btn : null) } });
    expect(p.toasts.map(trT)).toEqual([a.ok ? a.toast : a.error]);
    if (a.ok) expect(normEnv(a.state.env)).toEqual(normEnv(p.S.env));
  });
});
