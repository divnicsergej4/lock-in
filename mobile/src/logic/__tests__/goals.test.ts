import {
  dayLabel, duration, emptySnapshot, goalsHeader, goalTags, goalView, introText, lastActivity, leaveText, money,
  nextPin, ofLine, paceCard, peopleLine, percent, pinChips, pinsPassed, putPreview, squadStreak, streakCard, timeAgo,
  weekStart, type Snapshot,
} from '../goals';
import { DEMO_GOAL, demoSnapshot } from '../goalsDemo';

// Wednesday 28 October 2026, 15:00 local time
const NOW = new Date(2026, 9, 28, 15, 0).getTime();
const H = 3600e3;
const D = 24 * H;
const iso = (t: number) => new Date(t).toISOString();

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    ...emptySnapshot('me'),
    names: { me: 'Sergej', m: 'Marko', a: 'Ana' },
    goals: [{ id: 'g', name: 'Summer trip to Greece', target: 2000, currency: 'EUR', deadline: '2027-05-01', created_at: iso(NOW - 60 * D) }],
    members: [
      { goal_id: 'g', user_id: 'me', joined_at: iso(NOW - 60 * D), added_by: 'me' },
      { goal_id: 'g', user_id: 'm', joined_at: iso(NOW - 60 * D + 1), added_by: 'me' },
      { goal_id: 'g', user_id: 'a', joined_at: iso(NOW - 16 * D), added_by: 'me' },
    ],
    ...over,
  };
}
let n = 0;
const c = (user_id: string, amount: number, t: number) => ({ id: 'c' + n++, goal_id: 'g', user_id, amount, note: null, created_at: iso(t) });

describe('money and time', () => {
  test('amounts like the design', () => {
    expect(money(1240, 'EUR')).toBe('1,240 €');
    expect(money(12.5, 'EUR')).toBe('12.5 €');
    expect(money(2000, 'USD')).toBe('$2,000');
    expect(money(1200, 'RSD')).toBe('1,200 RSD');
    expect(money(300, 'SEK')).toBe('300 kr');
  });

  test('the intro names the goal currency', () => {
    expect(introText('EUR')).toBe('Pick one thing to save for with your people. Every euro anyone puts in fills the ring. Hit the goal and the lock opens.');
    expect(introText('USD')).toContain('Every dollar anyone');
    expect(introText('SEK')).toContain('Every krona anyone');
  });

  test('activity times', () => {
    expect(timeAgo(NOW - 20e3, NOW)).toBe('now');
    expect(timeAgo(NOW - 5 * 60e3, NOW)).toBe('5m ago');
    expect(timeAgo(NOW - 2 * H, NOW)).toBe('2h ago');
    expect(timeAgo(NOW - 1 * D, NOW)).toBe('yesterday');
    expect(timeAgo(new Date(2026, 9, 26, 9).getTime(), NOW)).toBe('Mon');
    expect(timeAgo(new Date(2026, 9, 12, 9).getTime(), NOW)).toBe('Oct 12');
    expect(timeAgo(new Date(2025, 9, 12, 9).getTime(), NOW)).toBe('Oct 12, 2025');
    expect(dayLabel(NOW - H, NOW)).toBe('today');
    expect(dayLabel(NOW - D, NOW)).toBe('yesterday');
    expect(dayLabel(new Date(2026, 9, 12).getTime(), NOW)).toBe('Oct 12');
  });

  test('how long a goal took', () => {
    expect(duration(NOW - 183 * D, NOW)).toBe('6 months');
    expect(duration(NOW - 30 * D, NOW)).toBe('1 month');
    expect(duration(NOW - 21 * D, NOW)).toBe('3 weeks');
    expect(duration(NOW - 5 * D, NOW)).toBe('5 days');
    expect(duration(NOW - H, NOW)).toBe('1 day');
  });

  test('weeks start on Monday', () => {
    expect(new Date(weekStart(NOW)).toDateString()).toBe(new Date(2026, 9, 26).toDateString());
    expect(goalsHeader(2, 3)).toBe('2 goals · 3 friends');
    expect(goalsHeader(1, 1)).toBe('1 goal · 1 friend');
  });
});

