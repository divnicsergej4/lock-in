import { canCheckInNoSpend, checkIn, streakInfo, TIERS, tierIndex } from '../streak';
import { at, exp, NOW, state } from './helpers';

describe('streak', () => {
  test('starts at 1 on the first day', () => {
    expect(streakInfo(state({ t0: NOW, tk0: 0 }), NOW).n).toBe(1);
  });

  test('today counts even before anything is logged', () => {
    const s = state({ t0: at(2026, 10, 21), exp: [exp(5, 'Food', at(2026, 10, 21))] });
    expect(streakInfo(s, NOW)).toEqual({ n: 2, todayChecked: false });
  });

  test('a missed day puts the flame out', () => {
    const s = state({ t0: at(2026, 10, 18), exp: [exp(5, 'Food', at(2026, 10, 18)), exp(5, 'Food', at(2026, 10, 19)), exp(5, 'Food', at(2026, 10, 21))] });
    expect(streakInfo(s, NOW).n).toBe(2); // 21st and today; the 20th was missed
  });

  test('"I didn\'t spend anything today" counts as a checked day', () => {
    const s = state({ t0: at(2026, 10, 20), exp: [exp(5, 'Food', at(2026, 10, 20))], chk: { '2026-10-21': 1 } });
    expect(streakInfo(s, NOW).n).toBe(3);
  });

  test('automatic entries do not keep the streak alive', () => {
    const s = state({ t0: at(2026, 10, 20), exp: [exp(5, 'Food', at(2026, 10, 20)), exp(9, 'Bills', at(2026, 10, 21), { auto: true })] });
    expect(streakInfo(s, NOW).n).toBe(1);
  });

  test('checkIn marks today with the prototype day key', () => {
    expect(checkIn(state(), NOW)).toEqual({ '2026-10-22': 1 });
    expect(checkIn(state(), at(2026, 1, 5))).toEqual({ '2026-1-5': 1 });
  });

  test('no-spend button only from 20:00 and only if today is not checked', () => {
    const s = state({ t0: at(2026, 10, 22) });
    expect(canCheckInNoSpend(s, at(2026, 10, 22, 19, 59))).toBe(false);
    expect(canCheckInNoSpend(s, at(2026, 10, 22, 20, 0))).toBe(true);
    expect(canCheckInNoSpend({ ...s, chk: { '2026-10-22': 1 } }, at(2026, 10, 22, 21))).toBe(false);
    expect(canCheckInNoSpend({ ...s, exp: [exp(5, 'Food', at(2026, 10, 22, 9))] }, at(2026, 10, 22, 21))).toBe(false);
  });
});

describe('tiers', () => {
  test.each([
    [0, 'Orange flame'],
    [4, 'Orange flame'],
    [5, 'Blue flame'],
    [10, 'Red flame'],
    [14, 'Golden flame'],
    [30, 'Purple flame'],
    [60, 'Lock-in green flame'],
    [90, 'Diamond flame'],
    [120, 'Rainbow flame'],
    [365, 'Legendary flame 🗿'],
    [1000, 'Legendary flame 🗿'],
  ])('%s days -> %s', (n, name) => expect(TIERS[tierIndex(n)].name).toBe(name));
});
