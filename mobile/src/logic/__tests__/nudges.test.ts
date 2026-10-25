import { NUDGES, NUDGES_GENTLE, nudgeHours, nudgeTimes, pickNudge, QUIET_FROM, QUIET_UNTIL, reminderTimes } from '../nudges';
import { initialState, type AppState } from '../types';

// 25 Oct 2026, 10:30 on the phone's clock (jest runs in the machine's time zone; the logic uses local hours too).
const NOW = new Date(2026, 9, 25, 10, 30).getTime();
const hour = (t: number) => new Date(t).getHours();
const day = (t: number) => new Date(t).getDate();

describe('nudges: when', () => {
  test('every 6, 12 or 24 hours from 9:00, never at night', () => {
    expect(nudgeHours(6)).toEqual([9, 15, 21]);
    expect(nudgeHours(12)).toEqual([9, 21]);
    expect(nudgeHours(24)).toEqual([9]);
  });

  test('no nudge between 23:00 and 9:00, for 10 days, only times still ahead', () => {
    for (const every of [6, 12, 24] as const) {
      const ts = nudgeTimes(NOW, every);
      expect(ts.every((t) => hour(t) >= QUIET_UNTIL && hour(t) < QUIET_FROM)).toBe(true);
      expect(ts.every((t) => t > NOW)).toBe(true);
      expect(new Set(ts.map(day)).size).toBe(every === 24 ? 9 : 10); // at 10:30 today's 9:00 is gone; 6 h and 12 h still have 21:00 today
    }
    const six = nudgeTimes(NOW, 6);
    expect(six.slice(0, 3).map(hour)).toEqual([15, 21, 9]); // today 9:00 is already past
    expect(six.length).toBe(29);
  });

  test('late in the evening the next one is tomorrow at 9', () => {
    const late = new Date(2026, 9, 25, 22, 59).getTime();
    const [first] = nudgeTimes(late, 6);
    expect([day(first), hour(first)]).toEqual([26, 9]);
  });
});

describe('nudges: which text, by roast level', () => {
  const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
  const hard = NUDGES.filter((x) => x[0] === '!').map((x) => x.slice(1));
  const normal = NUDGES.filter((x) => x[0] !== '!');

  test('15 texts in all', () => {
    expect(NUDGES_GENTLE.length + NUDGES.length).toBe(15);
  });

  test('Gentle: only the gentle ones', () => {
    for (let i = 0; i < 50; i++) expect(NUDGES_GENTLE).toContain(pickNudge(0));
  });

  test('Normal: never the strong ones', () => {
    for (let i = 0; i < 200; i++) expect(normal).toContain(pickNudge(1));
  });

  test('No mercy: strong about 70% of the time, the "!" marker is never shown', () => {
    expect(hard).toContain(pickNudge(2, seq(0.69, 0)));
    expect(normal).toContain(pickNudge(2, seq(0.7, 0)));
    let strong = 0;
    for (let i = 0; i < 4000; i++) {
      const t = pickNudge(2);
      expect(t.startsWith('!')).toBe(false);
      if (hard.includes(t)) strong++;
    }
    expect(strong / 4000).toBeGreaterThan(0.65);
    expect(strong / 4000).toBeLessThan(0.75);
  });
});

describe('expense reminder: when', () => {
  const s = (over: Partial<AppState>): AppState => ({ ...initialState, rem: { on: true, time: '20:00' }, ...over });

  test('off: nothing', () => {
    expect(reminderTimes({ ...initialState }, NOW)).toEqual([]);
    expect(reminderTimes(s({ rem: { on: false, time: '20:00' } }), NOW)).toEqual([]);
  });

  test('every day at the chosen time, starting today', () => {
    const ts = reminderTimes(s({ rem: { on: true, time: '20:15' } }), NOW);
    expect(ts.length).toBe(10);
    expect(ts.every((t) => new Date(t).getHours() === 20 && new Date(t).getMinutes() === 15)).toBe(true);
    expect(day(ts[0])).toBe(25);
  });

  test('not today once something is logged today, "I didn’t spend" is checked, or the card was answered', () => {
    const logged = s({ exp: [{ amt: 4, cat: 'Coffee', t: NOW - 3600_000, note: 'latte' }] });
    expect(day(reminderTimes(logged, NOW)[0])).toBe(26);
    expect(day(reminderTimes(s({ chk: { '2026-10-25': 1 } }), NOW)[0])).toBe(26);
    expect(day(reminderTimes(s({ remDis: '2026-10-25' }), NOW)[0])).toBe(26);
  });

  test('time already past today: from tomorrow', () => {
    expect(day(reminderTimes(s({ rem: { on: true, time: '08:00' } }), NOW)[0])).toBe(26);
  });
});