describe('pins', () => {
  test('passed and next', () => {
    expect(pinsPassed(1240, 2000)).toEqual([25, 50]);
    expect(nextPin(1240, 2000)).toEqual({ pin: 75, away: 260 });
    expect(pinsPassed(2000, 2000)).toEqual([25, 50, 75, 100]);
    expect(nextPin(2000, 2000)).toEqual({ pin: null, away: 0 });
    expect(percent(1290, 2000)).toBe(65);
    expect(percent(1995, 2000)).toBe(99); // never 100% before the lock opens
  });
});

describe('the design example (Summer trip to Greece)', () => {
  const s = demoSnapshot(NOW);
  const v = goalView(s, DEMO_GOAL, NOW)!;

  test('totals, people and pins', () => {
    expect(v.members.map((m) => [m.name, m.total, m.color])).toEqual([
      ['Sergej', 520, '#22e07a'], ['Marko', 400, '#5aa9f0'], ['Ana', 320, '#ff7eb6'],
    ]);
    expect(v.saved).toBe(1240);
    expect(v.pct).toBe(62);
    expect(ofLine(v)).toBe('of 2,000 € · 62% · 760 € to go');
    expect(peopleLine(v, NOW)).toBe('3 people · due May 1');
    expect(pinChips(v).map((p) => p.t)).toEqual(['25% pin', '50% pin', '75% next · 260 € away']);
    expect(Math.round(v.fair)).toBe(667);
  });

  test('this week, streak and pace', () => {
    expect(v.members.map((m) => m.thisWeek)).toEqual([true, true, false]);
    expect(v.streak).toBe(3);
    expect(streakCard(v)).toEqual({ title: '3-week squad streak', text: "Everyone put something in. Ana, you're up this week." });
    const p = paceCard(v, NOW);
    expect(p.text).toBe('10 € a week each gets you there by May 1.');
  });

  test('Put money in with 50', () => {
    const p = putPreview(v, 50);
    expect(p.line).toBe('1,290 / 2,000 € · 65%');
    expect(p.note).toBe('Next pin at 75%: 210 € away');
    expect(p.rest).toBe(147);
    expect(p.streak).toBe(false); // I already put something in this week
    expect(putPreview(v, 760).note).toBe('This opens the lock 🔓');
  });

  test('activity and the card', () => {
    expect(v.activity[0].parts.map((x) => x.t).join('')).toBe('Marko put in 50 €');
    expect(lastActivity(v, NOW)).toEqual({ parts: [{ t: 'Marko', role: 'name' }, { t: ' put in 50 €', role: 'text' }], when: '2h ago' });
    const texts = v.activity.map((a) => a.parts.map((x) => x.t).join(''));
    expect(texts).toContain('The 50% pin clicked');
    expect(texts).toContain('Ana joined the goal');
    expect(texts).toContain('You put in 120 €');
    expect(v.activity.find((a) => a.parts[0].t === 'You put in 120 €')?.contributionId).toBeTruthy();
    expect(v.activity.find((a) => a.parts[0].t === 'Marko put in 50 €')?.contributionId).toBeUndefined();
    expect(leaveText(v)).toBe('If you leave, your 520 € is taken out of this goal. Everyone else keeps going.');
  });
});

describe('squad streak', () => {
  const ws = weekStart(NOW);
  test('a week someone missed breaks it; this week does not until it is over', () => {
    const s = snap({
      contributions: [
        c('me', 10, ws - 6 * D), c('m', 10, ws - 5 * D), c('a', 10, ws - 4 * D), // last week: all
        c('me', 10, ws - 13 * D), c('a', 10, ws - 12 * D), // two weeks ago: Marko missed
        c('me', 10, ws + H),
      ],
    });
    const v = goalView(s, 'g', NOW)!;
    expect(v.streak).toBe(1);
    expect(v.missing).toEqual(['m', 'a']);
    expect(streakCard(v).text).toBe("Everyone put something in. Marko and Ana, you're up this week.");
  });

  test('everyone this week counts at once', () => {
    const s = snap({ contributions: [c('me', 10, ws + H), c('m', 10, ws + H), c('a', 10, ws + H)] });
    const v = goalView(s, 'g', NOW)!;
    expect(v.streak).toBe(1);
    expect(streakCard(v)).toEqual({ title: '1-week squad streak', text: 'Everyone put something in this week.' });
  });

  test('no streak, and I am the one missing', () => {
    const s = snap({ contributions: [c('m', 10, ws + H), c('a', 10, ws + H)] });
    const v = goalView(s, 'g', NOW)!;
    expect(streakCard(v)).toEqual({ title: 'No squad streak yet', text: "Every week everyone puts something in, the streak grows. You're up this week." });
    const s2 = snap({ contributions: [c('a', 10, ws + H)] });
    expect(streakCard(goalView(s2, 'g', NOW)!).text).toContain('You and Marko are up this week.');
  });

  test('members only count from the week they joined; weeks before the goal do not count', () => {
    const mem = [{ goal_id: 'g', user_id: 'x', joined_at: iso(ws - 7 * D), added_by: null }];
    expect(squadStreak(mem, [c('x', 5, ws - 3 * D)], ws - 7 * D, NOW).weeks).toBe(1);
  });
});

