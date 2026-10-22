import { editAmount } from '../entries';
import { currentGoal, deleteEnvelope, distribute, drawerLabel, leftUnassignedLine } from '../envelopes';
import { ordinal, parseAmount } from '../format';
import { accountLine, convert, spentLine } from '../money';
import { removePlanItem, setPlanItem, setPlanSave } from '../plan';
import { dropSubscription, recurringList, subscriptions } from '../recurring';
import type { Envelope } from '../types';
import { exp, NOW, state } from './helpers';

const env = (b: number, t = 0, n = 'Trip'): Envelope => ({ id: n, n, b, t, due: 0 });

describe('splitting free money into envelopes', () => {
  // Differs from the prototype on purpose: it read "12.5" as 125 (it dropped every dot).
  test('assigns typed amounts, skips empty ones', () => {
    const s = state({ start: 1000, env: [env(0, 0, 'A'), env(10, 0, 'B'), env(0, 0, 'C')] });
    const r = distribute(s, ['100', '', '12.5']);
    expect(r.ok && r.state.env.map((e) => e.b)).toEqual([100, 10, 12.5]);
    expect(r.ok && r.toast).toBe('Assigned 112.5 EUR 💪');
  });

  test('cannot assign more than is free', () => {
    const s = state({ start: 100, env: [env(60)] });
    expect(leftUnassignedLine(s, ['50'])).toBe('Left unassigned: -10 EUR');
    expect(distribute(s, ['50'])).toEqual({ ok: false, error: 'You’re assigning more than you have free.' });
  });

  test('nothing typed', () => {
    const r = distribute(state({ env: [env(0)] }), ['', '0']);
    expect(r.ok && r.toast).toBe('Nothing assigned.');
  });
});

describe('envelopes', () => {
  test('deleting frees its money', () => {
    const s = state({ start: 500, env: [env(200)] });
    const r = deleteEnvelope(s, 0);
    expect(r.ok && r.state.env).toEqual([]);
    expect(r.ok && r.toast).toBe('Envelope deleted. Its money is free again.');
    expect(s.env.length).toBe(1); // the original state is not changed
  });

  test('drawer label and the line under Available', () => {
    expect(drawerLabel(state({ env: [env(200)] }))).toBe('1 envelope, 200 EUR');
    expect(drawerLabel(state({ env: [env(200), env(1250.5)] }))).toBe('2 envelopes, 1,450.5 EUR');
    expect(accountLine(state({ start: 1000, env: [env(300)] }))).toBe('In your account 1,000 EUR, of which 300 in envelopes.');
    expect(accountLine(state({ start: 1000 }))).toBe('');
  });

  test('current goal = first unfinished envelope with a target', () => {
    expect(currentGoal(state({ env: [env(5), env(100, 100, 'Done'), env(20, 300, 'Car')] }))?.n).toBe('Car');
    expect(currentGoal(state({ env: [env(5)] }))).toBeNull();
  });
});

describe('money', () => {
  test('spent line', () => {
    expect(spentLine(state({ start: 1000, added: 200, exp: [exp(150, 'Food', NOW)] }))).toBe('Spent 150 of 1,200 EUR');
  });

  test('second currency converts at the prototype rates', () => {
    expect(convert(state({ cur: 'EUR', cur2: 'RSD' }), 1000)).toBeCloseTo(8.5, 9);
    expect(convert(state({ cur: 'EUR', cur2: null }), 1000)).toBe(1000);
  });

  test('editing shows the amount in the currency it was logged in', () => {
    expect(editAmount({ amt: 8.5, oa: 1000, c2: true })).toBe('1000');
    expect(editAmount({ amt: 12 })).toBe('12');
  });
});

describe('parsing and formatting', () => {
  test.each([
    ['1,250.50', 1250.5],
    ['1.250', 1250],
    ['12.000.000', 12000000],
    ['12.5', 12.5],
    ['1.25', 1.25],
    [' 40 ', 40],
  ])('%s -> %s', (raw, v) => expect(parseAmount(raw)).toBe(v));

  test.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [31, '31st'],
  ])('%s -> %s', (d, t) => expect(ordinal(d)).toBe(t));
});

describe('subscriptions', () => {
  const s = state({
    exp: [exp(9.99, 'Subscription', NOW, { sub: true, note: 'Netflix' }), exp(5, 'Food', NOW)],
    rec: [
      { k: 'o', cat: 'Subscription', amt: 10, day: 3, note: 'Spotify' },
      { k: 'o', cat: 'Rent', amt: 400, day: 1, note: 'Flat' },
    ],
  });

  test('list, sorted by day, with the yearly total', () => {
    const r = subscriptions(s);
    expect(r.list.map((q) => [q.name, q.line])).toEqual([
      ['Spotify', '10 a month, on the 3rd'],
      ['Netflix', '9.99 a month'],
    ]);
    expect(r.summary).toBe('You pay 19.99 EUR per month, which is 239.88 per year. Which of these do you actually use?');
  });

  test("Don't use it", () => {
    const [spotify, netflix] = subscriptions(s).list;
    const a = dropSubscription(s, netflix);
    expect(a.state.exp[0].sub).toBe(false);
    expect(a.toast).toBeUndefined();
    const b = dropSubscription(s, spotify);
    expect(b.state.rec.map((r) => r.note)).toEqual(['Flat']);
    expect(b.toast).toBe('Cancelled: Spotify. It won’t be logged every month anymore. Don’t forget to cancel it with them too.');
  });

  test('recurring list sorted by day', () => {
    expect(recurringList(s).map((r) => [r.day, r.note, r.amount])).toEqual([
      ['1st', 'Flat', '−400'],
      ['3rd', 'Spotify', '−10'],
    ]);
  });
});

describe('plan of the month', () => {
  test('items and savings goal', () => {
    const a = setPlanItem(state(), 'Coffee', '30');
    expect(a.ok && a.state.plan.items).toEqual({ Coffee: 30 });
    expect(setPlanItem(state(), 'Coffee', '0')).toEqual({ ok: false, error: 'Pick a category and enter an amount' });
    expect(removePlanItem(state({ plan: { items: { Coffee: 30 }, save: 0 } }), 'Coffee').plan.items).toEqual({});
    const b = setPlanSave(state(), '200');
    expect(b.ok && [b.state.plan.save, b.toast]).toEqual([200, 'Savings goal saved']);
    expect(setPlanSave(state(), '-1')).toEqual({ ok: false, error: 'Enter the amount' });
  });
});
