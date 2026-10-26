import { LOGGED_HOUR, NUDGES, nudgePlan, reminderTimes, rotationText, STREAK_NUDGE } from '../nudges';
import { initialState, type AppState } from '../types';

// 25 Oct 2026 on the phone's clock (jest runs in the machine's time zone; the logic uses local hours too).
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const NOW = at(25, 8, 30);
const hour = (t: number) => new Date(t).getHours();
const day = (t: number) => new Date(t).getDate();
const s = (over: Partial<AppState> = {}): AppState => ({ ...initialState, ...over });
const logged = (t: number) => s({ exp: [{ amt: 4, cat: 'Coffee', t, note: 'latte' }] });

describe('Sergej’s texts, exactly', () => {
  test('11 in the rotation, the streak one apart', () => {
    expect(NUDGES).toEqual([
      'remember what you’re saving for, g',
      'every bit you don’t spend today goes to your goal😉',
      'these ‘small’ purchases add up by the end of the month',
      'boy, you gonna save up a little bit or what?',
      'lock in. no random buys today. stay focused.',
      'your goal won’t fund itself. keep going 💪',
      'future you is watching. make them proud 😌',
      'a coffee here, a snack there… it all counts',
      'skip one thing today. your savings will thank you',
      'today’s a good day to spend nothing 😌',
      'you don’t need it. you just saw it.',
    ]);
    expect(STREAK_NUDGE).toBe('you’ve been doing good. don’t ruin the streak now 🔥');
    expect(NUDGES).not.toContain(STREAK_NUDGE);
  });
});

describe('when', () => {
  test('nothing logged: 9, 15 and 20 every day; 20 is always the streak one', () => {
    const plan = nudgePlan(s(), NOW);
    expect(plan.slice(0, 3).map((p) => [day(p.at), hour(p.at)])).toEqual([[25, 9], [25, 15], [25, 20]]);
    expect(plan.length).toBe(30); // 10 days × 3
    for (const p of plan) {
      expect([9, 15, 20]).toContain(hour(p.at));
      if (hour(p.at) === 20) expect(p.body).toBe(STREAK_NUDGE);
      else expect(NUDGES).toContain(p.body);
    }
  });

  test('something logged today: the rest of today is dropped, one comes at 21 instead; tomorrow starts over', () => {
    const now = at(25, 12);
    const plan = nudgePlan(logged(at(25, 11)), now);
    const today = plan.filter((p) => day(p.at) === 25);
    expect(today.map((p) => hour(p.at))).toEqual([LOGGED_HOUR]);
    expect(NUDGES).toContain(today[0].body);
    expect(plan.filter((p) => day(p.at) === 26).map((p) => hour(p.at))).toEqual([9, 15, 20]);
  });

  test('"I didn’t spend anything today" counts as logged (it keeps the streak)', () => {
    const plan = nudgePlan(s({ chk: { '2026-10-25': 1 } }), at(25, 20, 30));
    expect(plan.filter((p) => day(p.at) === 25).map((p) => hour(p.at))).toEqual([21]);
  });

  test('nothing logged and it is already 20:30: nothing more today (21 is only for logged days)', () => {
    const plan = nudgePlan(s(), at(25, 20, 30));
    expect(day(plan[0].at)).toBe(26);
  });

  test('never at night', () => {
    for (const p of [...nudgePlan(s(), NOW), ...nudgePlan(logged(NOW), NOW)]) {
      expect(hour(p.at)).toBeGreaterThanOrEqual(9);
      expect(hour(p.at)).toBeLessThan(23);
    }
  });

  test('the rotation never repeats a text twice in a row and uses all of them', () => {
    const slots: number[] = [];
    for (let d = 1; d <= 20; d++) for (const h of [9, 15, 21]) slots.push(at(d, h));
    const texts = slots.map(rotationText);
    for (let i = 1; i < texts.length; i++) expect(texts[i]).not.toBe(texts[i - 1]);
    expect(new Set(texts).size).toBe(NUDGES.length);
  });
});

describe('expense reminder: when', () => {
  const r = (over: Partial<AppState>): AppState => s({ rem: { on: true, time: '20:00' }, ...over });

  test('off: nothing', () => {
    expect(reminderTimes(s(), NOW)).toEqual([]);
    expect(reminderTimes(r({ rem: { on: false, time: '20:00' } }), NOW)).toEqual([]);
  });

  test('every day at the chosen time, starting today', () => {
    const ts = reminderTimes(r({ rem: { on: true, time: '20:15' } }), NOW);
    expect(ts.length).toBe(10);
    expect(ts.every((t) => hour(t) === 20 && new Date(t).getMinutes() === 15)).toBe(true);
    expect(day(ts[0])).toBe(25);
  });

  test('not today once something is logged today, "I didn’t spend" is checked, or the card was answered', () => {
    expect(day(reminderTimes(r({ exp: [{ amt: 4, cat: 'Coffee', t: NOW - 3600_000, note: 'latte' }] }), NOW)[0])).toBe(26);
    expect(day(reminderTimes(r({ chk: { '2026-10-25': 1 } }), NOW)[0])).toBe(26);
    expect(day(reminderTimes(r({ remDis: '2026-10-25' }), NOW)[0])).toBe(26);
  });

  test('time already past today: from tomorrow', () => {
    expect(day(reminderTimes(r({ rem: { on: true, time: '08:00' } }), NOW)[0])).toBe(26);
  });
});