describe('pace and tags', () => {
  test('behind, past due, no due date, done', () => {
    const behind = goalView(snap({ contributions: [c('me', 100, NOW - 50 * D)] }), 'g', NOW)!;
    expect(paceCard(behind, NOW).label).toBe('Behind');
    expect(goalTags(behind, NOW).map((t) => t.t)).toEqual(['Behind']);

    const g0 = snap().goals[0];
    const past = goalView(snap({ goals: [{ ...g0, deadline: '2026-10-01' }], contributions: [c('me', 100, NOW - D)] }), 'g', NOW)!;
    expect(paceCard(past, NOW)).toEqual({ label: 'Past due', good: false, text: '1,900 € still to go.' });

    const free = goalView(snap({ goals: [{ ...g0, deadline: null }], contributions: [c('me', 400, NOW - 7 * D)] }), 'g', NOW)!;
    // 400 in the last 4 weeks = 100 a week, 1,600 to go = 16 weeks
    expect(paceCard(free, NOW).text).toBe('At this pace: ~Feb 2027');
    const none = goalView(snap({ goals: [{ ...g0, deadline: null }] }), 'g', NOW)!;
    expect(paceCard(none, NOW)).toEqual({ label: 'No due date', good: true, text: 'Put money in to see your pace.' });
    expect(peopleLine(none, NOW)).toBe('3 people');

    const done = goalView(snap({ contributions: [c('me', 2000, NOW - D)] }), 'g', NOW)!;
    expect(done.unlocked).toBe(true);
    expect(paceCard(done, NOW).label).toBe('Done');
    expect(goalTags(done, NOW)[0].t).toBe('Unlocked');
    expect(done.activity.map((a) => a.parts.map((x) => x.t).join(''))).toContain('The lock opened');
  });

  test('close to the goal and close to the date', () => {
    const g0 = snap().goals[0];
    const v = goalView(snap({ goals: [{ ...g0, target: 200, deadline: '2026-11-06' }], contributions: [c('me', 170, NOW - D)] }), 'g', NOW)!;
    expect(goalTags(v, NOW).map((t) => t.t)).toEqual(['30 € to unlock', 'Due in 9 days']);
  });

  test('nudges show in the activity and the nudge button waits a day', () => {
    const s = snap({
      nudges: [
        { id: 'n1', goal_id: 'g', from_user: 'me', to_user: 'a', created_at: iso(NOW - H) },
        { id: 'n2', goal_id: 'g', from_user: 'm', to_user: 'me', created_at: iso(NOW - 2 * H) },
      ],
    });
    const v = goalView(s, 'g', NOW)!;
    expect(v.members.find((m) => m.id === 'a')?.nudgedToday).toBe(true);
    expect(v.members.find((m) => m.id === 'm')?.nudgedToday).toBe(false);
    const t = v.activity.map((a) => a.parts.map((x) => x.t).join(''));
    expect(t.slice(0, 2)).toEqual(['You nudged Ana', 'Marko nudged you']);
  });

  test('alone in a goal', () => {
    const s = snap({ members: [snap().members[0]] });
    expect(leaveText(goalView(s, 'g', NOW)!)).toBe("You're the only one here. If you leave, the goal is deleted.");
    expect(peopleLine(goalView(s, 'g', NOW)!, NOW)).toBe('1 person · due May 1');
  });
});
